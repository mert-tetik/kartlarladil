import { GamesList } from "@/features/games/components/games-list";

export default function GamesPage() {
  return (
    <div
      data-games-active
      className="relative flex h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] flex-col overflow-hidden lg:h-[calc(100dvh-var(--app-header-height))]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url('/game-backgrounds/games-page-bg.png')] bg-cover bg-center lg:hidden"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/55 lg:hidden" />
      <div className="relative z-10 flex min-h-0 flex-1">
        <GamesList />
      </div>
    </div>
  );
}
