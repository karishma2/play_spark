import { MongoServerError, ObjectId, type Db, type Document } from "mongodb";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { findAuthenticatedUser, type AuthRepository, type AuthUser } from "./auth.js";
import type { MongoClientProvider } from "./db.js";

export interface ProfileOption {
  key: string;
  label: string;
}

export interface ProfileOptions {
  interests: ProfileOption[];
  playStyles: ProfileOption[];
}

export interface ChildProfileInput {
  nickname?: string;
  birthMonth: number;
  birthYear: number;
  interestKeys: string[];
  playStyleKeys: string[];
}

export type ChildProfileUpdate = Partial<ChildProfileInput>;

export interface ChildProfile extends ChildProfileInput {
  id: string;
}

export interface ChildProfileRepository {
  listOptions(): Promise<ProfileOptions>;
  findActiveByUserId(userId: string): Promise<ChildProfile | null>;
  create(userId: string, input: ChildProfileInput): Promise<ChildProfile>;
  update(userId: string, input: ChildProfileUpdate): Promise<ChildProfile | null>;
}

export class ChildProfileAlreadyExistsError extends Error {}

const optionDocument = {
  bsonType: "object",
  required: ["kind", "key", "label", "position", "enabled", "createdAt", "updatedAt"],
  properties: {
    kind: { enum: ["interest", "play_style"] },
    key: { bsonType: "string" },
    label: { bsonType: "string" },
    position: { bsonType: "int", minimum: 1 },
    enabled: { bsonType: "bool" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

const childProfileDocument = {
  bsonType: "object",
  required: ["userId", "birthMonth", "birthYear", "interestKeys", "playStyleKeys", "isActive", "createdAt", "updatedAt"],
  properties: {
    userId: { bsonType: "objectId" },
    nickname: { bsonType: "string", maxLength: 40 },
    birthMonth: { bsonType: "int", minimum: 1, maximum: 12 },
    birthYear: { bsonType: "int" },
    interestKeys: { bsonType: "array", minItems: 1, uniqueItems: true, items: { bsonType: "string" } },
    playStyleKeys: { bsonType: "array", minItems: 1, uniqueItems: true, items: { bsonType: "string" } },
    isActive: { bsonType: "bool" },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: "date" },
  },
};

export async function ensureChildProfileCollections(db: Db) {
  const validators: Record<string, Document> = {
    childProfiles: { $jsonSchema: childProfileDocument },
    profileOptions: { $jsonSchema: optionDocument },
  };
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  for (const [name, validator] of Object.entries(validators)) {
    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    } else {
      await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    }
  }
  await Promise.all([
    db.collection("childProfiles").createIndex(
      { userId: 1, isActive: 1 },
      { unique: true, partialFilterExpression: { isActive: true } },
    ),
    db.collection("profileOptions").createIndex({ kind: 1, key: 1 }, { unique: true }),
    db.collection("profileOptions").createIndex(
      { kind: 1, position: 1 },
      { unique: true, partialFilterExpression: { enabled: true } },
    ),
  ]);
}

interface ProfileDocument extends Document {
  _id: ObjectId;
  nickname?: string;
  birthMonth: number;
  birthYear: number;
  interestKeys: string[];
  playStyleKeys: string[];
}

function toProfile(document: ProfileDocument): ChildProfile {
  return {
    id: document._id.toHexString(),
    ...(document.nickname ? { nickname: document.nickname } : {}),
    birthMonth: document.birthMonth,
    birthYear: document.birthYear,
    interestKeys: document.interestKeys,
    playStyleKeys: document.playStyleKeys,
  };
}

export function createMongoChildProfileRepository(
  mongo: MongoClientProvider,
  databaseName: string,
): ChildProfileRepository {
  async function database() {
    return (await mongo.getClient()).db(databaseName);
  }

  return {
    async listOptions() {
      const documents = await (await database()).collection("profileOptions")
        .find({ enabled: true })
        .sort({ kind: 1, position: 1 })
        .toArray();
      const result = {
        interests: documents
          .filter(({ kind }) => kind === "interest")
          .map(({ key, label }) => ({ key, label })),
        playStyles: documents
          .filter(({ kind }) => kind === "play_style")
          .map(({ key, label }) => ({ key, label })),
      };
      if (result.interests.length === 0 || result.playStyles.length === 0) {
        throw new Error("Profile options have not been seeded");
      }
      return result;
    },
    async findActiveByUserId(userId) {
      const document = await (await database()).collection<ProfileDocument>("childProfiles")
        .findOne({ userId: new ObjectId(userId), isActive: true });
      return document ? toProfile(document) : null;
    },
    async create(userId, input) {
      const db = await database();
      const now = new Date();
      try {
        const result = await db.collection("childProfiles").insertOne({
          userId: new ObjectId(userId),
          ...input,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        return { id: result.insertedId.toHexString(), ...input };
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) {
          throw new ChildProfileAlreadyExistsError();
        }
        throw error;
      }
    },
    async update(userId, input) {
      const setFields: Document = { updatedAt: new Date() };
      for (const key of ["birthMonth", "birthYear", "interestKeys", "playStyleKeys"] as const) {
        if (input[key] !== undefined) setFields[key] = input[key];
      }
      if (input.nickname) setFields.nickname = input.nickname;
      const update: Document = {
        $set: setFields,
      };
      if (Object.hasOwn(input, "nickname") && !input.nickname) update.$unset = { nickname: "" };
      const document = await (await database()).collection<ProfileDocument>("childProfiles")
        .findOneAndUpdate(
          { userId: new ObjectId(userId), isActive: true },
          update,
          { returnDocument: "after" },
        );
      return document ? toProfile(document) : null;
    },
  };
}

const uniqueKeys = z.array(z.string().min(1)).min(1).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: "custom", message: "Choose each option only once." });
  }
});

const profileInputSchema = z.object({
  nickname: z.string().trim().max(40).optional().transform((value) => value || undefined),
  birthMonth: z.number().int().min(1).max(12),
  birthYear: z.number().int(),
  interestKeys: uniqueKeys,
  playStyleKeys: uniqueKeys,
}).strict();

const profileUpdateSchema = profileInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one profile field to update." },
);

function validationError(response: Response, fieldErrors: Record<string, string>) {
  response.status(400).json({
    error: { code: "VALIDATION_ERROR", message: "Please check the highlighted fields.", fieldErrors },
  });
}

function zodValidationError(response: Response, error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  validationError(response, fieldErrors);
}

function ageInYears(birthMonth: number, birthYear: number, now: Date) {
  return now.getUTCFullYear() - birthYear - (now.getUTCMonth() + 1 < birthMonth ? 1 : 0);
}

function allowedKeys(options: ProfileOptions, input: ChildProfileUpdate) {
  const interestKeys = new Set(options.interests.map(({ key }) => key));
  const playStyleKeys = new Set(options.playStyles.map(({ key }) => key));
  const errors: Record<string, string> = {};
  if (input.interestKeys?.some((key) => !interestKeys.has(key))) {
    errors.interestKeys = "Choose interests from the available options.";
  }
  if (input.playStyleKeys?.some((key) => !playStyleKeys.has(key))) {
    errors.playStyleKeys = "Choose play styles from the available options.";
  }
  return errors;
}

export function createChildProfileRouter(options: {
  repository: ChildProfileRepository;
  authRepository: AuthRepository;
  requireEmailVerification?: boolean;
  now?: () => Date;
}) {
  const router = Router();
  const now = options.now ?? (() => new Date());

  async function verifiedUser(request: Request, response: Response): Promise<AuthUser | null> {
    const user = await findAuthenticatedUser(request, options.authRepository);
    if (!user) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
      return null;
    }
    if ((options.requireEmailVerification ?? true) && !user.emailVerified) {
      response.status(403).json({
        error: { code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email before managing a child profile." },
      });
      return null;
    }
    return user;
  }

  router.get("/profile-options", async (request, response) => {
    try {
      if (!await verifiedUser(request, response)) return;
      response.json({ data: await options.repository.listOptions() });
    } catch {
      response.status(503).json({ error: { code: "PROFILE_UNAVAILABLE", message: "Profile setup is temporarily unavailable. Please try again." } });
    }
  });

  router.get("/child-profile", async (request, response) => {
    try {
      const user = await verifiedUser(request, response);
      if (!user) return;
      const profile = await options.repository.findActiveByUserId(user.id);
      if (!profile) {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "No child profile has been created yet." } });
        return;
      }
      response.json({ data: profile });
    } catch {
      response.status(503).json({ error: { code: "PROFILE_UNAVAILABLE", message: "The child profile is temporarily unavailable. Please try again." } });
    }
  });

  router.post("/child-profile", async (request, response) => {
    const parsed = profileInputSchema.safeParse(request.body);
    if (!parsed.success) {
      zodValidationError(response, parsed.error);
      return;
    }
    const currentAge = ageInYears(parsed.data.birthMonth, parsed.data.birthYear, now());
    if (currentAge < 3 || currentAge > 5) {
      validationError(response, { birthYear: "Play Spark currently supports children aged 3 to 5." });
      return;
    }
    try {
      const user = await verifiedUser(request, response);
      if (!user) return;
      const availableOptions = await options.repository.listOptions();
      const optionErrors = allowedKeys(availableOptions, parsed.data);
      if (Object.keys(optionErrors).length > 0) {
        validationError(response, optionErrors);
        return;
      }
      const profile = await options.repository.create(user.id, parsed.data);
      response.status(201).json({ data: profile });
    } catch (error) {
      if (error instanceof ChildProfileAlreadyExistsError) {
        response.status(409).json({ error: { code: "CONFLICT", message: "A child profile already exists for this account." } });
        return;
      }
      response.status(503).json({ error: { code: "PROFILE_UNAVAILABLE", message: "We couldn't save the child profile. Please try again." } });
    }
  });

  router.patch("/child-profile", async (request, response) => {
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      zodValidationError(response, parsed.error);
      return;
    }
    try {
      const user = await verifiedUser(request, response);
      if (!user) return;
      const currentProfile = await options.repository.findActiveByUserId(user.id);
      if (!currentProfile) {
        response.status(404).json({ error: { code: "NOT_FOUND", message: "No child profile has been created yet." } });
        return;
      }
      const birthMonth = parsed.data.birthMonth ?? currentProfile.birthMonth;
      const birthYear = parsed.data.birthYear ?? currentProfile.birthYear;
      const currentAge = ageInYears(birthMonth, birthYear, now());
      if (currentAge < 3 || currentAge > 5) {
        validationError(response, { birthYear: "Play Spark currently supports children aged 3 to 5." });
        return;
      }
      const availableOptions = await options.repository.listOptions();
      const optionErrors = allowedKeys(availableOptions, parsed.data);
      if (Object.keys(optionErrors).length > 0) {
        validationError(response, optionErrors);
        return;
      }
      const profile = await options.repository.update(user.id, parsed.data);
      if (!profile) throw new Error("Active profile disappeared during update");
      response.json({ data: profile });
    } catch {
      response.status(503).json({ error: { code: "PROFILE_UNAVAILABLE", message: "We couldn't update the child profile. Please try again." } });
    }
  });

  return router;
}
