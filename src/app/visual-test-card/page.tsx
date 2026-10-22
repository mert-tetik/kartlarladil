import type { Metadata } from "next";
import { CardDesignTestScreen } from "@/features/cards/components/card-design-test-screen";

export const metadata: Metadata = {
  title: "Card design visual test | FoxiesDeck",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CardDesignTestPage() {
  return <CardDesignTestScreen />;
}
