export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type TrajectoryAction = "launch" | "transit" | "hold" | "observe" | "effect" | "egress" | "recovery";
export type TrajectorySensorMode = "none" | "rgb-video" | "thermal-video" | "audio" | "satellite-cue" | "public-camera";
export type SetupStatus = "ready" | "pending" | "blocked";

export type ManualTrajectoryPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  altitudeM: number;
  speedKmh: number;
  etaOffsetMin: number;
  action: TrajectoryAction;
  headingDeg: number;
  holdSeconds: number;
  sensorMode: TrajectorySensorMode;
  handoff: string;
  notes: string;
};

export type ManualSetupItem = {
  id: string;
  label: string;
  owner: string;
  status: SetupStatus;
  notes: string;
};

export type ManualCollectionWindow = {
  id: string;
  label: string;
  source: "video" | "camera" | "audio" | "satellite" | "operator" | "other";
  offsetMin: number;
  durationMin: number;
  objective: string;
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
  trajectory?: ManualTrajectoryPoint[];
  setupChecklist?: string[];
  selectedParameters: {
    routeProfile: string;
    timing: string;
    sensorPlan: string;
    deconfliction: string;
    weatherAssumption: string;
  };
};

export type IntakePlanningSeed = {
  available: boolean;
  sourceTitle: string;
  targetSummary: string;
  areaName: string;
  coordinates: Coordinates;
  priority: "critical" | "high" | "medium" | "low";
  constraints: string;
  brief: string;
  confidence: string;
  observationCount: number;
  gapCount: number;
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
  trajectory: ManualTrajectoryPoint[];
  setupItems: ManualSetupItem[];
  collectionWindows: ManualCollectionWindow[];
  assetPackage: string;
  sensorTasking: string;
  commsPlan: string;
  abortCriteria: string;
  fallbackPlan: string;
  bdaCollectionPlan: string;
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
