interface GameRouteLoadingProps {
  color: string;
}

export function GameRouteLoading({ color }: GameRouteLoadingProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading game"
      className="fixed inset-0 z-[260] flex items-center justify-center"
      role="status"
      style={{ backgroundColor: color }}
    />
  );
}
