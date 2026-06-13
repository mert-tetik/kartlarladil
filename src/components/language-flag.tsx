import { LANGUAGE_BY_CODE } from "@/data/languages";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export function LanguageFlag({
  code,
  className,
}: {
  code: LanguageCode | LocaleCode;
  className?: string;
}) {
  const language = LANGUAGE_BY_CODE[code];

  return (
    <svg
      role="img"
      aria-label={language.nativeName}
      viewBox="0 0 64 48"
      className={cn(
        "inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] border border-slate-900/10 bg-white",
        className,
      )}
    >
      {renderFlag(language.flagCode)}
    </svg>
  );
}

function renderFlag(flagCode: string) {
  switch (flagCode) {
    case "tr":
      return <TurkeyFlag />;
    case "gb":
      return <UnitedKingdomFlag />;
    case "de":
      return <HorizontalStripes colors={["#000000", "#dd0000", "#ffce00"]} />;
    case "ru":
      return <HorizontalStripes colors={["#ffffff", "#0039a6", "#d52b1e"]} />;
    case "fr":
      return <VerticalStripes colors={["#0055a4", "#ffffff", "#ef4135"]} />;
    case "es":
      return <SpainFlag />;
    case "it":
      return <VerticalStripes colors={["#009246", "#ffffff", "#ce2b37"]} />;
    case "pt":
      return <PortugalFlag />;
    case "nl":
      return <HorizontalStripes colors={["#ae1c28", "#ffffff", "#21468b"]} />;
    case "pl":
      return <HorizontalStripes colors={["#ffffff", "#dc143c"]} />;
    case "sa":
      return <SaudiArabiaFlag />;
    case "jp":
      return <JapanFlag />;
    case "kr":
      return <SouthKoreaFlag />;
    case "cn":
      return <ChinaFlag />;
    default:
      return <rect width="64" height="48" fill="#f8fafc" />;
  }
}

function HorizontalStripes({ colors }: { colors: string[] }) {
  const stripeHeight = 48 / colors.length;

  return (
    <>
      {colors.map((color, index) => (
        <rect key={color} x="0" y={index * stripeHeight} width="64" height={stripeHeight} fill={color} />
      ))}
    </>
  );
}

function VerticalStripes({ colors }: { colors: string[] }) {
  const stripeWidth = 64 / colors.length;

  return (
    <>
      {colors.map((color, index) => (
        <rect key={color} x={index * stripeWidth} y="0" width={stripeWidth} height="48" fill={color} />
      ))}
    </>
  );
}

function TurkeyFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#e30a17" />
      <circle cx="26" cy="24" r="12" fill="#ffffff" />
      <circle cx="30" cy="24" r="9.5" fill="#e30a17" />
      <polygon points={starPoints(42, 24, 6.2, 2.5)} fill="#ffffff" />
    </>
  );
}

function UnitedKingdomFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#012169" />
      <path d="M-8 0 72 48M72 0-8 48" stroke="#ffffff" strokeWidth="10" />
      <path d="M-8 0 72 48M72 0-8 48" stroke="#c8102e" strokeWidth="5" />
      <path d="M32 0v48M0 24h64" stroke="#ffffff" strokeWidth="16" />
      <path d="M32 0v48M0 24h64" stroke="#c8102e" strokeWidth="9" />
    </>
  );
}

function SpainFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#aa151b" />
      <rect y="12" width="64" height="24" fill="#f1bf00" />
      <g transform="translate(18 24)">
        <rect x="-3.5" y="-6" width="7" height="12" rx="1" fill="#c60b1e" />
        <rect x="-2.2" y="-4.5" width="4.4" height="9" rx="0.8" fill="#f8fafc" />
        <circle cx="0" cy="-2" r="1.4" fill="#f1bf00" />
      </g>
    </>
  );
}

function PortugalFlag() {
  return (
    <>
      <rect width="26" height="48" fill="#006600" />
      <rect x="26" width="38" height="48" fill="#ff0000" />
      <circle cx="26" cy="24" r="8.2" fill="none" stroke="#ffcc00" strokeWidth="3.2" />
      <path d="M27 18h10v8c0 4-5 7-5 7s-5-3-5-7z" fill="#ffffff" />
      <path d="M27 18h5v13c-1.6-1.1-3-2.8-3-5v-8z" fill="#0055a4" />
      <path d="M27 18h10v8c0 4-5 7-5 7s-5-3-5-7z" fill="none" stroke="#c8102e" strokeWidth="1.2" />
    </>
  );
}

function SaudiArabiaFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#006c35" />
      <text
        x="32"
        y="20"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="serif"
        fontSize="6.2"
        fontWeight="700"
      >
        لا إله إلا الله
      </text>
      <path d="M18 31h25c3.5 0 5.5-1 7.5-2.8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 33h23" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

function JapanFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#ffffff" />
      <circle cx="32" cy="24" r="12.5" fill="#bc002d" />
    </>
  );
}

function SouthKoreaFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#ffffff" />
      <g transform="translate(32 24)">
        <path d="M-10 0a10 10 0 0 1 20 0 5 5 0 0 1-10 0 5 5 0 0 0-10 0z" fill="#cd2e3a" />
        <path d="M-10 0a10 10 0 0 0 20 0 5 5 0 0 0-10 0 5 5 0 0 1-10 0z" fill="#0047a0" />
      </g>
      <Trigram x={17} y={11} rotate={-32} pattern="solid-solid-solid" />
      <Trigram x={43} y={11} rotate={32} pattern="broken-solid-broken" />
      <Trigram x={17} y={34} rotate={32} pattern="solid-broken-solid" />
      <Trigram x={43} y={34} rotate={-32} pattern="broken-broken-broken" />
    </>
  );
}

function Trigram({
  x,
  y,
  rotate,
  pattern,
}: {
  x: number;
  y: number;
  rotate: number;
  pattern: "solid-solid-solid" | "broken-solid-broken" | "solid-broken-solid" | "broken-broken-broken";
}) {
  const rows = pattern.split("-") as Array<"solid" | "broken">;

  return (
    <g transform={`translate(${x - 5} ${y - 4}) rotate(${rotate} 5 4)`} fill="#111827">
      {rows.map((row, index) =>
        row === "solid" ? (
          <rect key={index} x="0" y={index * 3} width="10" height="1.5" />
        ) : (
          <g key={index}>
            <rect x="0" y={index * 3} width="4" height="1.5" />
            <rect x="6" y={index * 3} width="4" height="1.5" />
          </g>
        ),
      )}
    </g>
  );
}

function ChinaFlag() {
  return (
    <>
      <rect width="64" height="48" fill="#de2910" />
      <polygon points={starPoints(14, 12, 7, 2.8)} fill="#ffde00" />
      <polygon points={starPoints(27, 7, 3, 1.2, -0.15)} fill="#ffde00" />
      <polygon points={starPoints(33, 13, 3, 1.2, 0.25)} fill="#ffde00" />
      <polygon points={starPoints(33, 21, 3, 1.2, 0.55)} fill="#ffde00" />
      <polygon points={starPoints(27, 27, 3, 1.2, 0.85)} fill="#ffde00" />
    </>
  );
}

function starPoints(cx: number, cy: number, outer: number, inner: number, rotation = -Math.PI / 2) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = rotation + (index * Math.PI) / 5;

    return `${round(cx + Math.cos(angle) * radius)},${round(cy + Math.sin(angle) * radius)}`;
  }).join(" ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
