import { PERMISSIONS, Role, ROLES } from "@/lib/permissions"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { EMAIL_CONFIG } from "@/config"
import { checkPermission } from "@/lib/auth"
import { domains as domainsTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { createDb } from "@/lib/db"

export const runtime = "edge"

export async function GET() {
  const env = getRequestContext().env
  const canManageConfig = await checkPermission(PERMISSIONS.MANAGE_CONFIG)

  const db = createDb()
  const allDomains = await db.select().from(domainsTable).where(eq(domainsTable.enabled, true))
  const emailDomainsString = allDomains.map(d => d.name).join(',')

  const [
    defaultRole,
    adminContact,
    maxEmails,
    turnstileEnabled,
    turnstileSiteKey,
    turnstileSecretKey,
    cfApiToken,
    cfAccountId
  ] = await Promise.all([
    env.SITE_CONFIG.get("DEFAULT_ROLE"),
    env.SITE_CONFIG.get("ADMIN_CONTACT"),
    env.SITE_CONFIG.get("MAX_EMAILS"),
    env.SITE_CONFIG.get("TURNSTILE_ENABLED"),
    env.SITE_CONFIG.get("TURNSTILE_SITE_KEY"),
    env.SITE_CONFIG.get("TURNSTILE_SECRET_KEY"),
    env.SITE_CONFIG.get("CF_API_TOKEN"),
    env.SITE_CONFIG.get("CF_ACCOUNT_ID")
  ])

  return Response.json({
    defaultRole: defaultRole || ROLES.CIVILIAN,
    emailDomains: emailDomainsString || "moemail.app",
    domainsList: allDomains,
    adminContact: adminContact || "",
    maxEmails: maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString(),
    turnstile: canManageConfig ? {
      enabled: turnstileEnabled === "true",
      siteKey: turnstileSiteKey || "",
      secretKey: turnstileSecretKey || "",
    } : undefined,
    cloudflare: canManageConfig ? {
      apiToken: cfApiToken ? cfApiToken.slice(0, 6) + "..." : "",
      accountId: cfAccountId || ""
    } : undefined
  })
}

export async function POST(request: Request) {
  const canAccess = await checkPermission(PERMISSIONS.MANAGE_CONFIG)

  if (!canAccess) {
    return Response.json({
      error: "权限不足"
    }, { status: 403 })
  }

  const {
    defaultRole,
    adminContact,
    maxEmails,
    turnstile,
    cfApiToken,
    cfAccountId
  } = await request.json() as {
    defaultRole: Exclude<Role, typeof ROLES.EMPEROR>,
    adminContact: string,
    maxEmails: string,
    turnstile?: {
      enabled: boolean,
      siteKey: string,
      secretKey: string
    },
    cfApiToken?: string,
    cfAccountId?: string
  }

  if (![ROLES.DUKE, ROLES.KNIGHT, ROLES.CIVILIAN].includes(defaultRole)) {
    return Response.json({ error: "无效的角色" }, { status: 400 })
  }

  const turnstileConfig = turnstile ?? {
    enabled: false,
    siteKey: "",
    secretKey: ""
  }

  if (turnstileConfig.enabled && (!turnstileConfig.siteKey || !turnstileConfig.secretKey)) {
    return Response.json({ error: "Turnstile 启用时需要提供 Site Key 和 Secret Key" }, { status: 400 })
  }

  const env = getRequestContext().env
  const kvOps: Promise<void>[] = [
    env.SITE_CONFIG.put("DEFAULT_ROLE", defaultRole),
    env.SITE_CONFIG.put("ADMIN_CONTACT", adminContact),
    env.SITE_CONFIG.put("MAX_EMAILS", maxEmails),
    env.SITE_CONFIG.put("TURNSTILE_ENABLED", turnstileConfig.enabled.toString()),
    env.SITE_CONFIG.put("TURNSTILE_SITE_KEY", turnstileConfig.siteKey),
    env.SITE_CONFIG.put("TURNSTILE_SECRET_KEY", turnstileConfig.secretKey)
  ]

  if (cfApiToken !== undefined) kvOps.push(env.SITE_CONFIG.put("CF_API_TOKEN", cfApiToken))
  if (cfAccountId !== undefined) kvOps.push(env.SITE_CONFIG.put("CF_ACCOUNT_ID", cfAccountId))

  await Promise.all(kvOps)

  return Response.json({ success: true })
}
