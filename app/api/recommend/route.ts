import { NextResponse } from "next/server";
import type { RiskLevel, StrikeRecommendation } from "@/app/types/pipeline";

export const runtime = "nodejs";

type RecommendPayload = {
  targetSummary?: string;
  areaName?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  priority?: string;
  constraints?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as RecommendPayload;
    const lat = safeNumber(payload.coordinates?.lat, 55.7558);
    const lng = safeNumber(payload.coordinates?.lng, 37.6173);
    const priority = String(payload.priority || "high").toLowerCase();
    const riskLevel = riskFromPriority(priority);
    const confidenceScore = confidenceFromInputs(payload);

    const recommendation: StrikeRecommendation = {
      id: `rec-${Date.now()}`,
      createdAt: new Date().toISOString(),
      source: "automated",
      targetSummary: payload.targetSummary?.trim() || "Priority target package",
      coordinates: { lat, lng },
      recommendedWindow: "T+45 to T+90 minutes",
      approachCorridor: `${payload.areaName?.trim() || "Reference area"} northern review corridor`,
      standoffDistanceKm: riskLevel === "critical" ? 120 : riskLevel === "high" ? 90 : 60,
      riskLevel,
      confidenceScore,
      rationale: [
        "Current-state intake contains enough structure to generate a planning packet.",
        "Primary uncertainty is source freshness and independent confirmation.",
        "Post-action assessment should prioritize video, public camera, audio, and satellite evidence fusion."
      ],
      constraints: splitText(payload.constraints, [
        "Sensor confirmation is required before final assessment.",
        "Weather, visibility, and source latency can change the evidence plan."
      ]),
      intelligenceGaps: [
        "No independent imagery timestamp attached to the current packet.",
        "Known defensive coverage should be reviewed against updated map layers.",
        "Post-event collection windows must be confirmed with available sensors."
      ],
      selectedParameters: {
        routeProfile: "Low-exposure corridor with wide standoff margin",
        timing: "Night or low-visibility collection window",
        sensorPlan: "Video, satellite, public camera, and audio cross-check",
        deconfliction: "Hold until source chain and airspace status are reviewed",
        weatherAssumption: "Proceed only with acceptable cloud ceiling and wind drift"
      }
    };

    return NextResponse.json(recommendation);
  } catch {
    return NextResponse.json({ error: "Failed to generate recommendation." }, { status: 500 });
  }
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function riskFromPriority(priority: string): RiskLevel {
  if (priority === "critical") {
    return "critical";
  }
  if (priority === "low") {
    return "low";
  }
  if (priority === "medium") {
    return "medium";
  }
  return "high";
}

function confidenceFromInputs(payload: RecommendPayload) {
  let score = 64;
  if (payload.targetSummary?.trim()) score += 8;
  if (payload.areaName?.trim()) score += 6;
  if (Number.isFinite(Number(payload.coordinates?.lat)) && Number.isFinite(Number(payload.coordinates?.lng))) score += 8;
  if (payload.constraints?.trim()) score += 6;
  return Math.min(92, score);
}

function splitText(value: string | undefined, fallback: string[]) {
  if (!value?.trim()) {
    return fallback;
  }
  return value
    .split(/[\n;.]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}
