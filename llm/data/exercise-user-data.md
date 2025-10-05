⏺ Analysis: Current Data Collection & Progress Visualization Recommendations

Let me analyze what data we're currently collecting and propose clear, implementable visualizations.

---

What Data We Currently Collect

From the Database Schema:

Per Workout Session:

- Date/timestamp of workout
- Workout type (e.g., "Upper Body", "Leg Day")
- Notes (user's thoughts/feelings)
- Raw text input

Per Exercise (within each workout):

- Exercise name (standardized, e.g., "Bench Press")
- Order performed
- Muscle group (stored in exercises table)
- Equipment type
- Notes specific to that exercise

Per Set (within each exercise):

- Set number (1, 2, 3...)
- Reps (always required)
- Weight in kg (null for bodyweight)
- RPE (Rate of Perceived Exertion, 1-10 scale - optional)
- Timestamp
- Notes

What We Can Calculate:

- Total volume per exercise/workout/period (weight × reps × sets)
- Max weight for any rep count (already have getExerciseMaxWeight)
- Estimated 1RM using formulas like Brzycki: weight × (36 / (37 - reps))
- Workout frequency/streaks from timestamps
- PR history (already computed on-the-fly via PrService)
- Muscle group distributions (from exercise.muscle_group field)

---

Recommended Visualizations - Prioritized

Based on the research and your existing data, here's what would be most valuable:

---

🟢 PHASE 1: Critical & Easy to Implement

1. Per-Exercise Weight Progress (Line Graph)

What it shows: Maximum weight lifted over time for a selected exercise

Implementation details:

- User selects an exercise (e.g., "Bench Press")
- X-axis: Workout dates (last 3 months, 6 months, or all time)
- Y-axis: Weight in kg
- Data points: For each workout date, plot the heaviest set (max weight) performed
- Optional: Add a trend line to show overall direction

Why it's valuable:

- Research shows this is THE most important graph in fitness apps
- Directly answers "Am I getting stronger?"
- Very intuitive - line goes up = progress

Data needed: Query sets for specific exercise_id, group by workout date, take MAX(weight)

---

2. Workout Consistency Calendar/Heatmap

What it shows: Visual calendar showing which days you worked out

Implementation details:

- Calendar grid (7 days × ~5 weeks)
- Each day colored based on:
  - Green: Workout completed
  - Light gray: Rest day
  - Optional: Shade intensity based on volume or number of exercises
- Show current streak: "12 day streak!" or "3 workouts this week"

Why it's valuable:

- Highly motivational (gamification)
- Shows consistency patterns (e.g., "I always skip Mondays")
- Research shows streaks drive habit formation

Data needed: Query workout_sessions grouped by date (just need dates, not full details)

---

3. Personal Records Dashboard

What it shows: Recent PRs achieved, categorized by exercise

Implementation details:

- List format, grouped by exercise
- Show:
  - Exercise name
  - PR type (e.g., "5-rep max", "1RM")
  - New weight vs. old weight
  - Date achieved
  - Badge color (🟠 orange = current PR, ⚪ gray = beaten since)
- Sort by most recent first
- Filter: "All time" vs "Last 30 days" vs "Last 90 days"

Why it's valuable:

- Leverages your existing PR calculation system
- Celebration of wins
- Shows orange/gray distinction you already built

Data needed: Use existing PrService.computePrsForSession but aggregate across recent workouts

---

🟡 PHASE 2: High Value, Moderate Complexity

4. Total Volume Over Time (Bar Chart)

What it shows: Total weight moved per week/month

Implementation details:

- X-axis: Weeks or months
- Y-axis: Total volume (kg)
- Bar height = sum of (weight × reps) for all sets in that period
- Optional: Color bars by workout type (Upper Body = blue, Lower Body = red)

Why it's valuable:

- Shows overall work capacity increasing
- Good for detecting overtraining or deload weeks
- Complements per-exercise graphs (big picture view)

Data needed: Aggregate sets.weight × sets.reps, group by week/month

---

5. Estimated 1RM Progression (Line Graph)

What it shows: Calculated max strength over time, even when not testing actual 1RMs

Implementation details:

- Per-exercise line graph
- Calculate estimated 1RM for each workout using Epley formula: weight × (1 + reps/30)
- Plot highest estimated 1RM per workout date
- Useful because most people don't regularly test true 1RMs

Why it's valuable:

- Shows strength gains even from 5-rep or 8-rep work
- Safer than actual 1RM testing
- Standard feature in Strong and Hevy

Data needed: Same as #1 but apply 1RM formula to each set

---

6. Muscle Group Volume Distribution (Pie Chart)

What it shows: Percentage of total volume by muscle group

Implementation details:

- Pie slices for each muscle group (Chest, Back, Legs, Shoulders, etc.)
- Size = total volume for that muscle group over selected period
- Shows if training is balanced or skewed

Why it's valuable:

- Reveals imbalances (e.g., "80% legs, 5% back")
- Helps plan future workouts
- Uses existing exercise.muscle_group data

Data needed: Join exercises.muscle_group with sets, aggregate volume, calculate percentages

---

🔵 PHASE 3: Nice to Have

7. Top Exercises by Volume or Frequency

What it shows: Ranked list of your most-performed exercises

Implementation details:

- Table or horizontal bar chart
- Columns: Exercise name | Total volume | # of workouts | # of sets
- Sort by any column

Why it's valuable:

- Shows training focus
- Can identify if you're neglecting certain lifts

---

8. RPE Trends (Line Graph)

What it shows: How hard workouts feel over time

Implementation details:

- Per-exercise or overall average RPE plotted over time
- If RPE decreasing at same weight = getting stronger
- If RPE increasing = fatigue or overtraining

Why it's valuable:

- Unique to your app (many apps don't track RPE)
- Shows adaptation beyond just weight increases
- Good for intermediate lifters

Data needed: Query sets.rpe, filter out nulls, average by workout

---

Proposed MVP Implementation

If you want to start simple and impactful, I'd recommend building these 3 first:

Starter Pack:

1. Per-Exercise Weight Progress (line graph) - answers "Am I getting stronger at X?"
2. Workout Frequency Calendar (heatmap) - answers "Am I consistent?"
3. Recent PRs List (dashboard) - answers "What have I achieved?"

Why these three?

- Cover the 3 core questions: strength, consistency, milestones
- All use data you already collect
- Match what research shows as most motivational
- Can be built with your existing PrService and database queries

---

UI Layout Suggestion

Progress Tab
├── Dashboard (default view)
│ ├── Consistency streak widget ("7 day streak! 🔥")
│ ├── This week summary (3 workouts, 12,500kg volume)
│ └── Recent PRs list (last 3-5 PRs)
│
├── Exercise Progress (drill-down)
│ ├── Dropdown to select exercise
│ ├── Weight over time line graph
│ └── All-time stats (max weight, total volume, # of workouts)
│
└── Calendar View
└── Monthly heatmap with workout days highlighted

This keeps it simple, clear, and useful—exactly what the research recommends!

---

Technical Notes

You already have most of the infrastructure:

- ✅ database.stats.getTotalVolume - can adapt for volume graphs
- ✅ database.stats.getExerciseHistory - perfect for line graphs
- ✅ PrService.computePrsForSession - powers PR dashboard
- ✅ Timestamps on all workouts - enables consistency tracking
- ✅ exercise.muscle_group - enables muscle distribution graphs

What you'd need to add:

- Chart library (e.g., react-native-chart-kit or victory-native)
- Date range pickers
- Exercise selector dropdown
- Simple aggregation queries (group by week/month)
