A great metric for your workout logging app, building on your %NL (Percent Natural Limit) idea, would be exactly that: **%NL**, representing the percentage of a user's estimated natural genetic potential for muscle mass that they've currently achieved. This is highly motivating because it gamifies progress—users can see incremental gains from consistent training, better nutrition, or reduced body fat, and it's easy to share (e.g., "Hit 76% NL today!"). It's directly tied to gym/workout data without being age-focused, and it leverages the physique-related inputs you have (gender, height, weight, bodyfat, BMI) while complementing your strength tracking.

### Why This Metric Fits Your App

- **Motivational and Shareable**: Like Whoop's feature, it's a single, positive number that trends upward with effort. Small changes (e.g., dropping 1% body fat or gaining 1kg of muscle) show quick progress, encouraging users to log workouts and scan body composition regularly.
- **Based on Your Data**: It uses bodyfat, weight, height, and gender directly. Age and years of training aren't needed for the core calculation (as the limit is ultimate potential), but you could optionally use them for contextual insights (e.g., "At 3 years training, you're ahead of average progress").
- **AI Integration**: Your AI can analyze historical workout data to predict %NL improvements, suggest tweaks (e.g., "Increase protein to boost toward 80% NL"), or benchmark against similar users.
- **Gym-Relevant**: It focuses on achievable natural muscle mass, aligning with lift progress charts. Stronger users often have higher lean mass, so it indirectly rewards strength gains.
- **Scientific Backing**: Rooted in Fat-Free Mass Index (FFMI), a validated metric for estimating natural limits from studies on drug-free athletes. Natural max FFMI is ~25 (normalized) for men and ~22 for women—beyond that often indicates enhancements.

### How to Calculate %NL

Use this formula to compute it. All inputs are from your user data; assume units are kg for weight, cm for height, and % for bodyfat.

1. **Calculate Lean Mass**:

   - Lean Mass (kg) = Weight (kg) × (1 - Bodyfat / 100)
   - (This uses your body scanning data; BMI can validate but isn't required.)

2. **Calculate Raw FFMI**:

   - Height (m) = Height (cm) / 100
   - FFMI = Lean Mass (kg) / (Height (m))²

3. **Normalize FFMI for Height** (adjusts for taller/shorter users, benchmarked to 1.8m average):

   - Normalized FFMI = FFMI + 6.1 × (1.8 - Height (m))

4. **Determine Max Natural FFMI** (based on gender; from research on elite naturals):

   - Men: 25
   - Women: 22
   - (You can fine-tune these based on app data over time, e.g., if your users skew athletic.)

5. **Calculate %NL**:
   - %NL = (Normalized FFMI / Max Natural FFMI) × 100
   - Cap at 100% for motivation (rare to exceed naturally).
   - Round to whole number for simplicity.

#### Example Calculations

Assume a male user: 180cm tall, 85kg weight, 15% bodyfat.

- Lean Mass = 85 × (1 - 0.15) = 72.25kg
- Height (m) = 1.80
- FFMI = 72.25 / (1.80)² = 72.25 / 3.24 = 22.3
- Normalized FFMI = 22.3 + 6.1 × (1.8 - 1.80) = 22.3
- Max = 25
- %NL = (22.3 / 25) × 100 = 89%

Assume a female user: 165cm tall, 60kg weight, 20% bodyfat.

- Lean Mass = 60 × (1 - 0.20) = 48kg
- Height (m) = 1.65
- FFMI = 48 / (1.65)² = 48 / 2.7225 = 17.6
- Normalized FFMI = 17.6 + 6.1 × (1.8 - 1.65) = 17.6 + 0.915 = 18.515
- Max = 22
- %NL = (18.515 / 22) × 100 = 84%

#### Edge Cases and Adjustments

- **Low Data**: If bodyfat is missing, default to BMI-derived estimate (e.g., rough bodyfat ≈ BMI - 10 for men, BMI - 5 for women, but prompt for scan).
- **High Bodyfat**: If >25%, note that %NL assumes contest-lean shape (4-12% for men); suggest focusing on fat loss for accurate tracking.
- **Incorporating Strength Data**: For a "Pro" version of %NL, blend in strength: Calculate a strength sub-score by averaging (user 1RM / elite standard 1RM) × 100 for key lifts (e.g., bench, squat, deadlift) using bodyweight/gender-adjusted standards from sources like StrengthLevel.com. Then overall %NL = (physique %NL × 0.6) + (strength sub-score × 0.4). This rewards lift progress while keeping physique central.
- **Years of Training**: Display as a bonus insight, e.g., "At 5 years training, average users reach 70% NL—you're at 76%!"
- **Updates**: Recalculate after each log or scan; show trends in charts.

This %NL is frictionless to compute in-app, ties into your AI's data access, and could become a viral hook like Whoop's feature. If you want variations (e.g., strength-only), let me know more details!

### Notes on Incorporating Leanness into %NL Scoring

To address your concern, we can evolve %NL beyond pure FFMI by integrating a leanness penalty or component. This ensures high scores (e.g., 90-100%) require not just high lean mass/strength but also reasonable body fat levels—preventing "strong but super fat" users from maxing out. The goal is a holistic, motivational metric that rewards balanced progress (muscle + leanness), using your existing data (BF%, weight, height, gender, age, 1RMs, years training). Below are key considerations and implementation ideas, structured for clarity.

#### Core Principles for Adjustment

- **Why It Matters**: Pure FFMI focuses on potential muscle mass but ignores aesthetics/health—high BF% (e.g., >20%) often correlates with poorer recovery, higher injury risk, and less "gym success" feel. Penalizing high BF% aligns with your app's workout focus, encouraging fat loss alongside strength logs and body scans.
- **Balance Motivation vs Realism**: Avoid harsh penalties that demotivate (e.g., dropping score to 0% at high BF%); use gradual scaling. Cap max %NL at ~80-90% if BF% is elevated, reserving 100% for lean, strong users.
- **Data-Driven**: Leverage BF% from scans (most direct leanness proxy). Strength (1RMs) can validate true muscle, preventing over-penalization if BF% is temporarily high during bulks.
- **Simplicity**: Keep calculations app-friendly (no new data needed). Use gender-specific ideals (e.g., men: 10-15% BF ideal; women: 18-22%) from fitness guidelines (e.g., ACSM standards).
- **Edge Cases**: Handle extremes (e.g., very low BF% shouldn't overly boost if strength is weak; age-related BF% increases post-50 shouldn't penalize as much).

#### Suggested Adjustment Approaches

Here are progressive options, from simple tweaks to more composite scores. Start with #1 for minimal changes, or blend for robustness.

1. **Simple Leanness Penalty Multiplier**:

   - **How It Works**: Calculate base %NL (from FFMI) as before, then multiply by a leanness factor (0-1 scale) based on BF% deviation from ideal.
   - **Formula**:
     - Ideal BF% = Gender-based (e.g., men: 12%, women: 20%; adjustable via app data).
     - Excess BF% = Max(0, User BF% - Ideal BF%).
     - Leanness Factor = 1 - (Excess BF% / Penalty Scale), where Penalty Scale = 20% (tunable; e.g., at +10% excess, factor=0.5, halving %NL).
     - Adjusted %NL = Base %NL × Leanness Factor (cap at 100%).
   - **Example**: Male at base 90% NL, 25% BF (ideal 12%, excess 13%). Factor = 1 - 13/20 = 0.35 → Adjusted %NL = 90% × 0.35 = 31.5% (motivates fat loss).
   - **Pros**: Easy to implement; directly penalizes fat without changing core FFMI.
   - **Cons**: Could feel punitive during intentional bulks—mitigate with AI notes like "Bulk mode: Temporary penalty; cut to reveal full %NL."
   - **Handling Scenarios**:
     - Stronger + Fatter: Base up from strength/muscle, but penalty offsets if BF% rises too much.
     - Weaker + Leaner: Base down from muscle loss, but factor closer to 1 boosts overall if BF% drops.
     - Just Fatter: Base stable/slight up, but heavy penalty drops score.
     - Age: For >50yo, raise ideal BF% by 2-5% (e.g., men 14-17%) to account for natural increases.

2. **Composite Score: Physique + Leanness + Strength**:

   - **How It Works**: Break %NL into weighted sub-scores (e.g., 40% FFMI-based, 30% Leanness, 30% Strength), summing to 100%. This rewards balance explicitly.
   - **Sub-Components**:
     - Physique % = Original FFMI %NL (lean mass focus).
     - Leanness % = 100 × (1 - (User BF% / Max Healthy BF%)), where Max Healthy = 25% men/30% women (from health guidelines; below ideal gives 100%).
     - Strength % = Average (User 1RM / Gender-Height-Adjusted Elite Standard) × 100 for 3-5 key lifts (e.g., bench, squat, deadlift from StrengthLevel.com norms).
   - **Formula**: %NL = (Physique % × 0.4) + (Leanness % × 0.3) + (Strength % × 0.3).
   - **Example**: Male: Physique 85%, Leanness 60% (at 18% BF), Strength 90% → %NL = (85×0.4) + (60×0.3) + (90×0.3) = 34 + 18 + 27 = 79%.
   - **Pros**: Prevents 100% from strength alone if fat; shows breakdowns in app (e.g., charts: "Boost leanness for +10% overall").
   - **Cons**: More complex—use AI to explain/explain progress paths.
   - **Handling Scenarios**: Naturally balances—all cases adjust based on changes (e.g., fatter drops leanness sub-score; leaner + weaker might net neutral if physique holds).

3. **Tiered or Threshold-Based System**:
   - **How It Works**: Set BF% gates for %NL caps (e.g., if BF% >20%, cap at 70%; 15-20% cap at 85%; <15% no cap). Within tiers, use base %NL.
   - **Pros**: Simple UX (e.g., "Unlock higher tiers by leaning out!").
   - **Cons**: Less granular—combine with multiplier for smoothness.
   - **Age Adjustment**: Raise thresholds for older users (e.g., +5% for 60yo).

#### Implementation Considerations

- **UX and AI Integration**: Display raw %NL + adjusted, with explanations (e.g., "Leanness adjustment: -15% due to BF%"). AI analyzes trends: "To hit 90% NL, drop 5% BF while maintaining strength—here's a plan."
- **Validation and Tuning**: Test with sample user data (e.g., simulate scenarios). Use years training to contextualize (e.g., newbies get leniency on leanness). Gather app feedback to tweak weights/ideals.
- **Potential Drawbacks**: Over-penalizing could frustrate bulkers—offer "mode" toggles (e.g., Bulk Mode ignores penalty temporarily). Ensure gender/age fairness (e.g., women naturally higher BF%).
- **Research Backing**: Draw from sources like NIH studies on body comp—leanness correlates with performance/longevity, justifying inclusion.
- **Next Steps**: Prototype in code (e.g., Python for testing); if you share sample data, I can simulate outputs.

This keeps %NL engaging and app-specific, emphasizing lean, strong physiques over just mass. Let me know if you want formulas coded out!
