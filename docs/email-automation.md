# Lifecycle Email Automation

This project now includes a Supabase Edge Function for lifecycle emails:

- `welcome` on non-guest profile creation (or guest -> account upgrade)
- `subscription_cancelled_feedback` on RevenueCat `CANCELLATION` (`UNSUBSCRIBE` or `PRICE_INCREASE`)
- `subscription_billing_issue` on RevenueCat `BILLING_ISSUE`
- `subscription_expired_winback` on RevenueCat `EXPIRATION` with `UNSUBSCRIBE`

The function lives at:

- `supabase/functions/send-lifecycle-email/index.ts`

Email send/audit events are stored in:

- `public.email_automation_events`

## 1) Set Supabase Edge Function Secrets

```bash
supabase secrets set \
  RESEND_API_KEY="re_xxx" \
  RESEND_FROM_EMAIL="Rep AI <oliver@contact.repaifit.app>" \
  REVENUECAT_WEBHOOK_AUTH="Bearer your-strong-random-token" \
  EMAIL_WEBHOOK_SECRET="another-strong-random-token" \
  EMAIL_APP_NAME="Rep AI" \
  EMAIL_APP_BASE_URL="https://www.repaifit.app" \
  EMAIL_SUPPORT_ADDRESS="support@repaifit.app" \
  EMAIL_REPLY_TO="oliver@repaifit.app"
```

Optional:

- `EMAIL_FEEDBACK_URL` (if omitted, cancellation emails use a `mailto:` link)

## 2) Apply Migration

Apply:

- `supabase/migrations/20260305120000_add_email_automation_events.sql`

## 3) Deploy Function

`supabase/config.toml` must have `verify_jwt = false` for this function (webhooks use custom auth, not JWT). Then:

```bash
supabase functions deploy send-lifecycle-email
```

## 4) Wire RevenueCat Webhook

In RevenueCat dashboard:

1. Add webhook URL:
   - `https://<project-ref>.supabase.co/functions/v1/send-lifecycle-email`
2. Set authorization header value to exactly `REVENUECAT_WEBHOOK_AUTH`.
3. Enable events:
   - `CANCELLATION`
   - `BILLING_ISSUE`
   - `EXPIRATION`
   - `TEST` (optional, for validation)

## 5) Wire Supabase Database Webhook

In Supabase dashboard:

1. Go to `Database` -> `Webhooks`.
2. Create webhook for table `public.profiles`.
3. Trigger on events: `INSERT`, `UPDATE`.
4. Target URL:
   - `https://<project-ref>.supabase.co/functions/v1/send-lifecycle-email`
5. Add header:
   - `x-email-webhook-secret: <EMAIL_WEBHOOK_SECRET>`

The function itself filters events so welcome email only sends when:

- a profile is inserted with `is_guest = false`, or
- a profile updates from `is_guest = true` to `is_guest = false`

## 6) Verify End-to-End

- Use RevenueCat `TEST` event first (should return `skipped: true, reason: "test_event"`).
- Create a real signup and confirm one `welcome` email.
- Cancel a sandbox subscription and confirm one feedback email.
- Review rows in `email_automation_events` for status and dedupe behavior.
