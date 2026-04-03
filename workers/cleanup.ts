interface Env {
  DB: D1Database
}

const CLEANUP_CONFIG = {
  DELETE_EXPIRED_EMAILS: true,
  BATCH_SIZE: 100,
  // 永久邮箱最多保留的消息数量
  PERMANENT_EMAIL_MAX_MESSAGES: 100,
} as const

const main = {
  async scheduled(_: ScheduledEvent, env: Env) {
    const now = Date.now()

    try {
      // 1. 删除已过期的邮箱（级联删除消息）
      if (CLEANUP_CONFIG.DELETE_EXPIRED_EMAILS) {
        const result = await env.DB
          .prepare(`
            DELETE FROM email
            WHERE expires_at < ?
            LIMIT ?
          `)
          .bind(now, CLEANUP_CONFIG.BATCH_SIZE)
          .run()

        if (result.success) {
          console.log(`Deleted ${result?.meta?.changes ?? 0} expired emails`)
        }
      }

      // 2. 清理永久邮箱的旧消息（保留最近 N 条）
      const permanentThreshold = new Date('9999-01-01T00:00:00.000Z').getTime()
      const permanentEmails = await env.DB
        .prepare(`
          SELECT e.id, COUNT(m.id) as msg_count
          FROM email e
          JOIN message m ON m."emailId" = e.id
          WHERE e.expires_at >= ?
          GROUP BY e.id
          HAVING msg_count > ?
          LIMIT ?
        `)
        .bind(permanentThreshold, CLEANUP_CONFIG.PERMANENT_EMAIL_MAX_MESSAGES, CLEANUP_CONFIG.BATCH_SIZE)
        .all<{ id: string; msg_count: number }>()

      if (permanentEmails.results.length > 0) {
        let totalDeleted = 0
        for (const email of permanentEmails.results) {
          const deleteResult = await env.DB
            .prepare(`
              DELETE FROM message
              WHERE "emailId" = ?
              AND id NOT IN (
                SELECT id FROM message
                WHERE "emailId" = ?
                ORDER BY received_at DESC
                LIMIT ?
              )
            `)
            .bind(email.id, email.id, CLEANUP_CONFIG.PERMANENT_EMAIL_MAX_MESSAGES)
            .run()

          totalDeleted += deleteResult?.meta?.changes ?? 0
        }
        console.log(`Cleaned ${totalDeleted} old messages from ${permanentEmails.results.length} permanent emails`)
      }
    } catch (error) {
      console.error('Failed to cleanup:', error)
      throw error
    }
  }
}

export default main
