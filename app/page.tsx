// app/page.tsx

"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Crosshair,
  Database,
  Download,
  FileSearch,
  Globe2,
  Image as ImageIcon,
  Import,
  Layers,
  Loader2,
  Radar,
  RotateCcw,
  Ruler,
  Save,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { StrikePlanner } from "./components/StrikePlanner";
import { ManualPlanInput } from "./components/ManualPlanInput";
import { PostStrikeAnalysis } from "./components/PostStrikeAnalysis";
import { AnalysisDashboard } from "./components/AnalysisDashboard";
import type { IntakePlanningSeed } from "./types/pipeline";

const MapPanel = dynamic(() => import("./components/MapPanel").then((mod) => mod.MapPanel), {
  ssr: false,
  loading: () => <div className="map-loading">Loading satellite map...</div>
});

type Observation = {
  label: string;
  detail: string;
  confidence: "low" | "medium" | "high" | string;
  source: string;
};

type AnalysisResult = {
  brief: string;
  observations: Observation[];
  confidence: "low" | "medium" | "high" | string;
  sourceGaps: string[];
  verificationQuestions: string[];
  safetyFlags: string[];
  mapLayers: MapLayer[];
  evidenceCards: EvidenceCard[];
};

type EvidenceCard = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  source: string;
};

type MapLayer = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  confidence: string;
  category: string;
  detail: string;
};

type RangeRing = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

type PipelineStage = "stage-0" | "stage-1" | "stage-2" | "stage-3";

type PipelineSessionSnapshot = {
  version: 1;
  savedAt: string;
  rawText: string;
  sourceTitle: string;
  sourceUrl: string;
  imageUrl: string;
  analysis: AnalysisResult;
  rangeAnchor: { lat: number; lng: number };
  rangeKm: number;
  rangeLabel: string;
  rangeRings: RangeRing[];
  lastAnalyzedText: string;
  activeStage: PipelineStage;
  strikeRecommendation: unknown;
  postStrikeData: unknown;
  manualPlanMode: boolean;
  agentAnalysis: unknown;
};

const sessionStorageKey = "aerorozum-warsaw26-pipeline-session-v1";

const sampleInput = `Source: private analyst note
Claim: 5 Pantsir air-defense systems are positioned around the Red Square perimeter in Moscow.
Time observed: not stated.
Evidence attached: none.
Provenance: secondhand note, no imagery, no metadata, no independent confirmation.`;

const emptyResult: AnalysisResult = {
  brief:
    "Paste a current-state note to extract claim-level details: who or what is mentioned, quantity, named place, time phrase, evidence provided, and verification gaps.",
  observations: [
    {
      label: "Awaiting source claim",
      detail: "Stage 0 preserves source-stated details as unverified claims, then separates evidence gaps from confidence.",
      confidence: "medium",
      source: "system"
    }
  ],
  confidence: "medium",
  sourceGaps: ["No source text, timestamp, imagery, provenance chain, or corroborating report has been submitted."],
  verificationQuestions: ["What exactly is claimed, when was it observed, what evidence supports it, and who can corroborate it?"],
  safetyFlags: [],
  mapLayers: [],
  evidenceCards: []
};

export default function Home() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("Session not loaded");

  // Stage 0 state
  const [rawText, setRawText] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult>(emptyResult);
  const [rangeAnchor, setRangeAnchor] = useState({ lat: 55.7558, lng: 37.6173 });
  const [rangeKm, setRangeKm] = useState(120);
  const [rangeLabel, setRangeLabel] = useState("Custom range");
  const [rangeRings, setRangeRings] = useState<RangeRing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");

  // Pipeline state
  const [activeStage, setActiveStage] = useState<PipelineStage>("stage-0");
  const [strikeRecommendation, setStrikeRecommendation] = useState<any>(null);
  const [postStrikeData, setPostStrikeData] = useState<any>(null);

  // Manual plan state
  const [manualPlanMode, setManualPlanMode] = useState(false);
  const [agentAnalysis, setAgentAnalysis] = useState<any>(null);

  const sessionSnapshot = useMemo<PipelineSessionSnapshot>(
    () => ({
      version: 1,
      savedAt: new Date().toISOString(),
      rawText,
      sourceTitle,
      sourceUrl,
      imageUrl,
      analysis,
      rangeAnchor,
      rangeKm,
      rangeLabel,
      rangeRings,
      lastAnalyzedText,
      activeStage,
      strikeRecommendation,
      postStrikeData,
      manualPlanMode,
      agentAnalysis
    }),
    [
      activeStage,
      agentAnalysis,
      analysis,
      imageUrl,
      lastAnalyzedText,
      manualPlanMode,
      postStrikeData,
      rangeAnchor,
      rangeKm,
      rangeLabel,
      rangeRings,
      rawText,
      sourceTitle,
      sourceUrl,
      strikeRecommendation
    ]
  );

  useEffect(() => {
    try {
      const storedSession = window.localStorage.getItem(sessionStorageKey);
      if (storedSession) {
        const parsed = parseSessionSnapshot(storedSession);
        applySessionSnapshot(parsed);
        setSessionStatus(`Restored ${formatSessionTime(parsed.savedAt)}`);
      } else {
        setSessionStatus("New session");
      }
    } catch (err) {
      setSessionStatus(err instanceof Error ? err.message : "Session restore failed");
    } finally {
      setSessionReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    try {
      const snapshot = JSON.stringify(sessionSnapshot);
      window.localStorage.setItem(sessionStorageKey, snapshot);
      setSessionStatus(`Autosaved ${formatSessionTime(sessionSnapshot.savedAt)}`);
    } catch {
      setSessionStatus("Autosave failed");
    }
  }, [sessionReady, sessionSnapshot]);

  const inputStats = useMemo(() => {
    const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
    return { chars: rawText.length, words };
  }, [rawText]);

  const intakePlanningSeed = useMemo<IntakePlanningSeed>(() => {
    const currentText = rawText.trim();
    const hasFreshAnalysis = Boolean(currentText) && lastAnalyzedText === currentText;
    const firstLayer = analysis.mapLayers[0];
    const sourceClaim =
      analysis.observations.find((observation) => observation.label !== "Awaiting source claim") ??
      analysis.observations[0];
    const sourceTitleLabel = sourceTitle.trim() || "Stage 0 source packet";
    const constraints = [
      ...analysis.sourceGaps,
      ...analysis.verificationQuestions,
      analysis.brief ? `Analyst brief: ${analysis.brief}` : ""
    ]
      .filter(Boolean)
      .slice(0, 8)
      .join("\n");

    return {
      available: hasFreshAnalysis,
      sourceTitle: sourceTitleLabel,
      targetSummary: sourceClaim?.label && sourceClaim.label !== "Awaiting source claim"
        ? `${sourceTitleLabel}: ${sourceClaim.label}`
        : "Stage 0 current-state claim review",
      areaName: firstLayer?.label || sourceTitleLabel,
      coordinates: firstLayer ? { lat: firstLayer.lat, lng: firstLayer.lng } : rangeAnchor,
      priority: priorityFromConfidence(analysis.confidence),
      constraints: constraints || "Stage 0 analysis did not include constraints.",
      brief: compactText(analysis.brief, 240),
      confidence: String(analysis.confidence || "unknown"),
      observationCount: analysis.observations.filter((observation) => observation.label !== "Awaiting source claim").length,
      gapCount: analysis.sourceGaps.length
    };
  }, [analysis, lastAnalyzedText, rangeAnchor, rawText, sourceTitle]);

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, sourceTitle, sourceUrl, imageUrl })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Analysis failed.");
      }

      setAnalysis(body);
      setLastAnalyzedText(rawText.trim());
      if (Array.isArray(body.mapLayers) && body.mapLayers[0]) {
        setRangeAnchor({ lat: body.mapLayers[0].lat, lng: body.mapLayers[0].lng });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleAddRangeRing() {
    const boundedRangeKm = Math.min(Math.max(rangeKm, 1), 2000);
    setRangeRings((rings) => [
      ...rings,
      {
        id: `${Date.now()}`,
        label: rangeLabel.trim() || "Custom range",
        lat: rangeAnchor.lat,
        lng: rangeAnchor.lng,
        radiusMeters: boundedRangeKm * 1000
      }
    ]);
  }

  function handleStageChange(stage: PipelineStage) {
    setActiveStage(stage);
    // Reset manual plan mode when leaving Stage 1
    if (stage !== "stage-1") {
      setManualPlanMode(false);
    }
  }

  function applySessionSnapshot(snapshot: PipelineSessionSnapshot) {
    setRawText(snapshot.rawText);
    setSourceTitle(snapshot.sourceTitle);
    setSourceUrl(snapshot.sourceUrl);
    setImageUrl(snapshot.imageUrl);
    setAnalysis(snapshot.analysis);
    setRangeAnchor(snapshot.rangeAnchor);
    setRangeKm(snapshot.rangeKm);
    setRangeLabel(snapshot.rangeLabel);
    setRangeRings(snapshot.rangeRings);
    setLastAnalyzedText(snapshot.lastAnalyzedText);
    setActiveStage(snapshot.activeStage);
    setStrikeRecommendation(snapshot.strikeRecommendation);
    setPostStrikeData(snapshot.postStrikeData);
    setManualPlanMode(snapshot.manualPlanMode);
    setAgentAnalysis(snapshot.agentAnalysis);
    setError("");
  }

  function handlePersistNow() {
    try {
      const snapshot = { ...sessionSnapshot, savedAt: new Date().toISOString() };
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(snapshot));
      setSessionStatus(`Saved ${formatSessionTime(snapshot.savedAt)}`);
    } catch {
      setSessionStatus("Save failed");
    }
  }

  function handleExportSession() {
    const snapshot = { ...sessionSnapshot, savedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aerorozum-session-${snapshot.savedAt.replace(/[:.]/g, "-")}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setSessionStatus(`Exported ${formatSessionTime(snapshot.savedAt)}`);
  }

  async function handleImportSession(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const snapshot = parseSessionSnapshot(await file.text());
      applySessionSnapshot(snapshot);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(snapshot));
      setSessionStatus(`Imported ${formatSessionTime(snapshot.savedAt)}`);
    } catch (err) {
      setSessionStatus(err instanceof Error ? err.message : "Import failed");
    }
  }

  function handleResetSession() {
    window.localStorage.removeItem(sessionStorageKey);
    setRawText("");
    setSourceTitle("");
    setSourceUrl("");
    setImageUrl("");
    setAnalysis(emptyResult);
    setRangeAnchor({ lat: 55.7558, lng: 37.6173 });
    setRangeKm(120);
    setRangeLabel("Custom range");
    setRangeRings([]);
    setLastAnalyzedText("");
    setActiveStage("stage-0");
    setStrikeRecommendation(null);
    setPostStrikeData(null);
    setManualPlanMode(false);
    setAgentAnalysis(null);
    setError("");
    setSessionStatus("Session reset");
  }

  return (
    <main className="app-shell">
      <section className="command-bar">
        <div>
          <div className="eyebrow">AeroRozum / Warsaw26</div>
          <h1>Intelligence Analysis Pipeline</h1>
        </div>
        <div className="pipeline-stages">
          <button
            className={`stage-button ${activeStage === "stage-0" ? "stage-active" : ""}`}
            onClick={() => handleStageChange("stage-0")}
          >
            <Layers size={16} />
            Stage 0
            <span>Intake</span>
          </button>
          <div className="stage-connector" />
          <button
            className={`stage-button ${activeStage === "stage-1" ? "stage-active" : ""}`}
            onClick={() => handleStageChange("stage-1")}
          >
            <TrendingUp size={16} />
            Stage 1
            <span>Plan</span>
          </button>
          <div className="stage-connector" />
          <button
            className={`stage-button ${activeStage === "stage-2" ? "stage-active" : ""}`}
            onClick={() => handleStageChange("stage-2")}
          >
            <Radar size={16} />
            Stage 2
            <span>Collect</span>
          </button>
          <div className="stage-connector" />
          <button
            className={`stage-button ${activeStage === "stage-3" ? "stage-active" : ""}`}
            onClick={() => handleStageChange("stage-3")}
          >
            <BarChart3 size={16} />
            Stage 3
            <span>Analyze</span>
          </button>
        </div>
        <div className="status-strip">
          <span>
            <ShieldCheck size={16} />
            Analytical Platform
          </span>
          <span>
            <Globe2 size={16} />
            Multi-Source Intel
          </span>
        </div>
        <div className="session-strip">
          <span>
            <Save size={15} />
            {sessionStatus}
          </span>
          <button type="button" onClick={handlePersistNow}>
            <Save size={15} />
            Save
          </button>
          <button type="button" onClick={handleExportSession}>
            <Download size={15} />
            Export
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            <Import size={15} />
            Import
          </button>
          <button type="button" className="ghost-button" onClick={handleResetSession}>
            <RotateCcw size={15} />
            Reset
          </button>
          <input
            accept="application/json,.json"
            className="session-file-input"
            onChange={handleImportSession}
            ref={importInputRef}
            type="file"
          />
        </div>
      </section>

      {/* Stage 0: Current-State Intake */}
      {activeStage === "stage-0" && (
        <section className="dashboard-grid">
          <form className="panel input-panel" onSubmit={handleAnalyze}>
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Stage 0</span>
                <h2>Current Information</h2>
              </div>
              <Database size={20} />
            </div>

            <label>
              Source title
              <input
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Analyst notes, OSINT packet, field report..."
              />
            </label>

            <label>
              Source URL
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Optional link kept as source context"
              />
            </label>

            <label>
              Evidence image URL
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="Optional image link shown with the brief"
              />
            </label>

            <label className="textarea-label">
              Current-state text
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="Paste exact claim text, quantities, equipment names, place names, time phrases, source notes, and evidence gaps..."
              />
            </label>

            <div className="input-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setSourceTitle("Private analyst note");
                  setRawText(sampleInput);
                }}
              >
                Load sample
              </button>
              <div className="telemetry">
                {inputStats.words} words / {inputStats.chars} chars
              </div>
              <button type="submit" disabled={isLoading || !rawText.trim()}>
                {isLoading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
                Analyze
              </button>
            </div>
            {error ? (
              <div className="error-line">
                <AlertTriangle size={16} />
                {error}
              </div>
            ) : null}
          </form>

          <section className="panel map-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Geospatial Context</span>
                <h2>Russia Satellite View</h2>
              </div>
              <Globe2 size={20} />
            </div>
            <MapPanel
              layers={analysis.mapLayers}
              rangeRings={rangeRings}
              onRangeAnchorChange={setRangeAnchor}
            />
            <div className="range-console">
              <div className="range-title">
                <Ruler size={17} />
                Range overlay
              </div>
              <label>
                Ring label
                <input
                  value={rangeLabel}
                  onChange={(event) => setRangeLabel(event.target.value)}
                  placeholder="Custom range"
                />
              </label>
              <label>
                Radius, km
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={rangeKm}
                  onChange={(event) => setRangeKm(Number(event.target.value))}
                />
              </label>
              <div className="range-actions">
                <span>
                  Anchor {rangeAnchor.lat.toFixed(3)}, {rangeAnchor.lng.toFixed(3)}
                </span>
                <button type="button" onClick={handleAddRangeRing}>
                  Add range
                </button>
                <button type="button" className="ghost-button" onClick={() => setRangeRings([])}>
                  Clear
                </button>
              </div>
            </div>
          </section>

          <section className="panel brief-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">LLM Output</span>
                <h2>Analyst Brief</h2>
              </div>
              <FileSearch size={20} />
            </div>
            <p className="brief-text">{analysis.brief}</p>
            {imageUrl.trim() ? (
              <figure className="evidence-image">
                <img src={imageUrl.trim()} alt="Evidence source preview" />
                <figcaption>
                  <ImageIcon size={14} />
                  Source image preview
                </figcaption>
              </figure>
            ) : null}
            {analysis.evidenceCards.length ? (
              <div className="evidence-cards">
                {analysis.evidenceCards.map((card) => (
                  <a href={card.url} target="_blank" rel="noreferrer" key={`${card.source}-${card.url}`}>
                    {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <div className="image-fallback" />}
                    <div>
                      <span>{card.source}</span>
                      <strong>{card.title}</strong>
                      <p>{card.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
            <div className="confidence-row">
              <span>Source confidence</span>
              <strong className={`confidence confidence-${analysis.confidence}`}>{analysis.confidence}</strong>
            </div>
            {analysis.safetyFlags.length ? (
              <div className="safety-box">
                <AlertTriangle size={17} />
                <span>{analysis.safetyFlags.join(", ")}</span>
              </div>
            ) : null}
          </section>

          <section className="panel observations-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Extraction</span>
                <h2>Observations</h2>
              </div>
              <Radar size={20} />
            </div>
            <div className="observation-list">
              {analysis.observations.map((observation, index) => (
                <article className="observation-card" key={`${observation.label}-${index}`}>
                  <div>
                    <h3>{observation.label}</h3>
                    <span>{observation.source}</span>
                  </div>
                  <p>{observation.detail}</p>
                  <strong className={`confidence confidence-${observation.confidence}`}>
                    {observation.confidence}
                  </strong>
                </article>
              ))}
            </div>
          </section>

          <section className="panel gaps-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Review</span>
                <h2>Gaps & Questions</h2>
              </div>
              <AlertTriangle size={20} />
            </div>
            <div className="two-column-list">
              <div>
                <h3>Source gaps</h3>
                <ul>
                  {analysis.sourceGaps.map((gap, index) => (
                    <li key={`${gap}-${index}`}>{gap}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Verification questions</h3>
                <ul>
                  {analysis.verificationQuestions.map((question, index) => (
                    <li key={`${question}-${index}`}>{question}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </section>
      )}

      {/* Stage 1: Strike Parameter Recommendation */}
      {activeStage === "stage-1" && (
        <section className="stage-1-container">
          <div className="stage-options">
            <div className="mode-toggle">
              <button
                className={`mode-button ${!manualPlanMode ? "mode-active" : ""}`}
                onClick={() => {
                  setManualPlanMode(false);
                  setAgentAnalysis(null);
                }}
              >
                <Crosshair size={16} />
                Automated Recommendation
              </button>
              <button
                className={`mode-button ${manualPlanMode ? "mode-active" : ""}`}
                onClick={() => {
                  setManualPlanMode(true);
                  setStrikeRecommendation(null);
                }}
              >
                <Brain size={16} />
                Manual Plan Input
              </button>
            </div>
            {manualPlanMode && agentAnalysis && (
              <div className="agent-analysis-status">
                <Brain size={14} />
                <span>Agent Analysis Complete</span>
                <strong>{agentAnalysis.agentAnalysis?.confidenceLevel || "?"}% confidence</strong>
              </div>
            )}
          </div>

          <div className="dashboard-grid">
            {!manualPlanMode ? (
              <StrikePlanner 
                intakeSeed={intakePlanningSeed}
                onRecommendationComplete={(rec) => {
                  setStrikeRecommendation(rec);
                }} 
              />
            ) : (
              <ManualPlanInput
                onPlanAnalyzed={(analysis) => {
                  setAgentAnalysis(analysis);
                  if (analysis.integratedRecommendation) {
                    setStrikeRecommendation(analysis.integratedRecommendation);
                  }
                }}
              />
            )}
          </div>

          {strikeRecommendation && (
            <div className="stage-navigation">
              <div className="nav-message">
                <CheckCircle size={16} />
                <span>Strike parameters ready. Proceed to Stage 2 for post-strike data collection.</span>
              </div>
              <button
                className="next-stage-button"
                onClick={() => handleStageChange("stage-2")}
              >
                Continue to Stage 2
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Stage 2: Post-Strike Data Collection */}
      {activeStage === "stage-2" && strikeRecommendation && (
        <section className="stage-2-container">
          <div className="dashboard-grid">
            <PostStrikeAnalysis
              recommendation={strikeRecommendation}
              onAnalysisComplete={(data) => {
                setPostStrikeData(data);
              }}
            />
          </div>

          {postStrikeData && (
            <div className="stage-navigation">
              <div className="nav-message">
                <CheckCircle size={16} />
                <span>Post-strike analysis complete. Proceed to Stage 3 for conclusions.</span>
              </div>
              <button
                className="next-stage-button"
                onClick={() => handleStageChange("stage-3")}
              >
                Continue to Stage 3
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Stage 3: Analysis Conclusions */}
      {activeStage === "stage-3" && strikeRecommendation && postStrikeData && (
        <section className="stage-3-container">
          <div className="dashboard-grid">
            <AnalysisDashboard
              recommendation={strikeRecommendation}
              postStrikeData={postStrikeData}
            />
          </div>

          <div className="stage-navigation">
            <div className="nav-message">
              <CheckCircle size={16} />
              <span>Pipeline complete. All stages have been processed successfully.</span>
            </div>
            <button
              className="next-stage-button secondary"
              onClick={() => handleStageChange("stage-0")}
            >
              Start New Analysis
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* Placeholder for stages without data */}
      {activeStage === "stage-2" && !strikeRecommendation && (
        <section className="dashboard-grid">
          <div className="panel placeholder-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Stage 2</span>
                <h2>Post-Strike Data Collection</h2>
              </div>
              <AlertTriangle size={20} />
            </div>
            <div className="placeholder-content">
              <Radar size={48} className="placeholder-icon" />
              <p>Please complete Stage 1 first to generate strike parameters.</p>
              <p className="placeholder-hint">This stage collects multi-source intelligence data for post-strike analysis.</p>
              <button 
                className="action-button"
                onClick={() => handleStageChange("stage-1")}
              >
                Go to Stage 1
              </button>
            </div>
          </div>
        </section>
      )}

      {activeStage === "stage-3" && (!strikeRecommendation || !postStrikeData) && (
        <section className="dashboard-grid">
          <div className="panel placeholder-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Stage 3</span>
                <h2>Analysis Conclusions</h2>
              </div>
              <AlertTriangle size={20} />
            </div>
            <div className="placeholder-content">
              <BarChart3 size={48} className="placeholder-icon" />
              <p>Please complete Stages 1 and 2 first to generate analysis data.</p>
              <p className="placeholder-hint">This stage provides strategic insights and lessons learned from the collected data.</p>
              <button 
                className="action-button"
                onClick={() => handleStageChange("stage-1")}
              >
                Go to Stage 1
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

// Need to import these for the stage navigation
function CheckCircle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

function priorityFromConfidence(confidence: string): IntakePlanningSeed["priority"] {
  if (confidence === "high") {
    return "high";
  }
  if (confidence === "low") {
    return "medium";
  }
  return "high";
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No Stage 0 brief is available yet.";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function parseSessionSnapshot(raw: string): PipelineSessionSnapshot {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error("Unsupported session file");
  }

  return {
    version: 1,
    savedAt: stringValue(parsed.savedAt, new Date().toISOString()),
    rawText: stringValue(parsed.rawText, ""),
    sourceTitle: stringValue(parsed.sourceTitle, ""),
    sourceUrl: stringValue(parsed.sourceUrl, ""),
    imageUrl: stringValue(parsed.imageUrl, ""),
    analysis: normalizeAnalysis(parsed.analysis),
    rangeAnchor: normalizeCoordinatePair(parsed.rangeAnchor, { lat: 55.7558, lng: 37.6173 }),
    rangeKm: numberValue(parsed.rangeKm, 120),
    rangeLabel: stringValue(parsed.rangeLabel, "Custom range"),
    rangeRings: normalizeRangeRings(parsed.rangeRings),
    lastAnalyzedText: stringValue(parsed.lastAnalyzedText, ""),
    activeStage: normalizeStage(parsed.activeStage),
    strikeRecommendation: parsed.strikeRecommendation ?? null,
    postStrikeData: parsed.postStrikeData ?? null,
    manualPlanMode: Boolean(parsed.manualPlanMode),
    agentAnalysis: parsed.agentAnalysis ?? null
  };
}

function normalizeAnalysis(value: unknown): AnalysisResult {
  if (!isRecord(value)) {
    return emptyResult;
  }

  return {
    brief: stringValue(value.brief, emptyResult.brief),
    observations: Array.isArray(value.observations)
      ? value.observations.map(normalizeObservation).filter((item): item is Observation => Boolean(item))
      : emptyResult.observations,
    confidence: stringValue(value.confidence, emptyResult.confidence),
    sourceGaps: normalizeStringArray(value.sourceGaps, emptyResult.sourceGaps),
    verificationQuestions: normalizeStringArray(value.verificationQuestions, emptyResult.verificationQuestions),
    safetyFlags: normalizeStringArray(value.safetyFlags, []),
    mapLayers: Array.isArray(value.mapLayers)
      ? value.mapLayers.map(normalizeMapLayer).filter((item): item is MapLayer => Boolean(item))
      : [],
    evidenceCards: Array.isArray(value.evidenceCards)
      ? value.evidenceCards.map(normalizeEvidenceCard).filter((item): item is EvidenceCard => Boolean(item))
      : []
  };
}

function normalizeObservation(value: unknown): Observation | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    label: stringValue(value.label, "Imported observation"),
    detail: stringValue(value.detail, "No detail supplied."),
    confidence: stringValue(value.confidence, "medium"),
    source: stringValue(value.source, "import")
  };
}

function normalizeMapLayer(value: unknown): MapLayer | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: stringValue(value.id, `layer-${Date.now()}`),
    label: stringValue(value.label, "Imported layer"),
    lat: numberValue(value.lat, 55.7558),
    lng: numberValue(value.lng, 37.6173),
    radiusMeters: numberValue(value.radiusMeters, 25000),
    confidence: stringValue(value.confidence, "medium"),
    category: stringValue(value.category, "imported"),
    detail: stringValue(value.detail, "Imported session layer.")
  };
}

function normalizeEvidenceCard(value: unknown): EvidenceCard | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    title: stringValue(value.title, "Imported source"),
    description: stringValue(value.description, "Imported source context."),
    url: stringValue(value.url, "#"),
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    source: stringValue(value.source, "import")
  };
}

function normalizeRangeRings(value: unknown): RangeRing[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        id: stringValue(item.id, `range-${Date.now()}`),
        label: stringValue(item.label, "Imported range"),
        lat: numberValue(item.lat, 55.7558),
        lng: numberValue(item.lng, 37.6173),
        radiusMeters: numberValue(item.radiusMeters, 120000)
      };
    })
    .filter((item): item is RangeRing => Boolean(item));
}

function normalizeCoordinatePair(value: unknown, fallback: { lat: number; lng: number }) {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    lat: numberValue(value.lat, fallback.lat),
    lng: numberValue(value.lng, fallback.lng)
  };
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : fallback;
}

function normalizeStage(value: unknown): PipelineStage {
  return value === "stage-0" || value === "stage-1" || value === "stage-2" || value === "stage-3"
    ? value
    : "stage-0";
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
