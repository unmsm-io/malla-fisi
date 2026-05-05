import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureMallaStatesTable, sql } from "@/lib/db";
import type { MallaState } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<MallaState>;
    if (!body.careerSlug || !body.careerLabel || !body.career) {
      return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
    }

    await ensureMallaStatesTable();

    const id = body.stateId || crypto.randomUUID();
    const savedAt = new Date().toISOString();
    const state: MallaState = {
      schemaVersion: 1,
      careerSlug: body.careerSlug,
      careerLabel: body.careerLabel,
      career: body.career,
      placement: body.placement ?? {},
      courseOverrides: body.courseOverrides ?? {},
      stateId: id,
      savedAt,
    };

    const rows = await sql()`
      INSERT INTO malla_states (id, user_id, career_slug, career_label, state)
      VALUES (${id}, ${userId}, ${state.careerSlug}, ${state.careerLabel}, ${JSON.stringify(state)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        career_slug = EXCLUDED.career_slug,
        career_label = EXCLUDED.career_label,
        state = EXCLUDED.state,
        updated_at = NOW()
      WHERE malla_states.user_id = ${userId}
      RETURNING id
    `;
    if (!rows[0]?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ id, state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 },
    );
  }
}
