// Icon sourced from Tabler Icons (https://tabler.io/icons/icon/cards)
// Licensed under the MIT License.

import { useId, type SVGProps } from "react";

interface CardsIconProps extends SVGProps<SVGSVGElement> {
  gradientFrom?: string;
  gradientTo?: string;
}

export function CardsIcon({ gradientFrom, gradientTo, ...props }: CardsIconProps) {
  const gradientId = useId();
  const hasGradient = Boolean(gradientFrom && gradientTo);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={hasGradient ? `url(#${gradientId})` : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {hasGradient ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gradientFrom} />
            <stop offset="1" stopColor={gradientTo} />
          </linearGradient>
        </defs>
      ) : null}
      <path d="M3.604 7.197l7.138 -3.109a.96 .96 0 0 1 1.27 .527l4.924 11.902a1 1 0 0 1 -.514 1.304l-7.137 3.109a.96 .96 0 0 1 -1.271 -.527l-4.924 -11.903a1 1 0 0 1 .514 -1.304l0 .001" />
      <path d="M15 4h1a1 1 0 0 1 1 1v3.5" />
      <path d="M20 6c.264 .112 .52 .217 .768 .315a1 1 0 0 1 .53 1.311l-2.298 5.374" />
    </svg>
  );
}
