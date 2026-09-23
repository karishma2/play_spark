export interface GuestProgress {
  completedSampleIds: string[];
  completedMissions: Record<string, string[]>;
}

const storageKey = "play-spark:guest-progress:v1";
const emptyProgress: GuestProgress = { completedSampleIds: [], completedMissions: {} };
const legacyIdReplacements: Record<string, string> = {
  "build-and-deliver": "64b100000000000000000001",
  "kitchen-shadow-safari": "64b100000000000000000002",
  "build-gather": "64b300000000000000000001",
  "build-road": "64b300000000000000000002",
  "build-deliver": "64b300000000000000000003",
  "shadow-den": "64b300000000000000000004",
  "shadow-animals": "64b300000000000000000005",
  "shadow-story": "64b300000000000000000006",
};

function replaceLegacyId(id: string) {
  return legacyIdReplacements[id] ?? id;
}

export function migrateLegacyGuestProgress(progress: GuestProgress): GuestProgress {
  const completedSampleIds = [...new Set(progress.completedSampleIds.map(replaceLegacyId))];
  const completedMissions: Record<string, string[]> = {};

  for (const [sampleId, missionIds] of Object.entries(progress.completedMissions)) {
    const migratedSampleId = replaceLegacyId(sampleId);
    const existing = completedMissions[migratedSampleId] ?? [];
    completedMissions[migratedSampleId] = [
      ...new Set([...existing, ...missionIds.filter((id): id is string => typeof id === "string").map(replaceLegacyId)]),
    ];
  }

  return { completedSampleIds, completedMissions };
}

export function readGuestProgress(): GuestProgress {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return emptyProgress;

    const parsed = JSON.parse(stored) as Partial<GuestProgress>;
    const normalized = {
      completedSampleIds: Array.isArray(parsed.completedSampleIds)
        ? parsed.completedSampleIds.filter((value): value is string => typeof value === "string")
        : [],
      completedMissions:
        parsed.completedMissions && typeof parsed.completedMissions === "object"
          ? parsed.completedMissions
          : {},
    };
    const migrated = migrateLegacyGuestProgress(normalized);
    if (JSON.stringify(migrated) !== JSON.stringify(normalized)) {
      window.localStorage.setItem(storageKey, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return emptyProgress;
  }
}

export function saveGuestProgress(progress: GuestProgress) {
  window.localStorage.setItem(storageKey, JSON.stringify(progress));
}

export function toggleMission(
  progress: GuestProgress,
  sampleId: string,
  missionId: string,
): GuestProgress {
  const completed = progress.completedMissions[sampleId] ?? [];
  const nextCompleted = completed.includes(missionId)
    ? completed.filter((id) => id !== missionId)
    : [...completed, missionId];

  return {
    ...progress,
    completedMissions: { ...progress.completedMissions, [sampleId]: nextCompleted },
  };
}

export function completeSample(progress: GuestProgress, sampleId: string): GuestProgress {
  if (progress.completedSampleIds.includes(sampleId)) return progress;
  return { ...progress, completedSampleIds: [...progress.completedSampleIds, sampleId] };
}

export function restartSample(progress: GuestProgress, sampleId: string): GuestProgress {
  return {
    completedSampleIds: progress.completedSampleIds.filter((id) => id !== sampleId),
    completedMissions: { ...progress.completedMissions, [sampleId]: [] },
  };
}
