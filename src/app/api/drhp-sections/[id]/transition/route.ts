import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { requireProjectAuth } from "@/utils/supabase/auth";
import { CATEGORY_OWNERS, canEdit } from "@/rbac";
import { SectionStatus, ProjectRole } from "@prisma/client";
import { inngest } from "@/lib/inngest";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sectionId = params.id;
    const data = await request.json();
    const { action, reviewNotes } = data; // action: 'submit', 'approve', 'request-changes', 'reopen'

    const section = await prisma.dRHPSection.findUnique({
      where: { id: sectionId },
      include: { versions: { select: { reviewRound: true } } }
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const { user, membership } = await requireProjectAuth(section.projectId);

    // Calculate current maximum review round
    let currentRound = 1;
    if (section.versions.length > 0) {
      currentRound = Math.max(...section.versions.map(v => v.reviewRound));
    }

    let newStatus: SectionStatus;
    let newRound = currentRound;

    const owningRole = CATEGORY_OWNERS[section.category];

    if (action === 'submit') {
      if (!canEdit(membership.role, section.category)) {
        return NextResponse.json({ error: "Forbidden: You cannot edit this category." }, { status: 403 });
      }
      if (section.status !== 'DRAFT' && section.status !== 'CHANGES_REQUESTED') {
        return NextResponse.json({ error: "Invalid state transition to SUBMITTED_FOR_REVIEW" }, { status: 400 });
      }
      if (section.status === 'CHANGES_REQUESTED') {
        newRound = currentRound + 1;
      }
      newStatus = 'SUBMITTED_FOR_REVIEW';
    } 
    else if (action === 'approve') {
      if (membership.role !== owningRole && membership.role !== 'MERCHANT_BANKER') {
        // Merchant Banker has implicit ownership of some? Actually the prompt says:
        // "Only the category's owning role can approve or request changes ... every other role, including Merchant Banker for categories they don't own outright, can view but not act."
        // Wait, the prompt says "Only the category's owning role... can approve".
        if (membership.role !== owningRole) {
          return NextResponse.json({ error: "Forbidden: Only the owning reviewer can approve." }, { status: 403 });
        }
      }
      if (section.status !== 'SUBMITTED_FOR_REVIEW') {
        return NextResponse.json({ error: "Section must be SUBMITTED_FOR_REVIEW to approve" }, { status: 400 });
      }
      newStatus = 'APPROVED';
    } 
    else if (action === 'request-changes') {
      if (membership.role !== owningRole) {
        return NextResponse.json({ error: "Forbidden: Only the owning reviewer can request changes." }, { status: 403 });
      }
      if (section.status !== 'SUBMITTED_FOR_REVIEW') {
        return NextResponse.json({ error: "Section must be SUBMITTED_FOR_REVIEW to request changes" }, { status: 400 });
      }
      if (!reviewNotes || reviewNotes.trim() === '') {
        return NextResponse.json({ error: "reviewNotes are required when requesting changes." }, { status: 400 });
      }
      newStatus = 'CHANGES_REQUESTED';
    } 
    else if (action === 'reopen') {
      if (membership.role !== 'MERCHANT_BANKER') {
        return NextResponse.json({ error: "Forbidden: Only MERCHANT_BANKER can reopen an approved section." }, { status: 403 });
      }
      if (section.status !== 'APPROVED') {
        return NextResponse.json({ error: "Section must be APPROVED to reopen." }, { status: 400 });
      }
      newStatus = 'SUBMITTED_FOR_REVIEW';
      newRound = currentRound + 1;
    } 
    else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updatedSection = await prisma.$transaction(async (tx) => {
      // 1. Update Section
      const sec = await tx.dRHPSection.update({
        where: { id: sectionId },
        data: { status: newStatus }
      });

      // 2. Create Version Snapshot (Only when transitioning to SUBMITTED_FOR_REVIEW, APPROVED, or CHANGES_REQUESTED)
      // Actually any action here transitions to one of these three.
      await tx.dRHPSectionVersion.create({
        data: {
          sectionId,
          content: sec.content,
          status: newStatus,
          createdById: user.id,
          reviewRound: newRound,
          reviewerId: (action === 'approve' || action === 'request-changes' || action === 'reopen') ? user.id : null,
          reviewNotes: reviewNotes || null,
        }
      });

      // 3. Create AuditLog
      await tx.auditLog.create({
        data: {
          projectId: sec.projectId,
          actorId: user.id,
          action: `TRANSITION_SECTION_${action.toUpperCase()}`,
          entityType: "DRHPSection",
          entityId: sectionId,
          metadata: { from: section.status, to: newStatus, reviewRound: newRound } as any,
        }
      });

      return sec;
    });

    // Fire Inngest event
    await inngest.send({
      name: "section.status.changed",
      data: { sectionId, projectId: section.projectId, status: newStatus },
    });

    return NextResponse.json({ section: updatedSection }, { status: 200 });

  } catch (error: any) {
    console.error("Error transitioning section:", error);
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
