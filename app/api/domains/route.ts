import { createDb } from "@/lib/db"
import { domains } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getZoneIdByName } from "@/lib/cloudflare-email"

export const runtime = "edge"

export async function GET() {
  const db = createDb()
  const allDomains = await db.select().from(domains).where(eq(domains.enabled, true))
  return NextResponse.json({ domains: allDomains })
}

export async function POST(request: Request) {
  const db = createDb()
  const { name, type, parentDomain } = await request.json() as {
    name: string
    type: "native" | "subdomain"
    parentDomain?: string
  }

  if (!name || !type) {
    return NextResponse.json({ error: "域名和类型为必填项" }, { status: 400 })
  }

  if (type === "subdomain" && !parentDomain) {
    return NextResponse.json({ error: "子域名必须指定父域名" }, { status: 400 })
  }

  const existing = await db.query.domains.findFirst({
    where: eq(domains.name, name.toLowerCase())
  })
  if (existing) {
    return NextResponse.json({ error: "该域名已存在" }, { status: 409 })
  }

  // 自动解析 CF Zone ID
  let resolvedZoneId: string | undefined
  try {
    if (type === "native") {
      // 原生域：直接从 CF 查
      resolvedZoneId = await getZoneIdByName(name.toLowerCase())
    } else if (parentDomain) {
      // 子域：从父域继承
      const parent = await db.query.domains.findFirst({
        where: eq(domains.name, parentDomain.toLowerCase())
      })
      if (parent?.cfZoneId) {
        resolvedZoneId = parent.cfZoneId
      } else {
        // 父域没有 zoneId，尝试从 CF 查父域
        resolvedZoneId = await getZoneIdByName(parentDomain.toLowerCase())
      }
    }
  } catch {
    // CF API 未配置或查不到，zoneId 留空，后续可手动配置
  }

  const result = await db.insert(domains).values({
    name: name.toLowerCase(),
    type,
    parentDomain: parentDomain?.toLowerCase(),
    cfZoneId: resolvedZoneId,
  }).returning()

  return NextResponse.json({ domain: result[0] })
}
