import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/constants";

export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col items-center justify-center bg-black text-white">
        <div tw="text-8xl font-bold tracking-tight">{APP_NAME}</div>
        <div tw="mt-6 text-3xl text-slate-300">Learn languages with collectible cards</div>
      </div>
    ),
    {
      ...size,
    },
  );
}
