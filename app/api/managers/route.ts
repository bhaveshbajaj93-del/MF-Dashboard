import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import { managers, fundManagerHistory, funds, amcs } from "@/lib/db/schema";
import { eq, desc, sql, asc, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get("q") ?? "";
    const sortBy = searchParams.get("sort") ?? "aum";
    const order  = searchParams.get("order") === "asc" ? "asc" : "desc";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
    const offset = (page - 1) * limit;

    let query = db
      .select({
        id:                managers.id,
        name:              managers.name,
        qualification:     managers.qualification,
        bio:               managers.bio,
        photoUrl:          managers.photoUrl,
        totalFundsManaged: managers.totalFundsManaged,
        totalAumManaged:   managers.totalAumManaged,
        yearsExperience:   managers.yearsExperience,
      })
      .from(managers)
      .$dynamic();

    if (search) {
      query = query.where(like(managers.name, `%${search}%`));
    }

    const sortMap: Record<string, any> = {
      name:  managers.name,
      aum:   managers.totalAumManaged,
      funds: managers.totalFundsManaged,
      years: managers.yearsExperience,
    };
    const col = sortMap[sortBy] ?? managers.totalAumManaged;
    query = query.orderBy(order === "asc" ? asc(col) : desc(col));

    const rows = await query.limit(limit).offset(offset);
    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(managers);

    return NextResponse.json({
      data: rows,
      meta: { total: countRow.count, page, limit, pages: Math.ceil(countRow.count / limit) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
