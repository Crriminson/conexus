import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireAuth } from "@/utils/supabase/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          where: {
            userId: user.id,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ projects }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { companyName, industry, incorporationYear, companyType, registeredOffice, promoterDetails, financialYear } = await request.json();

    if (!companyName) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name: companyName, // Map companyName to name
        companyName,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "APPLICANT_COMPANY",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
        },
        companyProfile: {
          create: {
            companyName,
            cin: "", // Default or get from form if added
            incorporationDate: incorporationYear ? new Date(Number(incorporationYear), 0, 1) : new Date(),
            registeredOffice,
            sector: industry,
            promoters: promoterDetails ? [promoterDetails] : [],
            capitalStructure: {},
            pan: "",
            gstin: "",
            fiscalYearEnd: financialYear,
            website: "",
          }
        }
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
