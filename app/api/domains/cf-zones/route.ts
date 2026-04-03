import { NextResponse } from "next/server"
import { getRequestContext } from "@cloudflare/next-on-pages"

export const runtime = "edge"

// 列出 CF 账号下所有域名
export async function GET() {
  const env = getRequestContext().env
  const token = await env.SITE_CONFIG.get("CF_API_TOKEN")

  if (!token) {
    return NextResponse.json({ error: "CF_API_TOKEN 未配置" }, { status: 400 })
  }

  try {
    const zones: Array<{ id: string; name: string; status: string }> = []
    let page = 1

    // 分页获取所有 zones
    while (true) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones?per_page=50&page=${page}&status=active`,
        { headers: { "Authorization": `Bearer ${token}` } }
      )
      const data = await res.json() as {
        success: boolean
        result?: Array<{ id: string; name: string; status: string }>
        result_info?: { total_pages: number }
      }

      if (!data.success || !data.result) break

      zones.push(...data.result.map(z => ({ id: z.id, name: z.name, status: z.status })))

      if (page >= (data.result_info?.total_pages || 1)) break
      page++
    }

    return NextResponse.json({ zones })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取域名列表失败" },
      { status: 500 }
    )
  }
}
