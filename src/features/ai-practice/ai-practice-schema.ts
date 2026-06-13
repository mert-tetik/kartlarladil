import { z } from "zod";
import { LANGUAGE_CODES } from "@/data/languages";

const languageCodeSchema = z.enum(LANGUAGE_CODES);

export const aiPracticeChatRequestSchema = z
  .object({
    language: languageCodeSchema,
    characterId: z.string().min(1).max(80),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(900),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((value) => value.messages.at(-1)?.role === "user", {
    message: "The latest message must be from the user.",
    path: ["messages"],
  });
