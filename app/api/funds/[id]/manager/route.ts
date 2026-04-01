import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import { fundManagerHistory, managers, funds } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fundId = parseInt(params.id);

    const history = await db
      .select({
        historyId:          fundManagerHistory.id,
        managerId:          fundManagerHistory.managerId,
        managerName:        managers.name,
        managerQual:        managers.qualification,
        managerBio:         managers.bio,
        managerPhoto:       managers.photoUrl,
        startDate:          fundManagerHistory.startDate,
        endDate:            fundManagerHistory.endDate,
        tenureReturnCagr:   fundManagerHistory.tenureReturnCagr,
        tenureBenchmarkCagr:fundManagerHistory.tenureBenchmarkCagr,
        tenureAlpha:        fundManagerHistory.tenureAlpha,
        tenureSharpe:       fundManagerHistory.tenureSharpe,
        tenureMaxDrawdown:  fundManagerHistory.tenureMaxDrawdown,
        tenureCategoryRank: fundManagerHistory.tenureCategoryRank,
      })
      .from(fundManagerHistory)
      .leftJoin(managers, eq(fundManagerHistory.managerId, managers.id))
      .where(eq(fundManagerHistory.fundId, fundId))
      .orderBy(desc(fundManagerHistory.startDate));

    return NextResponse.json({ data: history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
