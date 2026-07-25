import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { canEdit } from "@/rbac";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { projectId, ...profileData } = data;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { membership } = await requireProjectAuth(projectId);

    if (!canEdit(membership.role, "COMPANY_PROFILE")) {
      return NextResponse.json(
        { error: `Forbidden: Your role (${membership.role}) cannot edit the Company Profile.` },
        { status: 403 }
      );
    }

    // Upsert CompanyProfile
    const companyProfile = await prisma.companyProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        companyName: profileData.companyName || "",
        cin: profileData.cin || "",
        incorporationDate: profileData.incorporationDate ? new Date(profileData.incorporationDate) : new Date(),
        registeredOffice: profileData.registeredOffice || "",
        sector: profileData.sector || "",
        promoters: profileData.promoters || [],
        capitalStructure: profileData.capitalStructure || {},
        pan: profileData.pan || "",
        gstin: profileData.gstin,
        fiscalYearEnd: profileData.fiscalYearEnd || "",
        website: profileData.website,
      },
      update: {
        companyName: profileData.companyName,
        cin: profileData.cin,
        incorporationDate: profileData.incorporationDate ? new Date(profileData.incorporationDate) : undefined,
        registeredOffice: profileData.registeredOffice,
        sector: profileData.sector,
        promoters: profileData.promoters,
        capitalStructure: profileData.capitalStructure,
        pan: profileData.pan,
        gstin: profileData.gstin,
        fiscalYearEnd: profileData.fiscalYearEnd,
        website: profileData.website,
      },
    });

    // Synchronously write every field into KnowledgeBaseEntry with sourceType = company_profile
    // We clear old company_profile entries for this project and insert the new ones.
    await prisma.knowledgeBaseEntry.deleteMany({
      where: {
        projectId,
        sourceType: "company_profile",
      },
    });

    const entriesToCreate = Object.entries(companyProfile)
      .filter(([key, value]) => key !== "id" && key !== "projectId" && value !== null && value !== undefined)
      .map(([key, value]) => ({
        projectId,
        sourceType: "company_profile",
        fieldKey: key,
        fieldValue: typeof value === "object" ? JSON.stringify(value) : String(value),
        confidence: 1.0,
      }));

    if (entriesToCreate.length > 0) {
      await prisma.knowledgeBaseEntry.createMany({
        data: entriesToCreate,
      });
    }

    return NextResponse.json({ companyProfile }, { status: 200 });
  } catch (error: any) {
    console.error("Error saving company profile:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
