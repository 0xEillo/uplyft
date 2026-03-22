import { errorResponse, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabase.ts'

type EmailSource = 'revenuecat' | 'supabase_db'

type EmailType =
  | 'welcome'
  | 'subscription_cancelled_feedback'
  | 'subscription_billing_issue'
  | 'subscription_expired_winback'

type RevenueCatEvent = {
  id?: string
  type?: string
  app_user_id?: string | null
  original_app_user_id?: string | null
  aliases?: string[] | null
  store?: string | null
  product_id?: string | null
  period_type?: string | null
  cancel_reason?: string | null
  expiration_reason?: string | null
  event_timestamp_ms?: number | null
  subscriber_attributes?: Record<
    string,
    { value?: string | null } | null | undefined
  > | null
}

type RevenueCatWebhookPayload = {
  event?: RevenueCatEvent
}

type SupabaseWebhookPayload = {
  type?: string
  table?: string
  schema?: string
  record?: Record<string, unknown> | null
  old_record?: Record<string, unknown> | null
}

type EmailTemplate = {
  subject: string
  html: string
  text: string
}

type PreparedEmail = {
  source: EmailSource
  sourceEventId: string
  emailType: EmailType
  userId: string | null
  recipientEmail: string
  template: EmailTemplate
  metadata: Record<string, unknown>
}

const DEFAULT_APP_NAME = 'Rep AI'
const DEFAULT_APP_BASE_URL = 'https://www.repaifit.app'
const DEFAULT_SUPPORT_EMAIL = 'support@repaifit.app'
const IOS_MANAGE_URL = 'https://apps.apple.com/account/subscriptions'
const ANDROID_MANAGE_URL = 'https://play.google.com/store/account/subscriptions'
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return null
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function firstName(displayName: string | null): string {
  if (!displayName) return 'there'
  const trimmed = displayName.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0]
}

function normalizeUrl(value: string | null | undefined): string {
  const fallback = DEFAULT_APP_BASE_URL
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.replace(/\/+$/g, '')
}

function buildFeedbackUrl(
  appName: string,
  feedbackEmail: string,
  customSubject?: string,
): string {
  const explicit = asString(Deno.env.get('EMAIL_FEEDBACK_URL'))
  if (explicit) return explicit

  const subject = encodeURIComponent(
    customSubject || `Cancellation feedback for ${appName}`,
  )
  return `mailto:${feedbackEmail}?subject=${subject}`
}

function resolveRevenueCatUserId(event: RevenueCatEvent): string | null {
  const candidates: string[] = []
  const primary = asString(event.app_user_id ?? null)
  const original = asString(event.original_app_user_id ?? null)

  if (primary) candidates.push(primary)
  if (original) candidates.push(original)
  if (Array.isArray(event.aliases)) {
    for (const alias of event.aliases) {
      const normalized = asString(alias)
      if (normalized) candidates.push(normalized)
    }
  }

  for (const candidate of candidates) {
    const match = candidate.match(UUID_PATTERN)
    if (match?.[0]) {
      return match[0].toLowerCase()
    }
  }

  return null
}

function resolveRevenueCatEmail(event: RevenueCatEvent): string | null {
  const attributes = event.subscriber_attributes
  if (!attributes) return null

  const attr = attributes.$email
  if (!attr || typeof attr !== 'object') return null

  return normalizeEmail(asString(attr.value))
}

function makeTemplate(input: {
  appName: string
  preheader: string
  title: string | null
  intro: string
  lines: string[]
  ctaLabel?: string
  ctaUrl?: string
  footer: string
  supportEmail: string
  ctaFallbackPrefix?: string
}): { html: string; text: string } {
  const lineHtml = input.lines
    .map((line) => {
      const isBullet = line.trim().startsWith('•')
      return `<p style="margin:0 0 ${
        isBullet ? '4px' : '16px'
      };font-size:16px;line-height:24px;">${escapeHtml(line)}</p>`
    })
    .join('')

  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:24px 0;">
  <a href="${escapeHtml(
    input.ctaUrl,
  )}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;">
    ${escapeHtml(input.ctaLabel)}
  </a>
</p>`
      : ''

  const ctaFallbackHtml =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:0 0 18px;font-size:14px;line-height:20px;color:#475569;">
  ${escapeHtml(
    input.ctaFallbackPrefix ?? 'Button not working? Open this link:',
  )}<br />
  <a href="${escapeHtml(
    input.ctaUrl,
  )}" style="color:#0f172a;text-decoration:underline;word-break:break-all;">${escapeHtml(
          input.ctaUrl,
        )}</a>
</p>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${escapeHtml(input.title || '')}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
            <tr>
              <td style="padding:24px 20px;">
      ${
        input.title
          ? `
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;letter-spacing:0.02em;text-transform:uppercase;">${escapeHtml(
        input.appName,
      )}</p>
      <h1 style="margin:0 0 14px;font-size:24px;line-height:30px;">${escapeHtml(
        input.title as string,
      )}</h1>`
          : ''
      }
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">${escapeHtml(
        input.intro,
      )}</p>
      ${lineHtml}
      ${ctaHtml}
      ${ctaFallbackHtml}
      <p style="margin:0 0 12px;font-size:14px;line-height:20px;color:#334155;">${escapeHtml(
        input.footer,
      )}</p>
      <p style="margin:0;font-size:14px;line-height:20px;color:#334155;">
        Need help? Reply to this email or contact
        <a href="mailto:${escapeHtml(
          input.supportEmail,
        )}" style="color:#0f172a;text-decoration:underline;">${escapeHtml(
    input.supportEmail,
  )}</a>.
      </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const textParts = [
    input.title || '',
    '',
    input.preheader,
    '',
    input.intro,
    '',
    ...input.lines,
    input.ctaLabel && input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : '',
    '',
    input.footer,
    `Need help? Reply to this email or contact ${input.supportEmail}.`,
  ].filter((item) => item.length > 0)

  return { html, text: textParts.join('\n') }
}

function buildWelcomeTemplate(input: {
  appName: string
  displayName: string | null
  supportEmail: string
}): EmailTemplate {
  const greeting = `Hey ${firstName(input.displayName)}, welcome to ${
    input.appName
  }.`
  const content = makeTemplate({
    appName: input.appName,
    preheader:
      'Thanks for signing up. Track your workouts, stay consistent, and get stronger.',
    title: `Welcome to ${input.appName}`,
    intro: greeting,
    lines: [
      'Thanks for signing up and giving the app a shot.',
      'The core value is simple: track your workouts, rank your lifts, and get stronger over time.',
      'When you can see your training, it is easier to improve it.',
    ],
    footer: 'You are receiving this because you created an account.',
    supportEmail: input.supportEmail,
  })

  return {
    subject: `Welcome to ${input.appName}`,
    html: content.html,
    text: content.text,
  }
}

function buildCancellationFeedbackTemplate(input: {
  appName: string
  displayName: string | null
  feedbackUrl: string
  supportEmail: string
}): EmailTemplate {
  const content = makeTemplate({
    appName: input.appName,
    preheader:
      'Quick reply = 1 free month of Rep AI Pro (personal thank-you from Oliver)',
    title: null,
    intro: `Hey ${firstName(input.displayName)},`,
    lines: [
      'Quick reply from you = I’ll immediately gift you 1 full extra month of Rep AI completely free (no strings, no auto-renew, just my personal thank-you).',
      'Oliver here — solo founder who builds and reads every single Rep AI email himself.',
      'I saw you cancelled and I’m genuinely bummed. Life gets in the way, I totally understand. No hard feelings at all.',
      'Your opinion is the highest-leverage feedback I get. One honest reply last week made me ship a much faster logging flow that everyone is now loving.',
      'So here’s my deal:',
      'Just reply with one line — anything at all — about what felt missing, confusing, or not worth it, and the free month is yours instantly.',
      'Examples (copy-paste or write your own):',
      '• “Logging sets took too many taps”',
      '• “Wanted better progress visuals / streaks”',
      '• “Notifications were too much”',
      '• “Too expensive for how much I used it”',
      '• “Switched to Hevy / Strong”',
      '• “Just got too busy — nothing wrong with the app”',
      'Takes 10 seconds. I’ll read it personally, action it this week, and add the free month to your account right away.',
      'You already helped me by trying the app — this is just my way of saying a proper thank you.',
      'Hit reply whenever you have a moment. I read and reply to every single one myself.',
      'You’ve got this 💪',
    ],
    ctaLabel: 'Claim my free month',
    ctaUrl: input.feedbackUrl,
    ctaFallbackPrefix:
      'P.S. If the button isn’t working, just reply or use this link:',
    footer: `– Oliver (repaifit.app solo founder)`,
    supportEmail: input.supportEmail,
  })

  return {
    subject:
      'Oliver here — your feedback = I’ll give you 1 month completely free right now',
    html: content.html,
    text: content.text,
  }
}

function getManageSubscriptionUrl(
  store: string | null,
  appBaseUrl: string,
): string {
  const normalized = (store ?? '').toUpperCase()
  if (normalized === 'APP_STORE' || normalized === 'MAC_APP_STORE') {
    return IOS_MANAGE_URL
  }
  if (normalized === 'PLAY_STORE') {
    return ANDROID_MANAGE_URL
  }
  return appBaseUrl
}

function buildBillingIssueTemplate(input: {
  appName: string
  displayName: string | null
  manageUrl: string
  supportEmail: string
}): EmailTemplate {
  const content = makeTemplate({
    appName: input.appName,
    preheader:
      'Update your payment method to avoid interruption to Pro access.',
    title: 'Action needed: billing issue',
    intro: `Hey ${firstName(input.displayName)}, we had trouble renewing your ${
      input.appName
    } subscription.`,
    lines: [
      'Your access may pause if billing is not fixed.',
      'Please update your payment method to keep your subscription active.',
    ],
    ctaLabel: 'Update Billing',
    ctaUrl: input.manageUrl,
    footer: 'If this is already resolved, you can ignore this message.',
    supportEmail: input.supportEmail,
  })

  return {
    subject: 'Action needed: update billing',
    html: content.html,
    text: content.text,
  }
}

function buildExpirationWinbackTemplate(input: {
  appName: string
  displayName: string | null
  appBaseUrl: string
  supportEmail: string
}): EmailTemplate {
  const content = makeTemplate({
    appName: input.appName,
    preheader:
      'Your data is still here. Restart Pro anytime when you are ready.',
    title: `Your ${input.appName} Pro access ended`,
    intro: `Hey ${firstName(
      input.displayName,
    )}, your subscription has expired.`,
    lines: [
      'If you still want guided progress tracking and full feature access, you can restart anytime.',
      'Your account and data are still here whenever you come back.',
    ],
    ctaLabel: 'Rejoin Pro',
    ctaUrl: input.appBaseUrl,
    footer: 'You are receiving this because your subscription ended.',
    supportEmail: input.supportEmail,
  })

  return {
    subject: `${input.appName} Pro ended`,
    html: content.html,
    text: content.text,
  }
}

function authHeaderMatches(
  expectedRaw: string,
  actualRaw: string | null,
): boolean {
  if (!actualRaw) return false

  const expected = expectedRaw.trim()
  const actual = actualRaw.trim()

  if (!expected || !actual) return false
  if (actual === expected) return true

  if (!expected.toLowerCase().startsWith('bearer ')) {
    return actual === `Bearer ${expected}`
  }

  return false
}

async function fetchUserContact(
  userId: string,
  fallbackDisplayName: string | null,
): Promise<{ email: string | null; displayName: string | null }> {
  const service = createServiceClient()

  const [userResult, profileResult] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (userResult.error) {
    console.error(
      '[send-lifecycle-email] Failed to fetch auth user:',
      userResult.error,
    )
  }

  if (profileResult.error) {
    console.error(
      '[send-lifecycle-email] Failed to fetch profile display_name:',
      profileResult.error,
    )
  }

  const email = normalizeEmail(asString(userResult.data.user?.email ?? null))
  const profileDisplayName = asString(profileResult.data?.display_name)

  return {
    email,
    displayName: profileDisplayName ?? fallbackDisplayName,
  }
}

async function wasAlreadySent(input: {
  source: EmailSource
  sourceEventId: string
  emailType: EmailType
}): Promise<boolean> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('email_automation_events')
    .select('id, status')
    .eq('source', input.source)
    .eq('source_event_id', input.sourceEventId)
    .eq('email_type', input.emailType)
    .maybeSingle()

  if (error) {
    // If the table is missing or query fails, fall back to idempotency via Resend key.
    console.warn(
      '[send-lifecycle-email] Could not read email_automation_events:',
      error,
    )
    return false
  }

  return Boolean(data && data.status === 'sent')
}

async function recordEvent(input: {
  source: EmailSource
  sourceEventId: string
  emailType: EmailType
  userId: string | null
  recipientEmail: string
  status: 'sent' | 'failed' | 'skipped'
  resendEmailId?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  const service = createServiceClient()

  const { error } = await service.from('email_automation_events').upsert(
    {
      source: input.source,
      source_event_id: input.sourceEventId,
      email_type: input.emailType,
      user_id: input.userId,
      recipient_email: input.recipientEmail,
      status: input.status,
      resend_email_id: input.resendEmailId ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    },
    {
      onConflict: 'source,source_event_id,email_type',
    },
  )

  if (error) {
    console.warn('[send-lifecycle-email] Failed to write event log:', error)
  }
}

async function sendEmailWithResend(input: {
  apiKey: string
  from: string
  to: string
  replyTo: string
  idempotencyKey: string
  template: EmailTemplate
  tags: { name: string; value: string }[]
}): Promise<{ emailId: string | null }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      reply_to: input.replyTo,
      subject: input.template.subject,
      html: input.template.html,
      text: input.template.text,
      tags: input.tags,
    }),
  })

  const rawText = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    parsed = { rawText }
  }

  if (!response.ok) {
    const message =
      asString(parsed.message) ??
      asString(parsed.error) ??
      `Resend request failed (${response.status})`
    throw new Error(message)
  }

  return {
    emailId: asString(parsed.id),
  }
}

async function prepareFromSupabaseWebhook(
  req: Request,
  payload: SupabaseWebhookPayload,
): Promise<
  | { kind: 'send'; email: PreparedEmail }
  | { kind: 'skip'; reason: string }
  | { kind: 'error'; status: number; message: string }
> {
  const expectedSecret = asString(Deno.env.get('EMAIL_WEBHOOK_SECRET'))
  if (!expectedSecret) {
    return {
      kind: 'error',
      status: 500,
      message: 'Missing EMAIL_WEBHOOK_SECRET configuration',
    }
  }

  const providedSecret = asString(req.headers.get('x-email-webhook-secret'))
  if (!providedSecret || providedSecret !== expectedSecret) {
    return { kind: 'error', status: 401, message: 'Unauthorized webhook' }
  }

  if (payload.table !== 'profiles') {
    return { kind: 'skip', reason: 'unsupported_table' }
  }

  if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') {
    return { kind: 'skip', reason: 'unsupported_operation' }
  }

  const record = payload.record ?? {}
  const oldRecord = payload.old_record ?? {}
  const userId = asString(record.id)

  if (!userId) {
    return { kind: 'skip', reason: 'missing_profile_id' }
  }

  const newIsGuest = asBoolean(record.is_guest) ?? false
  const oldIsGuest = asBoolean(oldRecord.is_guest)

  const shouldSendWelcome =
    (payload.type === 'INSERT' && !newIsGuest) ||
    (payload.type === 'UPDATE' && oldIsGuest === true && newIsGuest === false)

  if (!shouldSendWelcome) {
    return { kind: 'skip', reason: 'not_a_welcome_transition' }
  }

  const fallbackDisplayName = asString(record.display_name)
  const contact = await fetchUserContact(userId, fallbackDisplayName)

  if (!contact.email) {
    return { kind: 'skip', reason: 'profile_has_no_email' }
  }

  const appName = asString(Deno.env.get('EMAIL_APP_NAME')) ?? DEFAULT_APP_NAME
  const supportEmail =
    normalizeEmail(asString(Deno.env.get('EMAIL_SUPPORT_ADDRESS'))) ??
    DEFAULT_SUPPORT_EMAIL
  const template = buildWelcomeTemplate({
    appName,
    displayName: contact.displayName,
    supportEmail,
  })

  return {
    kind: 'send',
    email: {
      source: 'supabase_db',
      sourceEventId: `welcome:${userId}`,
      emailType: 'welcome',
      userId,
      recipientEmail: contact.email,
      template,
      metadata: {
        webhook_type: payload.type,
        table: payload.table,
      },
    },
  }
}

async function prepareFromRevenueCatWebhook(
  req: Request,
  payload: RevenueCatWebhookPayload,
): Promise<
  | { kind: 'send'; email: PreparedEmail }
  | { kind: 'skip'; reason: string }
  | { kind: 'error'; status: number; message: string }
> {
  const expectedAuth = asString(Deno.env.get('REVENUECAT_WEBHOOK_AUTH'))
  if (!expectedAuth) {
    return {
      kind: 'error',
      status: 500,
      message: 'Missing REVENUECAT_WEBHOOK_AUTH configuration',
    }
  }

  if (!authHeaderMatches(expectedAuth, req.headers.get('authorization'))) {
    return {
      kind: 'error',
      status: 401,
      message: 'Unauthorized RevenueCat webhook',
    }
  }

  const event = payload.event
  if (!event) {
    return { kind: 'skip', reason: 'missing_event' }
  }

  const eventType = asString(event.type)?.toUpperCase()
  if (!eventType) {
    return { kind: 'skip', reason: 'missing_event_type' }
  }

  if (eventType === 'TEST') {
    return { kind: 'skip', reason: 'test_event' }
  }

  const supportedEvents = new Set([
    'CANCELLATION',
    'BILLING_ISSUE',
    'EXPIRATION',
  ])
  if (!supportedEvents.has(eventType)) {
    return { kind: 'skip', reason: `unsupported_event_${eventType}` }
  }

  if (eventType === 'CANCELLATION') {
    const cancelReason = asString(event.cancel_reason)?.toUpperCase()
    if (!cancelReason) {
      return { kind: 'skip', reason: 'missing_cancel_reason' }
    }

    const allowedReasons = new Set(['UNSUBSCRIBE', 'PRICE_INCREASE'])
    if (!allowedReasons.has(cancelReason)) {
      return { kind: 'skip', reason: `cancellation_reason_${cancelReason}` }
    }
  }

  if (eventType === 'EXPIRATION') {
    const expirationReason =
      asString(event.expiration_reason)?.toUpperCase() ?? 'UNKNOWN'
    if (expirationReason !== 'UNSUBSCRIBE') {
      return { kind: 'skip', reason: `expiration_reason_${expirationReason}` }
    }
  }

  const userId = resolveRevenueCatUserId(event)
  const fallbackRevenueCatEmail = resolveRevenueCatEmail(event)

  let displayName: string | null = null
  let recipientEmail: string | null = null

  if (userId) {
    const contact = await fetchUserContact(userId, null)
    recipientEmail = contact.email
    displayName = contact.displayName
  }

  if (!recipientEmail && fallbackRevenueCatEmail) {
    recipientEmail = fallbackRevenueCatEmail
  }

  if (!recipientEmail) {
    return { kind: 'skip', reason: 'user_not_resolved_to_email' }
  }

  const appName = asString(Deno.env.get('EMAIL_APP_NAME')) ?? DEFAULT_APP_NAME
  const appBaseUrl = normalizeUrl(Deno.env.get('EMAIL_APP_BASE_URL'))
  const supportEmail =
    normalizeEmail(asString(Deno.env.get('EMAIL_SUPPORT_ADDRESS'))) ??
    DEFAULT_SUPPORT_EMAIL
  const feedbackEmail =
    normalizeEmail(asString(Deno.env.get('EMAIL_REPLY_TO'))) ?? supportEmail
  const feedbackUrl = buildFeedbackUrl(
    appName,
    feedbackEmail,
    'Feedback + 1 free month gift',
  )

  let emailType: EmailType
  let template: EmailTemplate

  if (eventType === 'CANCELLATION') {
    emailType = 'subscription_cancelled_feedback'
    template = buildCancellationFeedbackTemplate({
      appName,
      displayName,
      feedbackUrl,
      supportEmail,
    })
  } else if (eventType === 'BILLING_ISSUE') {
    emailType = 'subscription_billing_issue'
    template = buildBillingIssueTemplate({
      appName,
      displayName,
      manageUrl: getManageSubscriptionUrl(asString(event.store), appBaseUrl),
      supportEmail,
    })
  } else {
    emailType = 'subscription_expired_winback'
    template = buildExpirationWinbackTemplate({
      appName,
      displayName,
      appBaseUrl,
      supportEmail,
    })
  }

  const eventId = asString(event.id)
  const eventTimestamp =
    typeof event.event_timestamp_ms === 'number'
      ? String(event.event_timestamp_ms)
      : String(Date.now())
  const sourceEventId =
    eventId ??
    `${eventType}:${asString(event.app_user_id) ?? 'unknown'}:${eventTimestamp}`

  return {
    kind: 'send',
    email: {
      source: 'revenuecat',
      sourceEventId,
      emailType,
      userId,
      recipientEmail,
      template,
      metadata: {
        revenuecat_event_type: eventType,
        cancel_reason: asString(event.cancel_reason),
        expiration_reason: asString(event.expiration_reason),
        product_id: asString(event.product_id),
        store: asString(event.store),
        period_type: asString(event.period_type),
      },
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true })
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'Invalid JSON payload')
  }

  const payload = asRecord(body)
  if (!payload) {
    return errorResponse(400, 'Invalid payload')
  }

  try {
    let preparedResult:
      | { kind: 'send'; email: PreparedEmail }
      | { kind: 'skip'; reason: string }
      | { kind: 'error'; status: number; message: string }

    if (asRecord(payload.event)) {
      preparedResult = await prepareFromRevenueCatWebhook(
        req,
        payload as RevenueCatWebhookPayload,
      )
    } else if (typeof payload.table === 'string') {
      preparedResult = await prepareFromSupabaseWebhook(
        req,
        payload as SupabaseWebhookPayload,
      )
    } else {
      return errorResponse(400, 'Unsupported payload shape')
    }

    if (preparedResult.kind === 'error') {
      return errorResponse(preparedResult.status, preparedResult.message)
    }

    if (preparedResult.kind === 'skip') {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: preparedResult.reason,
      })
    }

    const prepared = preparedResult.email
    const resendApiKey = asString(Deno.env.get('RESEND_API_KEY'))
    const resendFrom = asString(Deno.env.get('RESEND_FROM_EMAIL'))
    const replyTo =
      normalizeEmail(asString(Deno.env.get('EMAIL_REPLY_TO'))) ??
      normalizeEmail(asString(Deno.env.get('EMAIL_SUPPORT_ADDRESS'))) ??
      DEFAULT_SUPPORT_EMAIL

    if (!resendApiKey || !resendFrom) {
      return errorResponse(
        500,
        'Missing RESEND_API_KEY or RESEND_FROM_EMAIL configuration',
      )
    }

    const duplicate = await wasAlreadySent({
      source: prepared.source,
      sourceEventId: prepared.sourceEventId,
      emailType: prepared.emailType,
    })

    if (duplicate) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: 'duplicate_event',
      })
    }

    const idempotencyKey = `${prepared.source}:${prepared.sourceEventId}:${prepared.emailType}`.slice(
      0,
      240,
    )

    let sendResult: { emailId: string | null }
    try {
      sendResult = await sendEmailWithResend({
        apiKey: resendApiKey,
        from: resendFrom,
        to: prepared.recipientEmail,
        replyTo,
        idempotencyKey,
        template: prepared.template,
        tags: [
          { name: 'source', value: prepared.source },
          { name: 'email_type', value: prepared.emailType },
        ],
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send email'
      await recordEvent({
        source: prepared.source,
        sourceEventId: prepared.sourceEventId,
        emailType: prepared.emailType,
        userId: prepared.userId,
        recipientEmail: prepared.recipientEmail,
        status: 'failed',
        reason: message,
        metadata: prepared.metadata,
      })
      return errorResponse(502, 'Failed to send lifecycle email', { message })
    }

    await recordEvent({
      source: prepared.source,
      sourceEventId: prepared.sourceEventId,
      emailType: prepared.emailType,
      userId: prepared.userId,
      recipientEmail: prepared.recipientEmail,
      status: 'sent',
      resendEmailId: sendResult.emailId,
      metadata: prepared.metadata,
    })

    return jsonResponse({
      success: true,
      sent: true,
      emailType: prepared.emailType,
      source: prepared.source,
      resendEmailId: sendResult.emailId,
    })
  } catch (error) {
    console.error('[send-lifecycle-email] Unexpected error:', error)
    return errorResponse(500, 'Internal error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
