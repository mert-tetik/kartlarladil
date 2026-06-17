import type { ReactNode } from "react";

export default function AiPracticeLayout({ children }: { children: ReactNode }) {
  return <div data-ai-practice-page>{children}</div>;
}
