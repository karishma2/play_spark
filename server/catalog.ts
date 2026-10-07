import { ObjectId, type Collection, type Db } from "mongodb";
import type { MongoClientProvider } from "./db.js";

export interface GuestSampleSummary {
  id: string;
  title: string;
  summary: string;
  goal: string;
  supports: string[];
  durationMinutes: number;
  setupMinutes: number;
  parentEffort: "Low";
  messLevel: "None" | "Low";
  category: string;
  secondaryCategory: string;
  imageUrl: string;
  imageAlt: string;
  materials: string[];
  missionCount: number;
}

export interface GuestMission {
  id: string;
  title: string;
  durationMinutes: number;
  setupSteps: string[];
  sayThis: string;
  childChallenge: string;
  tidyUp: string;
  materials?: string[];
  wallElement: {
    key: string;
    label: string;
    revealMessage: string;
  };
  replacementMissionId?: string;
}

export type PublishedMission = Omit<GuestMission, "wallElement" | "replacementMissionId">;

export interface GuestSample extends Omit<GuestSampleSummary, "missionCount"> {
  safetyNote: string;
  wallSceneKey: string;
  missions: GuestMission[];
}

export interface CatalogRepository {
  listGuestSamples(): Promise<GuestSampleSummary[]>;
  findGuestSample(sampleId: string): Promise<GuestSample | null>;
  findPublishedPlayPath(playPathId: string): Promise<GuestSample | null>;
  findPublishedMission?(missionId: string): Promise<PublishedMission | null>;
}

interface GuestPreviewDocument {
  enabled: boolean;
  position: number;
  setupMinutes: number;
  parentEffort: "Low";
  messLevel: "None" | "Low";
  category: string;
  secondaryCategory: string;
  imageUrl: string;
  imageAlt: string;
  materials: string[];
  safetyNote: string;
}

interface PlayPathDocument {
  _id: ObjectId;
  title: string;
  description: string;
  goal: string;
  supports: string[];
  durationMinutes: number;
  wallSceneId: ObjectId;
  status: "draft" | "published" | "retired";
  guestPreview?: GuestPreviewDocument;
}

interface MissionDocument {
  _id: ObjectId;
  title: string;
  durationMinutes: number;
  setupSteps: string[];
  sayThis: string;
  childChallenge: string;
  tidyUp: string | null;
  materials: Array<{ name: string }>;
  status: "draft" | "published" | "retired";
}

interface PlayPathMissionDocument {
  playPathId: ObjectId;
  missionId: ObjectId;
  position: number;
  wallElementKey: string;
  replacementMissionId?: ObjectId;
}

interface MissionWallSceneDocument {
  _id: ObjectId;
  key: string;
  elements: Array<{
    key: string;
    label: string;
    revealMessage: string;
  }>;
  status: "draft" | "published" | "retired";
}

function playPaths(db: Db): Collection<PlayPathDocument> {
  return db.collection<PlayPathDocument>("playPaths");
}

function toSummary(playPath: PlayPathDocument, missionCount: number): GuestSampleSummary {
  const preview = playPath.guestPreview;
  if (!preview) throw new Error("Published Play Path is missing card metadata");

  return {
    id: playPath._id.toHexString(),
    title: playPath.title,
    summary: playPath.description,
    goal: playPath.goal,
    supports: playPath.supports,
    durationMinutes: playPath.durationMinutes,
    setupMinutes: preview.setupMinutes,
    parentEffort: preview.parentEffort,
    messLevel: preview.messLevel,
    category: preview.category,
    secondaryCategory: preview.secondaryCategory,
    imageUrl: preview.imageUrl,
    imageAlt: preview.imageAlt,
    materials: preview.materials,
    missionCount,
  };
}

export function createMongoCatalogRepository(
  mongo: MongoClientProvider,
  databaseName: string,
): CatalogRepository {
  async function database() {
    return (await mongo.getClient()).db(databaseName);
  }

  async function findPlayPath(playPathId: string, guestOnly: boolean): Promise<GuestSample | null> {
    if (!ObjectId.isValid(playPathId)) return null;

    const db = await database();
    const path = await playPaths(db).findOne({
      _id: new ObjectId(playPathId),
      status: "published",
      ...(guestOnly ? { "guestPreview.enabled": true } : {}),
    });
    if (!path?.guestPreview) return null;

    const links = await db.collection<PlayPathMissionDocument>("playPathMissions")
      .find({ playPathId: path._id })
      .sort({ position: 1 })
      .toArray();
    const missionDocuments = await db.collection<MissionDocument>("missions")
      .find({ _id: { $in: links.map((link) => link.missionId) }, status: "published" })
      .toArray();
    const missionById = new Map(missionDocuments.map((mission) => [mission._id.toHexString(), mission]));
    const scene = await db.collection<MissionWallSceneDocument>("missionWallScenes").findOne({
      _id: path.wallSceneId,
      status: "published",
    });
    if (!scene || missionDocuments.length !== links.length) {
      throw new Error("Published Play Path has incomplete catalogue references");
    }

    const elementByKey = new Map(scene.elements.map((element) => [element.key, element]));
    const missions = links.map((link) => {
      const mission = missionById.get(link.missionId.toHexString());
      const wallElement = elementByKey.get(link.wallElementKey);
      if (!mission || !wallElement) {
        throw new Error("Published Play Path has an invalid mission or wall element reference");
      }

      return {
        id: mission._id.toHexString(),
        title: mission.title,
        durationMinutes: mission.durationMinutes,
        setupSteps: mission.setupSteps,
        sayThis: mission.sayThis,
        childChallenge: mission.childChallenge,
        tidyUp: mission.tidyUp ?? "",
        materials: mission.materials.map(({ name }) => name),
        wallElement: {
          key: wallElement.key,
          label: wallElement.label,
          revealMessage: wallElement.revealMessage,
        },
        ...(link.replacementMissionId ? { replacementMissionId: link.replacementMissionId.toHexString() } : {}),
      };
    });

    const { missionCount: _missionCount, ...summary } = toSummary(path, missions.length);
    return {
      ...summary,
      safetyNote: path.guestPreview.safetyNote,
      wallSceneKey: scene.key,
      missions,
    };
  }

  return {
    async listGuestSamples() {
      const db = await database();
      const paths = await playPaths(db)
        .find({ status: "published", "guestPreview.enabled": true })
        .sort({ "guestPreview.position": 1 })
        .toArray();

      const counts = await db.collection<PlayPathMissionDocument>("playPathMissions")
        .aggregate<{ _id: ObjectId; count: number }>([
          { $match: { playPathId: { $in: paths.map((path) => path._id) } } },
          { $group: { _id: "$playPathId", count: { $sum: 1 } } },
        ])
        .toArray();
      const countByPath = new Map(counts.map(({ _id, count }) => [_id.toHexString(), count]));

      return paths.map((path) => toSummary(path, countByPath.get(path._id.toHexString()) ?? 0));
    },

    async findGuestSample(sampleId) {
      return findPlayPath(sampleId, true);
    },

    async findPublishedPlayPath(playPathId) {
      return findPlayPath(playPathId, false);
    },

    async findPublishedMission(missionId) {
      if (!ObjectId.isValid(missionId)) return null;
      const mission = await (await database()).collection<MissionDocument>("missions").findOne({
        _id: new ObjectId(missionId),
        status: "published",
      });
      if (!mission) return null;
      return {
        id: mission._id.toHexString(),
        title: mission.title,
        durationMinutes: mission.durationMinutes,
        setupSteps: mission.setupSteps,
        sayThis: mission.sayThis,
        childChallenge: mission.childChallenge,
        tidyUp: mission.tidyUp ?? "",
        materials: mission.materials.map(({ name }) => name),
      };
    },
  };
}
