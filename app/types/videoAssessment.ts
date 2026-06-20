export type DamageSeverity = "none" | "minor" | "moderate" | "severe" | "unknown";

export type DetectionLabel =
  | "explosion_flash"
  | "fire"
  | "smoke"
  | "dust"
  | "structural_damage"
  | "vehicle_or_object"
  | "possible_person"
  | "unknown";

export type ConfidenceLevel = "low" | "medium" | "high";

export type VideoMode = "auto" | "visual" | "thermal" | "mixed";

export type AssessmentSettings = {
  fps: number;
  eventSensitivity: number;
  openAiFrameLimit: number;
  processingConcurrency: number;
  videoMode: VideoMode;
};

export type DetectionBox = {
  id: string;
  label: DetectionLabel;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  source: "local-cv" | "openai";
  color: string;
  detail: string;
};

export type FrameMetrics = {
  changeRatio: number;
  fireRatio: number;
  smokeRatio: number;
  dustRatio: number;
  brightness: number;
  smokeColor: string;
};

export type VideoFrameAssessment = {
  id: string;
  timeSec: number;
  imageUrl: string;
  width: number;
  height: number;
  metrics: FrameMetrics;
  boxes: DetectionBox[];
};

export type VideoEvent = {
  id: string;
  frameId: string;
  timeSec: number;
  title: string;
  severity: DamageSeverity;
  labels: DetectionLabel[];
  confidence: ConfidenceLevel;
  boxes: DetectionBox[];
  notes: string[];
};

export type PeopleRiskAssessment = {
  level: "none_visible" | "possible" | "elevated" | "unknown";
  indicators: string[];
  rationale: string;
  confidence: ConfidenceLevel;
};

export type DamageAssessment = {
  severity: DamageSeverity;
  fireDetected: boolean;
  explosionDetected: boolean;
  smokeColor: string;
  smokeExtent: "none" | "localized" | "expanding" | "heavy" | "unknown";
  rationale: string;
};

export type OpenAiVideoReview = {
  status: "not-run" | "ok" | "failed" | "missing-key";
  model: string;
  reviewedFrameIds: string[];
  summary: string;
  observations: string[];
  error?: string;
};

export type VideoAssessmentResult = {
  id: string;
  createdAt: string;
  settings: AssessmentSettings;
  video: {
    fileName: string;
    source: "demo" | "upload";
    durationSec: number;
    width: number;
    height: number;
    frameCount: number;
    url: string;
    annotatedUrl?: string;
  };
  summary: string;
  damage: DamageAssessment;
  peopleRisk: PeopleRiskAssessment;
  frames: VideoFrameAssessment[];
  events: VideoEvent[];
  openAiReview: OpenAiVideoReview;
  processing: {
    localCvVersion: string;
    frameCount: number;
    ffmpeg: boolean;
    processingConcurrency: number;
    videoMode: VideoMode;
    annotatedVideo: boolean;
  };
};
