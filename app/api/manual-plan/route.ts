// app/api/manual-plan/route.ts

import { NextResponse } from "next/server";
import type { ManualPlanInput, AgentAnalyzedPlan, RiskLevel, StrikeRecommendation } from "@/app/types/pipeline";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const payload = (await request.json()) as ManualPlanInput;
    const trajectory = Array.isArray(payload.trajectory) ? payload.trajectory : [];
    const setupItems = Array.isArray(payload.setupItems) ? payload.setupItems : [];
    const collectionWindows = Array.isArray(payload.collectionWindows) ? payload.collectionWindows : [];
    const decisionGates = Array.isArray(payload.decisionGates) ? payload.decisionGates : [];
    const contingencyBranches = Array.isArray(payload.contingencyBranches) ? payload.contingencyBranches : [];
    const routeSummary = summarizeTrajectory(trajectory);

    if (!payload.planTitle || !payload.targetDescription) {
      return NextResponse.json(
        { error: "Plan title and target description are required." },
        { status: 400 }
      );
    }

    // If OpenAI key is available, use LLM analysis
    if (apiKey) {
      try {
        const prompt = [
          "You are a military planning analyst reviewing a manually submitted strike plan.",
          "Analyze the plan for feasibility, risks, and potential improvements.",
          "DO NOT recommend actual strikes or provide real military tactics.",
          "Focus on analytical assessment: strengths, weaknesses, and alternative approaches.",
          "",
          "Return only valid JSON with this shape:",
          "{",
          '  "feasibilityScore": number between 0-100,',
          '  "riskAssessment": "low" | "medium" | "high" | "critical",',
          '  "strengths": ["array of plan strengths"],',
          '  "weaknesses": ["array of plan weaknesses"],',
          '  "recommendedModifications": ["array of suggested improvements"],',
          '  "alternativeApproaches": ["array of alternative strategies"],',
          '  "confidenceLevel": number between 0-100',
          "}",
          "",
          `Plan Title: ${payload.planTitle}`,
          `Target: ${payload.targetDescription}`,
          `Coordinates: ${payload.coordinates.lat}, ${payload.coordinates.lng}`,
          `Trajectory Summary: ${routeSummary}`,
          `Trajectory: ${trajectory.map((point) => `${point.etaOffsetMin}min ${point.label} ${point.action} ${point.lat},${point.lng} alt=${point.altitudeM}m speed=${point.speedKmh}kmh heading=${point.headingDeg} hold=${point.holdSeconds}s sensor=${point.sensorMode} handoff=${point.handoff} notes=${point.notes}`).join(" | ")}`,
          `Decision Gates: ${decisionGates.map((gate) => `T+${gate.etaOffsetMin}m ${gate.label} owner=${gate.owner} status=${gate.status} condition=${gate.condition} action=${gate.action}`).join(" | ")}`,
          `Contingency Branches: ${contingencyBranches.map((branch) => `${branch.priority} trigger=${branch.trigger} owner=${branch.owner} action=${branch.action} notes=${branch.notes}`).join(" | ")}`,
          `Setup Items: ${setupItems.map((item) => `${item.label} owner=${item.owner} status=${item.status} notes=${item.notes}`).join(" | ")}`,
          `Collection Windows: ${collectionWindows.map((window) => `T+${window.offsetMin}m ${window.label} source=${window.source} duration=${window.durationMin}m objective=${window.objective}`).join(" | ")}`,
          `Approach Strategy: ${payload.approachStrategy}`,
          `Timing: ${payload.timingConsiderations}`,
          `AD Avoidance: ${payload.adAvoidanceStrategy}`,
          `Environment: ${payload.environmentalNotes}`,
          `Asset Package: ${payload.assetPackage}`,
          `Sensor Tasking: ${payload.sensorTasking}`,
          `Comms Plan: ${payload.commsPlan}`,
          `Abort Criteria: ${payload.abortCriteria}`,
          `Fallback Plan: ${payload.fallbackPlan}`,
          `BDA Collection Plan: ${payload.bdaCollectionPlan}`,
          `Additional Context: ${payload.additionalContext}`,
          `Operator: ${payload.operatorName}`
        ].join("\n");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-5.5",
            input: prompt,
            max_output_tokens: 1200
          }),
          signal: controller.signal
        }).finally(() => clearTimeout(timeout));

        if (!openAiResponse.ok) {
          throw new Error(`OpenAI manual analysis failed with ${openAiResponse.status}`);
        }

        const openAiBody = await openAiResponse.json();
        const outputText = extractOutputText(openAiBody);
        const llmAnalysis = parseJsonObject(outputText);

        const analyzedPlan: AgentAnalyzedPlan = {
          originalPlan: payload,
          agentAnalysis: {
            feasibilityScore: llmAnalysis.feasibilityScore || 70,
            riskAssessment: normalizeRisk(llmAnalysis.riskAssessment),
            strengths: llmAnalysis.strengths || ["Manual plan submitted for review"],
            weaknesses: llmAnalysis.weaknesses || ["Requires further analysis"],
            recommendedModifications: llmAnalysis.recommendedModifications || [],
            alternativeApproaches: llmAnalysis.alternativeApproaches || [],
            confidenceLevel: llmAnalysis.confidenceLevel || 75,
            analysisTimestamp: new Date().toISOString()
          },
          integratedRecommendation: recommendationFromManualPlan(payload, llmAnalysis.confidenceLevel || 75, normalizeRisk(llmAnalysis.riskAssessment))
        };

        return NextResponse.json(analyzedPlan);
      } catch {
        return NextResponse.json(buildFallbackAnalysis(payload));
      }
    }

    return NextResponse.json(buildFallbackAnalysis(payload));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to analyze manual plan." },
      { status: 500 }
    );
  }
}

function normalizeRisk(value: unknown): RiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function summarizeTrajectory(trajectory: ManualPlanInput["trajectory"]) {
  if (!trajectory.length) {
    return "No trajectory checkpoints submitted.";
  }

  const sensorGates = trajectory.filter((point) => point.sensorMode && point.sensorMode !== "none").length;
  const handoffs = trajectory.filter((point) => point.handoff?.trim()).length;
  const firstEta = Math.min(...trajectory.map((point) => Number(point.etaOffsetMin) || 0));
  const lastEta = Math.max(...trajectory.map((point) => Number(point.etaOffsetMin) || 0));

  return `${trajectory.length} checkpoints over ${Math.max(0, lastEta - firstEta)} minutes; ${sensorGates} sensor gates; ${handoffs} handoffs.`;
}

function buildFallbackAnalysis(payload: ManualPlanInput): AgentAnalyzedPlan {
  const trajectory = Array.isArray(payload.trajectory) ? payload.trajectory : [];
  const setupItems = Array.isArray(payload.setupItems) ? payload.setupItems : [];
  const collectionWindows = Array.isArray(payload.collectionWindows) ? payload.collectionWindows : [];
  const decisionGates = Array.isArray(payload.decisionGates) ? payload.decisionGates : [];
  const contingencyBranches = Array.isArray(payload.contingencyBranches) ? payload.contingencyBranches : [];

  return {
    originalPlan: payload,
    agentAnalysis: {
      feasibilityScore: 72,
      riskAssessment: "medium",
      strengths: [
        `Manual package includes ${trajectory.length} trajectory checkpoints with timing, sensor, and handoff metadata`,
        `${decisionGates.length} decision gates define continuation, hold, and review conditions`,
        `${contingencyBranches.length} contingency branches are available for source degradation or contradiction`,
        `${setupItems.filter((item) => item.status === "ready").length} setup items are marked ready for review`,
        `${collectionWindows.length} collection windows are available for post-event evidence fusion`
      ],
      weaknesses: [
        "Limited real-time intelligence integration",
        "Environmental factors may change during execution",
        "AD avoidance strategy requires satellite confirmation",
        "Trajectory assumptions require timing and sensor deconfliction checks",
        decisionGates.some((gate) => gate.status === "abort")
          ? "At least one decision gate is currently marked abort"
          : "Decision gate status requires final owner review before release",
        ...setupItems
          .filter((item) => item.status !== "ready")
          .slice(0, 2)
          .map((item) => `${item.label} remains ${item.status}`)
      ],
      recommendedModifications: [
        "Integrate real-time weather data before execution",
        "Confirm AD positions via satellite imagery",
        "Add contingency routing for dynamic threats",
        "Review each trajectory checkpoint against source freshness and collection windows",
        "Assign final owners to every decision gate and contingency branch",
        "Tie each post-event evidence window to a named owner and retained raw source reference"
      ],
      alternativeApproaches: [
        "Consider multi-axis approach for redundancy",
        "Evaluate standoff engagement options",
        "Assess feasibility of coordinated timing windows",
        "Use decision gates to keep low-confidence source conflicts from becoming final conclusions",
        "Use a checkpoint-only dry run to validate telemetry, source windows, and handoff timing"
      ],
      confidenceLevel: 68,
      analysisTimestamp: new Date().toISOString()
    },
    integratedRecommendation: recommendationFromManualPlan(payload, 68, "medium")
  };
}

function recommendationFromManualPlan(
  payload: ManualPlanInput,
  confidenceScore: number,
  riskLevel: RiskLevel
): StrikeRecommendation {
  const trajectory = Array.isArray(payload.trajectory) ? payload.trajectory : [];
  const setupItems = Array.isArray(payload.setupItems) ? payload.setupItems : [];
  const collectionWindows = Array.isArray(payload.collectionWindows) ? payload.collectionWindows : [];
  const decisionGates = Array.isArray(payload.decisionGates) ? payload.decisionGates : [];
  const contingencyBranches = Array.isArray(payload.contingencyBranches) ? payload.contingencyBranches : [];
  const blockedSetup = setupItems.filter((item) => item.status === "blocked");
  const pendingSetup = setupItems.filter((item) => item.status === "pending");
  const holdOrAbortGates = decisionGates.filter((gate) => gate.status === "hold" || gate.status === "abort");
  return {
    id: `manual-rec-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: "manual-agent",
    targetSummary: payload.targetDescription,
    coordinates: payload.coordinates,
    recommendedWindow: payload.timingConsiderations || "Operator-defined review window",
    approachCorridor: payload.approachStrategy || "Operator-defined approach corridor",
    standoffDistanceKm: riskLevel === "critical" ? 120 : riskLevel === "high" ? 90 : 65,
    riskLevel,
    confidenceScore: Math.max(0, Math.min(100, Math.round(Number(confidenceScore) || 68))),
    rationale: [
      "Manual plan accepted and converted into pipeline parameters.",
      "Agent review produced a bounded confidence score and risk category.",
      `${trajectory.length} route checkpoints, ${decisionGates.length} decision gates, ${contingencyBranches.length} contingency branches, ${setupItems.length} setup items, and ${collectionWindows.length} collection windows were retained for audit.`,
      "Stage 2 should collect independent post-event evidence before conclusions."
    ],
    constraints: [
      payload.adAvoidanceStrategy || "Defensive coverage notes require review.",
      payload.environmentalNotes || "Environmental assumptions require update before assessment.",
      payload.additionalContext || "Additional source context not provided.",
      ...holdOrAbortGates.slice(0, 2).map((gate) => `Decision gate ${gate.status}: ${gate.label}`),
      ...blockedSetup.map((item) => `Blocked setup item: ${item.label}`),
      ...pendingSetup.slice(0, 2).map((item) => `Pending setup item: ${item.label}`)
    ],
    intelligenceGaps: [
      "Manual plan source metadata requires review.",
      "Independent imagery and sensor confirmation are required.",
      "Any conflicting reports should be retained for Stage 3 analysis.",
      ...collectionWindows
        .filter((window) => !String(window.objective ?? "").trim())
        .slice(0, 2)
        .map((window) => `Collection objective missing for ${window.label}`),
      ...contingencyBranches
        .filter((branch) => !String(branch.action ?? "").trim())
        .slice(0, 2)
        .map((branch) => `Contingency action missing for ${branch.trigger}`)
    ],
    trajectory,
    decisionGates,
    contingencyBranches,
    setupChecklist: [
      `Asset package: ${payload.assetPackage || "not specified"}`,
      `Sensor tasking: ${payload.sensorTasking || "not specified"}`,
      `Comms plan: ${payload.commsPlan || "not specified"}`,
      `Abort criteria: ${payload.abortCriteria || "not specified"}`,
      `Fallback plan: ${payload.fallbackPlan || "not specified"}`,
      `BDA collection: ${payload.bdaCollectionPlan || "not specified"}`,
      ...decisionGates.map((gate) => `${String(gate.status ?? "review").toUpperCase()} GATE T+${gate.etaOffsetMin}m: ${gate.label} - ${gate.owner}`),
      ...contingencyBranches.map((branch) => `${String(branch.priority ?? "secondary").toUpperCase()} BRANCH: ${branch.trigger} - ${branch.owner}`),
      ...setupItems.map((item) => `${String(item.status ?? "pending").toUpperCase()}: ${item.label} - ${item.owner}`),
      ...collectionWindows.map(
        (window) => `T+${window.offsetMin}m/${window.durationMin}m ${window.source}: ${window.label}`
      )
    ],
    selectedParameters: {
      routeProfile: trajectory.length
        ? `${trajectory.length} checkpoint trajectory: ${trajectory.map((point) => `${point.label} (${point.action})`).join(" -> ")}; gates ${decisionGates
            .map((gate) => `T+${gate.etaOffsetMin}m ${gate.status}`)
            .join(", ") || "none"}`
        : payload.approachStrategy || "Manual route profile",
      timing: payload.timingConsiderations || "Manual timing window",
      sensorPlan: collectionWindows.length
        ? `${payload.sensorTasking || "Manual sensor tasking"}; windows: ${collectionWindows
            .map((window) => `${window.source} T+${window.offsetMin}m`)
            .join(", ")}`
        : payload.sensorTasking || "Video, public camera, audio, and satellite corroboration",
      deconfliction: setupItems.length
        ? `${payload.commsPlan || "Manual deconfliction"}; setup posture ${setupItems.filter((item) => item.status === "ready").length}/${setupItems.length} ready; contingency branches ${contingencyBranches.length}`
        : payload.commsPlan || "Analyst review required before operational use",
      weatherAssumption: payload.environmentalNotes || "Weather assumptions not specified"
    }
  };
}

// Helper functions
function extractOutputText(response: any): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const chunks =
    response.output
      ?.flatMap((item: any) => item.content ?? [])
      .map((content: any) => content.text)
      .filter((text: any): text is string => typeof text === "string") ?? [];

  return chunks.join("\n");
}

function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}
