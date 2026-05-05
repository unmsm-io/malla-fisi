import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureMallaStatesTable, sql } from "@/lib/db";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await ensureMallaStatesTable();
    const rows = await sql()`
      SELECT state FROM malla_states WHERE id = ${id} AND user_id = ${userId} LIMIT 1
    `;
    const state = rows[0]?.state;
    if (!state) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Load failed" },
      { status: 500 },
    );
  }
}
