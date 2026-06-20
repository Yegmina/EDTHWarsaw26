"use client";

import dynamic from "next/dynamic";
import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  FileSearch,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Radar,
  Ruler,
  ShieldCheck,
  Sparkles
} from "lucide-react";

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

  const inputStats = useMemo(() => {
    const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
    return { chars: rawText.length, words };
  }, [rawText]);

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

  return (
    <main className="app-shell">
      <section className="command-bar">
        <div>
          <div className="eyebrow">AeroRozum / Warsaw26</div>
          <h1>Zero Stage Current-State Intake</h1>
        </div>
        <div className="status-strip">
          <span>
            <ShieldCheck size={16} />
            GPT-5.5 server-side
          </span>
          <span>
            <Globe2 size={16} />
            Satellite basemap
          </span>
          <span>
            <Radar size={16} />
            Range tools
          </span>
        </div>
      </section>

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
    </main>
  );
}
