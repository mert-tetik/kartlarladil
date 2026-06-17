import type { ReactNode } from "react";

export default function AskLayout({ children }: { children: ReactNode }) {
  return <div data-ask-page>{children}</div>;
}
