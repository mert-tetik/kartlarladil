const AI_PRACTICE_CHAT_BACKGROUNDS = {
  "gentle-companion": {
    imageSrc: "/ai-chat-backgrounds/gentle-companion.webp",
    overlay: "linear-gradient(145deg, rgba(21, 34, 27, 0.84), rgba(45, 24, 20, 0.58))",
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
    imageSrc: "/ai-chat-backgrounds/study-buddy.webp",
    overlay: "linear-gradient(145deg, rgba(9, 4, 18, 0.9), rgba(75, 24, 98, 0.74))",
  },
  "sleepy-student": {
    imageSrc: "/ai-chat-backgrounds/sleepy-student.webp",
    overlay: "linear-gradient(145deg, rgba(121, 39, 83, 0.78), rgba(248, 130, 167, 0.42))",
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

export function getAiPracticeChatBackground(characterId: string) {
  return AI_PRACTICE_CHAT_BACKGROUNDS[
    characterId as keyof typeof AI_PRACTICE_CHAT_BACKGROUNDS
  ] ?? DEFAULT_BACKGROUND;
}
