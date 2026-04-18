import { NextResponse } from "next/server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const calculation = await prisma.savedCalculation.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    select: {
      id: true,
      toolSlug: true,
      title: true,
      inputData: true,
      outputData: true,
      createdAt: true,
    },
  });

  if (!calculation) {
    return NextResponse.json(
      { error: "Saved calculation not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(calculation);
}
