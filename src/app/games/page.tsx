import { GamesList } from "@/features/games/components/games-list";

export default function GamesPage() {
  return (
    <div data-games-active className="flex h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] flex-col lg:h-[calc(100dvh-var(--app-header-height))]">
      <GamesList />
    </div>
  );
}
