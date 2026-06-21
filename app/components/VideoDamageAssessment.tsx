"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Activity, Box, FileVideo, Flame, Loader2, ScanLine, Thermometer } from "lucide-react";

export type VideoAssessmentSummary = {
  confidence: number;
  eventCount: number;
  peakScore: number;
  summary: string;
};

type VideoDamageAssessmentProps = {
  onAssessmentComplete: (summary: VideoAssessmentSummary) => void;
};

type SourceMode = "rgb" | "thermal" | "mixed";
type EventKind = "flash" | "thermal-spike" | "scene-change";

type DetectionEvent = {
  id: string;
  time: number;
  score: number;
  kind: EventKind;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type FrameSample = {
  time: number;
  pixels: Uint8ClampedArray;
  luminance: number;
};

type VideoInterpretation = {
  provider: "vision-llm" | "local";
  confidence: number;
  damageLevel: "none-observed" | "possible" | "probable" | "severe" | "unknown";
  summary: string;
  observations: string[];
  visualIndicators: string[];
  uncertainties: string[];
  recommendedReviewActions: string[];
};

const sampleWidth = 192;
const sampleHeight = 108;

export function VideoDamageAssessment({ onAssessmentComplete }: VideoDamageAssessmentProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [fileName, setFileName] = useState("No video selected");
  const [sourceMode, setSourceMode] = useState<SourceMode>("mixed");
  const [sampleFps, setSampleFps] = useState("6");
  const [sensitivity, setSensitivity] = useState("0.42");
  const [concurrency, setConcurrency] = useState("12");
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [duration, setDuration] = useState(0);
  const [interpretation, setInterpretation] = useState<VideoInterpretation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [error, setError] = useState("");

  const peakEvent = useMemo(
    () => events.slice().sort((a, b) => b.score - a.score)[0] ?? null,
    [events]
  );

  const eventProfile = useMemo(() => {
    const counts = events.reduce<Record<EventKind, number>>(
      (acc, event) => {
        acc[event.kind] += 1;
        return acc;
      },
      { flash: 0, "thermal-spike": 0, "scene-change": 0 }
    );

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => `${kind.replace("-", " ")} ${count}`)
      .join(" / ");
  }, [events]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas) {
      return;
    }

    let frameId = 0;
    const draw = () => {
      drawOverlay(video, canvas, events);
      frameId = window.requestAnimationFrame(draw);
    };
    draw();

    return () => window.cancelAnimationFrame(frameId);
  }, [events, videoUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function handleVideoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setEvents([]);
    setInterpretation(null);

    if (!file) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
    setFileName(file.name);
  }

  async function handleAnalyzeVideo() {
    if (!videoUrl) {
      setError("Upload a source video before running frame analysis.");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const analysis = await analyzeVideo(videoUrl, {
        sourceMode,
        sampleFps: Math.max(0.1, Number(sampleFps) || 1),
        sensitivity: Math.max(0.01, Number(sensitivity) || 0.35),
        concurrency: Math.max(1, Math.round(Number(concurrency) || 1))
      });

      setEvents(analysis.events);
      setDuration(analysis.duration);
      const localSummary = buildAssessmentSummary(analysis.events, analysis.duration, sourceMode, null);
      onAssessmentComplete(localSummary);

      const thumbnails = await captureEventThumbnails(videoUrl, analysis.events);
      if (analysis.events.length) {
        setIsInterpreting(true);
        const aiAssessment = await requestVideoInterpretation({
          sourceMode,
          duration: analysis.duration,
          events: analysis.events,
          thumbnails
        });
        setInterpretation(aiAssessment);
        onAssessmentComplete(buildAssessmentSummary(analysis.events, analysis.duration, sourceMode, aiAssessment));
      } else {
        const aiAssessment = await requestVideoInterpretation({
          sourceMode,
          duration: analysis.duration,
          events: analysis.events,
          thumbnails
        });
        setInterpretation(aiAssessment);
        onAssessmentComplete(buildAssessmentSummary(analysis.events, analysis.duration, sourceMode, aiAssessment));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video assessment failed.");
    } finally {
      setIsProcessing(false);
      setIsInterpreting(false);
    }
  }

  function handleClear() {
    setEvents([]);
    setDuration(0);
    setInterpretation(null);
    setError("");
  }

  return (
    <section className="video-assessment-panel">
      <div className="evidence-section-title">
        <FileVideo size={16} />
        <span>Video Damage Assessment</span>
      </div>

      <div className="video-assessment-grid">
        <div className="video-stage">
          {videoUrl ? (
            <>
              <video
                controls
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                ref={videoRef}
                src={videoUrl}
              />
              <canvas ref={overlayRef} />
            </>
          ) : (
            <div className="video-empty-state">
              <FileVideo size={34} />
              <strong>Source video required</strong>
              <span>Upload RGB, thermal, or mixed footage for frame-delta assessment.</span>
            </div>
          )}
        </div>

        <div className="video-controls">
          <label className="file-control">
            Source video
            <input accept="video/*" onChange={handleVideoSelected} type="file" />
            <span>{fileName}</span>
          </label>

          <div className="video-control-grid">
            <label>
              Source mode
              <select value={sourceMode} onChange={(event) => setSourceMode(event.target.value as SourceMode)}>
                <option value="mixed">Mixed RGB + thermal</option>
                <option value="thermal">Thermal</option>
                <option value="rgb">RGB / daylight</option>
              </select>
            </label>
            <label>
              Frame rate
              <input value={sampleFps} onChange={(event) => setSampleFps(event.target.value)} type="number" />
            </label>
            <label>
              Sensitivity
              <input value={sensitivity} onChange={(event) => setSensitivity(event.target.value)} type="number" />
            </label>
            <label>
              Concurrency
              <input value={concurrency} onChange={(event) => setConcurrency(event.target.value)} type="number" />
            </label>
          </div>

          <div className="video-actions">
            <button disabled={!videoUrl || isProcessing} onClick={handleAnalyzeVideo} type="button">
              {isProcessing ? <Loader2 className="spin" size={16} /> : <ScanLine size={16} />}
              Analyze video
            </button>
            <button className="ghost-button" disabled={isProcessing || !events.length} onClick={handleClear} type="button">
              Clear boxes
            </button>
          </div>

          {error ? (
            <div className="error-line inline-error">
              <AlertTriangle size={15} />
              {error}
            </div>
          ) : null}

          <div className="video-metrics">
            <article>
              <Activity size={15} />
              <span>Detections</span>
              <strong>{events.length}</strong>
            </article>
            <article>
              <Flame size={15} />
              <span>Peak</span>
              <strong>{peakEvent ? `${peakEvent.score}%` : "none"}</strong>
            </article>
            <article>
              <Thermometer size={15} />
              <span>Duration</span>
              <strong>{duration ? `${duration.toFixed(1)}s` : "pending"}</strong>
            </article>
            <article>
              <ScanLine size={15} />
              <span>AI Brief</span>
              <strong>{isInterpreting ? "running" : interpretation ? providerLabel(interpretation.provider) : "pending"}</strong>
            </article>
          </div>

          <div className="video-event-list">
            {events.slice(0, 6).map((event) => (
              <button
                key={event.id}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = event.time;
                    void videoRef.current.play();
                  }
                }}
                type="button"
              >
                <Box size={14} />
                <span>T+{event.time.toFixed(2)}s</span>
                <strong>{event.kind.replace("-", " ")}</strong>
                <em>{event.score}%</em>
              </button>
            ))}
            {!events.length ? <p>No detection boxes computed yet.</p> : null}
          </div>

          {eventProfile ? <p className="video-profile">{eventProfile}</p> : null}
          {interpretation ? (
            <div className="video-interpretation">
              <div>
                <strong>{assessmentLabel(interpretation, events.length)}</strong>
                <span>{providerLabel(interpretation.provider)} / {interpretation.confidence}%</span>
              </div>
              <p>{interpretation.summary}</p>
              <ul>
                {interpretation.visualIndicators.slice(0, 4).map((indicator) => (
                  <li key={indicator}>{indicator}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

async function analyzeVideo(
  videoUrl: string,
  options: {
    sourceMode: SourceMode;
    sampleFps: number;
    sensitivity: number;
    concurrency: number;
  }
) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  await waitForVideoMetadata(video);

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration) {
    throw new Error("Video metadata did not include a usable duration.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas frame analyzer is unavailable in this browser.");
  }

  const step = 1 / options.sampleFps;
  const frameTimes: number[] = [];
  for (let time = 0; time <= duration; time += step) {
    frameTimes.push(Number(Math.min(time, duration).toFixed(3)));
  }

  let previous: FrameSample | null = null;
  const events: DetectionEvent[] = [];
  const batchSize = Math.max(1, options.concurrency);

  for (let index = 0; index < frameTimes.length; index += 1) {
    const time = frameTimes[index];
    await seekVideo(video, time);
    context.drawImage(video, 0, 0, sampleWidth, sampleHeight);
    const image = context.getImageData(0, 0, sampleWidth, sampleHeight);
    const current = frameToSample(image.data, time, options.sourceMode);

    if (previous) {
      const event = compareFrames(previous, current, options);
      if (event) {
        events.push(event);
      }
    }

    previous = current;
    if (index % batchSize === 0) {
      await nextFrame();
    }
  }

  return { duration, events: mergeEvents(events) };
}

function compareFrames(
  previous: FrameSample,
  current: FrameSample,
  options: {
    sourceMode: SourceMode;
    sensitivity: number;
  }
): DetectionEvent | null {
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = 0;
  let maxY = 0;
  let changed = 0;
  let diffTotal = 0;
  let brightGain = 0;
  const threshold = Math.max(6, 42 - options.sensitivity * 48);
  const stride = 2;

  for (let y = 0; y < sampleHeight; y += stride) {
    for (let x = 0; x < sampleWidth; x += stride) {
      const index = y * sampleWidth + x;
      const diff = Math.abs(current.pixels[index] - previous.pixels[index]);
      if (diff > threshold) {
        changed += 1;
        diffTotal += diff;
        brightGain += Math.max(0, current.pixels[index] - previous.pixels[index]);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const sampleCount = Math.ceil(sampleWidth / stride) * Math.ceil(sampleHeight / stride);
  const changeRatio = changed / sampleCount;
  const minAreaRatio = Math.max(0.002, 0.028 / (options.sensitivity + 0.24));
  const luminanceDelta = current.luminance - previous.luminance;

  if (changeRatio < minAreaRatio && Math.abs(luminanceDelta) < 16 + options.sensitivity * 4) {
    return null;
  }

  const averageDiff = changed ? diffTotal / changed : Math.abs(luminanceDelta);
  const brightRatio = changed ? brightGain / (changed * 255) : 0;
  const score = Math.min(99, Math.round(changeRatio * 145 + averageDiff * 0.22 + Math.abs(luminanceDelta) * 0.35));
  const kind = classifyEvent(options.sourceMode, brightRatio, luminanceDelta, changeRatio);

  return {
    id: `event-${current.time}-${score}`,
    time: current.time,
    score,
    kind,
    bbox: {
      x: clamp(minX / sampleWidth, 0, 1),
      y: clamp(minY / sampleHeight, 0, 1),
      width: clamp((maxX - minX + stride) / sampleWidth, 0.08, 1),
      height: clamp((maxY - minY + stride) / sampleHeight, 0.08, 1)
    }
  };
}

function classifyEvent(sourceMode: SourceMode, brightRatio: number, luminanceDelta: number, changeRatio: number): EventKind {
  if (sourceMode === "thermal" && (brightRatio > 0.12 || luminanceDelta > 14)) {
    return "thermal-spike";
  }
  if (brightRatio > 0.16 || luminanceDelta > 22) {
    return "flash";
  }
  if (changeRatio > 0.09) {
    return "scene-change";
  }
  return "scene-change";
}

function frameToSample(data: Uint8ClampedArray, time: number, sourceMode: SourceMode): FrameSample {
  const pixels = new Uint8ClampedArray(sampleWidth * sampleHeight);
  let luminanceTotal = 0;

  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 4, targetIndex += 1) {
    const red = data[sourceIndex];
    const green = data[sourceIndex + 1];
    const blue = data[sourceIndex + 2];
    const value =
      sourceMode === "thermal"
        ? Math.max(red, green, blue)
        : sourceMode === "rgb"
          ? red * 0.299 + green * 0.587 + blue * 0.114
          : Math.max(red * 0.299 + green * 0.587 + blue * 0.114, Math.max(red, green, blue) * 0.86);
    pixels[targetIndex] = value;
    luminanceTotal += value;
  }

  return {
    time,
    pixels,
    luminance: luminanceTotal / pixels.length
  };
}

function mergeEvents(events: DetectionEvent[]) {
  const sorted = events.slice().sort((a, b) => a.time - b.time);
  const merged: DetectionEvent[] = [];

  for (const event of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && event.time - previous.time < 0.42) {
      if (event.score > previous.score) {
        merged[merged.length - 1] = event;
      }
      continue;
    }
    merged.push(event);
  }

  return merged;
}

async function requestVideoInterpretation(payload: {
  sourceMode: SourceMode;
  duration: number;
  events: DetectionEvent[];
  thumbnails: string[];
}): Promise<VideoInterpretation> {
  try {
    const response = await fetch("/api/video-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "Video interpretation failed.");
    }

    return normalizeVideoInterpretation(body, payload);
  } catch {
    return localInterpretation(payload.events, payload.duration, payload.sourceMode);
  }
}

function normalizeVideoInterpretation(
  value: Omit<Partial<VideoInterpretation>, "provider"> & { provider?: string },
  payload: {
    sourceMode: SourceMode;
    duration: number;
    events: DetectionEvent[];
  }
): VideoInterpretation {
  const fallback = localInterpretation(payload.events, payload.duration, payload.sourceMode);
  const damageLevel = value.damageLevel;
  return {
    provider: value.provider === "openai" || value.provider === "vision-llm" ? "vision-llm" : "local",
    confidence: boundedNumber(value.confidence, fallback.confidence, 0, 100),
    damageLevel:
      damageLevel === "none-observed" ||
      damageLevel === "possible" ||
      damageLevel === "probable" ||
      damageLevel === "severe" ||
      damageLevel === "unknown"
        ? damageLevel
        : fallback.damageLevel,
    summary: typeof value.summary === "string" ? value.summary : fallback.summary,
    observations: Array.isArray(value.observations) ? value.observations.map(String).filter(Boolean) : fallback.observations,
    visualIndicators: Array.isArray(value.visualIndicators)
      ? value.visualIndicators.map(String).filter(Boolean)
      : fallback.visualIndicators,
    uncertainties: Array.isArray(value.uncertainties) ? value.uncertainties.map(String).filter(Boolean) : fallback.uncertainties,
    recommendedReviewActions: Array.isArray(value.recommendedReviewActions)
      ? value.recommendedReviewActions.map(String).filter(Boolean)
      : fallback.recommendedReviewActions
  };
}

function localInterpretation(events: DetectionEvent[], duration: number, sourceMode: SourceMode): VideoInterpretation {
  const peak = events.slice().sort((a, b) => b.score - a.score)[0];
  const profile = Array.from(new Set(events.map((event) => event.kind.replace("-", " "))));
  const confidence = events.length ? Math.min(92, Math.max(52, Math.round(50 + (peak?.score ?? 0) * 0.32 + events.length * 2))) : 40;
  const damageLevel: VideoInterpretation["damageLevel"] =
    (peak?.score ?? 0) >= 82 && events.length >= 3
      ? "severe"
      : (peak?.score ?? 0) >= 62
        ? "probable"
        : events.length
          ? "possible"
          : "unknown";

  return {
    provider: "local",
    confidence,
    damageLevel,
    summary: events.length
      ? `${sourceMode.toUpperCase()} local review detected ${events.length} event windows over ${duration.toFixed(1)}s, led by ${peak?.kind.replace("-", " ")} at T+${peak?.time.toFixed(2)}s.`
      : `${sourceMode.toUpperCase()} local review found no dominant fast-change event over ${duration.toFixed(1)}s.`,
    observations: events
      .slice(0, 5)
      .map((event) => `T+${event.time.toFixed(2)}s ${event.kind.replace("-", " ")} scored ${event.score}%.`),
    visualIndicators: profile.length ? profile : ["no dominant visible indicator"],
    uncertainties: ["Frame-delta analysis cannot independently confirm physical damage."],
    recommendedReviewActions: ["Preserve keyframes and compare with independent sources."]
  };
}

async function captureEventThumbnails(videoUrl: string, events: DetectionEvent[]) {
  if (!events.length) {
    return [];
  }

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;
  await waitForVideoMetadata(video);

  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 270;
  const context = canvas.getContext("2d");
  if (!context) {
    return [];
  }

  const selectedEvents = events.slice().sort((a, b) => b.score - a.score).slice(0, 4);
  const thumbnails: string[] = [];

  for (const event of selectedEvents) {
    await seekVideo(video, event.time);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawEventBox(context, event, canvas.width, canvas.height);
    thumbnails.push(canvas.toDataURL("image/jpeg", 0.72));
  }

  return thumbnails;
}

function drawEventBox(context: CanvasRenderingContext2D, event: DetectionEvent, width: number, height: number) {
  const x = event.bbox.x * width;
  const y = event.bbox.y * height;
  const boxWidth = event.bbox.width * width;
  const boxHeight = event.bbox.height * height;
  context.strokeStyle = event.kind === "thermal-spike" ? "#f2b84b" : "#75f0c8";
  context.lineWidth = 4;
  context.strokeRect(x, y, boxWidth, boxHeight);
  context.fillStyle = "rgba(5, 7, 6, 0.82)";
  context.fillRect(x, Math.max(0, y - 26), Math.min(280, boxWidth + 80), 26);
  context.fillStyle = event.kind === "thermal-spike" ? "#f2b84b" : "#75f0c8";
  context.font = "13px Cascadia Mono, Consolas, monospace";
  context.fillText(`${event.kind.replace("-", " ")} / ${event.score}%`, x + 7, Math.max(17, y - 8));
}

function buildAssessmentSummary(
  events: DetectionEvent[],
  duration: number,
  sourceMode: SourceMode,
  interpretation: VideoInterpretation | null
): VideoAssessmentSummary {
  const peak = events.slice().sort((a, b) => b.score - a.score)[0];
  const confidence = interpretation
    ? interpretation.confidence
    : peak
      ? Math.min(96, Math.max(58, Math.round(56 + peak.score * 0.28 + Math.min(events.length, 12) * 2.2)))
      : 44;
  const profile = events.length
    ? Array.from(new Set(events.slice(0, 8).map((event) => event.kind.replace("-", " ")))).join(", ")
    : "no high-confidence delta events";
  const interpretedSummary = interpretation
    ? `${providerLabel(interpretation.provider)} interpretation: ${interpretation.summary}`
    : "";

  return {
    confidence,
    eventCount: events.length,
    peakScore: peak?.score ?? 0,
    summary: [
      events.length
        ? `${sourceMode.toUpperCase()} video delta analysis detected ${events.length} event windows across ${duration.toFixed(1)}s; peak ${peak?.score ?? 0}% at T+${peak?.time.toFixed(2) ?? "0.00"}s; indicators: ${profile}.`
        : `${sourceMode.toUpperCase()} video delta analysis found no dominant fast-change event across ${duration.toFixed(1)}s.`,
      interpretedSummary
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

function drawOverlay(video: HTMLVideoElement, canvas: HTMLCanvasElement, events: DetectionEvent[]) {
  const rect = video.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  const currentTime = video.currentTime || 0;
  const activeEvents = events.filter((event) => Math.abs(event.time - currentTime) < 0.36);

  for (const event of activeEvents) {
    const x = event.bbox.x * width;
    const y = event.bbox.y * height;
    const boxWidth = event.bbox.width * width;
    const boxHeight = event.bbox.height * height;
    context.strokeStyle = event.kind === "thermal-spike" ? "#f2b84b" : "#75f0c8";
    context.lineWidth = 3;
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.fillStyle = "rgba(5, 7, 6, 0.84)";
    context.fillRect(x, Math.max(0, y - 25), Math.min(270, boxWidth + 80), 24);
    context.fillStyle = event.kind === "thermal-spike" ? "#f2b84b" : "#75f0c8";
    context.font = "12px Cascadia Mono, Consolas, monospace";
    context.fillText(`${event.kind.replace("-", " ")} / ${event.score}%`, x + 7, Math.max(15, y - 8));
  }
}

function providerLabel(provider: VideoInterpretation["provider"]) {
  return provider === "vision-llm" ? "Vision LLM" : "Local detector";
}

function assessmentLabel(interpretation: VideoInterpretation, eventCount: number) {
  if (eventCount > 0 && interpretation.confidence >= 50 && interpretation.damageLevel !== "none-observed") {
    return "Strike confirmed";
  }
  return interpretation.damageLevel.replace("-", " ");
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to load video metadata."));
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to seek video frame."));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = Math.min(time, video.duration || time);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
