"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Camera,
  FileVideo,
  Flame,
  Loader2,
  ScanEye,
  Upload,
  Video
} from "lucide-react";
import type {
  AssessmentSettings,
  DamageSeverity,
  DetectionBox,
  VideoAssessmentResult,
  VideoFrameAssessment
} from "../types/videoAssessment";

const suppliedVideoUrl = "/demo/video_2026-06-20_20-14-28.mp4";

const defaultSettings: AssessmentSettings = {
  fps: 1,
  maxFrames: 24,
  eventSensitivity: 0.35,
  openAiFrameLimit: 8,
  processingConcurrency: 4,
  videoMode: "auto"
};

const severityRank: Record<DamageSeverity, number> = {
  none: 0,
  minor: 1,
  unknown: 1,
  moderate: 2,
  severe: 3
};

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function severityClass(value: DamageSeverity) {
  return `severity-${value}`;
}

function labelText(label: string) {
  if (label === "explosion_flash") {
    return "flash / heat";
  }

  return label.replaceAll("_", " ");
}

function selectedFrameFromResult(result: VideoAssessmentResult | null, selectedFrameId: string) {
  if (!result) {
    return null;
  }

  return result.frames.find((frame) => frame.id === selectedFrameId) ?? result.frames[0] ?? null;
}

function playbackFrameFromTime(result: VideoAssessmentResult | null, timeSec: number) {
  if (!result?.frames.length) {
    return null;
  }

  return result.frames.reduce((best, frame) =>
    Math.abs(frame.timeSec - timeSec) < Math.abs(best.timeSec - timeSec) ? frame : best
  );
}

function boxStyle(box: DetectionBox) {
  return {
    borderColor: box.color,
    color: box.color,
    height: `${box.height * 100}%`,
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`
  };
}

function videoBoxLayerStyle(frame: VideoFrameAssessment) {
  const aspectRatio = `${frame.width} / ${frame.height}`;
  const frameAspect = frame.width / Math.max(1, frame.height);
  const playerAspect = 16 / 10;

  return frameAspect >= playerAspect
    ? { aspectRatio, width: "100%" }
    : { aspectRatio, height: "100%" };
}

export function VideoAssessmentPanel() {
  const [settings, setSettings] = useState<AssessmentSettings>(defaultSettings);
  const [result, setResult] = useState<VideoAssessmentResult | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState(suppliedVideoUrl);
  const [usingSuppliedVideo, setUsingSuppliedVideo] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const selectedFrame = useMemo(
    () => selectedFrameFromResult(result, selectedFrameId),
    [result, selectedFrameId]
  );

  const playbackFrame = useMemo(
    () => playbackFrameFromTime(result, currentVideoTime),
    [currentVideoTime, result]
  );

  const strongestEvent = useMemo(() => {
    if (!result?.events.length) {
      return null;
    }

    return [...result.events].sort((a, b) => severityRank[b.severity] - severityRank[a.severity])[0];
  }, [result]);

  useEffect(() => {
    return () => {
      if (videoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  function updateSetting<K extends keyof AssessmentSettings>(key: K, value: AssessmentSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUsingSuppliedVideo(false);
    setResult(null);
    setSelectedFrameId("");
    setCurrentVideoTime(0);
    setError("");

    if (videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoUrl(file ? URL.createObjectURL(file) : suppliedVideoUrl);
  }

  function useSuppliedVideo() {
    if (videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }

    setSelectedFile(null);
    setUsingSuppliedVideo(true);
    setVideoUrl(suppliedVideoUrl);
    setResult(null);
    setSelectedFrameId("");
    setCurrentVideoTime(0);
    setError("");
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAnalyzing(true);
    setError("");

    try {
      const form = new FormData();
      form.set("settings", JSON.stringify(settings));

      if (usingSuppliedVideo || !selectedFile) {
        form.set("demo", "true");
        form.set("supplied", "true");
      } else {
        form.set("video", selectedFile);
      }

      const response = await fetch("/api/video-assessments", {
        method: "POST",
        body: form
      });
      const body = (await response.json()) as VideoAssessmentResult | { error?: string; detail?: string };

      if (!response.ok) {
        throw new Error("detail" in body && body.detail ? body.detail : "error" in body && body.error ? body.error : "Video assessment failed.");
      }

      const assessment = body as VideoAssessmentResult;
      setResult(assessment);
      setSelectedFrameId(assessment.events[0]?.frameId ?? assessment.frames[0]?.id ?? "");
      setCurrentVideoTime(0);
      setVideoUrl(assessment.video.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video assessment failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function selectFrame(frame: VideoFrameAssessment) {
    setSelectedFrameId(frame.id);
    if (videoRef.current) {
      videoRef.current.currentTime = frame.timeSec;
    }
  }

  return (
    <section className="panel video-assessment-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 2</span>
          <h2>Video Damage Assessment</h2>
        </div>
        <ScanEye size={20} />
      </div>

      <div className="video-assessment-grid">
        <form className="video-control-panel" onSubmit={handleAnalyze}>
          <div className="video-section-title">
            <FileVideo size={17} />
            Source video
          </div>

          <div className="video-source-actions">
            <button type="button" className={usingSuppliedVideo ? "" : "ghost-button"} onClick={useSuppliedVideo}>
              <Video size={17} />
              Supplied video
            </button>
            <label className="file-drop">
              <Upload size={17} />
              <span>{selectedFile ? selectedFile.name : "Upload video"}</span>
              <input accept="video/*,.mp4,.mov,.m4v,.webm" onChange={handleFileChange} type="file" />
            </label>
          </div>

          <div className="video-player-frame">
            <div className="video-player-stage">
              <video
                ref={videoRef}
                controls
                playsInline
                src={videoUrl}
                onLoadedMetadata={(event) => setCurrentVideoTime(event.currentTarget.currentTime)}
                onSeeked={(event) => setCurrentVideoTime(event.currentTarget.currentTime)}
                onTimeUpdate={(event) => setCurrentVideoTime(event.currentTarget.currentTime)}
              />
              {playbackFrame ? (
                <div className="video-playback-box-layer" style={videoBoxLayerStyle(playbackFrame)} aria-hidden="true">
                  {playbackFrame.boxes.map((box) => (
                    <div className="video-box playback-box" key={`playback-${box.id}`} style={boxStyle(box)}>
                      <span>{labelText(box.label)}</span>
                    </div>
                  ))}
                  <div className="frame-timecode playback-timecode">
                    {formatSeconds(playbackFrame.timeSec)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="video-settings-grid">
            <label>
              Frame rate
              <input
                max={5}
                min={0.25}
                step={0.25}
                type="number"
                value={settings.fps}
                onChange={(event) => updateSetting("fps", Number(event.target.value))}
              />
            </label>
            <label>
              Max frames
              <input
                max={80}
                min={4}
                step={1}
                type="number"
                value={settings.maxFrames}
                onChange={(event) => updateSetting("maxFrames", Number(event.target.value))}
              />
            </label>
            <label>
              Sensitivity
              <input
                max={0.95}
                min={0.05}
                step={0.05}
                type="range"
                value={settings.eventSensitivity}
                onChange={(event) => updateSetting("eventSensitivity", Number(event.target.value))}
              />
              <span>{settings.eventSensitivity.toFixed(2)}</span>
            </label>
            <label>
              GPT-5.5 frames
              <input
                max={16}
                min={0}
                step={1}
                type="number"
                value={settings.openAiFrameLimit}
                onChange={(event) => updateSetting("openAiFrameLimit", Number(event.target.value))}
              />
            </label>
            <label>
              Concurrency
              <input
                min={1}
                step={1}
                type="number"
                value={settings.processingConcurrency}
                onChange={(event) => updateSetting("processingConcurrency", Number(event.target.value))}
              />
            </label>
            <label>
              Video mode
              <select
                value={settings.videoMode}
                onChange={(event) =>
                  updateSetting("videoMode", event.target.value as AssessmentSettings["videoMode"])
                }
              >
                <option value="auto">Auto detect</option>
                <option value="visual">Visual / RGB</option>
                <option value="thermal">Thermal / IR</option>
                <option value="mixed">Mixed RGB + thermal</option>
              </select>
            </label>
          </div>

          <button className="video-analyze-button" disabled={isAnalyzing} type="submit">
            {isAnalyzing ? <Loader2 className="spin" size={18} /> : <Activity size={18} />}
            Analyze video
          </button>
          {error ? (
            <div className="error-line video-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : null}
        </form>

        <div className="frame-review-panel">
          <div className="video-section-title">
            <Boxes size={17} />
            Frame evidence
          </div>
          <div className="frame-review-stage">
            {selectedFrame ? (
              <>
                <img src={selectedFrame.imageUrl} alt={`Assessed frame at ${formatSeconds(selectedFrame.timeSec)}`} />
                {selectedFrame.boxes.map((box) => (
                  <div className="video-box" key={box.id} style={boxStyle(box)}>
                    <span>{labelText(box.label)}</span>
                  </div>
                ))}
                <div className="frame-timecode">{formatSeconds(selectedFrame.timeSec)}</div>
              </>
            ) : (
              <div className="frame-review-empty">
                <Camera size={26} />
                <span>Analyze video to populate frame-level boxes.</span>
              </div>
            )}
          </div>

          <div className="video-summary-grid">
            <article>
              <span>Damage severity</span>
              <strong className={result ? severityClass(result.damage.severity) : ""}>
                {result?.damage.severity ?? "pending"}
              </strong>
            </article>
            <article>
              <span>Smoke</span>
              <strong>{result ? `${result.damage.smokeColor} / ${result.damage.smokeExtent}` : "pending"}</strong>
            </article>
            <article>
              <span>Fire / flash</span>
              <strong>{result ? (result.damage.fireDetected || result.damage.explosionDetected ? "detected" : "not visible") : "pending"}</strong>
            </article>
            <article>
              <span>People risk</span>
              <strong>{result?.peopleRisk.level.replaceAll("_", " ") ?? "pending"}</strong>
            </article>
          </div>

          {result ? (
            <div className="assessment-narrative">
              <p>{result.summary}</p>
              <p>{result.damage.rationale}</p>
            </div>
          ) : null}
        </div>

        <div className="video-output-panel">
          <div className="video-section-title">
            <Flame size={17} />
            Events and review
          </div>

          <div className="model-status-grid">
            <article>
              <span>Vision review</span>
              <strong>{result?.openAiReview.status ?? "pending"}</strong>
            </article>
            <article>
              <span>Model</span>
              <strong>{result?.openAiReview.model ?? "GPT-5.5"}</strong>
            </article>
            <article>
              <span>Frames</span>
              <strong>{result ? `${result.processing.frameCount} sampled` : "pending"}</strong>
            </article>
            <article>
              <span>Strongest event</span>
              <strong className={strongestEvent ? severityClass(strongestEvent.severity) : ""}>
                {strongestEvent?.severity ?? "pending"}
              </strong>
            </article>
            <article>
              <span>Mode</span>
              <strong>{result?.processing.videoMode ?? settings.videoMode}</strong>
            </article>
            <article>
              <span>Concurrency</span>
              <strong>
                {result?.processing.processingConcurrency ?? settings.processingConcurrency}
              </strong>
            </article>
          </div>

          {result?.openAiReview.error ? <div className="model-error">{result.openAiReview.error}</div> : null}

          <div className="video-timeline">
            {(result?.frames ?? []).map((frame) => (
              <button
                type="button"
                className={frame.id === selectedFrame?.id ? "timeline-frame active" : "timeline-frame"}
                key={frame.id}
                onClick={() => selectFrame(frame)}
              >
                <img src={frame.imageUrl} alt="" />
                <span>{formatSeconds(frame.timeSec)}</span>
                <em>{frame.boxes.length} boxes</em>
              </button>
            ))}
            {!result ? <div className="timeline-empty">Frame timeline will appear after processing.</div> : null}
          </div>

          <div className="event-list">
            {(result?.events ?? []).map((event) => (
              <button
                type="button"
                className="event-card"
                key={event.id}
                onClick={() => {
                  const frame = result?.frames.find((item) => item.id === event.frameId);
                  if (frame) {
                    selectFrame(frame);
                  }
                }}
              >
                <div>
                  <strong>{event.title}</strong>
                  <span>{formatSeconds(event.timeSec)}</span>
                </div>
                <p>{event.labels.map(labelText).join(", ")}</p>
                <div className="event-meta">
                  <em className={severityClass(event.severity)}>{event.severity}</em>
                  <em>{event.confidence} confidence</em>
                  <em>{event.boxes.length} boxes</em>
                </div>
              </button>
            ))}
            {result && !result.events.length ? (
              <div className="timeline-empty">No visible smoke, flash, dust, or major scene-change events were detected in sampled frames.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
