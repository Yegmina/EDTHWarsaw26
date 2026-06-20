import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type {
  AssessmentSettings,
  ConfidenceLevel,
  DamageAssessment,
  DamageSeverity,
  DetectionBox,
  DetectionLabel,
  FrameMetrics,
  OpenAiVideoReview,
  PeopleRiskAssessment,
  VideoMode,
  VideoAssessmentResult,
  VideoEvent,
  VideoFrameAssessment
} from "../types/videoAssessment";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const demoVideoPath = path.join(projectRoot, "public", "demo", "video_2026-06-20_20-14-28.mp4");
const storageRoot = path.join(projectRoot, "data", "video-assessments");
const frameWidth = 540;
const openAiModel = "gpt-5.5";

type RawFrame = {
  id: string;
  fileName: string;
  absolutePath: string;
  timeSec: number;
  width: number;
  height: number;
  data: Buffer;
};

type FfprobePayload = {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    nb_frames?: string;
    duration?: string;
  }>;
  format?: {
    duration?: string;
  };
};

type OpenAiParsedReview = {
  summary?: string;
  damageSeverity?: DamageSeverity;
  damageRationale?: string;
  smokeColor?: string;
  smokeExtent?: DamageAssessment["smokeExtent"];
  peopleRisk?: Partial<PeopleRiskAssessment>;
  observations?: string[];
  events?: Array<{
    frameId?: string;
    timeSec?: number;
    title?: string;
    severity?: DamageSeverity;
    labels?: DetectionLabel[];
    notes?: string[];
    boxes?: Array<Partial<DetectionBox>>;
  }>;
};

export const defaultAssessmentSettings: AssessmentSettings = {
  fps: 4,
  eventSensitivity: 0.35,
  openAiFrameLimit: 8,
  processingConcurrency: 4,
  videoMode: "auto"
};

export function normalizeAssessmentSettings(input: unknown): AssessmentSettings {
  const value = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return {
    fps: clampNumber(value.fps, 0.25, 5, defaultAssessmentSettings.fps),
    eventSensitivity: clampNumber(
      value.eventSensitivity,
      0.05,
      0.95,
      defaultAssessmentSettings.eventSensitivity
    ),
    openAiFrameLimit: Math.round(
      clampNumber(value.openAiFrameLimit, 0, 16, defaultAssessmentSettings.openAiFrameLimit)
    ),
    processingConcurrency: positiveInteger(value.processingConcurrency, defaultAssessmentSettings.processingConcurrency),
    videoMode: validVideoMode(value.videoMode) ?? defaultAssessmentSettings.videoMode
  };
}

export async function createVideoAssessmentFromDemo(settings: AssessmentSettings) {
  const run = await createRunDirectory();
  await copyFile(demoVideoPath, run.sourcePath);
  return analyzeSavedVideo(run.id, run.runDir, run.sourcePath, "video_2026-06-20_20-14-28.mp4", "demo", settings);
}

export async function createVideoAssessmentFromUpload(
  fileName: string,
  fileBytes: Buffer,
  settings: AssessmentSettings
) {
  const run = await createRunDirectory();
  await writeFile(run.sourcePath, fileBytes);
  return analyzeSavedVideo(run.id, run.runDir, run.sourcePath, fileName || "uploaded-video.mp4", "upload", settings);
}

export async function readVideoAssessment(id: string) {
  assertSafeId(id);
  const resultPath = path.join(storageRoot, id, "result.json");
  const text = await readFile(resultPath, "utf8");
  return JSON.parse(text) as VideoAssessmentResult;
}

export async function readAssessmentFrame(id: string, frameId: string) {
  assertSafeId(id);
  assertSafeFrameId(frameId);
  const framePath = path.join(storageRoot, id, "frames", `${frameId}.jpg`);
  return readFile(framePath);
}

export async function readAssessmentSourceVideo(id: string) {
  assertSafeId(id);
  const sourcePath = path.join(storageRoot, id, "source.mp4");
  return readFile(sourcePath);
}

export async function readAssessmentAnnotatedVideo(id: string) {
  assertSafeId(id);
  const annotatedPath = path.join(storageRoot, id, "annotated.mp4");
  return readFile(annotatedPath);
}

async function analyzeSavedVideo(
  id: string,
  runDir: string,
  sourcePath: string,
  fileName: string,
  source: "demo" | "upload",
  settings: AssessmentSettings
) {
  const framesDir = path.join(runDir, "frames");
  await mkdir(framesDir, { recursive: true });

  const metadata = await probeVideo(sourcePath);
  const extractedFrames = await extractFrames(sourcePath, framesDir, settings);
  const rawFrames = await loadRawFrames(extractedFrames, settings.processingConcurrency);
  const frameAssessments = analyzeFrames(id, rawFrames, settings);
  const localEvents = buildEvents(frameAssessments);
  const localDamage = summarizeDamage(frameAssessments, localEvents);
  const localPeopleRisk = summarizePeopleRisk(frameAssessments);
  const openAiReview = await reviewFramesWithOpenAi(rawFrames, frameAssessments, localEvents, settings);
  const result = mergeAssessment({
    id,
    fileName,
    source,
    metadata,
    settings,
    frames: frameAssessments,
    events: localEvents,
    damage: localDamage,
    peopleRisk: localPeopleRisk,
    openAiReview
  });
  result.processing.annotatedVideo = await createAnnotatedVideo(runDir, sourcePath, result.frames, settings.fps);
  if (result.processing.annotatedVideo) {
    result.video.annotatedUrl = `/api/video-assessments/${id}/annotated`;
  }

  await writeFile(path.join(runDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  await writeFile(path.join(runDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  return result;
}

async function createRunDirectory() {
  const id = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto
    .randomBytes(4)
    .toString("hex")}`;
  const runDir = path.join(storageRoot, id);
  await mkdir(runDir, { recursive: true });
  return {
    id,
    runDir,
    sourcePath: path.join(runDir, "source.mp4")
  };
}

async function probeVideo(sourcePath: string) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-show_format", "-show_streams", "-of", "json", sourcePath],
    { maxBuffer: 1024 * 1024 * 8 }
  );
  const payload = JSON.parse(stdout) as FfprobePayload;
  const videoStream = payload.streams?.find((stream) => stream.codec_type === "video");
  return {
    durationSec: Number(payload.format?.duration ?? videoStream?.duration ?? 0),
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    frameCount: Number(videoStream?.nb_frames ?? 0)
  };
}

async function extractFrames(sourcePath: string, framesDir: string, settings: AssessmentSettings) {
  const outputPattern = path.join(framesDir, "frame_%04d.jpg");
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      sourcePath,
      "-vf",
      `fps=${settings.fps},scale=${frameWidth}:-1`,
      "-q:v",
      "3",
      outputPattern
    ],
    { maxBuffer: 1024 * 1024 * 8 }
  );

  const files = (await readdir(framesDir))
    .filter((file) => /^frame_\d+\.jpg$/.test(file))
    .sort();

  return files.map((file, index) => ({
    id: path.basename(file, ".jpg"),
    fileName: file,
    absolutePath: path.join(framesDir, file),
    timeSec: Number((index / settings.fps).toFixed(3))
  }));
}

async function loadRawFrames(
  frames: Array<{ id: string; fileName: string; absolutePath: string; timeSec: number }>,
  concurrency: number
): Promise<RawFrame[]> {
  return mapWithConcurrency(frames, concurrency, async (frame) => {
    const image = sharp(frame.absolutePath).toColorspace("srgb");
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    return {
      ...frame,
      width: info.width,
      height: info.height,
      data
    };
  });
}

function analyzeFrames(id: string, frames: RawFrame[], settings: AssessmentSettings): VideoFrameAssessment[] {
  const baseline = frames[0]?.data;
  return frames.map((frame, index) => {
    const previous = index > 0 ? frames[index - 1].data : baseline;
    const { boxes, metrics } = analyzeFramePixels(frame, baseline, previous, settings);
    return {
      id: frame.id,
      timeSec: frame.timeSec,
      imageUrl: `/api/video-assessments/${id}/frames/${frame.id}`,
      width: frame.width,
      height: frame.height,
      metrics,
      boxes
    };
  });
}

function analyzeFramePixels(
  frame: RawFrame,
  baseline: Buffer | undefined,
  previous: Buffer | undefined,
  settings: AssessmentSettings
) {
  const pixels = frame.width * frame.height;
  const channels = Math.max(3, Math.round(frame.data.length / pixels));
  const hasPrevious = Boolean(previous && previous !== frame.data);
  const hasBaseline = Boolean(baseline && baseline !== frame.data);
  const deltaHistogram = new Uint32Array(256);
  const deltaValues = new Uint8Array(pixels);
  let deltaSum = 0;
  let deltaMax = 0;

  for (let index = 0; index < pixels; index += 1) {
    const offset = index * channels;
    const delta = hasPrevious && previous ? colorDistance(frame.data, previous, offset, channels) : 0;
    const capped = Math.min(255, Math.round(delta));
    deltaValues[index] = capped;
    deltaHistogram[capped] += 1;
    deltaSum += capped;
    deltaMax = Math.max(deltaMax, capped);
  }

  const deltaThreshold = hasPrevious
    ? adaptiveDeltaThreshold(deltaHistogram, pixels, settings.eventSensitivity)
    : Number.POSITIVE_INFINITY;
  const slowDeltaThreshold = deltaThreshold * 0.45;
  const baselineThreshold = deltaThreshold * 1.15;
  const rapidMask = new Uint8Array(pixels);
  const fireMask = new Uint8Array(pixels);
  const smokeMask = new Uint8Array(pixels);
  const dustMask = new Uint8Array(pixels);
  let changed = 0;
  let fire = 0;
  let smoke = 0;
  let dust = 0;
  let brightnessSum = 0;
  let smokeR = 0;
  let smokeG = 0;
  let smokeB = 0;

  for (let index = 0; index < pixels; index += 1) {
    const offset = index * channels;
    const r = frame.data[offset] ?? 0;
    const g = frame.data[offset + 1] ?? 0;
    const b = frame.data[offset + 2] ?? 0;
    const avg = (r + g + b) / 3;
    brightnessSum += avg;

    const prevDelta = deltaValues[index];
    const baseChanged =
      hasBaseline && baseline ? colorDistance(frame.data, baseline, offset, channels) > baselineThreshold : false;
    const prevChanged = hasPrevious && prevDelta >= deltaThreshold;
    const slowButPersistent = baseChanged && prevDelta >= slowDeltaThreshold;
    const isChanged = prevChanged || slowButPersistent;
    if (isChanged) {
      changed += 1;
    }
    if (prevChanged) {
      rapidMask[index] = 1;
    }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const grayish = max - min < 48;
    const warm = r > 150 && g > 82 && b < 130 && r > b * 1.45;
    const hotFlash = r > 210 && g > 130 && b < 120 && r > b * 1.8;
    const brightDelta =
      hasPrevious && previous ? avg - ((previous[offset] ?? 0) + (previous[offset + 1] ?? 0) + (previous[offset + 2] ?? 0)) / 3 : 0;
    const whiteGraySmoke = grayish && avg > 82 && avg < 232 && isChanged;
    const darkSmoke = grayish && avg > 35 && avg <= 110 && isChanged;
    const tanDust = r > 112 && g > 92 && b < 126 && r > b * 1.12 && Math.abs(r - g) < 58 && isChanged;
    const rapidThermalHotspot = prevChanged && brightDelta > 34 && avg > 132;

    if ((warm || hotFlash || rapidThermalHotspot) && isChanged) {
      fireMask[index] = 1;
      fire += 1;
    }
    if (whiteGraySmoke || darkSmoke) {
      smokeMask[index] = 1;
      smoke += 1;
      smokeR += r;
      smokeG += g;
      smokeB += b;
    }
    if (tanDust) {
      dustMask[index] = 1;
      dust += 1;
    }
  }

  const cleanedRapidMask = cleanMotionMask(rapidMask, frame.width, frame.height);
  const classifiedBoxes = [
    ...boxesForMask(fireMask, frame.width, frame.height, "explosion_flash", pixels * 0.00012, "#ffcc48"),
    ...boxesForMask(smokeMask, frame.width, frame.height, "smoke", pixels * 0.0012, "#c9d2d0"),
    ...boxesForMask(dustMask, frame.width, frame.height, "dust", pixels * 0.001, "#caa46b")
  ];
  const motionBoxes = boxesForMask(
    cleanedRapidMask.mask,
    frame.width,
    frame.height,
    "motion_delta",
    pixels * 0.00016,
    "#49f4ff"
  )
    .filter((box) => classifiedBoxes.every((classified) => boxIntersectionRatio(box, classified) < 0.35))
    .slice(0, 3);
  const boxes = [...classifiedBoxes, ...motionBoxes].map((box, index) => ({
    ...box,
    id: `${frame.id}-${box.label}-${index}`,
    detail: detailForLocalBox(box.label)
  }));

  const rapidChangeRatio = cleanedRapidMask.count / pixels;
  const metrics: FrameMetrics = {
    changeRatio: changed / pixels,
    rapidChangeRatio,
    deltaScore: Math.min(1, rapidChangeRatio * 11 + (deltaSum / pixels / 255) * 0.7 + (deltaMax / 255) * 0.22),
    meanDelta: deltaSum / pixels / 255,
    fireRatio: fire / pixels,
    smokeRatio: smoke / pixels,
    dustRatio: dust / pixels,
    brightness: brightnessSum / pixels / 255,
    smokeColor: describeSmokeColor(smoke, smokeR, smokeG, smokeB)
  };

  return { boxes, metrics };
}

function adaptiveDeltaThreshold(histogram: Uint32Array, totalPixels: number, sensitivity: number) {
  const p92 = histogramPercentile(histogram, totalPixels, 0.92);
  const p985 = histogramPercentile(histogram, totalPixels, 0.985);
  const floor = 30 - sensitivity * 16;
  const adaptive = Math.max(floor, Math.min(p985, p92 + 12));
  return Math.max(14, Math.min(86, adaptive));
}

function histogramPercentile(histogram: Uint32Array, totalPixels: number, percentile: number) {
  const target = Math.max(1, Math.ceil(totalPixels * percentile));
  let running = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    running += histogram[value] ?? 0;
    if (running >= target) {
      return value;
    }
  }
  return histogram.length - 1;
}

function cleanMotionMask(mask: Uint8Array, width: number, height: number) {
  const cleaned = new Uint8Array(mask.length);
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!mask[index]) {
        continue;
      }
      let neighbors = 0;
      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          if (xx === 0 && yy === 0) {
            continue;
          }
          neighbors += mask[index + yy * width + xx] ? 1 : 0;
        }
      }
      if (neighbors >= 2) {
        cleaned[index] = 1;
        count += 1;
      }
    }
  }

  return { mask: cleaned, count };
}

function boxesForMask(
  mask: Uint8Array,
  width: number,
  height: number,
  label: DetectionLabel,
  minPixels: number,
  color: string
): DetectionBox[] {
  const visited = new Uint8Array(mask.length);
  const boxes: Array<DetectionBox & { area: number }> = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    const stack = [index];
    visited[index] = 1;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let area = 0;

    while (stack.length) {
      const current = stack.pop() ?? 0;
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      area += 1;

      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }

    if (area < minPixels) {
      continue;
    }

    const pad = label === "explosion_flash" ? 8 : 14;
    const x0 = Math.max(0, minX - pad);
    const y0 = Math.max(0, minY - pad);
    const x1 = Math.min(width - 1, maxX + pad);
    const y1 = Math.min(height - 1, maxY + pad);
    boxes.push({
      id: "",
      label,
      x: x0 / width,
      y: y0 / height,
      width: Math.max(1, x1 - x0) / width,
      height: Math.max(1, y1 - y0) / height,
      confidence: Math.min(0.95, 0.44 + (area / (width * height)) * 28),
      source: "local-cv",
      color,
      detail: "",
      area
    });
  }

  return boxes
    .sort((a, b) => b.area - a.area)
    .slice(0, 5)
    .map(({ area: _area, ...box }) => box);
}

function boxIntersectionRatio(a: DetectionBox, b: DetectionBox) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  const intersection = width * height;
  const smaller = Math.max(0.000001, Math.min(a.width * a.height, b.width * b.height));
  return intersection / smaller;
}

function detailForLocalBox(label: DetectionLabel) {
  return {
    motion_delta: "Frame-to-frame delta component: rapid local change proposed before visual classification.",
    explosion_flash: "Rapid warm/bright visual change consistent with flash or heat evidence.",
    fire: "Warm visual region consistent with fire evidence.",
    smoke: "Low-saturation changed plume area consistent with smoke evidence.",
    dust: "Changed tan plume area consistent with dust/debris evidence.",
    structural_damage: "Persistent changed structure region proposed by local CV.",
    vehicle_or_object: "Changed object region proposed by local CV.",
    possible_person: "Person-shaped region proposed by local CV.",
    unknown: "Unclassified local visual-change evidence."
  }[label];
}

function buildEvents(frames: VideoFrameAssessment[]): VideoEvent[] {
  return frames
    .filter((frame) => frame.boxes.length > 0 || frame.metrics.deltaScore > 0.18 || frame.metrics.rapidChangeRatio > 0.006)
    .map((frame, index) => {
      const labels = uniqueLabels(frame.boxes.map((box) => box.label));
      const severity = frameSeverity(frame);
      const hasFire = labels.includes("explosion_flash");
      const title = hasFire
        ? "Flash / heat signature change"
        : labels.includes("smoke")
          ? "Smoke plume visible"
          : labels.includes("dust")
            ? "Dust/debris plume visible"
            : labels.includes("motion_delta")
              ? "Rapid frame-delta change"
              : "Scene change detected";
      return {
        id: `event-${index + 1}`,
        frameId: frame.id,
        timeSec: frame.timeSec,
        title,
        severity,
        labels: labels.length ? labels : ["unknown"],
        confidence: confidenceFromBoxes(frame.boxes),
        boxes: frame.boxes,
        notes: [
          `Rapid delta ${(frame.metrics.rapidChangeRatio * 100).toFixed(1)}%`,
          `Delta score ${frame.metrics.deltaScore.toFixed(2)}`,
          `Frame change ${(frame.metrics.changeRatio * 100).toFixed(1)}%`,
          frame.metrics.smokeColor !== "none" ? `Smoke color: ${frame.metrics.smokeColor}` : ""
        ].filter(Boolean)
      };
    });
}

async function reviewFramesWithOpenAi(
  rawFrames: RawFrame[],
  frames: VideoFrameAssessment[],
  events: VideoEvent[],
  settings: AssessmentSettings
): Promise<OpenAiVideoReview & { parsed?: OpenAiParsedReview }> {
  if (!settings.openAiFrameLimit) {
    return {
      status: "not-run",
      model: openAiModel,
      reviewedFrameIds: [],
      summary: "OpenAI visual review disabled for this run.",
      observations: []
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      status: "missing-key",
      model: openAiModel,
      reviewedFrameIds: [],
      summary: "OpenAI visual review unavailable because OPENAI_API_KEY is not configured.",
      observations: []
    };
  }

  const selected = selectFramesForOpenAi(rawFrames, frames, events, settings.openAiFrameLimit);
  const videoModeInstruction = videoModePrompt(settings.videoMode);
  const frameById = new Map(frames.map((frame) => [frame.id, frame]));
  const prompt = [
    "You are a video evidence assessment analyst.",
    "Analyze only visible evidence in these extracted video frames.",
    `Video mode setting: ${settings.videoMode}.`,
    videoModeInstruction,
    "A frame may be normal RGB/visual footage, thermal/infrared footage, or a mixed composite with thermal inset plus RGB view.",
    "For thermal or mixed footage, interpret color palettes as relative heat contrast; do not treat thermal hot colors as visible flame unless RGB/visual evidence supports it.",
    "For smoke color, use visible RGB evidence only. If only thermal evidence is available, mark smoke color as unknown and explain the limitation.",
    "When thermal and RGB disagree, report both observations and keep severity tied to visible evidence, not hidden inference.",
    "The local pre-pass uses frame-to-frame delta first, then classifies rapid-change regions as flash/heat, smoke, dust, or unclassified motion_delta proposals.",
    "Treat local delta boxes as candidate regions to verify, correct, or reject from the image evidence; do not copy them blindly.",
    "Return damage assessment evidence: bounding boxes, smoke/fire/dust/explosion indicators, smoke color, people-risk indicators, severity, confidence, and verification gaps.",
    "Do not provide targeting, strike correction, weapon-use, evasion, routing, or future attack recommendations.",
    "Do not infer hidden objects, precise geolocation, unit identity, casualties, or intent.",
    "Boxes must use normalized x/y/width/height from 0 to 1 for the displayed image.",
    "Return only valid JSON with this shape:",
    "{",
    '  "summary": "2-4 concrete sentences",',
    '  "damageSeverity": "none|minor|moderate|severe|unknown",',
    '  "damageRationale": "visible evidence only",',
    '  "smokeColor": "none|white/gray|dark gray/black|tan/brown|mixed|unknown",',
    '  "smokeExtent": "none|localized|expanding|heavy|unknown",',
    '  "peopleRisk": {"level":"none_visible|possible|elevated|unknown","indicators":["visible indicators"],"rationale":"visible evidence only","confidence":"low|medium|high"},',
    '  "observations": ["specific video observations"],',
    '  "events": [{"frameId":"frame_0001","timeSec":0,"title":"event title","severity":"none|minor|moderate|severe|unknown","labels":["motion_delta","explosion_flash","smoke"],"boxes":[{"label":"smoke","x":0.1,"y":0.2,"width":0.3,"height":0.2,"confidence":0.72,"detail":"visible evidence"}],"notes":["uncertainty or gap"]}]',
    "}",
    "",
    "Available frame IDs and timestamps:",
    ...selected.map((frame) => `${frame.id}: ${frame.timeSec.toFixed(2)}s`),
    "",
    "Local delta candidates:",
    ...selected.map((frame) => openAiCandidateLine(frameById.get(frame.id)))
  ].join("\n");

  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: prompt }];
  for (const frame of selected) {
    const localFrame = frameById.get(frame.id);
    const image = await readFile(frame.absolutePath);
    content.push({
      type: "input_text",
      text: `Frame ${frame.id} at ${frame.timeSec.toFixed(2)} seconds. ${openAiCandidateLine(localFrame)}`
    });
    content.push({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${image.toString("base64")}`
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: openAiModel,
        input: [{ role: "user", content }],
        max_output_tokens: 2200
      })
    });
    const responseText = await response.text();
    const body = JSON.parse(responseText) as unknown;

    if (!response.ok) {
      return {
        status: "failed",
        model: openAiModel,
        reviewedFrameIds: selected.map((frame) => frame.id),
        summary: "OpenAI visual review failed; local CV output is still available.",
        observations: [],
        error: errorMessageFromOpenAi(body)
      };
    }

    const outputText = extractOutputText(body);
    const parsed = parseJsonObject(outputText) as OpenAiParsedReview;
    return {
      status: "ok",
      model: openAiModel,
      reviewedFrameIds: selected.map((frame) => frame.id),
      summary: parsed.summary ?? "OpenAI visual review completed.",
      observations: Array.isArray(parsed.observations) ? parsed.observations.map(String).slice(0, 8) : [],
      parsed
    };
  } catch (error) {
    return {
      status: "failed",
      model: openAiModel,
      reviewedFrameIds: selected.map((frame) => frame.id),
      summary: "OpenAI visual review failed; local CV output is still available.",
      observations: [],
      error: error instanceof Error ? error.message : "Unknown OpenAI review error."
    };
  }
}

function mergeAssessment(input: {
  id: string;
  fileName: string;
  source: "demo" | "upload";
  metadata: { durationSec: number; width: number; height: number; frameCount: number };
  settings: AssessmentSettings;
  frames: VideoFrameAssessment[];
  events: VideoEvent[];
  damage: DamageAssessment;
  peopleRisk: PeopleRiskAssessment;
  openAiReview: OpenAiVideoReview & { parsed?: OpenAiParsedReview };
}): VideoAssessmentResult {
  const ai = input.openAiReview.parsed;
  const aiEvents = normalizeOpenAiEvents(ai?.events ?? []);
  const events = mergeEvents(input.events, aiEvents);
  const damage: DamageAssessment = {
    ...input.damage,
    severity: validSeverity(ai?.damageSeverity) ?? input.damage.severity,
    smokeColor: ai?.smokeColor || input.damage.smokeColor,
    smokeExtent: validSmokeExtent(ai?.smokeExtent) ?? input.damage.smokeExtent,
    rationale: ai?.damageRationale || input.damage.rationale
  };
  const peopleRisk: PeopleRiskAssessment = {
    ...input.peopleRisk,
    ...normalizePeopleRisk(ai?.peopleRisk, input.peopleRisk)
  };

  return {
    id: input.id,
    createdAt: new Date().toISOString(),
    settings: input.settings,
    video: {
      fileName: input.fileName,
      source: input.source,
      durationSec: input.metadata.durationSec,
      width: input.metadata.width,
      height: input.metadata.height,
      frameCount: input.metadata.frameCount,
      url: input.source === "demo" ? "/demo/video_2026-06-20_20-14-28.mp4" : `/api/video-assessments/${input.id}/source`
    },
    summary:
      ai?.summary ||
      `Video review found ${events.length} frame-level event${events.length === 1 ? "" : "s"}. Overall visible damage severity is ${input.damage.severity}; smoke color is ${input.damage.smokeColor}.`,
    damage,
    peopleRisk,
    frames: attachOpenAiBoxes(input.frames, aiEvents),
    events,
    openAiReview: {
      status: input.openAiReview.status,
      model: input.openAiReview.model,
      reviewedFrameIds: input.openAiReview.reviewedFrameIds,
      summary: input.openAiReview.summary,
      observations: input.openAiReview.observations,
      error: input.openAiReview.error
    },
    processing: {
      localCvVersion: "frame-delta-v2",
      frameCount: input.frames.length,
      ffmpeg: true,
      processingConcurrency: input.settings.processingConcurrency,
      videoMode: input.settings.videoMode,
      annotatedVideo: false
    }
  };
}

async function createAnnotatedVideo(
  runDir: string,
  sourcePath: string,
  frames: VideoFrameAssessment[],
  fps: number
) {
  const outputPath = path.join(runDir, "annotated.mp4");
  const framesWithBoxes = frames.filter((frame) => frame.boxes.length > 0);

  if (!framesWithBoxes.length) {
    await copyFile(sourcePath, outputPath);
    return false;
  }

  const labeledFilterPath = path.join(runDir, "annotated-filter-labels.txt");
  const boxFilterPath = path.join(runDir, "annotated-filter-boxes.txt");

  try {
    await writeFile(labeledFilterPath, buildVideoFilterGraph(frames, fps, true), "utf8");
    await runAnnotatedFfmpeg(sourcePath, outputPath, labeledFilterPath);
    return true;
  } catch {
    try {
      await writeFile(boxFilterPath, buildVideoFilterGraph(frames, fps, false), "utf8");
      await runAnnotatedFfmpeg(sourcePath, outputPath, boxFilterPath);
      return true;
    } catch {
      await copyFile(sourcePath, outputPath);
      return false;
    }
  }
}

async function runAnnotatedFfmpeg(sourcePath: string, outputPath: string, filterPath: string) {
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      sourcePath,
      "-filter_complex_script",
      filterPath,
      "-map",
      "[v]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath
    ],
    { maxBuffer: 1024 * 1024 * 16 }
  );
}

function buildVideoFilterGraph(frames: VideoFrameAssessment[], fps: number, includeLabels: boolean) {
  const filters: string[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const previous = frames[index - 1];
    const next = frames[index + 1];
    const halfFrameWindow = 0.5 / Math.max(0.001, fps);
    const start =
      previous !== undefined
        ? (previous.timeSec + frame.timeSec) / 2
        : Math.max(0, frame.timeSec - halfFrameWindow);
    const end =
      next !== undefined
        ? (frame.timeSec + next.timeSec) / 2
        : frame.timeSec + halfFrameWindow;
    const enable = `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`;

    for (const box of frame.boxes) {
      const color = ffmpegColor(box.color);
      const x = normalizedExpr("iw", box.x);
      const y = normalizedExpr("ih", box.y);
      const w = normalizedExpr("iw", box.width);
      const h = normalizedExpr("ih", box.height);
      filters.push(
        `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@0.92:t=4:enable='${enable}'`
      );
      if (includeLabels) {
        filters.push(
          `drawtext=text='${escapeDrawtext(labelTextForVideo(box.label))}':x=${x}:y=max(0\\,${y}-24):fontsize=18:fontcolor=${color}:box=1:boxcolor=black@0.68:boxborderw=4:enable='${enable}'`
        );
      }
    }
  }

  return `[0:v]${filters.join(",")}[v]`;
}

function normalizedExpr(axis: "iw" | "ih", value: number) {
  return `${axis}*${Math.max(0, Math.min(1, value)).toFixed(6)}`;
}

function ffmpegColor(color: string) {
  return `0x${color.replace(/^#/, "").slice(0, 6) || "75f0c8"}`;
}

function labelTextForVideo(label: DetectionLabel) {
  if (label === "motion_delta") {
    return "motion delta";
  }
  return label === "explosion_flash" ? "flash heat" : label.replaceAll("_", " ");
}

function escapeDrawtext(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function summarizeDamage(frames: VideoFrameAssessment[], events: VideoEvent[]): DamageAssessment {
  const explosionDetected = frames.some((frame) => frame.boxes.some((box) => box.label === "explosion_flash"));
  const smokeFrames = frames.filter((frame) => frame.metrics.smokeRatio > 0.005);
  const maxSmoke = Math.max(0, ...frames.map((frame) => frame.metrics.smokeRatio));
  const maxFire = Math.max(0, ...frames.map((frame) => frame.metrics.fireRatio));
  const maxDust = Math.max(0, ...frames.map((frame) => frame.metrics.dustRatio));
  const severeEvents = events.filter((event) => event.severity === "severe").length;
  const moderateEvents = events.filter((event) => event.severity === "moderate").length;
  const severity: DamageSeverity =
    severeEvents || maxFire > 0.012 || maxSmoke > 0.08
      ? "severe"
      : moderateEvents || maxSmoke > 0.025 || maxDust > 0.03
        ? "moderate"
        : events.length
          ? "minor"
          : "none";
  const smokeColor = mostCommon(
    smokeFrames.map((frame) => frame.metrics.smokeColor).filter((color) => color !== "none")
  );
  return {
    severity,
    fireDetected: maxFire > 0.0004 || explosionDetected,
    explosionDetected,
    smokeColor: smokeColor || "none",
    smokeExtent:
      maxSmoke > 0.08 ? "heavy" : smokeFrames.length >= 4 ? "expanding" : smokeFrames.length ? "localized" : "none",
    rationale:
      events.length > 0
        ? `Frame analysis found ${events.length} visible event${events.length === 1 ? "" : "s"}, with peak smoke coverage ${(maxSmoke * 100).toFixed(1)}% and peak dust coverage ${(maxDust * 100).toFixed(1)}%.`
        : "No major visible damage, smoke, fire, or dust event was detected in sampled frames."
  };
}

function summarizePeopleRisk(frames: VideoFrameAssessment[]): PeopleRiskAssessment {
  const possiblePeople = frames.flatMap((frame) => frame.boxes.filter((box) => box.label === "possible_person"));
  if (!possiblePeople.length) {
    return {
      level: "none_visible",
      indicators: ["No clear person-shaped indicators detected by the local pass."],
      rationale: "Local CV does not perform person identification; OpenAI visual review may add visible people-risk indicators.",
      confidence: "low"
    };
  }

  return {
    level: "possible",
    indicators: [`${possiblePeople.length} possible person indicator${possiblePeople.length === 1 ? "" : "s"}`],
    rationale: "Possible person-shaped indicators are visible near assessed effects.",
    confidence: "medium"
  };
}

function selectFramesForOpenAi(
  rawFrames: RawFrame[],
  frames: VideoFrameAssessment[],
  events: VideoEvent[],
  limit: number
) {
  const frameById = new Map(rawFrames.map((frame) => [frame.id, frame]));
  const scored = frames
    .map((frame) => ({
      frame,
      score:
        frame.metrics.deltaScore * 1.8 +
        frame.metrics.rapidChangeRatio * 4 +
        frame.metrics.changeRatio * 0.8 +
        frame.metrics.smokeRatio * 8 +
        frame.metrics.fireRatio * 18 +
        frame.metrics.dustRatio * 5 +
        (events.some((event) => event.frameId === frame.id) ? 0.35 : 0)
    }))
    .sort((a, b) => b.score - a.score);
  const chosen = new Map<string, RawFrame>();
  for (const item of scored) {
    const raw = frameById.get(item.frame.id);
    if (raw) {
      chosen.set(raw.id, raw);
    }
    if (chosen.size >= limit) {
      break;
    }
  }
  for (const fallback of [rawFrames[0], rawFrames[Math.floor(rawFrames.length / 2)], rawFrames[rawFrames.length - 1]]) {
    if (fallback && chosen.size < limit) {
      chosen.set(fallback.id, fallback);
    }
  }
  return [...chosen.values()].sort((a, b) => a.timeSec - b.timeSec);
}

function openAiCandidateLine(frame: VideoFrameAssessment | undefined) {
  if (!frame) {
    return "No local delta candidate metadata available.";
  }
  const boxes = frame.boxes.length
    ? frame.boxes
        .slice(0, 8)
        .map(
          (box) =>
            `${box.label} x=${box.x.toFixed(3)} y=${box.y.toFixed(3)} w=${box.width.toFixed(3)} h=${box.height.toFixed(3)} c=${box.confidence.toFixed(2)}`
        )
        .join("; ")
    : "none";
  return `${frame.id}: deltaScore=${frame.metrics.deltaScore.toFixed(3)}, rapidDelta=${(
    frame.metrics.rapidChangeRatio * 100
  ).toFixed(1)}%, meanDelta=${frame.metrics.meanDelta.toFixed(3)}, localBoxes=${boxes}`;
}

function normalizeOpenAiEvents(events: NonNullable<OpenAiParsedReview["events"]>): VideoEvent[] {
  return events.slice(0, 12).map((event, index) => ({
    id: `openai-event-${index + 1}`,
    frameId: event.frameId || "frame_0001",
    timeSec: Number(event.timeSec ?? 0),
    title: event.title || "OpenAI visual observation",
    severity: validSeverity(event.severity) ?? "unknown",
    labels: uniqueLabels(Array.isArray(event.labels) ? event.labels : ["unknown"]),
    confidence: confidenceFromBoxes([]),
    boxes: (event.boxes ?? []).slice(0, 6).map((box, boxIndex) => normalizeOpenAiBox(box, index, boxIndex)),
    notes: Array.isArray(event.notes) ? event.notes.map(String).slice(0, 4) : []
  }));
}

function normalizeOpenAiBox(box: Partial<DetectionBox>, eventIndex: number, boxIndex: number): DetectionBox {
  const label = validLabel(box.label) ?? "unknown";
  return {
    id: `openai-${eventIndex + 1}-${boxIndex + 1}`,
    label,
    x: clampNumber(box.x, 0, 1, 0),
    y: clampNumber(box.y, 0, 1, 0),
    width: clampNumber(box.width, 0.01, 1, 0.1),
    height: clampNumber(box.height, 0.01, 1, 0.1),
    confidence: clampNumber(box.confidence, 0, 1, 0.45),
    source: "openai",
    color: colorForLabel(label),
    detail: String(box.detail || "OpenAI visual review box.")
  };
}

function mergeEvents(localEvents: VideoEvent[], aiEvents: VideoEvent[]) {
  const merged = [...localEvents];
  for (const aiEvent of aiEvents) {
    const match = merged.find((event) => event.frameId === aiEvent.frameId);
    if (match) {
      match.notes = [...match.notes, ...aiEvent.notes].slice(0, 8);
      match.boxes = [...match.boxes, ...aiEvent.boxes].slice(0, 10);
      match.labels = uniqueLabels([...match.labels, ...aiEvent.labels]);
      if (rankSeverity(aiEvent.severity) > rankSeverity(match.severity)) {
        match.severity = aiEvent.severity;
      }
    } else {
      merged.push(aiEvent);
    }
  }
  return merged.sort((a, b) => a.timeSec - b.timeSec);
}

function attachOpenAiBoxes(frames: VideoFrameAssessment[], aiEvents: VideoEvent[]) {
  return frames.map((frame) => {
    const aiBoxes = aiEvents.filter((event) => event.frameId === frame.id).flatMap((event) => event.boxes);
    return aiBoxes.length ? { ...frame, boxes: [...frame.boxes, ...aiBoxes].slice(0, 12) } : frame;
  });
}

function normalizePeopleRisk(
  peopleRisk: Partial<PeopleRiskAssessment> | undefined,
  fallback: PeopleRiskAssessment
): PeopleRiskAssessment {
  if (!peopleRisk) {
    return fallback;
  }
  return {
    level:
      peopleRisk.level === "possible" ||
      peopleRisk.level === "elevated" ||
      peopleRisk.level === "unknown" ||
      peopleRisk.level === "none_visible"
        ? peopleRisk.level
        : fallback.level,
    indicators: Array.isArray(peopleRisk.indicators) ? peopleRisk.indicators.map(String).slice(0, 6) : fallback.indicators,
    rationale: peopleRisk.rationale || fallback.rationale,
    confidence: validConfidence(peopleRisk.confidence) ?? fallback.confidence
  };
}

function frameSeverity(frame: VideoFrameAssessment): DamageSeverity {
  const score =
    frame.metrics.deltaScore * 0.55 +
    frame.metrics.rapidChangeRatio * 3 +
    frame.metrics.changeRatio * 0.55 +
    frame.metrics.fireRatio * 18 +
    frame.metrics.smokeRatio * 7 +
    frame.metrics.dustRatio * 4;
  if (score > 0.72) {
    return "severe";
  }
  if (score > 0.32) {
    return "moderate";
  }
  return frame.boxes.length ? "minor" : "none";
}

function confidenceFromBoxes(boxes: DetectionBox[]): ConfidenceLevel {
  const best = Math.max(0, ...boxes.map((box) => box.confidence));
  if (best >= 0.72) {
    return "high";
  }
  if (best >= 0.45) {
    return "medium";
  }
  return "low";
}

function colorDistance(a: Buffer, b: Buffer, offset: number, channels: number) {
  const dr = (a[offset] ?? 0) - (b[offset] ?? 0);
  const dg = (a[offset + 1] ?? 0) - (b[offset + 1] ?? 0);
  const db = (a[offset + 2] ?? 0) - (b[offset + 2] ?? 0);
  return Math.sqrt(dr * dr + dg * dg + db * db) * (3 / channels);
}

function describeSmokeColor(count: number, r: number, g: number, b: number) {
  if (!count) {
    return "none";
  }
  const avgR = r / count;
  const avgG = g / count;
  const avgB = b / count;
  const avg = (avgR + avgG + avgB) / 3;
  if (avg < 80) {
    return "dark gray/black";
  }
  if (avgR > avgB * 1.18 && avgG > avgB * 1.05) {
    return "tan/brown";
  }
  return "white/gray";
}

function uniqueLabels(labels: DetectionLabel[]) {
  return [...new Set(labels.map((label) => validLabel(label) ?? "unknown"))];
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function validLabel(label: unknown): DetectionLabel | undefined {
  const labels: DetectionLabel[] = [
    "motion_delta",
    "explosion_flash",
    "fire",
    "smoke",
    "dust",
    "structural_damage",
    "vehicle_or_object",
    "possible_person",
    "unknown"
  ];
  return labels.includes(label as DetectionLabel) ? (label as DetectionLabel) : undefined;
}

function validSeverity(severity: unknown): DamageSeverity | undefined {
  const severities: DamageSeverity[] = ["none", "minor", "moderate", "severe", "unknown"];
  return severities.includes(severity as DamageSeverity) ? (severity as DamageSeverity) : undefined;
}

function rankSeverity(severity: DamageSeverity) {
  return { none: 0, minor: 1, unknown: 1, moderate: 2, severe: 3 }[severity];
}

function validSmokeExtent(extent: unknown): DamageAssessment["smokeExtent"] | undefined {
  const extents: DamageAssessment["smokeExtent"][] = ["none", "localized", "expanding", "heavy", "unknown"];
  return extents.includes(extent as DamageAssessment["smokeExtent"])
    ? (extent as DamageAssessment["smokeExtent"])
    : undefined;
}

function validConfidence(confidence: unknown): ConfidenceLevel | undefined {
  return confidence === "low" || confidence === "medium" || confidence === "high" ? confidence : undefined;
}

function validVideoMode(value: unknown): VideoMode | undefined {
  return value === "auto" || value === "visual" || value === "thermal" || value === "mixed" ? value : undefined;
}

function videoModePrompt(mode: VideoMode) {
  return {
    auto:
      "Auto mode: decide from visible frame content whether each image is RGB/visual, thermal/infrared, or mixed, and state that basis in observations.",
    visual:
      "Visual mode: treat frames as normal RGB camera footage unless a visible thermal inset or palette is clearly present.",
    thermal:
      "Thermal mode: treat frames as thermal/infrared evidence. Focus on relative hot/cold patterns, plume contrast, and motion/change; avoid claiming visible color or open flame from palette colors alone.",
    mixed:
      "Mixed mode: treat frames as containing both thermal/infrared and RGB/visual evidence. Separate thermal hot-spot observations from visible smoke, dust, fire, people, and object observations."
  }[mode];
}

function colorForLabel(label: DetectionLabel) {
  return {
    motion_delta: "#49f4ff",
    explosion_flash: "#ffcc48",
    fire: "#ff7a45",
    smoke: "#c9d2d0",
    dust: "#caa46b",
    structural_damage: "#f07167",
    vehicle_or_object: "#49b8ff",
    possible_person: "#c77dff",
    unknown: "#75f0c8"
  }[label];
}

function extractOutputText(response: unknown): string {
  const body = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };
  if (typeof body.output_text === "string") {
    return body.output_text;
  }
  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n") ?? ""
  );
}

function parseJsonObject(text: string) {
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

function errorMessageFromOpenAi(body: unknown) {
  const record = body as { error?: { message?: string } };
  return record.error?.message || "Unknown OpenAI API error.";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.round(parsed));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Math.round(concurrency), items.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );
  return results;
}

function assertSafeId(id: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    throw new Error("Invalid assessment id.");
  }
}

function assertSafeFrameId(frameId: string) {
  if (!/^frame_\d{4}$/.test(frameId)) {
    throw new Error("Invalid frame id.");
  }
}

export async function assertDemoVideoExists() {
  await stat(demoVideoPath);
}
