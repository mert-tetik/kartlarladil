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
  | "social"
  | "vegetables"
  | "drinks"
  | "grainsLegumes"
  | "nutsSeeds"
  | "desserts"
  | "kitchenUtensils"
  | "householdItems"
  | "roomsFurniture"
  | "cityPlaces"
  | "buildings"
  | "nature"
  | "geography"
  | "transportVehicles"
  | "pharmacyMedicine"
  | "personality"
  | "appearance"
  | "communication"
  | "advancedVerbs"
  | "technologyDevices"
  | "internetSocialMedia";

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
  vegetables: "/card-groups/vegetables.webp",
  drinks: "/card-groups/drinks.webp",
  grainsLegumes: "/card-groups/grainsLegumes.webp",
  nutsSeeds: "/card-groups/nutsSeeds.webp",
  desserts: "/card-groups/desserts.webp",
  kitchenUtensils: "/card-groups/kitchenUtensils.webp",
  householdItems: "/card-groups/householdItems.webp",
  roomsFurniture: "/card-groups/roomsFurniture.webp",
  cityPlaces: "/card-groups/cityPlaces.webp",
  buildings: "/card-groups/buildings.webp",
  nature: "/card-groups/nature.webp",
  geography: "/card-groups/geography.webp",
  transportVehicles: "/card-groups/transportVehicles.webp",
  pharmacyMedicine: "/card-groups/pharmacyMedicine.webp",
  personality: "/card-groups/personality.webp",
  appearance: "/card-groups/appearance.webp",
  communication: "/card-groups/communication.webp",
  advancedVerbs: "/card-groups/advancedVerbs.webp",
  technologyDevices: "/card-groups/technologyDevices.webp",
  internetSocialMedia: "/card-groups/internetSocialMedia.webp",
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
    "professor", "campus", "notebook", "pencil", "pen", "classmate", "semester",
  ]),
  group("business", [
    "business", "company", "office", "meeting", "manager", "customer", "client", "job",
    "work", "career", "project", "team", "salary", "market", "contract", "employee", "employer",
    "department", "director", "boss", "staff", "finance", "profit", "trade", "industry", "invoice",
  ]),
  group("restaurant", [
    "restaurant", "menu", "waiter", "table", "order", "bill", "dish", "meal",
    "breakfast", "lunch", "dinner", "coffee", "water", "food", "chef", "cook", "kitchen",
    "fork", "spoon", "plate", "recipe", "reservation", "receipt", "dessert", "napkin",
  ]),
  group("shopping", [
    "shop", "store", "buy", "sell", "price", "cost", "money", "cash", "card", "market",
    "customer", "size", "clothes", "mall", "basket", "receipt", "discount", "sale", "cheap",
    "expensive", "online", "refund", "checkout", "cashier",
  ]),
  group("fruits", [
    "apple", "banana", "orange", "lemon", "fruit", "tomato", "grape", "strawberry", "blueberry",
    "watermelon", "pineapple", "mango", "peach", "pear", "cherry", "apricot", "fig", "raspberry", "kiwi", "coconut",
  ]),
  group("months", [
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "calendar",
  ]),
  group("travel", [
    "travel", "trip", "journey", "ticket", "train", "airport", "hotel", "passport",
    "map", "tourist", "vacation", "flight", "station", "beach", "border", "guide", "destination",
    "departure", "arrival", "visa", "luggage", "suitcase", "hostel", "customs",
  ]),
  group("home", [
    "home", "house", "room", "kitchen", "bathroom", "bedroom", "door", "window", "table",
    "chair", "bed", "wall", "floor", "garden", "key", "apartment", "lamp", "shelf", "roof",
    "ceiling", "furniture", "sofa", "wardrobe", "drawer", "pillow", "balcony",
  ]),
  group("health", [
    "health", "doctor", "hospital", "medicine", "pain", "head", "hand", "foot", "heart",
    "body", "sick", "ill", "exercise", "sleep", "blood", "nurse", "patient", "treatment",
    "symptom", "fever", "disease", "temperature", "allergy", "cough", "bandage", "pharmacy",
  ]),
  group("technology", [
    "computer", "phone", "internet", "website", "email", "message", "screen", "keyboard",
    "software", "program", "file", "password", "camera", "video", "technology", "app", "data",
    "network", "battery", "browser", "download", "cloud", "code", "database", "charger", "microphone", "folder", "upload",
  ]),
  group("emotions", [
    "emotion", "feeling", "happy", "sad", "angry", "afraid", "excited", "surprised", "worried",
    "proud", "calm", "hope", "love", "hate", "smile", "sadness",
  ]),
  group("body", [
    "body", "head", "face", "eye", "ear", "nose", "mouth", "hair", "arm", "leg", "hand", "foot",
    "finger", "skin", "tooth", "teeth",
  ]),
  group("clothes", [
    "clothes", "shirt", "dress", "coat", "jacket", "shoe", "sock", "hat", "skirt", "trousers", "wear",
    "pocket", "button", "scarf", "boots",
  ]),
  group("family", [
    "family", "mother", "father", "parent", "son", "daughter", "brother", "sister", "husband", "wife",
    "child", "baby", "friend", "people", "person", "nephew", "niece", "neighbor",
  ]),
  group("weather", [
    "weather", "rain", "snow", "wind", "cloud", "sun", "storm", "hot", "cold", "warm", "sky", "air",
    "season", "fog", "sunny", "rainy", "windy",
  ]),
  group("animals", [
    "animal", "dog", "cat", "bird", "horse", "cow", "sheep", "fish", "mouse", "bear", "lion", "chicken",
    "insect", "rabbit", "duck", "goat", "wolf",
  ]),
  group("transport", [
    "transport", "car", "bus", "train", "taxi", "bicycle", "bike", "motorcycle", "ship", "boat", "plane",
    "airport", "station", "road", "drive", "tram", "subway", "scooter", "ferry",
  ]),
  group("directions", [
    "direction", "left", "right", "straight", "north", "south", "east", "west", "near", "far", "corner",
    "street", "place", "address", "map", "center",
  ]),
  group("routines", [
    "routine", "wake", "morning", "wash", "shower", "eat", "drink", "go", "come", "work", "start", "finish",
    "sleep", "everyday", "daily", "commute",
  ]),
  group("sports", [
    "sport", "football", "soccer", "basketball", "tennis", "game", "team", "player", "win", "lose", "run",
    "swim", "ball", "race", "exercise", "volleyball", "cycling", "skating",
  ]),
  group("hobbies", [
    "hobby", "read", "reading", "draw", "drawing", "paint", "sing", "dance", "travel", "cook", "cooking",
    "photograph", "garden", "collect", "play", "hiking", "knitting",
  ]),
  group("musicMovies", [
    "music", "song", "movie", "film", "actor", "actress", "show", "concert", "band", "guitar", "piano",
    "radio", "listen", "watch", "story", "violin", "flute", "lyrics", "playlist",
  ]),
  group("cooking", [
    "cook", "kitchen", "food", "recipe", "ingredient", "salt", "sugar", "bread", "rice", "meat", "chicken",
    "vegetable", "fruit", "knife", "plate", "garlic", "dessert", "pasta", "lentil",
  ]),
  group("jobs", [
    "job", "work", "career", "profession", "doctor", "teacher", "engineer", "driver", "artist", "writer", "chef",
    "nurse", "lawyer", "farmer", "worker", "electrician", "receptionist",
  ]),
  group("colorsShapes", [
    "red", "blue", "green", "yellow", "black", "white", "orange", "purple", "circle", "square", "line", "shape",
    "round", "light", "gray", "triangle", "rectangle",
  ]),
  group("numbersTime", [
    "number", "one", "time", "hour", "minute", "second", "day", "week", "month", "year", "today", "tomorrow", "zero", "two", "three", "four", "five", "calendar",
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
  group("vegetables", [
    "vegetable", "carrot", "potato", "onion", "tomato", "pepper", "bean", "cucumber", "lettuce", "mushroom", "spinach", "broccoli", "cabbage", "pumpkin", "zucchini", "celery",
  ]),
  group("drinks", [
    "drink", "water", "coffee", "tea", "juice", "milk", "beer", "wine", "bottle", "cup", "lemonade", "soda", "cocoa", "smoothie",
  ]),
  group("grainsLegumes", [
    "bread", "rice", "flour", "wheat", "grain", "bean", "pasta", "lentil", "cereal", "oat",
  ]),
  group("nutsSeeds", [
    "nut", "seed", "almond", "peanut", "walnut", "pistachio", "cashew", "hazelnut", "chestnut", "coconut",
  ]),
  group("desserts", [
    "cake", "chocolate", "biscuit", "sugar", "sweet", "cookie", "candy", "pie", "pudding", "donut", "muffin", "honey", "pastry",
  ]),
  group("kitchenUtensils", [
    "knife", "fork", "spoon", "plate", "bowl", "cup", "glass", "pan", "pot", "oven", "kitchen", "recipe", "dish",
    "stove", "ladle", "whisk", "grater", "tongs", "spatula",
  ]),
  group("householdItems", [
    "furniture", "table", "chair", "lamp", "shelf", "door", "window", "key", "clock", "mirror", "towel", "blanket",
    "carpet", "basket", "box", "clean", "detergent", "broom", "drawer", "pillow",
  ]),
  group("roomsFurniture", [
    "room", "house", "home", "bedroom", "bathroom", "kitchen", "bed", "chair", "table", "shelf", "desk", "garden", "sofa", "wardrobe", "balcony", "hallway", "armchair", "cushion",
  ]),
  group("cityPlaces", [
    "city", "street", "road", "park", "bank", "hospital", "school", "library", "station", "airport", "shop", "store",
    "market", "restaurant", "hotel", "museum", "theater", "subway", "pharmacy", "bakery", "bookstore",
  ]),
  group("buildings", [
    "building", "house", "apartment", "office", "school", "hospital", "hotel", "church", "bridge", "tower", "factory",
    "station", "castle", "wall", "roof", "skyscraper", "stairs",
  ]),
  group("nature", [
    "nature", "tree", "flower", "plant", "forest", "river", "lake", "sea", "mountain", "hill", "beach", "island", "field",
    "grass", "garden", "earth", "stone", "rock", "animal", "waterfall", "volcano", "desert",
  ]),
  group("geography", [
    "country", "city", "world", "earth", "land", "sea", "ocean", "river", "mountain", "island", "border", "capital", "map",
    "north", "south", "east", "west", "continent", "latitude", "longitude",
  ]),
  group("transportVehicles", [
    "car", "bus", "train", "taxi", "bicycle", "bike", "motorcycle", "ship", "boat", "plane", "truck", "van", "vehicle",
    "road", "drive", "ride", "helicopter", "rocket",
  ]),
  group("pharmacyMedicine", [
    "medicine", "drug", "pill", "tablet", "prescription", "doctor", "nurse", "hospital", "patient", "pain", "fever", "cold",
    "treatment", "health", "pharmacy", "cough", "allergy", "bandage",
  ]),
  group("personality", [
    "personality", "kind", "friendly", "polite", "honest", "brave", "calm", "lazy", "clever", "smart", "shy", "serious",
    "funny", "rude", "patient", "active", "hardworking", "selfish",
  ]),
  group("appearance", [
    "appearance", "beautiful", "pretty", "ugly", "tall", "short", "young", "old", "thin", "fat", "hair", "face", "eye",
    "blonde", "dark", "clean", "handsome", "beard", "moustache", "glasses",
  ]),
  group("communication", [
    "communication", "talk", "speak", "say", "tell", "ask", "answer", "question", "explain", "listen", "conversation", "message",
    "email", "call", "write", "read", "agree", "disagree", "pronunciation",
  ]),
  group("advancedVerbs", [
    "achieve", "admit", "advise", "afford", "allow", "appear", "avoid", "compare", "consider", "continue", "depend", "describe",
    "develop", "encourage", "improve", "include", "increase", "manage", "mention", "offer", "prefer", "prevent", "provide",
    "realize", "recommend", "reduce", "require", "suggest", "analyze",
  ]),
  group("technologyDevices", [
    "computer", "phone", "laptop", "tablet", "screen", "keyboard", "camera", "printer", "device", "machine", "battery", "internet",
    "website", "app", "software", "program", "headset", "router",
  ]),
  group("internetSocialMedia", [
    "internet", "website", "email", "message", "account", "password", "online", "social", "media", "post", "share", "like",
    "follow", "friend", "network", "video", "download", "chat", "upload", "livestream", "username", "hashtag", "notification",
  ]),
] as const;

/**
 * Some lemmas intentionally appear in more than one raw category because they
 * are useful for describing both concepts. A card, however, must have one
 * canonical category everywhere in the app. These overrides resolve the
 * specific-category conflicts before the definition order is used as the
 * fallback (for example, `foot` belongs to `body`, not `health`).
 */
const PREFERRED_GROUP_BY_ENGLISH_KEY: Readonly<Record<string, CardGroupIcon>> = {
  body: "body",
  eye: "body",
  face: "body",
  foot: "body",
  hair: "body",
  hand: "body",
  head: "body",

  bicycle: "transportVehicles",
  bike: "transportVehicles",
  boat: "transportVehicles",
  bus: "transportVehicles",
  car: "transportVehicles",
  drive: "transportVehicles",
  motorcycle: "transportVehicles",
  plane: "transportVehicles",
  ship: "transportVehicles",
  taxi: "transportVehicles",
  train: "transportVehicles",

  camera: "technologyDevices",
  computer: "technologyDevices",
  keyboard: "technologyDevices",
  phone: "technologyDevices",
  program: "technologyDevices",
  screen: "technologyDevices",
  software: "technologyDevices",
  tablet: "technologyDevices",

  bean: "vegetables",
  bread: "grainsLegumes",
  flour: "grainsLegumes",
  lentil: "grainsLegumes",
  oat: "grainsLegumes",
  pasta: "grainsLegumes",
  rice: "grainsLegumes",
  wheat: "grainsLegumes",

  clothes: "clothes",
  exercise: "sports",
  fork: "kitchenUtensils",
  knife: "kitchenUtensils",
  plate: "kitchenUtensils",
  spoon: "kitchenUtensils",
};

const groupDefinitionsById = new Map(
  CARD_GROUPS.map((definition) => [definition.id, definition]),
);

const canonicalGroupByEnglishKey = new Map<string, CardGroupDefinition>();

for (const definition of CARD_GROUPS) {
  for (const key of definition.englishKeys) {
    const normalizedKey = key.toLowerCase();
    const preferredGroupId = PREFERRED_GROUP_BY_ENGLISH_KEY[normalizedKey];

    if (preferredGroupId) {
      const preferredGroup = groupDefinitionsById.get(preferredGroupId);
      if (preferredGroup) {
        canonicalGroupByEnglishKey.set(normalizedKey, preferredGroup);
      }
      continue;
    }

    if (!canonicalGroupByEnglishKey.has(normalizedKey)) {
      canonicalGroupByEnglishKey.set(normalizedKey, definition);
    }
  }
}

export function getCardsForGroup(groupId: CardGroupIcon, language: LanguageCode): VocabularyCard[] {
  return VOCABULARY_CARDS.filter(
    (card) => card.language === language && getCardGroupForCard(card)?.id === groupId,
  );
}

export function getCardGroup(groupId: CardGroupIcon): CardGroupDefinition | undefined {
  return CARD_GROUPS.find((definition) => definition.id === groupId);
}

export function getCardGroupForCard(card: Pick<VocabularyCard, "englishKey">): CardGroupDefinition | undefined {
  return canonicalGroupByEnglishKey.get(card.englishKey.toLowerCase());
}
