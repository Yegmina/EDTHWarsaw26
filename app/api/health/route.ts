import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

async function commandAvailable(command: string) {
  try {
    await execFileAsync(command, ["-version"], { maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function storageWritable() {
  try {
    const storageRoot = path.join(process.cwd(), "data", "video-assessments");
    await mkdir(storageRoot, { recursive: true });
    await writeFile(path.join(storageRoot, ".healthcheck"), new Date().toISOString(), "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [ffmpegAvailable, ffprobeAvailable, canWriteStorage] = await Promise.all([
    commandAvailable("ffmpeg"),
    commandAvailable("ffprobe"),
    storageWritable()
  ]);
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const healthy = openAiConfigured && ffmpegAvailable && ffprobeAvailable && canWriteStorage;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown",
      commitSha: process.env.COMMIT_SHA ?? "unknown",
      openAiConfigured,
      ffmpegAvailable,
      ffprobeAvailable,
      storageWritable: canWriteStorage,
      timestamp: new Date().toISOString()
    },
    { status: healthy ? 200 : 503 }
  );
}
