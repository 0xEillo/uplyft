# send-lifecycle-email

Supabase Edge Function that sends high-value lifecycle emails via Resend.

Supported inbound webhook payloads:

- RevenueCat webhooks (`event` payloads)
- Supabase Database Webhook payloads (for `public.profiles`)

Email types:

- `welcome`
- `subscription_cancelled_feedback` (RevenueCat cancellation reasons: `UNSUBSCRIBE`, `PRICE_INCREASE`)
- `subscription_billing_issue`
- `subscription_expired_winback` (RevenueCat expiration reason: `UNSUBSCRIBE`)

Required secrets:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `REVENUECAT_WEBHOOK_AUTH`
- `EMAIL_WEBHOOK_SECRET`

Recommended secrets:

- `EMAIL_APP_NAME`
- `EMAIL_APP_BASE_URL`
- `EMAIL_SUPPORT_ADDRESS`
- `EMAIL_REPLY_TO`
- `EMAIL_FEEDBACK_URL` (optional)
