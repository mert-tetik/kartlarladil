import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";

function responseWith(value: unknown) {
  return value as OpenAIResponse;
}

describe("extractResponseOutputText", () => {
  it("uses the complete top-level output_text so the first words are preserved", () => {
    expect(
      extractResponseOutputText(
        responseWith({
          output_text: "First words must remain visible.",
          output: [],
        }),
      ),
    ).toBe("First words must remain visible.");
  });

  it("concatenates standard output text parts in order", () => {
    expect(
      extractResponseOutputText(
        responseWith({
          output: [
            {
              type: "message",
              content: [
                { type: "output_text", text: "First " },
                { type: "output_text", text: "second." },
              ],
            },
          ],
        }),
      ),
    ).toBe("First second.");
  });

  it("supports compatible providers that return text parts", () => {
    expect(
      extractResponseOutputText(
        responseWith({
          output: [
            {
              type: "message",
              content: [{ type: "text", text: "First " }, { type: "text", text: "second." }],
            },
          ],
        }),
      ),
    ).toBe("First second.");
  });

  it("keeps a compatible text prefix when the SDK output_text only contains the suffix", () => {
    expect(
      extractResponseOutputText(
        responseWith({
          output_text: "cek planlarından bahsederken",
          output: [
            {
              type: "message",
              content: [
                { type: "text", text: "Gele" },
                { type: "output_text", text: "cek planlarından bahsederken" },
              ],
            },
          ],
        }),
      ),
    ).toBe("Gelecek planlarından bahsederken");
  });

  it("ignores malformed output entries without throwing", () => {
    expect(
      extractResponseOutputText(
        responseWith({
          output: [null, { type: "reasoning" }, { type: "message", content: [{ type: "refusal" }] }],
        }),
      ),
    ).toBe("");
  });
});
