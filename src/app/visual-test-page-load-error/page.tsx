import type { Metadata } from "next";
import { PageLoadErrorTestScreen } from "@/app/visual-test-page-load-error/page-load-error-test-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page load error visual test | FoxiesDeck",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PageLoadErrorVisualTestPage() {
  return <PageLoadErrorTestScreen />;
}
