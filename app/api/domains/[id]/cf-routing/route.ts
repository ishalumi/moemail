import { createDb } from "@/lib/db"
import { domains } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { enableEmailRouting, createCatchAllRule } from "@/lib/cloudflare-email"

export const runtime = "edge"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createDb()

  const domain = await db.query.domains.findFirst({ where: eq(domains.id, id) })
  if (!domain) {
    return NextResponse.json({ error: "域名不存在" }, { status: 404 })
  }
  if (!domain.cfZoneId) {
    return NextResponse.json({ error: "域名未配置 Cloudflare Zone ID" }, { status: 400 })
  }

  const { workerName } = await request.json() as { workerName?: string }
  const worker = workerName || "moemail-email-receiver"

  try {
    await enableEmailRouting(domain.cfZoneId)
    await createCatchAllRule(domain.cfZoneId, worker)

    await db.update(domains)
      .set({ cfRouteEnabled: true })
      .where(eq(domains.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CF API 调用失败" },
      { status: 500 }
    )
  }
}
