import { Router, type Request, type Response } from "express";
import { ObjectId, type Collection, type Db } from "mongodb";
import { z } from "zod";
import { findAuthenticatedUser, type AuthRepository } from "./auth.js";
import type { ChildProfile, ChildProfileRepository } from "./childProfile.js";
import type { MongoClientProvider } from "./db.js";

const availableMinutes = [10, 20, 30] as const;
const currentStates = ["calm", "ready_to_play", "full_energy"] as const;
const constraints = ["small_space", "quiet", "low_mess", "mostly_independent"] as const;

export type CurrentState = typeof currentStates[number];
export type RecommendationConstraint = typeof constraints[number];

export interface RecommendationSelection {
  availableMinutes: typeof availableMinutes[number];
  currentState: CurrentState;
  constraints: RecommendationConstraint[];
  themeKey?: string;
}

interface Eligibility {
  ageBands: string[];
  interestKeys: string[];
  playStyleKeys: string[];
  energyLevels: string[];
  noiseLevel: string;
  messLevel: string;
  spaceLevel: string;
  independenceLevel: "independent_after_setup" | "check_in_occasionally" | "parent_guided";
}

interface RecommendationPreview {
  setupMinutes: number;
  imageUrl: string;
  imageAlt: string;
  materials: string[];
}

export interface RecommendationCandidate {
  id: string;
  title: string;
  summary: string;
  goal: string;
  supports: string[];
  durationMinutes: number;
  themeKey: string;
  eligibility: Eligibility;
  preview: RecommendationPreview;
}

export interface RecommendationCard {
  playPathId: string;
  title: string;
  summary: string;
  goal: string;
  supports: string[];
  durationMinutes: number;
  setupMinutes: number;
  parentEffort: Eligibility["independenceLevel"];
  imageUrl: string;
  imageAlt: string;
  materials: string[];
  matchType: "exact" | "best_available";
  playedBefore: boolean;
  explanation: string;
}

export interface RecommendationRepository {
  listPublished(): Promise<RecommendationCandidate[]>;
  findCompletedPlayPathIds(userId: string, childProfileId: string, candidateIds: string[]): Promise<string[]>;
}

interface RecommendationDocument {
  _id: { toHexString(): string };
  title: string;
  description: string;
  goal: string;
  supports: string[];
  durationMinutes: number;
  themeKey: string;
  eligibility: Eligibility;
  status: "draft" | "published" | "retired";
  guestPreview?: RecommendationPreview & { enabled: boolean; position: number };
}

function playPaths(db: Db): Collection<RecommendationDocument> {
  return db.collection<RecommendationDocument>("playPaths");
}

export function createMongoRecommendationRepository(
  mongo: MongoClientProvider,
  databaseName: string,
): RecommendationRepository {
  return {
    async findCompletedPlayPathIds(userId, childProfileId, candidateIds) {
      if (!ObjectId.isValid(userId) || !ObjectId.isValid(childProfileId) || !candidateIds.length) return [];
      const db = (await mongo.getClient()).db(databaseName);
      return db.collection("playSessions").distinct<string>("playPath.id", {
        userId: new ObjectId(userId), childProfileId: new ObjectId(childProfileId),
        status: "completed", "playPath.id": { $in: candidateIds },
      });
    },
    async listPublished() {
      const db = (await mongo.getClient()).db(databaseName);
      const documents = await playPaths(db)
        .find({ status: "published" })
        .sort({ "guestPreview.position": 1, _id: 1 })
        .toArray();

      return documents.map((document) => {
        if (!document.guestPreview) throw new Error("Published Play Path is missing card metadata");
        return {
          id: document._id.toHexString(),
          title: document.title,
          summary: document.description,
          goal: document.goal,
          supports: document.supports,
          durationMinutes: document.durationMinutes,
          themeKey: document.themeKey,
          eligibility: document.eligibility,
          preview: {
            setupMinutes: document.guestPreview.setupMinutes,
            imageUrl: document.guestPreview.imageUrl,
            imageAlt: document.guestPreview.imageAlt,
            materials: document.guestPreview.materials,
          },
        };
      });
    },
  };
}

const selectionSchema = z.object({
  availableMinutes: z.union(availableMinutes.map((value) => z.literal(value))),
  currentState: z.enum(currentStates),
  constraints: z.array(z.enum(constraints)).max(constraints.length).refine(
    (values) => new Set(values).size === values.length,
    "Choose each constraint only once.",
  ),
  themeKey: z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9_-]*$/u).optional(),
}).strict();

export function ageBand(profile: ChildProfile, now: Date) {
  const age = now.getUTCFullYear() - profile.birthYear
    - (now.getUTCMonth() + 1 < profile.birthMonth ? 1 : 0);
  return `${age}_${age + 1}`;
}

function constraintMatches(candidate: RecommendationCandidate, constraint: RecommendationConstraint) {
  const { eligibility } = candidate;
  if (constraint === "small_space") return eligibility.spaceLevel === "small";
  if (constraint === "quiet") return eligibility.noiseLevel === "quiet";
  if (constraint === "low_mess") return ["none", "low"].includes(eligibility.messLevel);
  return ["independent_after_setup", "check_in_occasionally"].includes(eligibility.independenceLevel);
}

const constraintLabels: Record<RecommendationConstraint, string> = {
  small_space: "small-space requirement",
  quiet: "quiet setting",
  low_mess: "low-mess requirement",
  mostly_independent: "mostly independent play",
};

function relaxedLabels(
  candidate: RecommendationCandidate,
  profile: ChildProfile,
  selection: RecommendationSelection,
) {
  const labels: string[] = [];
  if (!profile.interestKeys.some((key) => candidate.eligibility.interestKeys.includes(key))) {
    labels.push("preferred interests");
  }
  if (!profile.playStyleKeys.some((key) => candidate.eligibility.playStyleKeys.includes(key))) {
    labels.push("preferred play style");
  }
  if (candidate.durationMinutes > selection.availableMinutes) labels.push("available time");
  if (!candidate.eligibility.energyLevels.includes(selection.currentState)) labels.push("current energy");
  if (selection.themeKey && candidate.themeKey !== selection.themeKey) labels.push("preferred theme");
  for (const constraint of selection.constraints) {
    if (!constraintMatches(candidate, constraint)) labels.push(constraintLabels[constraint]);
  }
  return labels;
}

function scoreCandidate(candidate: RecommendationCandidate, profile: ChildProfile, selection: RecommendationSelection) {
  const interestMatches = profile.interestKeys.filter((key) => candidate.eligibility.interestKeys.includes(key)).length;
  const styleMatches = profile.playStyleKeys.filter((key) => candidate.eligibility.playStyleKeys.includes(key)).length;
  const energyMatch = candidate.eligibility.energyLevels.includes(selection.currentState);
  const themeMatch = selection.themeKey ? candidate.themeKey === selection.themeKey : false;
  const timeMatch = candidate.durationMinutes <= selection.availableMinutes;
  const durationDifference = Math.abs(selection.availableMinutes - candidate.durationMinutes);
  const durationScore = timeMatch
    ? Math.max(1, 8 - Math.floor(durationDifference / 5) * 2)
    : -Math.ceil(durationDifference / 5) * 2;
  const constraintMatchCount = selection.constraints.filter((value) => constraintMatches(candidate, value)).length;
  const relaxed = relaxedLabels(candidate, profile, selection);

  return {
    candidate,
    exact: relaxed.length === 0,
    relaxed,
    score: interestMatches * 4 + styleMatches * 3 + (energyMatch ? 3 : 0)
      + (themeMatch ? 4 : 0) + durationScore + constraintMatchCount * 2,
    interestMatches,
    styleMatches,
  };
}

export function rankRecommendations(
  candidates: RecommendationCandidate[],
  profile: ChildProfile,
  selection: RecommendationSelection,
  now = new Date(),
  completedPlayPathIds: ReadonlySet<string> = new Set(),
): RecommendationCard[] {
  const band = ageBand(profile, now);
  const ageSuitable = candidates.filter((candidate) => candidate.eligibility.ageBands.includes(band));
  const withinAvailableTime = ageSuitable.filter(
    (candidate) => candidate.durationMinutes <= selection.availableMinutes,
  );
  const candidatePool = withinAvailableTime.length > 0 ? withinAvailableTime : ageSuitable;
  const ranked = candidatePool
    .map((candidate) => scoreCandidate(candidate, profile, selection))
    .sort((left, right) => (
      Number(right.exact) - Number(left.exact)
      || Number(completedPlayPathIds.has(left.candidate.id)) - Number(completedPlayPathIds.has(right.candidate.id))
      || Math.abs(selection.availableMinutes - left.candidate.durationMinutes)
      - Math.abs(selection.availableMinutes - right.candidate.durationMinutes)
    )
      || right.score - left.score
      || left.candidate.id.localeCompare(right.candidate.id))
    .slice(0, 3);

  return ranked.map(({ candidate, exact, relaxed, interestMatches, styleMatches }) => {
    const personalReasons = [
      interestMatches > 0 ? "matches their interests" : "offers a fresh interest",
      styleMatches > 0 ? "fits their preferred way to play" : "adds a different way to play",
    ];
    const explanation = exact
      ? `A strong fit that ${personalReasons.join(" and ")}.`
      : `Closest suitable option; relaxes ${relaxed.join(" and ")} while it ${personalReasons[0]}.`;
    return {
      playPathId: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      goal: candidate.goal,
      supports: candidate.supports,
      durationMinutes: candidate.durationMinutes,
      setupMinutes: candidate.preview.setupMinutes,
      parentEffort: candidate.eligibility.independenceLevel,
      imageUrl: candidate.preview.imageUrl,
      imageAlt: candidate.preview.imageAlt,
      materials: candidate.preview.materials,
      matchType: exact ? "exact" : "best_available",
      playedBefore: completedPlayPathIds.has(candidate.id),
      explanation,
    };
  });
}

function validationError(response: Response, error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "request");
    fieldErrors[field] ??= issue.message;
  }
  response.status(400).json({
    error: { code: "VALIDATION_ERROR", message: "Please check the recommendation choices.", fieldErrors },
  });
}

export function createRecommendationRouter(options: {
  repository: RecommendationRepository;
  authRepository: AuthRepository;
  childProfiles: ChildProfileRepository;
  requireEmailVerification?: boolean;
  now?: () => Date;
}) {
  const router = Router();
  const now = options.now ?? (() => new Date());

  router.post("/recommendations", async (request: Request, response: Response) => {
    const parsed = selectionSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error);
      return;
    }

    try {
      const user = await findAuthenticatedUser(request, options.authRepository);
      if (!user) {
        response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } });
        return;
      }
      if ((options.requireEmailVerification ?? true) && !user.emailVerified) {
        response.status(403).json({
          error: { code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email to receive recommendations." },
        });
        return;
      }
      const profile = await options.childProfiles.findActiveByUserId(user.id);
      if (!profile) {
        response.status(409).json({
          error: { code: "CHILD_PROFILE_REQUIRED", message: "Create a child profile before requesting recommendations." },
        });
        return;
      }
      const candidates = await options.repository.listPublished();
      const completed = await options.repository.findCompletedPlayPathIds(user.id, profile.id, candidates.map(({ id }) => id));
      const recommendations = rankRecommendations(candidates, profile, parsed.data, now(), new Set(completed));
      response.json({ data: { recommendations } });
    } catch {
      response.status(503).json({
        error: { code: "RECOMMENDATIONS_UNAVAILABLE", message: "Recommendations are temporarily unavailable. Please try again." },
      });
    }
  });

  return router;
}
