import { NextResponse } from "next/server";
import {
  assertDemoVideoExists,
  createVideoAssessmentFromDemo,
  createVideoAssessmentFromUpload,
  normalizeAssessmentSettings
} from "../../lib/videoAssessment";

export const runtime = "nodejs";

const maxUploadBytes = 220 * 1024 * 1024;

function parseSettings(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return normalizeAssessmentSettings({});
  }

  try {
    return normalizeAssessmentSettings(JSON.parse(value));
  } catch {
    return normalizeAssessmentSettings({});
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}

function isSupportedVideo(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("video/") ||
    name.endsWith(".mp4") ||
    name.endsWith(".mov") ||
    name.endsWith(".m4v") ||
    name.endsWith(".webm")
  );
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const settings = parseSettings(form.get("settings"));
      const useSuppliedVideo = form.get("demo") === "true" || form.get("supplied") === "true";

      if (useSuppliedVideo) {
        await assertDemoVideoExists();
        const result = await createVideoAssessmentFromDemo(settings);
        return NextResponse.json(result);
      }

      const file = form.get("video");
      if (!isUploadedFile(file)) {
        return NextResponse.json({ error: "Video file is required." }, { status: 400 });
      }

      if (file.size <= 0 || file.size > maxUploadBytes) {
        return NextResponse.json({ error: "Video file must be between 1 byte and 220 MB." }, { status: 400 });
      }

      if (!isSupportedVideo(file)) {
        return NextResponse.json({ error: "Unsupported video type." }, { status: 400 });
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const result = await createVideoAssessmentFromUpload(file.name, bytes, settings);
      return NextResponse.json(result);
    }

    const payload = (await request.json().catch(() => ({}))) as {
      demo?: boolean;
      supplied?: boolean;
      settings?: unknown;
    };
    const settings = normalizeAssessmentSettings(payload.settings);

    if (payload.demo || payload.supplied) {
      await assertDemoVideoExists();
      const result = await createVideoAssessmentFromDemo(settings);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Use multipart upload or set supplied=true." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Video assessment failed.",
        detail: error instanceof Error ? error.message : "Unknown error."
      },
      { status: 500 }
    );
  }
}
