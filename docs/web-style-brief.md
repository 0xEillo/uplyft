# Rep AI Web Style Brief

## TL;DR

- Build a single-page site with four sections: hero, features (workout logging • AI chat • body scan), membership/CTA, and support + legal.
- Stick to a white/light gray canvas with bold accents in `#FF6B35` and blue links; pair with dark mode inversion for future expansion.
- Use rounded cards, soft shadows, and generous spacing just like the in-app feed; avoid skeuomorphic gradients.
- Tone: confident coach, data-backed, encouraging—not bro-y.

## Product Snapshot

- **What it is**: Rep AI is a fitness companion that logs workouts automatically, analyses progress with AI, and tracks physique changes with body scans.
- **Audience**: Intermediate to advanced lifters who want a smarter coach, plus quantified-self athletes chasing PRs.
- **Value prop**: “Smarter training decisions from every rep, set, and scan.”

## Core Features (site copy blocks)

- **Workout Logging** — Auto-parse typed notes or photos into structured workouts; highlights PRs, set volume, and equipment. Pull screenshots from the in-app feed (`app/(tabs)/index.tsx`).
- **AI Coach Chat** — Conversational analytics answering “What’s my 1RM?” or “Which muscle group am I neglecting?” (see behavior in `components/workout-chat.tsx`). Mention streaming responses and Pro gating.
- **Body Scan Analysis** — Guided photo capture with AI composition trends, premium gated experience (intro flow defined in `app/body-log/intro.tsx`). Promote “Track physique like a pro without calipers.”

## Support & Policy Sections

- **Support landing**: link to help email + quick-start checklists (install, sign-in, log first workout, start chat, run body scan).
- **FAQ anchors**: data privacy, scan requirements, AI accuracy, subscription tiers, troubleshooting logging errors.
- **Legal links**: Privacy Policy, Terms, Data Deletion. Include placeholder URLs now; update later.

## Visual Identity

### Color Palette (from `constants/colors.ts`)

- **Primary** `#FF6B35` — CTA buttons, floating action icon, highlight badges.
- **Primary Dark** `#FF4444` — Hover/pressed state or gradient stop.
- **Primary Light** `#FFF5F0` — Feature callouts, stat backgrounds.
- **Neutral Light** `#FAFAFA` background, `#FFFFFF` cards, `#F0F0F0` dividers.
- **Neutral Dark** `#1A1A1A` background, `#242424` cards for dark mode parity; text `#F5F5F5`.
- **Text** `#1A1A1A` (light) / `#F5F5F5` (dark); secondary `#666` / `#A8A8A8`.
- **Link/Interactive** `#007AFF` (light) / `#0A84FF` (dark) — use for inline links and secondary CTAs.
- **Status Accents**: Success `#4CAF50`, Warning `#FF9800`, Error `#F44336`.

Use CSS custom properties so you can pivot themes fast. Example:

```
:root {
  --color-primary: #FF6B35;
  --color-surface: #FFFFFF;
  --color-bg: #FAFAFA;
  --color-text: #1A1A1A;
  --color-link: #007AFF;
}

[data-theme='dark'] {
  --color-bg: #1A1A1A;
  --color-surface: #242424;
  --color-text: #F5F5F5;
  --color-link: #0A84FF;
}
```

### Typography (from `constants/theme.ts`)

- Base font stack: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`.
- Headlines: 48/56 hero, 32/38 section, 24/30 subheads, weight 700.
- Body: 18/28 for paragraphs, weight 400–500.
- Overline/cta label: uppercase 12/16 tracking 0.2em in primary color.
- Code snippets or data callouts can use `SFMono-Regular, Menlo, Consolas, 'Courier New', monospace` on dark tiles for developer docs.

### Layout & Components (grounded in `app/(tabs)/index.tsx`)

- Cards: 16px radius, 20–24px padding, ultra-light borders `rgba(0,0,0,0.04)` and soft shadow `0 12px 40px rgba(17,24,28,0.05)`.
- CTA Buttons: pill shape (28–32px radius), gradient optional (`linear-gradient(135deg, #FF6B35, #FF4444)`), white text.
- Iconography: use outlined Ionicons equivalents or lucide icons; keep stroke 1.5–2px; inactive icons `#687076`.
- Navigation: sticky top bar with logo left, support/contact right; optional floating action button for “Log Workout” mirroring the app.
- Microcopy: drop emojis sparingly (🔥, 🚀) to mirror feed tone.

### Imagery & Assets

- Logos: use `llm/repai-logo-black.png` (light backgrounds) and `llm/repai-logo-white.png` (dark backgrounds). Provide both as retina PNG + SVG if available.
- App icon: `assets/images/icon.png` conveys geometric precision—adapt as favicon.
- Screenshots: use `docs/workout-screen.png` for hero mock, pair with AI chat and body scan shots (capture via simulator).
- Photography: prefer clean studio fitness shots with diffuse light and visible effort. Avoid stock “gym selfie” clichés.

### Motion & Interaction

- Hover transitions 200ms ease-out, translateY(-2px) and subtle shadow bloom.
- Scroll-triggered fade/slide to echo card animations (`LayoutAnimation` usage in `app/(tabs)/index.tsx`).
- Chat transcript reveal can mimic streaming by animating typing indicator; optional speculation: integrate Cursor Trail or Framer Motion for sequential reveals (_speculative_).

## Content Structure Draft

1. **Hero** — Headline “Your AI training partner.” Subhead emphasising logging + analytics. CTA `Download on iOS TestFlight` (or waitlist). Secondary CTA `Read Privacy Policy`.
2. **Feature Trio** — Three equal columns or stacked cards, each with icon + short blurb + “See how it works” linking to detail anchors.
3. **Progress Proof** — Carousel of workout stats, PR badges, body scan change logs. Include trust signals (beta testers, PR counts).
4. **Membership** — Table comparing Free vs Pro (AI Chat + Body Scan gated). Button `Upgrade to Pro`.
5. **Support & Docs** — Anchor list with email, quickstart, knowledge base placeholder, FAQ accordions.
6. **Footer** — Social, contact, legal. Include data deletion request link.

## Voice & Messaging Guidelines

- Speak like a data-savvy coach: encouraging, precise, no fluff.
- Emphasise outcomes (“Hit more PRs”, “Know exactly where to focus next workout”).
- When discussing AI, highlight transparency (“Every suggestion links to your logged data”).
- For privacy copy, stress on-device capture and secure storage (see Supabase backend if needed).

## Accessibility Checklist

- Color contrast ratio ≥ 4.5 for text against `#FFF5F0` backgrounds; darken the accent to `#E45A24` if necessary.
- Provide text alternatives for screenshots (call out PR highlights, AI insights).
- Ensure focus states add 2px outline `#0A84FF` with 2px offset.
- Use prefers-reduced-motion media query to disable hero animations.

## Implementation Starters

- Set up CSS variables (see palette above) and wrap in design tokens for rapid theming.
- Use `clamp()` for typography scaling across mobile → desktop.
- Consider Astro or Next.js static export; use MDX for privacy/policy content so it stays versioned.
- Embed support email via `mailto:support@rep-ai.app` and add short contact form (Netlify Forms or Supabase Edge Function) for feedback.

## Next Steps

- Export SVG versions of logos from `llm/repai-logo*.png` for crisp web rendering.
- Capture dark-mode screenshots once the app theme parity stabilises.
- Draft privacy policy copy aligned with App Store requirements; host under `/legal/privacy`.
- Add analytics (Plausible or PostHog) to mirror in-app telemetry.
