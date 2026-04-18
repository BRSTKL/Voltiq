import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { checkUsageLimit, incrementUsage } from "@/lib/usage";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

type CheckUsageBody = {
  toolSlug?: unknown;
  consume?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ allowed: false }, { status: 401 });
  }

  const rl = checkRateLimit(`check-usage:${session.user.id}`, {
    windowMs: 60_000,
    maxRequests: 60,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: CheckUsageBody;

  try {
    body = (await request.json()) as CheckUsageBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const toolSlug =
    typeof body.toolSlug === "string" ? body.toolSlug.trim().toLowerCase() : "";

  if (!toolSlug) {
    return NextResponse.json(
      { error: "toolSlug is required." },
      { status: 400 }
    );
  }

  const consume = body.consume === true;
  const result = await checkUsageLimit(
    session.user.id,
    toolSlug,
    session.user.plan ?? "FREE"
  );

  if (result.allowed && consume) {
    await incrementUsage(session.user.id, toolSlug);
  }

  return NextResponse.json(result);
}
