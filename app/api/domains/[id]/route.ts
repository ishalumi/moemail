import { createDb } from "@/lib/db"
import { domains } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { cleanupSubdomainDns } from "@/lib/cloudflare-email"

export const runtime = "edge"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createDb()
  const domain = await db.query.domains.findFirst({ where: eq(domains.id, id) })
  if (!domain) {
    return NextResponse.json({ error: "域名不存在" }, { status: 404 })
  }
  return NextResponse.json({ domain })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createDb()

  const domain = await db.query.domains.findFirst({ where: eq(domains.id, id) })
  if (!domain) {
    return NextResponse.json({ error: "域名不存在" }, { status: 404 })
  }

  // 子域删除时清理 CF DNS 记录
  let cfCleanupError: string | undefined
  if (domain.type === "subdomain" && domain.cfZoneId) {
    try {
      await cleanupSubdomainDns(domain.cfZoneId, domain.name)
    } catch (error) {
      cfCleanupError = error instanceof Error ? error.message : "DNS 清理失败"
    }
  }

  await db.delete(domains).where(eq(domains.id, id))
  return NextResponse.json({ success: true, cfCleanupError })
}
