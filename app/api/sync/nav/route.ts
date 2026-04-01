import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/sync/nav — manually trigger a NAV sync
export async function POST(_req: NextRequest) {
  // Import lazily to avoid loading the scheduler at build time
  const { syncLatestNavManual } = await import("@/lib/sync/nav-manual");
  try {
    const result = await syncLatestNavManual();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
