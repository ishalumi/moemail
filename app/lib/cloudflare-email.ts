import { getRequestContext } from "@cloudflare/next-on-pages"

const CF_API_BASE = "https://api.cloudflare.com/client/v4"

async function getCfCredentials() {
  const env = getRequestContext().env
  const token = await env.SITE_CONFIG.get("CF_API_TOKEN")
  const accountId = await env.SITE_CONFIG.get("CF_ACCOUNT_ID")
  return { token, accountId }
}

async function cfFetch(path: string, options: RequestInit = {}) {
  const { token } = await getCfCredentials()
  if (!token) throw new Error("CF_API_TOKEN 未配置")

  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers,
    },
  })
  const data = await res.json() as { success: boolean; errors?: Array<{ message: string }>; result?: unknown }
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || "CF API 调用失败")
  }
  return data.result
}

// 启用域名的 Email Routing
export async function enableEmailRouting(zoneId: string) {
  return cfFetch(`/zones/${zoneId}/email/routing/enable`, { method: "POST", body: "{}" })
}

// 创建 catch-all 路由规则，转发到 Worker
export async function createCatchAllRule(zoneId: string, workerName: string) {
  return cfFetch(`/zones/${zoneId}/email/routing/rules/catch_all`, {
    method: "PUT",
    body: JSON.stringify({
      enabled: true,
      name: "MoeMail catch-all",
      actions: [{ type: "worker", value: [workerName] }],
    }),
  })
}

// 创建特定地址的路由规则
export async function createAddressRule(zoneId: string, address: string, workerName: string) {
  return cfFetch(`/zones/${zoneId}/email/routing/rules`, {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      name: `MoeMail route: ${address}`,
      matchers: [{ type: "literal", field: "to", value: address }],
      actions: [{ type: "worker", value: [workerName] }],
    }),
  })
}

// 获取所有路由规则
export async function listRoutingRules(zoneId: string) {
  return cfFetch(`/zones/${zoneId}/email/routing/rules`)
}

// 删除路由规则
export async function deleteRoutingRule(zoneId: string, ruleId: string) {
  return cfFetch(`/zones/${zoneId}/email/routing/rules/${ruleId}`, { method: "DELETE" })
}
