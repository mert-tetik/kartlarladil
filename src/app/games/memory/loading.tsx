import { GameRouteLoading } from "@/features/games/components/game-route-loading";
import { GAME_LAUNCH_COLORS } from "@/features/games/game-launch-transition";

export default function Loading() {
  return <GameRouteLoading color={GAME_LAUNCH_COLORS.memory} />;
}
