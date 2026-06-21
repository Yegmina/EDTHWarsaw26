import { NextResponse } from "next/server";
import type { PostStrikeData, StrikeRecommendation } from "@/app/types/pipeline";

export const runtime = "nodejs";

type SourceReportInput = Partial<PostStrikeData["sourceReports"][number]>;
type TimelineInput = Partial<PostStrikeData["timeline"][number]>;

type PostAnalysisPayload = {
  recommendation?: StrikeRecommendation;
  evidence?: {
    visualStatus?: string;
    cameraNotes?: string;
    audioNotes?: string;
    satelliteNotes?: string;
    confidence?: number;
    statusOverride?: PostStrikeData["status"] | "auto";
    sourceReports?: SourceReportInput[];
    timeline?: TimelineInput[];
    gaps?: string[];
    nextReviewActions?: string[];
  };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as PostAnalysisPayload;
    if (!payload.recommendation?.id) {
      return NextResponse.json({ error: "Recommendation is required." }, { status: 400 });
    }

    const sourceReports = normalizeSourceReports(payload);
    const confidenceScore = normalizeConfidence(
      payload.evidence?.confidence,
      averageConfidence(sourceReports, 76)
    );
    const status =
      payload.evidence?.statusOverride && payload.evidence.statusOverride !== "auto"
        ? payload.evidence.statusOverride
        : inferStatus(sourceReports, payload.evidence?.visualStatus, confidenceScore);
    const createdAt = new Date().toISOString();
    const timeline = normalizeTimeline(payload.evidence?.timeline);
    const observedEffects = sourceReports
      .filter((report) => report.summary.trim())
      .map((report) => `${report.label}: ${report.summary}`)
      .slice(0, 6);

    const result: PostStrikeData = {
      id: `post-${Date.now()}`,
      recommendationId: payload.recommendation.id,
      createdAt,
      status,
      confidenceScore,
      observedEffects: observedEffects.length ? observedEffects : ["No source summaries were submitted."],
      sourceReports,
      timeline,
      gaps: buildGaps(sourceReports, payload.evidence?.gaps),
      nextReviewActions: buildNextActions(sourceReports, payload.evidence?.nextReviewActions)
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to run post-strike analysis." }, { status: 500 });
  }
}

function normalizeSourceReports(payload: PostAnalysisPayload): PostStrikeData["sourceReports"] {
  const submitted = payload.evidence?.sourceReports;
  if (Array.isArray(submitted) && submitted.length) {
    return submitted.slice(0, 8).map((report, index) => ({
      id: sanitizeText(report.id, `source-${index + 1}`),
      type: normalizeReportType(report.type),
      label: sanitizeText(report.label, `Source ${index + 1}`),
      status: normalizeReportStatus(report.status),
      confidence: normalizeConfidence(report.confidence, 50),
      summary: sanitizeText(report.summary, "No summary submitted.")
    }));
  }

  const confidence = normalizeConfidence(payload.evidence?.confidence, 76);
  return [
    {
      id: "source-video",
      type: "video",
      label: "Video review",
      status: confidence >= 70 ? "confirmed" : "supporting",
      confidence,
      summary: payload.evidence?.visualStatus || "Video source submitted for review."
    },
    {
      id: "source-camera",
      type: "camera",
      label: "Public camera layer",
      status: payload.evidence?.cameraNotes ? "supporting" : "pending",
      confidence: payload.evidence?.cameraNotes ? Math.max(45, confidence - 12) : 35,
      summary: payload.evidence?.cameraNotes || "Camera corroboration pending."
    },
    {
      id: "source-audio",
      type: "audio",
      label: "Audio sensor layer",
      status: payload.evidence?.audioNotes ? "supporting" : "pending",
      confidence: payload.evidence?.audioNotes ? Math.max(42, confidence - 18) : 30,
      summary: payload.evidence?.audioNotes || "Audio confirmation pending."
    },
    {
      id: "source-satellite",
      type: "satellite",
      label: "Satellite tasking",
      status: payload.evidence?.satelliteNotes ? "supporting" : "pending",
      confidence: payload.evidence?.satelliteNotes ? Math.max(40, confidence - 20) : 28,
      summary: payload.evidence?.satelliteNotes || "Satellite imagery not yet available."
    }
  ];
}

function normalizeTimeline(timeline: TimelineInput[] | undefined): PostStrikeData["timeline"] {
  if (Array.isArray(timeline) && timeline.length) {
    return timeline.slice(0, 8).map((item, index) => ({
      time: sanitizeText(item.time, `T+${index * 15}m`),
      label: sanitizeText(item.label, `Review step ${index + 1}`),
      detail: sanitizeText(item.detail, "Timeline detail not provided.")
    }));
  }

  return [
    {
      time: "T+0",
      label: "Event window",
      detail: "Primary visual/audio event window recorded for review."
    },
    {
      time: "T+15m",
      label: "Camera sweep",
      detail: "Public camera layer reviewed for flash or impact-detected indicators."
    },
    {
      time: "T+60m",
      label: "Fusion pass",
      detail: "Evidence reports fused into current BDA status."
    }
  ];
}

function inferStatus(
  sourceReports: PostStrikeData["sourceReports"],
  legacyText: string | undefined,
  confidence: number
): PostStrikeData["status"] {
  const combinedText = [legacyText, ...sourceReports.map((report) => report.summary)].join(" ").toLowerCase();
  const confirmedCount = sourceReports.filter((report) => report.status === "confirmed").length;
  const conflictingCount = sourceReports.filter((report) => report.status === "conflicting").length;
  const supportingCount = sourceReports.filter((report) => report.status === "supporting").length;

  if (confidence < 45) {
    return "unknown";
  }
  if (conflictingCount > confirmedCount + supportingCount || /\b(active|operational|no visible damage|unchanged)\b/.test(combinedText)) {
    return "active";
  }
  if (confirmedCount >= 2 && confidence >= 82 && /\b(destroyed|neutralized|collapsed|fully engulfed|catastrophic|total loss)\b/.test(combinedText)) {
    return "destroyed";
  }
  if (supportingCount + confirmedCount >= 1 || /\b(partial|damaged|smoke|impact detected|secondary|burning|blast|fire)\b/.test(combinedText)) {
    return "partially-damaged";
  }
  return confidence >= 88 && confirmedCount >= 2 ? "destroyed" : "unknown";
}

function buildGaps(sourceReports: PostStrikeData["sourceReports"], submitted: string[] | undefined) {
  const gaps = Array.isArray(submitted) ? submitted.filter(Boolean) : [];
  if (sourceReports.some((report) => report.status === "pending")) {
    gaps.push("Pending source reports require follow-up before final confidence is locked.");
  }
  if (sourceReports.some((report) => report.status === "conflicting")) {
    gaps.push("Conflicting source reports require analyst reconciliation.");
  }
  if (sourceReports.some((report) => report.type === "satellite" && report.status !== "confirmed")) {
    gaps.push("Independent imagery remains the highest-value confirmation source.");
  }
  gaps.push("Precise source timestamps and metadata require analyst confirmation.");
  return unique(gaps).slice(0, 8);
}

function buildNextActions(sourceReports: PostStrikeData["sourceReports"], submitted: string[] | undefined) {
  const actions = Array.isArray(submitted) ? submitted.filter(Boolean) : [];
  if (sourceReports.some((report) => report.status === "pending")) {
    actions.push("Queue pending source review.");
  }
  if (sourceReports.some((report) => report.status === "conflicting")) {
    actions.push("Run source conflict review and preserve both versions.");
  }
  actions.push("Preserve raw video, camera, audio, and imagery references.");
  actions.push("Re-score confidence when independent source metadata is available.");
  return unique(actions).slice(0, 8);
}

function averageConfidence(sourceReports: PostStrikeData["sourceReports"], fallback: number) {
  if (!sourceReports.length) {
    return fallback;
  }
  return Math.round(sourceReports.reduce((sum, report) => sum + report.confidence, 0) / sourceReports.length);
}

function normalizeConfidence(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(parsed) ? parsed : fallback)));
}

function normalizeReportType(value: unknown): PostStrikeData["sourceReports"][number]["type"] {
  return value === "video" ||
    value === "satellite" ||
    value === "camera" ||
    value === "audio" ||
    value === "operator" ||
    value === "other"
    ? value
    : "other";
}

function normalizeReportStatus(value: unknown): PostStrikeData["sourceReports"][number]["status"] {
  return value === "confirmed" || value === "supporting" || value === "conflicting" || value === "pending"
    ? value
    : "pending";
}

function sanitizeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
