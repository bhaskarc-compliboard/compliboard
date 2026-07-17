import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')

    if (!companies || companies.length === 0) {
      return NextResponse.json({ message: 'No companies found' })
    }

    let emailsSent = 0

    for (const company of companies) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', company.id)
          .single()

        if (!profile) continue

        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
        if (!authUser?.user?.email) continue

        const userEmail = authUser.user.email
        const now = new Date()
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const { data: upcomingEvents } = await supabase
          .from('calendar_events')
          .select('title, due_date, category')
          .eq('company_id', company.id)
          .eq('completed', false)
          .gte('due_date', now.toISOString())
          .lte('due_date', thirtyDaysFromNow.toISOString())
          .order('due_date', { ascending: true })

        const { data: recentAudits } = await supabase
          .from('folder_audits')
          .select('folder_name, result_json, created_at')
          .eq('company_id', company.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false })

        const { data: allFolders } = await supabase
          .from('company_folders')
          .select('id, name')
          .eq('company_id', company.id)
          .is('parent_id', null)

        const recentlyAuditedFolderNames = new Set((recentAudits || []).map((a: any) => a.folder_name))
        const unauditedFolders = (allFolders || []).filter(f => !recentlyAuditedFolderNames.has(f.name))

        const unauditedWithDates = await Promise.all(
          unauditedFolders.map(async (folder) => {
            const { data: lastAudit } = await supabase
              .from('folder_audits')
              .select('created_at')
              .eq('company_id', company.id)
              .eq('folder_name', folder.name)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            return { name: folder.name, last_audit: lastAudit?.created_at || null }
          })
        )

        const hasContent = (upcomingEvents && upcomingEvents.length > 0) ||
          (recentAudits && recentAudits.length > 0) ||
          unauditedWithDates.length > 0

        if (!hasContent) continue

        const deadlinesHtml = upcomingEvents && upcomingEvents.length > 0 ? `
          <div style="margin-bottom:32px;">
            <h2 style="color:#166534;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📅 Upcoming Deadlines — Next 30 Days</h2>
            ${upcomingEvents.map((event: any) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6;">
                <span style="font-size:14px;color:#111827;flex:1;">${event.title}</span>
                <span style="font-size:13px;color:#6b7280;margin-left:16px;white-space:nowrap;">${new Date(event.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            `).join('')}
          </div>
        ` : ''

        const auditStatusHtml = recentAudits && recentAudits.length > 0 ? `
          <div style="margin-bottom:32px;">
            <h2 style="color:#166534;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📂 Your Compliance Status</h2>
            ${recentAudits.map((audit: any) => {
              const result = audit.result_json
              const missingCount = result.missing?.length || 0
              const needsReviewCount = result.needs_review?.length || 0
              let statusIcon = '✅'
              let statusText = 'Looks complete'
              let statusColor = '#166534'
              if (missingCount > 0) { statusIcon = '❌'; statusText = `${missingCount} missing document${missingCount > 1 ? 's' : ''}`; statusColor = '#dc2626' }
              else if (needsReviewCount > 0) { statusIcon = '⚠️'; statusText = `${needsReviewCount} may need updating`; statusColor = '#d97706' }
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6;">
                  <span style="font-size:14px;color:#111827;flex:1;">${audit.folder_name}</span>
                  <span style="font-size:13px;color:${statusColor};margin-left:16px;white-space:nowrap;">${statusIcon} ${statusText}</span>
                </div>
              `
            }).join('')}
          </div>
        ` : ''

        const unauditedHtml = unauditedWithDates.length > 0 ? `
          <div style="margin-bottom:32px;">
            <h2 style="color:#166534;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🔍 Folders Needing Attention</h2>
            <p style="font-size:13px;color:#6b7280;margin-bottom:12px;">These folders have not been audited recently. Log in to run a fresh audit.</p>
            ${unauditedWithDates.map(folder => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6;">
                <span style="font-size:14px;color:#111827;flex:1;">${folder.name}</span>
                <span style="font-size:13px;color:#6b7280;margin-left:16px;white-space:nowrap;">${folder.last_audit ? `Last audited ${new Date(folder.last_audit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Never audited'}</span>
              </div>
            `).join('')}
          </div>
        ` : ''

        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#ffffff;">
            <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #166534;">
              <h1 style="color:#166534;font-size:22px;font-weight:700;margin:0 0 4px 0;">CompliBoard</h1>
              <p style="color:#6b7280;font-size:13px;margin:0;">Monthly Compliance Summary</p>
              <p style="color:#111827;font-size:15px;font-weight:600;margin:8px 0 0 0;">${company.name}</p>
            </div>
            ${deadlinesHtml}
            ${auditStatusHtml}
            ${unauditedHtml}
            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f3f4f6;text-align:center;">
              <a href="https://compliboard.vercel.app/dashboard" style="display:inline-block;background:#166534;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Open CompliBoard →</a>
            </div>
            <p style="color:#6b7280;font-size:11px;text-align:center;margin-top:24px;line-height:1.5;">
              AI-generated for information only — not legal or professional advice. Verify before acting.
            </p>
            <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:8px;">
              You are receiving this because you have a CompliBoard account. This summary is sent on the 1st of every month.
            </p>
          </div>
        `

        await resend.emails.send({
          from: 'CompliBoard <onboarding@resend.dev>',
          to: userEmail,
          subject: `Your Monthly Compliance Summary — ${company.name}`,
          html,
        })

        emailsSent++
      } catch (err) {
        console.error(`Error processing company ${company.id}:`, err)
      }
    }

    return NextResponse.json({ success: true, emails_sent: emailsSent })
  } catch (error) {
    console.error('Monthly summary error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
