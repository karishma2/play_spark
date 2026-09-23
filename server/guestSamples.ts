export interface GuestMission {
  id: string;
  title: string;
  durationMinutes: number;
  setupSteps: string[];
  sayThis: string;
  childChallenge: string;
  tidyUp: string;
}

export interface GuestSample {
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
  safetyNote: string;
  missions: GuestMission[];
}

const guestSamples: GuestSample[] = [
  {
    id: "build-and-deliver",
    title: "Build & Deliver",
    summary: "Turn cushions, blocks, and a spoon into a tiny delivery route.",
    durationMinutes: 20,
    setupMinutes: 2,
    parentEffort: "Low",
    messLevel: "None",
    category: "Building Blocks",
    secondaryCategory: "Pretend Play",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDXxiham9LOk82Hp5c1XN5R-JLFHi_DiowVkSNyaDyu8AA7MRXg07-6Lg_ZNKBzmLi1ShA_mEwTZp0RrNczgSSsEeCsWoXaFCUdvDvwm5sPSs6PvG8Np-Ikjq7xDLzCiQ_QL9pZkuoUsCO9BDpAgrUEU0lRkRliEuyk8_zMpG6qS3wsw76-DQpK-kDy0-3ik6JViRxHCtEcHBh8UZU9LQz5ljCfZPxsUOW8BVTtoZuVvJtgfTLL1FPQ-w",
    imageAlt: "Wooden blocks arranged as roads for small toy cars.",
    materials: ["2 sofa cushions", "wooden blocks", "1 spoon or toy car"],
    safetyNote: "Keep the route on the floor and away from doorways or stairs.",
    missions: [
      {
        id: "build-gather",
        title: "Gather the route pieces",
        durationMinutes: 3,
        setupSteps: ["Place two cushions on the floor.", "Add a few blocks and one spoon or toy car."],
        sayThis: "A delivery is waiting. What kind of road should we build?",
        childChallenge: "Choose where the delivery route begins and ends.",
        tidyUp: "Keep unused blocks in their basket.",
      },
      {
        id: "build-road",
        title: "Build bridges and bends",
        durationMinutes: 9,
        setupSteps: ["Use blocks to mark two bends.", "Make one cushion into a gentle bridge."],
        sayThis: "Can the driver find a way over the bridge?",
        childChallenge: "Test the route, then change one part to make it easier or trickier.",
        tidyUp: "Move any loose pieces away from walking paths.",
      },
      {
        id: "build-deliver",
        title: "Make the final delivery",
        durationMinutes: 8,
        setupSteps: ["Choose a small soft item as the parcel.", "Put it at the starting point."],
        sayThis: "Who needs this special delivery today?",
        childChallenge: "Carry the parcel along the whole route and invent who receives it.",
        tidyUp: "Return cushions and blocks together when the delivery is complete.",
      },
    ],
  },
  {
    id: "kitchen-shadow-safari",
    title: "Kitchen Shadow Safari",
    summary: "Make gentle animal shadows with a torch and everyday kitchen tools.",
    durationMinutes: 15,
    setupMinutes: 1,
    parentEffort: "Low",
    messLevel: "None",
    category: "Sensory",
    secondaryCategory: "Animals",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCyuWhLhB3zizw-Sqk3g1-BZL3ii7dxvPI-2nouzqH1GsoSbIfWqXejHZlTXIqTLHEhFaLzVhv-VWnJWXKc30B4ugbFQPPnFXlm6SQDgE7ShEVb1vqGEhZpDbbkrgztFPajNi0aJhNgYfPeqqPWK6lVvGdCHcPYdTGb3xUYGgdks69eo7vmP7vP1_Iaw33Z4FyENZN6clqXLBKjbfWpt-jiyQeDTMY6hLDf-LrjHUtQpxDCMWrv2M4n0w",
    imageAlt: "Warm torchlight casting playful shadows from kitchen tools.",
    materials: ["torch", "colander or slotted spoon", "clear wall"],
    safetyNote: "An adult holds the torch. Do not shine it toward anyone's eyes.",
    missions: [
      {
        id: "shadow-den",
        title: "Find a shadow den",
        durationMinutes: 3,
        setupSteps: ["Dim one room slightly.", "Point the torch at a clear wall from arm's length."],
        sayThis: "Our wall is a quiet jungle. Who might be hiding here?",
        childChallenge: "Move closer and farther from the wall to change the shadow size.",
        tidyUp: "Keep the floor clear while the room is dim.",
      },
      {
        id: "shadow-animals",
        title: "Discover three creatures",
        durationMinutes: 7,
        setupSteps: ["Hold a slotted spoon or colander between the torch and wall."],
        sayThis: "What animal does this shadow remind you of?",
        childChallenge: "Name three shadow creatures and show how each one moves.",
        tidyUp: "Place each kitchen tool on a nearby table after using it.",
      },
      {
        id: "shadow-story",
        title: "Tell the safari story",
        durationMinutes: 5,
        setupSteps: ["Choose the child's favourite shadow creature."],
        sayThis: "Where is our creature going before bedtime?",
        childChallenge: "Tell a beginning, middle, and ending for the creature's adventure.",
        tidyUp: "Turn on the room light before returning the torch and tools.",
      },
    ],
  },
];

export const guestSampleIds = guestSamples.map((sample) => sample.id) as [string, ...string[]];

export function listGuestSamples() {
  return guestSamples.map(({ missions, safetyNote: _safetyNote, ...sample }) => ({
    ...sample,
    missionCount: missions.length,
  }));
}

export function findGuestSample(sampleId: string) {
  return guestSamples.find((sample) => sample.id === sampleId);
}
