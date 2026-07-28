import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { inngest } from "@/lib/inngest";
import { rateLimit } from "@/lib/rateLimit";

function checkRateLimit(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  return rateLimit(ip, 10, 60000); // 10 requests per minute
}

export async function GET(request: NextRequest) {
  const limit = checkRateLimit(request);
  if (!limit.success) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAuth(projectId);

    const results = await prisma.validationResult.findMany({
      where: {
        projectId,
        source: "VALIDATION_ENGINE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching validation results:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request);
  if (!limit.success) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { user } = await requireProjectAuth(projectId);

    // Trigger manual run
    await inngest.send({
      name: "validation.requested",
      data: { projectId, requestedBy: user.id },
    });

    return NextResponse.json({ message: "Validation requested successfully" }, { status: 202 });
  } catch (error: any) {
    console.error("Error requesting validation:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
