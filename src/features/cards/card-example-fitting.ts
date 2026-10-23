export const MAX_CARD_EXAMPLE_LINES = 3;

const MIN_FONT_SCALE = 0.2;
const SCALE_SEARCH_ITERATIONS = 12;
const LINE_TOP_TOLERANCE = 1;

function measureExampleLineCount(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);

  if (typeof range.getClientRects === "function") {
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const lineTops: number[] = [];

    for (const rect of rects) {
      if (!lineTops.some((top) => Math.abs(top - rect.top) <= LINE_TOP_TOLERANCE)) {
        lineTops.push(rect.top);
      }
    }

    if (lineTops.length > 0) return lineTops.length;
  }

  const text = element.textContent ?? "";
  if (!text.trim()) return 0;
  if (element.hasAttribute("data-example-breaks-collapsed")) return 1;
  return text.split(/\r\n|\r|\n/).length;
}

/** Fits a card example to three visible lines and records its rendered line count. */
export function fitCardExampleText(element: HTMLElement) {
  element.removeAttribute("data-example-breaks-collapsed");

  const measureAtScale = (scale: number) => {
    element.style.setProperty("--fd-card-example-font-scale", String(scale));
    return measureExampleLineCount(element);
  };

  let lineCount = measureAtScale(1);

  // Preserve intentional line breaks until they would force a fourth row.
  // In that case treat them as normal whitespace so the text can reflow.
  if (lineCount > MAX_CARD_EXAMPLE_LINES) {
    element.setAttribute("data-example-breaks-collapsed", "");
    lineCount = measureAtScale(1);
  }

  let scale = 1;
  if (lineCount > MAX_CARD_EXAMPLE_LINES) {
    let lower = MIN_FONT_SCALE;
    let upper = 1;

    if (measureAtScale(lower) <= MAX_CARD_EXAMPLE_LINES) {
      for (let step = 0; step < SCALE_SEARCH_ITERATIONS; step += 1) {
        const middle = (lower + upper) / 2;
        if (measureAtScale(middle) <= MAX_CARD_EXAMPLE_LINES) lower = middle;
        else upper = middle;
      }
      scale = lower;
    } else {
      scale = MIN_FONT_SCALE;
    }

    lineCount = measureAtScale(scale);
  }

  element.style.setProperty("--fd-card-example-font-scale", String(scale));
  const visibleLineCount = Math.min(lineCount, MAX_CARD_EXAMPLE_LINES);
  element.dataset.exampleLineCount = String(visibleLineCount);
  element.closest<HTMLElement>(".fd-card-design__front")?.setAttribute(
    "data-example-line-count",
    String(visibleLineCount),
  );

  return visibleLineCount;
}

export function fitCardExamples(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".fd-card-design__example").forEach(fitCardExampleText);
}
