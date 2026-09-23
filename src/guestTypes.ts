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
}

export interface GuestSample extends Omit<GuestSampleSummary, "missionCount"> {
  safetyNote: string;
  missions: GuestMission[];
}
