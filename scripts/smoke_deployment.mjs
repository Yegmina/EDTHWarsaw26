#!/usr/bin/env node
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const home = await request("/");
  assert(home.response.ok, `Homepage failed with ${home.response.status}`);

  const health = await request("/api/health");
  assert(health.response.ok, `Health failed with ${health.response.status}: ${JSON.stringify(health.body)}`);
  assert(health.body?.openAiConfigured === true, "Health did not confirm OPENAI_API_KEY");
  assert(health.body?.ffmpegAvailable === true, "Health did not confirm ffmpeg");
  assert(health.body?.ffprobeAvailable === true, "Health did not confirm ffprobe");
  assert(health.body?.storageWritable === true, "Health did not confirm writable storage");

  const invalidAnalyze = await request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert(
    invalidAnalyze.response.status === 400,
    `Analyze validation expected 400, got ${invalidAnalyze.response.status}: ${JSON.stringify(invalidAnalyze.body)}`
  );

  const video = await request("/api/video-assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supplied: true,
      settings: {
        fps: 0.25,
        eventSensitivity: 0.35,
        openAiFrameLimit: 0,
        processingConcurrency: 2,
        videoMode: "auto"
      }
    })
  });
  assert(video.response.ok, `Video assessment failed with ${video.response.status}: ${JSON.stringify(video.body)}`);
  assert(typeof video.body?.id === "string" && video.body.id.length > 0, "Video assessment did not return an id");
  assert(Array.isArray(video.body?.frames) && video.body.frames.length > 0, "Video assessment returned no frames");
  assert(video.body?.openAiReview?.status === "not-run", "Smoke video should disable OpenAI frame review");

  console.log(`Smoke deployment passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
