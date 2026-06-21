"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Database,
  Loader2,
  Plus,
  Radar,
  Radio,
  Satellite,
  Trash2,
  Video,
  Volume2
} from "lucide-react";
import type { PostStrikeData, StrikeRecommendation } from "@/app/types/pipeline";
import { VideoDamageAssessment, type VideoAssessmentSummary } from "./VideoDamageAssessment";

type PostStrikeAnalysisProps = {
  recommendation: StrikeRecommendation;
  onAnalysisComplete: (data: PostStrikeData) => void;
};

type SourceReport = PostStrikeData["sourceReports"][number];
type SourceType = SourceReport["type"];
type SourceStatus = SourceReport["status"];
type StatusOverride = PostStrikeData["status"] | "auto";

type EvidenceSourceInput = {
  id: string;
  type: SourceType;
  label: string;
  status: SourceStatus;
  confidence: number;
  summary: string;
};

const sourceTypes: SourceType[] = ["video", "camera", "audio", "satellite", "operator", "other"];
const sourceStatuses: SourceStatus[] = ["confirmed", "supporting", "pending", "conflicting"];

const initialSources: EvidenceSourceInput[] = [
  {
    id: "source-video",
    type: "video",
    label: "Video review",
    status: "confirmed",
    confidence: 82,
    summary: "Visible blast effects and sustained impact detected"
  },
  {
    id: "source-camera",
    type: "camera",
    label: "Public camera layer",
    status: "supporting",
    confidence: 70,
    summary: "Public camera layer indicates change in scene brightness and persistent impact detected"
  },
  {
    id: "source-audio",
    type: "audio",
    label: "Audio sensor layer",
    status: "supporting",
    confidence: 64,
    summary: "Audio sensors report impulse event followed by lower-amplitude secondary activity"
  },
  {
    id: "source-satellite",
    type: "satellite",
    label: "Satellite tasking",
    status: "pending",
    confidence: 42,
    summary: "Satellite imagery confirmation pending"
  }
];

const initialTimeline = [
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

export function PostStrikeAnalysis({ recommendation, onAnalysisComplete }: PostStrikeAnalysisProps) {
  const [sources, setSources] = useState<EvidenceSourceInput[]>(initialSources);
  const [statusOverride, setStatusOverride] = useState<StatusOverride>("auto");
  const [assessmentConfidence, setAssessmentConfidence] = useState("82");
  const [reviewNotes, setReviewNotes] = useState(
    "Preserve raw source references and re-score when independent metadata is available."
  );
  const [result, setResult] = useState<PostStrikeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const sourceSummary = useMemo(() => {
    const counts = sources.reduce<Record<SourceStatus, number>>(
      (acc, source) => {
        acc[source.status] += 1;
        return acc;
      },
      { confirmed: 0, supporting: 0, pending: 0, conflicting: 0 }
    );
    return `${counts.confirmed} confirmed / ${counts.supporting} supporting / ${counts.pending} pending / ${counts.conflicting} conflicting`;
  }, [sources]);

  function updateSource(id: string, updates: Partial<EvidenceSourceInput>) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, ...updates } : source)));
    setResult(null);
  }

  function addSource() {
    setSources((current) => [
      ...current,
      {
        id: `source-${Date.now()}`,
        type: "other",
        label: `Source ${current.length + 1}`,
        status: "pending",
        confidence: 50,
        summary: "Additional source awaiting analyst review"
      }
    ]);
    setResult(null);
  }

  function removeSource(id: string) {
    setSources((current) => (current.length <= 1 ? current : current.filter((source) => source.id !== id)));
    setResult(null);
  }

  function applyVideoAssessment(summary: VideoAssessmentSummary) {
    updateSource("source-video", {
      label: "Video damage assessment",
      status: summary.eventCount ? "confirmed" : "supporting",
      confidence: summary.confidence,
      summary: summary.summary
    });
    setAssessmentConfidence(String(Math.max(Number(assessmentConfidence) || 0, summary.confidence)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/post-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation,
          evidence: {
            confidence: Number(assessmentConfidence),
            statusOverride,
            sourceReports: sources,
            timeline: initialTimeline,
            nextReviewActions: splitLines(reviewNotes)
          }
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Post-strike analysis failed.");
      }
      setResult(body);
      onAnalysisComplete(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post-strike analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel pipeline-card evidence-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 2</span>
          <h2>Post-Strike Data Collection</h2>
        </div>
        <Activity size={20} />
      </div>

      <div className="recommendation-output compact">
        <div className="output-header">
          <Radar size={18} />
          <strong>{recommendation.targetSummary}</strong>
          <span>{recommendation.confidenceScore}% plan confidence</span>
        </div>
        <p>{recommendation.approachCorridor} / {recommendation.recommendedWindow}</p>
        <div className="evidence-plan-strip">
          <span>{recommendation.selectedParameters.sensorPlan}</span>
          <span>{recommendation.selectedParameters.timing}</span>
        </div>
      </div>

      <form className="planner-form" onSubmit={(event) => event.preventDefault()}>
        <VideoDamageAssessment onAssessmentComplete={applyVideoAssessment} />
      </form>

      <form className="planner-form" onSubmit={handleSubmit}>
        <div className="evidence-section-title">
          <ClipboardList size={16} />
          <span>Evidence Matrix</span>
          <button type="button" onClick={addSource}>
            <Plus size={14} />
            Add source
          </button>
        </div>

        <div className="evidence-source-list">
          {sources.map((source, index) => (
            <article className="evidence-source-card" key={source.id}>
              <div className="evidence-source-head">
                {sourceIcon(source.type)}
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input
                  aria-label={`Source ${index + 1} label`}
                  value={source.label}
                  onChange={(event) => updateSource(source.id, { label: event.target.value })}
                />
                <button
                  aria-label={`Remove source ${index + 1}`}
                  disabled={sources.length <= 1}
                  onClick={() => removeSource(source.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="evidence-source-grid">
                <label>
                  Type
                  <select
                    value={source.type}
                    onChange={(event) => updateSource(source.id, { type: event.target.value as SourceType })}
                  >
                    {sourceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={source.status}
                    onChange={(event) => updateSource(source.id, { status: event.target.value as SourceStatus })}
                  >
                    {sourceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Confidence
                  <input
                    max={100}
                    min={0}
                    type="number"
                    value={source.confidence}
                    onChange={(event) => updateSource(source.id, { confidence: Number(event.target.value) })}
                  />
                </label>
              </div>
              <label>
                Source summary
                <textarea
                  value={source.summary}
                  onChange={(event) => updateSource(source.id, { summary: event.target.value })}
                />
              </label>
            </article>
          ))}
        </div>

        <div className="evidence-section-title">
          <Radio size={16} />
          <span>Fusion Controls</span>
        </div>
        <div className="planner-grid">
          <label>
            Assessment confidence
            <input
              max={100}
              min={0}
              type="number"
              value={assessmentConfidence}
              onChange={(event) => {
                setAssessmentConfidence(event.target.value);
                setResult(null);
              }}
            />
          </label>
          <label>
            Status override
            <select
              value={statusOverride}
              onChange={(event) => {
                setStatusOverride(event.target.value as StatusOverride);
                setResult(null);
              }}
            >
              <option value="auto">Auto infer</option>
              <option value="destroyed">Destroyed</option>
              <option value="partially-damaged">Partially damaged</option>
              <option value="active">Active</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label>
            Source posture
            <input readOnly value={sourceSummary} />
          </label>
        </div>
        <label>
          Next review actions
          <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
        </label>

        {error ? (
          <div className="error-line">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <button className="action-button" disabled={isLoading} type="submit">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Satellite size={18} />}
          Fuse Post-Strike Evidence
        </button>
      </form>

      {result ? (
        <div className="recommendation-output">
          <div className="output-header">
            <CheckCircle2 size={18} />
            <strong>{result.status.replace("-", " ")}</strong>
            <span>{result.confidenceScore}% confidence</span>
          </div>
          <div className="planner-grid">
            {result.sourceReports.map((report) => (
              <article key={report.id}>
                {sourceIcon(report.type)}
                <span>{report.label}</span>
                <strong>{report.status} / {report.confidence}%</strong>
              </article>
            ))}
          </div>
          <ul>
            {result.observedEffects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function splitLines(value: string) {
  return value
    .split(/[\n;.]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceIcon(type: SourceType) {
  if (type === "video") {
    return <Video size={16} />;
  }
  if (type === "camera") {
    return <Camera size={16} />;
  }
  if (type === "audio") {
    return <Volume2 size={16} />;
  }
  if (type === "satellite") {
    return <Satellite size={16} />;
  }
  if (type === "operator") {
    return <Radio size={16} />;
  }
  return <Database size={16} />;
}
