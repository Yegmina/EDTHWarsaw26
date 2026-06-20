import { NextResponse } from "next/server";
import { readVideoAssessment } from "../../../lib/videoAssessment";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await readVideoAssessment(id));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Assessment not found.",
        detail: error instanceof Error ? error.message : "Unknown error."
      },
      { status: 404 }
    );
  }
}
