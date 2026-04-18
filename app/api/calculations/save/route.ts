import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { buildSavedCalculationTitle, getToolDefinition } from "@/lib/toolRegistry";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_PAYLOAD_SIZE = 512_000; // 512 KB

type SaveCalculationBody = {
  toolSlug?: unknown;
  inputData?: unknown;
  outputData?: unknown;
  title?: unknown;
};

type JsonObject = {
  [key: string]: Prisma.InputJsonValue;
};

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && isJsonValue(value);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`save-calc:${session.user.id}`, {
    windowMs: 60_000,
    maxRequests: 30,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      { error: "Payload too large." },
      { status: 413 }
    );
  }

  let body: SaveCalculationBody;

  try {
    body = (await request.json()) as SaveCalculationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.toolSlug !== "string" || !getToolDefinition(body.toolSlug)) {
    return NextResponse.json({ error: "Invalid toolSlug." }, { status: 400 });
  }

  if (!isJsonObject(body.inputData) || !isJsonObject(body.outputData)) {
    return NextResponse.json(
      { error: "inputData and outputData must be objects." },
      { status: 400 }
    );
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : buildSavedCalculationTitle(body.toolSlug);

  const calculation = await prisma.savedCalculation.create({
    data: {
      userId: session.user.id,
      toolSlug: body.toolSlug,
      title,
      inputData: body.inputData,
      outputData: body.outputData,
    },
    select: {
      id: true,
      title: true,
      toolSlug: true,
      createdAt: true,
    },
  });

  return NextResponse.json(calculation);
}
