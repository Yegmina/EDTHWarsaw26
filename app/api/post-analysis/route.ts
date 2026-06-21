import { NextResponse } from "next/server";
import type { PostStrikeData, StrikeRecommendation } from "@/app/types/pipeline";

export const runtime = "nodejs";

type PostAnalysisPayload = {
  recommendation?: StrikeRecommendation;
  evidence?: {
    visualStatus?: string;
    cameraNotes?: string;
    audioNotes?: string;
    satelliteNotes?: string;
    confidence?: number;
  };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as PostAnalysisPayload;
    if (!payload.recommendation?.id) {
      return NextResponse.json({ error: "Recommendation is required." }, { status: 400 });
    }

    const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(payload.evidence?.confidence ?? 76))));
    const status = inferStatus(payload.evidence?.visualStatus, confidenceScore);
    const createdAt = new Date().toISOString();

    const result: PostStrikeData = {
      id: `post-${Date.now()}`,
      recommendationId: payload.recommendation.id,
      createdAt,
      status,
      confidenceScore,
      observedEffects: [
        payload.evidence?.visualStatus || "Visible scene change reported by video source.",
        payload.evidence?.cameraNotes || "Camera layer provides supporting public-view context.",
        payload.evidence?.audioNotes || "Audio layer requires further corroboration."
      ],
      sourceReports: [
        {
          id: "source-video",
          type: "video",
          label: "Video review",
          status: confidenceScore >= 70 ? "confirmed" : "supporting",
          confidence: confidenceScore,
          summary: payload.evidence?.visualStatus || "Video source submitted for review."
        },
        {
          id: "source-camera",
          type: "camera",
          label: "Public camera layer",
          status: payload.evidence?.cameraNotes ? "supporting" : "pending",
          confidence: payload.evidence?.cameraNotes ? Math.max(45, confidenceScore - 12) : 35,
          summary: payload.evidence?.cameraNotes || "Camera corroboration pending."
        },
        {
          id: "source-audio",
          type: "audio",
          label: "Audio sensor layer",
          status: payload.evidence?.audioNotes ? "supporting" : "pending",
          confidence: payload.evidence?.audioNotes ? Math.max(42, confidenceScore - 18) : 30,
          summary: payload.evidence?.audioNotes || "Audio confirmation pending."
        },
        {
          id: "source-satellite",
          type: "satellite",
          label: "Satellite tasking",
          status: payload.evidence?.satelliteNotes ? "supporting" : "pending",
          confidence: payload.evidence?.satelliteNotes ? Math.max(40, confidenceScore - 20) : 28,
          summary: payload.evidence?.satelliteNotes || "Satellite imagery not yet available."
        }
      ],
      timeline: [
        {
          time: "T+0",
          label: "Event window",
          detail: "Primary visual/audio event window recorded for review."
        },
        {
          time: "T+15m",
          label: "Camera sweep",
          detail: "Public camera layer reviewed for plume, flash, or scene-change indicators."
        },
        {
          time: "T+60m",
          label: "Fusion pass",
          detail: "Evidence reports fused into current BDA status."
        }
      ],
      gaps: [
        "Precise source timestamps and metadata require analyst confirmation.",
        "Satellite imagery remains the highest-value independent confirmation source.",
        "Conflicting reports should be preserved until source reliability is scored."
      ],
      nextReviewActions: [
        "Queue follow-up imagery review.",
        "Preserve raw video, camera, and audio source references.",
        "Re-score confidence when independent source metadata is available."
      ]
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to run post-strike analysis." }, { status: 500 });
  }
}

function inferStatus(text: string | undefined, confidence: number): PostStrikeData["status"] {
  const lower = text?.toLowerCase() ?? "";
  if (confidence < 45) {
    return "unknown";
  }
  if (/\b(active|operational|no visible damage|unchanged)\b/.test(lower)) {
    return "active";
  }
  if (/\b(destroyed|neutralized|collapsed|fully engulfed|catastrophic|total loss)\b/.test(lower)) {
    return "destroyed";
  }
  if (/\b(partial|damaged|smoke|plume|secondary|burning|blast|fire)\b/.test(lower)) {
    return "partially-damaged";
  }
  return confidence >= 88 ? "destroyed" : "partially-damaged";
}
