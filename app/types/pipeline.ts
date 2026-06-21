export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type StrikeRecommendation = {
  id: string;
  createdAt: string;
  source: "automated" | "manual-agent";
  targetSummary: string;
  coordinates: Coordinates;
  recommendedWindow: string;
  approachCorridor: string;
  standoffDistanceKm: number;
  riskLevel: RiskLevel;
  confidenceScore: number;
  rationale: string[];
  constraints: string[];
  intelligenceGaps: string[];
  selectedParameters: {
    routeProfile: string;
    timing: string;
    sensorPlan: string;
    deconfliction: string;
    weatherAssumption: string;
  };
};

export type ManualPlanInput = {
  planTitle: string;
  targetDescription: string;
  coordinates: Coordinates;
  approachStrategy: string;
  timingConsiderations: string;
  adAvoidanceStrategy: string;
  environmentalNotes: string;
  additionalContext: string;
  operatorName: string;
};

export type AgentAnalyzedPlan = {
  originalPlan: ManualPlanInput;
  agentAnalysis: {
    feasibilityScore: number;
    riskAssessment: RiskLevel;
    strengths: string[];
    weaknesses: string[];
    recommendedModifications: string[];
    alternativeApproaches: string[];
    confidenceLevel: number;
    analysisTimestamp: string;
  };
  integratedRecommendation?: StrikeRecommendation;
};

export type PostStrikeData = {
  id: string;
  recommendationId: string;
  createdAt: string;
  status: "destroyed" | "partially-damaged" | "active" | "unknown";
  confidenceScore: number;
  observedEffects: string[];
  sourceReports: Array<{
    id: string;
    type: "video" | "satellite" | "camera" | "audio" | "operator" | "other";
    label: string;
    status: "confirmed" | "supporting" | "conflicting" | "pending";
    confidence: number;
    summary: string;
  }>;
  timeline: Array<{
    time: string;
    label: string;
    detail: string;
  }>;
  gaps: string[];
  nextReviewActions: string[];
};

export type AnalysisConclusion = {
  id: string;
  recommendationId: string;
  postStrikeId: string;
  summary: string;
  effectiveness: {
    rating: "ineffective" | "partial" | "effective" | "highly-effective" | "unknown";
    factors: string[];
  };
  lessonsLearned: string[];
  parameterAdjustments: string[];
  confidenceScore: number;
  timestamp: string;
};
