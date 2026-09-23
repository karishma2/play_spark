export interface GuestProgress {
  completedSampleIds: string[];
  completedMissions: Record<string, string[]>;
}

const storageKey = "play-spark:guest-progress:v1";
const emptyProgress: GuestProgress = { completedSampleIds: [], completedMissions: {} };

export function readGuestProgress(): GuestProgress {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return emptyProgress;

    const parsed = JSON.parse(stored) as Partial<GuestProgress>;
    return {
      completedSampleIds: Array.isArray(parsed.completedSampleIds)
        ? parsed.completedSampleIds.filter((value): value is string => typeof value === "string")
        : [],
      completedMissions:
        parsed.completedMissions && typeof parsed.completedMissions === "object"
          ? parsed.completedMissions
          : {},
    };
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
