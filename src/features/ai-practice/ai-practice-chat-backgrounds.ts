const AI_PRACTICE_CHAT_BACKGROUNDS = {
  "gentle-companion": {
    imageSrc: "/ai-chat-backgrounds/gentle-companion.jpg",
    overlay: "linear-gradient(145deg, rgba(44, 23, 12, 0.86), rgba(132, 66, 25, 0.58))",
  },
  "gothic-calm": {
    imageSrc: "/ai-chat-backgrounds/gothic-calm.webp",
    overlay: "linear-gradient(145deg, rgba(12, 5, 20, 0.9), rgba(66, 22, 92, 0.72))",
  },
  "campus-friend": {
    imageSrc: "/ai-chat-backgrounds/campus-friend.webp",
    overlay: "linear-gradient(145deg, rgba(20, 50, 88, 0.72), rgba(19, 45, 50, 0.58))",
  },
  "soft-artist": {
    imageSrc: "/ai-chat-backgrounds/soft-artist.webp",
    overlay: "linear-gradient(145deg, rgba(47, 23, 43, 0.72), rgba(37, 65, 43, 0.56))",
  },
  "skater-coach": {
    imageSrc: "/ai-chat-backgrounds/skater-coach.webp",
    overlay: "linear-gradient(145deg, rgba(18, 20, 25, 0.72), rgba(176, 47, 46, 0.48))",
  },
  "study-buddy": {
    imageSrc: "/ai-chat-backgrounds/study-buddy.jpg",
    overlay: "linear-gradient(145deg, rgba(14, 5, 28, 0.92), rgba(86, 29, 121, 0.74))",
  },
  "sleepy-student": {
    imageSrc: "/ai-chat-backgrounds/sleepy-student.webp",
    overlay: "linear-gradient(145deg, rgba(31, 12, 53, 0.84), rgba(194, 71, 149, 0.5))",
  },
  "friendly-worker": {
    imageSrc: "/ai-chat-backgrounds/friendly-worker.webp",
    overlay: "linear-gradient(145deg, rgba(39, 25, 17, 0.82), rgba(115, 62, 28, 0.52))",
  },
  "warm-grandmother": {
    imageSrc: "/ai-chat-backgrounds/warm-grandmother.webp",
    overlay: "linear-gradient(145deg, rgba(61, 30, 17, 0.78), rgba(116, 73, 31, 0.5))",
  },
  "wise-elder": {
    imageSrc: "/ai-chat-backgrounds/wise-elder.webp",
    overlay: "linear-gradient(145deg, rgba(14, 21, 34, 0.82), rgba(39, 50, 78, 0.54))",
  },
} as const;

const DEFAULT_BACKGROUND = AI_PRACTICE_CHAT_BACKGROUNDS["gentle-companion"];

export type AiPracticeScenarioChatBackground = {
  imageSrc: string;
  overlay: string;
  accent: string;
};

const AI_PRACTICE_SCENARIO_CHAT_BACKGROUNDS: Record<string, AiPracticeScenarioChatBackground> = {
  "restaurant-order": {
    imageSrc: "/ai-chat-backgrounds/scenarios/restaurant-order.jpg",
    overlay: "linear-gradient(145deg, rgba(35, 15, 8, 0.82), rgba(72, 38, 18, 0.66))",
    accent: "#f5b84b",
  },
  "hotel-check-in": {
    imageSrc: "/ai-chat-backgrounds/scenarios/hotel-check-in.jpg",
    overlay: "linear-gradient(145deg, rgba(10, 20, 49, 0.82), rgba(18, 18, 29, 0.68))",
    accent: "#9fc2ff",
  },
  "shopping-help": {
    imageSrc: "/ai-chat-backgrounds/scenarios/shopping-help.jpg",
    overlay: "linear-gradient(145deg, rgba(8, 47, 51, 0.78), rgba(38, 22, 36, 0.7))",
    accent: "#63dfc4",
  },
  "job-interview": {
    imageSrc: "/ai-chat-backgrounds/scenarios/job-interview.jpg",
    overlay: "linear-gradient(145deg, rgba(14, 28, 48, 0.82), rgba(18, 20, 26, 0.72))",
    accent: "#8eb9ff",
  },
  "doctor-visit": {
    imageSrc: "/ai-chat-backgrounds/scenarios/doctor-visit.jpg",
    overlay: "linear-gradient(145deg, rgba(8, 54, 52, 0.78), rgba(18, 29, 45, 0.72))",
    accent: "#7ce5c2",
  },
  "asking-directions": {
    imageSrc: "/ai-chat-backgrounds/scenarios/asking-directions.jpg",
    overlay: "linear-gradient(145deg, rgba(35, 19, 58, 0.78), rgba(12, 40, 47, 0.72))",
    accent: "#c79bff",
  },
  "apartment-viewing": {
    imageSrc: "/ai-chat-backgrounds/scenarios/apartment-viewing.jpg",
    overlay: "linear-gradient(145deg, rgba(52, 32, 18, 0.74), rgba(25, 26, 30, 0.7))",
    accent: "#f0bd73",
  },
  "pharmacy-help": {
    imageSrc: "/ai-chat-backgrounds/scenarios/pharmacy-help.jpg",
    overlay: "linear-gradient(145deg, rgba(8, 42, 46, 0.78), rgba(20, 31, 37, 0.7))",
    accent: "#79dfca",
  },
  "party-introduction": {
    imageSrc: "/ai-chat-backgrounds/scenarios/party-introduction.jpg",
    overlay: "linear-gradient(145deg, rgba(52, 18, 65, 0.76), rgba(20, 23, 51, 0.72))",
    accent: "#ec9bff",
  },
  "airport-check-in": {
    imageSrc: "/ai-chat-backgrounds/scenarios/airport-check-in.jpg",
    overlay: "linear-gradient(145deg, rgba(11, 37, 64, 0.8), rgba(20, 26, 34, 0.72))",
    accent: "#91c9ff",
  },
};

export function getAiPracticeChatBackground(characterId: string) {
  return AI_PRACTICE_CHAT_BACKGROUNDS[
    characterId as keyof typeof AI_PRACTICE_CHAT_BACKGROUNDS
  ] ?? DEFAULT_BACKGROUND;
}

export function getAiPracticeScenarioChatBackground(scenarioId: string) {
  return AI_PRACTICE_SCENARIO_CHAT_BACKGROUNDS[scenarioId] ?? {
    imageSrc: AI_PRACTICE_SCENARIO_CHAT_BACKGROUNDS["restaurant-order"].imageSrc,
    overlay: "linear-gradient(145deg, rgba(23, 23, 23, 0.84), rgba(36, 36, 36, 0.74))",
    accent: "#ffffff",
  };
}
