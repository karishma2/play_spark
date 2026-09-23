import { ObjectId, type Collection, type Db } from "mongodb";
import type { MongoClientProvider } from "./db.js";

export interface GuestSampleSummary {
  id: string;
  title: string;
  summary: string;
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
  wallElement: {
    key: string;
    label: string;
    revealMessage: string;
  };
}

export interface GuestSample extends Omit<GuestSampleSummary, "missionCount"> {
  safetyNote: string;
  wallSceneKey: string;
  missions: GuestMission[];
}

export interface CatalogRepository {
  listGuestSamples(): Promise<GuestSampleSummary[]>;
  findGuestSample(sampleId: string): Promise<GuestSample | null>;
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
  status: "draft" | "published" | "retired";
}

interface PlayPathMissionDocument {
  playPathId: ObjectId;
  missionId: ObjectId;
  position: number;
  wallElementKey: string;
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
  if (!preview) throw new Error("Published guest Play Path is missing preview metadata");

  return {
    id: playPath._id.toHexString(),
    title: playPath.title,
    summary: playPath.description,
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
      if (!ObjectId.isValid(sampleId)) return null;

      const db = await database();
      const path = await playPaths(db).findOne({
        _id: new ObjectId(sampleId),
        status: "published",
        "guestPreview.enabled": true,
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
        throw new Error("Published guest Play Path has incomplete catalogue references");
      }

      const elementByKey = new Map(scene.elements.map((element) => [element.key, element]));
      const missions = links.map((link) => {
        const mission = missionById.get(link.missionId.toHexString());
        const wallElement = elementByKey.get(link.wallElementKey);
        if (!mission || !wallElement) {
          throw new Error("Published guest Play Path has an invalid mission or wall element reference");
        }

        return {
          id: mission._id.toHexString(),
          title: mission.title,
          durationMinutes: mission.durationMinutes,
          setupSteps: mission.setupSteps,
          sayThis: mission.sayThis,
          childChallenge: mission.childChallenge,
          tidyUp: mission.tidyUp ?? "",
          wallElement: {
            key: wallElement.key,
            label: wallElement.label,
            revealMessage: wallElement.revealMessage,
          },
        };
      });

      const { missionCount: _missionCount, ...summary } = toSummary(path, missions.length);
      return {
        ...summary,
        safetyNote: path.guestPreview.safetyNote,
        wallSceneKey: scene.key,
        missions,
      };
    },
  };
}
