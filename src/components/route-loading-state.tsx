export function RouteLoadingState() {
  return (
    <section className="mx-auto flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 max-w-7xl items-center justify-center bg-background px-4 py-16 text-foreground max-lg:h-[calc(100dvh-8rem)] max-lg:max-h-[calc(100dvh-8rem)] sm:px-6 lg:px-8">
      <div className="route-loading-pencil-wrap" role="status" aria-label="Loading page">
        <svg className="route-loading-pencil" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <clipPath id="route-loading-pencil-eraser">
              <rect height="30" width="30" ry="5" rx="5" />
            </clipPath>
          </defs>
          <circle
            className="route-loading-pencil__stroke"
            transform="rotate(-113 100 100)"
            strokeLinecap="round"
            strokeDashoffset="439.82"
            strokeDasharray="439.82 439.82"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            r="70"
          />
          <g transform="translate(100 100)" className="route-loading-pencil__rotate">
            <g fill="none">
              <circle
                className="route-loading-pencil__body1"
                transform="rotate(-90)"
                strokeDashoffset="402"
                strokeDasharray="402.12 402.12"
                strokeWidth="30"
                stroke="var(--route-pencil-body-1, var(--brand))"
                r="64"
              />
              <circle
                className="route-loading-pencil__body2"
                transform="rotate(-90)"
                strokeDashoffset="465"
                strokeDasharray="464.96 464.96"
                strokeWidth="10"
                stroke="var(--route-pencil-body-2, var(--brand))"
                r="74"
              />
              <circle
                className="route-loading-pencil__body3"
                transform="rotate(-90)"
                strokeDashoffset="339"
                strokeDasharray="339.29 339.29"
                strokeWidth="10"
                stroke="var(--route-pencil-body-3, var(--brand))"
                r="54"
              />
            </g>
            <g transform="rotate(-90) translate(49 0)" className="route-loading-pencil__eraser">
              <g className="route-loading-pencil__eraser-skew">
                <rect height="30" width="30" ry="5" rx="5" fill="var(--route-pencil-eraser, var(--brand))" />
                <rect clipPath="url(#route-loading-pencil-eraser)" height="30" width="5" fill="var(--route-pencil-eraser-shade, var(--brand))" />
                <rect height="20" width="30" fill="var(--route-pencil-eraser-band, #f5f5f5)" />
                <rect height="20" width="15" fill="var(--route-pencil-eraser-band-shadow, #c7c7c7)" />
                <rect height="20" width="5" fill="#e2e2e2" />
                <rect height="2" width="30" y="6" fill="rgb(0 0 0 / 20%)" />
                <rect height="2" width="30" y="13" fill="rgb(0 0 0 / 20%)" />
              </g>
            </g>
            <g transform="rotate(-90) translate(49 -30)" className="route-loading-pencil__point">
              <polygon points="15 0 30 30 0 30" fill="var(--route-pencil-point-light, var(--brand))" />
              <polygon points="15 0 6 30 0 30" fill="var(--route-pencil-point-dark, var(--brand))" />
              <polygon points="15 0 20 10 10 10" fill="#1f1f1f" />
            </g>
          </g>
        </svg>
      </div>
      <span className="sr-only">Loading page</span>
    </section>
  );
}
