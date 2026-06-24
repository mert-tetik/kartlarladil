import { NextResponse } from "next/server";

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const from = searchParams.get("from")?.toUpperCase() ?? "";
  const to = searchParams.get("to")?.toUpperCase() ?? "";

  if (
    !CURRENCY_CODE_PATTERN.test(from) ||
    !CURRENCY_CODE_PATTERN.test(to)
  ) {
    return NextResponse.json({ error: "invalid_currency" }, { status: 400 });
  }

  if (from === to) {
    return NextResponse.json({ rate: 1 });
  }

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rates?base=${from}&quotes=${to}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "rate_unavailable" },
      { status: 502 },
    );
  }

  const data = (await response.json()) as Array<{
    quote?: string;
    rate?: number;
  }>;
  const rate = data.find((item) => item.quote === to)?.rate;

  if (typeof rate !== "number") {
    return NextResponse.json(
      { error: "rate_unavailable" },
      { status: 502 },
    );
  }

  return NextResponse.json({ rate });
}
