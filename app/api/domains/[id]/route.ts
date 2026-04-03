import { createDb } from "@/lib/db"
import { domains } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

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
  await db.delete(domains).where(eq(domains.id, id))
  return NextResponse.json({ success: true })
}
