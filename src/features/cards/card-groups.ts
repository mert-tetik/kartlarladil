import { VOCABULARY_CARDS } from "@/data/cards";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

export type CardGroupIcon =
  | "school"
  | "business"
  | "restaurant"
  | "shopping"
  | "fruits"
  | "months"
  | "travel"
  | "home"
  | "health"
  | "technology"
  | "emotions"
  | "body"
  | "clothes"
  | "family"
  | "weather"
  | "animals"
  | "transport"
  | "directions"
  | "routines"
  | "sports"
  | "hobbies"
  | "musicMovies"
  | "cooking"
  | "jobs"
  | "colorsShapes"
  | "numbersTime"
  | "commonVerbs"
  | "adjectives"
  | "emergency"
  | "social";

export interface CardGroupDefinition {
  id: CardGroupIcon;
  labelKey: `cards.groups.${CardGroupIcon}`;
  descriptionKey: `cards.groups.${CardGroupIcon}Description`;
  englishKeys: readonly string[];
}

export const CARD_GROUP_IMAGE_PATHS: Record<CardGroupIcon, string> = {
  school: "/card-groups/school.webp",
  business: "/card-groups/business.webp",
  restaurant: "/card-groups/restaurant.webp",
  shopping: "/card-groups/shopping.webp",
  fruits: "/card-groups/fruits.webp",
  months: "/card-groups/months.webp",
  travel: "/card-groups/travel.webp",
  home: "/card-groups/home.webp",
  health: "/card-groups/health.webp",
  technology: "/card-groups/technology.webp",
  emotions: "/card-groups/emotions.webp",
  body: "/card-groups/body.webp",
  clothes: "/card-groups/clothes.webp",
  family: "/card-groups/family.webp",
  weather: "/card-groups/weather.webp",
  animals: "/card-groups/animals.webp",
  transport: "/card-groups/transport.webp",
  directions: "/card-groups/directions.webp",
  routines: "/card-groups/routines.webp",
  sports: "/card-groups/sports.webp",
  hobbies: "/card-groups/hobbies.webp",
  musicMovies: "/card-groups/musicMovies.webp",
  cooking: "/card-groups/cooking.webp",
  jobs: "/card-groups/jobs.webp",
  colorsShapes: "/card-groups/colorsShapes.webp",
  numbersTime: "/card-groups/numbersTime.webp",
  commonVerbs: "/card-groups/commonVerbs.webp",
  adjectives: "/card-groups/adjectives.webp",
  emergency: "/card-groups/emergency.webp",
  social: "/card-groups/social.webp",
};

const group = <T extends CardGroupIcon>(
  id: T,
  englishKeys: readonly string[],
): CardGroupDefinition => ({
  id,
  labelKey: `cards.groups.${id}`,
  descriptionKey: `cards.groups.${id}Description`,
  englishKeys,
});

export const CARD_GROUPS: readonly CardGroupDefinition[] = [
  group("school", [
    "school", "student", "teacher", "class", "classroom", "lesson", "book", "exam", "homework",
    "university", "college", "library", "study", "learn", "subject", "course", "principal", "pupil",
    "professor", "campus", "notebook", "pencil", "pen",
  ]),
  group("business", [
    "business", "company", "office", "meeting", "manager", "customer", "client", "job",
    "work", "career", "project", "team", "salary", "market", "contract", "employee", "employer",
    "department", "director", "boss", "staff", "finance", "profit", "trade", "industry",
  ]),
  group("restaurant", [
    "restaurant", "menu", "waiter", "table", "order", "bill", "dish", "meal",
    "breakfast", "lunch", "dinner", "coffee", "water", "food", "chef", "cook", "kitchen",
    "fork", "spoon", "plate", "recipe", "reservation", "receipt",
  ]),
  group("shopping", [
    "shop", "store", "buy", "sell", "price", "cost", "money", "cash", "card", "market",
    "customer", "size", "clothes", "mall", "basket", "receipt", "discount", "sale", "cheap",
    "expensive", "online",
  ]),
  group("fruits", [
    "apple", "banana", "orange", "lemon", "fruit", "tomato", "grape", "strawberry", "blueberry",
    "watermelon", "pineapple", "mango", "peach", "pear", "cherry",
  ]),
  group("months", [
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
  ]),
  group("travel", [
    "travel", "trip", "journey", "ticket", "train", "airport", "hotel", "passport",
    "map", "tourist", "vacation", "flight", "station", "beach", "border", "guide", "destination",
    "departure", "arrival", "visa",
  ]),
  group("home", [
    "home", "house", "room", "kitchen", "bathroom", "bedroom", "door", "window", "table",
    "chair", "bed", "wall", "floor", "garden", "key", "apartment", "lamp", "shelf", "roof",
    "ceiling", "furniture",
  ]),
  group("health", [
    "health", "doctor", "hospital", "medicine", "pain", "head", "hand", "foot", "heart",
    "body", "sick", "ill", "exercise", "sleep", "blood", "nurse", "patient", "treatment",
    "symptom", "fever", "disease", "temperature",
  ]),
  group("technology", [
    "computer", "phone", "internet", "website", "email", "message", "screen", "keyboard",
    "software", "program", "file", "password", "camera", "video", "technology", "app", "data",
    "network", "battery", "browser", "download", "cloud", "code", "database",
  ]),
  group("emotions", [
    "emotion", "feeling", "happy", "sad", "angry", "afraid", "excited", "surprised", "worried",
    "proud", "calm", "hope", "love", "hate", "smile",
  ]),
  group("body", [
    "body", "head", "face", "eye", "ear", "nose", "mouth", "hair", "arm", "leg", "hand", "foot",
    "finger", "skin", "tooth",
  ]),
  group("clothes", [
    "clothes", "shirt", "dress", "coat", "jacket", "shoe", "sock", "hat", "skirt", "trousers", "wear",
    "pocket", "button",
  ]),
  group("family", [
    "family", "mother", "father", "parent", "son", "daughter", "brother", "sister", "husband", "wife",
    "child", "baby", "friend", "people", "person",
  ]),
  group("weather", [
    "weather", "rain", "snow", "wind", "cloud", "sun", "storm", "hot", "cold", "warm", "sky", "air",
    "season",
  ]),
  group("animals", [
    "animal", "dog", "cat", "bird", "horse", "cow", "sheep", "fish", "mouse", "bear", "lion", "chicken",
    "insect",
  ]),
  group("transport", [
    "transport", "car", "bus", "train", "taxi", "bicycle", "bike", "motorcycle", "ship", "boat", "plane",
    "airport", "station", "road", "drive",
  ]),
  group("directions", [
    "direction", "left", "right", "straight", "north", "south", "east", "west", "near", "far", "corner",
    "street", "place", "address", "map",
  ]),
  group("routines", [
    "routine", "wake", "morning", "wash", "shower", "eat", "drink", "go", "come", "work", "start", "finish",
    "sleep", "everyday", "daily",
  ]),
  group("sports", [
    "sport", "football", "soccer", "basketball", "tennis", "game", "team", "player", "win", "lose", "run",
    "swim", "ball", "race", "exercise",
  ]),
  group("hobbies", [
    "hobby", "read", "reading", "draw", "drawing", "paint", "sing", "dance", "travel", "cook", "cooking",
    "photograph", "garden", "collect", "play",
  ]),
  group("musicMovies", [
    "music", "song", "movie", "film", "actor", "actress", "show", "concert", "band", "guitar", "piano",
    "radio", "listen", "watch", "story",
  ]),
  group("cooking", [
    "cook", "kitchen", "food", "recipe", "ingredient", "salt", "sugar", "bread", "rice", "meat", "chicken",
    "vegetable", "fruit", "knife", "plate",
  ]),
  group("jobs", [
    "job", "work", "career", "profession", "doctor", "teacher", "engineer", "driver", "artist", "writer", "chef",
    "nurse", "lawyer", "farmer", "worker",
  ]),
  group("colorsShapes", [
    "red", "blue", "green", "yellow", "black", "white", "orange", "purple", "circle", "square", "line", "shape",
    "round", "light",
  ]),
  group("numbersTime", [
    "number", "one", "time", "hour", "minute", "second", "day", "week", "month", "year", "today", "tomorrow",
  ]),
  group("commonVerbs", [
    "be", "have", "do", "make", "go", "come", "take", "give", "get", "know", "think", "want", "need", "look",
    "use",
  ]),
  group("adjectives", [
    "good", "bad", "big", "small", "long", "short", "new", "old", "easy", "hard", "important", "different",
    "same", "right", "wrong",
  ]),
  group("emergency", [
    "emergency", "help", "danger", "safe", "safety", "police", "fire", "accident", "hurt", "hospital", "doctor",
    "problem", "lost", "call", "stop",
  ]),
  group("social", [
    "hello", "goodbye", "please", "thanks", "sorry", "welcome", "question", "answer", "conversation", "talk",
    "speak", "say", "agree", "invite",
  ]),
] as const;

const groupKeySets = new Map(CARD_GROUPS.map((definition) => [definition.id, new Set(definition.englishKeys)]));

export function getCardsForGroup(groupId: CardGroupIcon, language: LanguageCode): VocabularyCard[] {
  const keys = groupKeySets.get(groupId);

  if (!keys) {
    return [];
  }

  return VOCABULARY_CARDS.filter(
    (card) => card.language === language && keys.has(card.englishKey.toLowerCase()),
  );
}

export function getCardGroup(groupId: CardGroupIcon): CardGroupDefinition | undefined {
  return CARD_GROUPS.find((definition) => definition.id === groupId);
}

export function getCardGroupForCard(card: Pick<VocabularyCard, "englishKey">): CardGroupDefinition | undefined {
  const englishKey = card.englishKey.toLowerCase();

  return CARD_GROUPS.find((definition) => definition.englishKeys.some((key) => key.toLowerCase() === englishKey));
}
