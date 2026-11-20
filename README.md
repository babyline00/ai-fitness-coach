# AI-Powered Fitness Coach

> A personalized workout coach with **form-check via camera**, **adaptive progression**,
> and **weekly plans** based on goals + equipment + recovery state.

This is project #79 from the 110-project portfolio plan — a focused MVP that
demonstrates a full feedback loop: a user profile drives a generated workout,
the workout is logged, the log drives progression for the next session, and
the past 7 days drive a weekly review with a deload suggestion. A form-check
flow lets the user upload a short video or image of an exercise and get an
LLM-vision analysis (with a deterministic mock fallback for offline dev).

---

## MVP scope (what ships)

- **Hardcoded exercise library** — 36 exercises in `src/lib/exercise-data.ts`,
  each with: id, name, category (strength/cardio/mobility/core), muscleGroups,
  equipment, difficulty, default sets/reps/rest, step-by-step instructions,
  common form errors, and coaching cues.
- **User profile** — goals, equipment owned, time per session, days per week,
  recovery state (fresh/moderate/fatigued), and experience level.
- **Adaptive workout generation** — pure-function `generateWorkout(profile, exercises)`
  returns warmup (5 min mobility) + main (compound + accessory scaled to time)
  + cooldown (5 min stretch). Each exercise carries sets × reps × rest ×
  estimated time.
- **Form check (mocked)** — user uploads a video/image; the LLM vision call
  (`zai.chat.completions.createVision`) describes the form and flags common
  errors from the exercise's `commonFormErrors` list. If no LLM is available,
  the deterministic mock returns "looks good, keep chest tall".
- **Adaptive progression** — pure-function `nextWorkoutProgression(history,
  currentWorkout)` returns per-exercise suggestions: +5 lb if all sets
  completed with good form, +1 rep if completed but RPE 8–9, no change if
  sets were failed, and the default weight if it's the first time.
- **Equipment-aware workouts** — `filterByEquipment(exercises, owned)` keeps
  only exercises the user can perform (bodyweight is always available).
- **Recovery-state input** — fatigued users get 80% of normal volume (fewer
  sets, rounded to min 2) and 120% rest, via `adjustForRecovery`.
- **Weekly review + adjust** — `generateWeeklyReview(workouts)` returns total
  volume, average RPE, and a `suggestedDeload` flag (true when avgRPE > 8.5).

## Stretch goals (documented, not shipped)

- **Real MediaPipe pose estimation** — instead of an LLM vision call, run
  `@tensorflow-models/pose-detection` (MoveNet) or MediaPipe Pose on each
  uploaded frame to extract joint landmarks, project them against a per-
  exercise form rule set (e.g. for a squat: knee-over-toe angle, hip-crease-
  below-knee, neutral spine), and emit concrete violations + a corrected-rep
  animation. The current `src/lib/form-check.ts` keeps the LLM-prompt parsing
  and the mock fallback isolated, so a real-pose path can be dropped in by
  replacing `runFormCheck`.
- **Wearable integration (Whoop / Apple Watch)** — pull real HRV, sleep, and
  recovery scores and let those drive `recoveryState` instead of a manual
  dropdown.
- **Group challenges** — share a weekly plan with friends and compare volume
  / adherence on a leaderboard.
- **Real exercise library** — pull from a fitness API (e.g. Wger, ExerciseDB)
  instead of the hardcoded 36-exercise library.

---

## Features

- Create and switch between multiple user profiles.
- Generate an equipment-aware, recovery-adjusted, goal-driven workout with one click.
- View the current workout as warmup / main / cooldown blocks, each with sets,
  reps, rest, cues, and a per-exercise "Form check" upload dialog.
- Mark a workout complete with a workout-level RPE (5–10).
- Compute adaptive progression for the next session and persist it as a new
  workout (not yet completed).
- Build a weekly review from the past 7 days — volume, average RPE, and a
  deload suggestion.
- Browse the exercise library with category / equipment / muscle-group /
  difficulty filters via `GET /api/exercises`.
- Stats endpoint (`GET /api/stats`) for quick health checks.

---

## Tech stack

| Layer       | Choice                                                             |
|-------------|--------------------------------------------------------------------|
| Framework   | Next.js 16 (App Router, TypeScript 5)                              |
| Styling     | Tailwind CSS 4 + shadcn/ui (New York style)                        |
| Database    | Prisma 6 + SQLite (isolated `db/custom.db`)                       |
| AI          | `z-ai-web-dev-sdk` (`chat.completions.create` + `createVision`)   |
| Tests       | `bun test` (deterministic, offline, 97 unit tests)               |
| Lint        | `eslint-config-next` (core-web-vitals + typescript)               |
| Icons       | lucide-react                                                       |

---

## Architecture (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Browser (src/app/page.tsx)                       │
│   ┌─────────────┐  ┌──────────────────────┐  ┌────────────────────────┐  │
│   │ Profile     │  │ Current Workout View │  │ Weekly Review +       │  │
│   │ Editor +    │  │  warmup / main / cool │  │ Progression panels    │  │
│   │ History     │  │  + per-exercise      │  │                       │  │
│   │             │  │  "Form check" dialog  │  │                       │  │
│   └──────┬──────┘  └──────────┬───────────┘  └───────────┬────────────┘  │
│          │ fetch (relative)  │                          │                │
└──────────┼───────────────────┼──────────────────────────┼────────────────┘
           ▼                   ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Next.js API routes (src/app/api/*)               │
│  profiles   workouts/generate   workouts/[id]    workouts/[id]/progress   │
│  form-check   weekly-review    exercises         stats                    │
└──────────┬────────────────────┬─────────────────────────┬─────────────────┘
           ▼                    ▼                         ▼
┌─────────────────────┐  ┌────────────────────┐  ┌──────────────────────────┐
│ Pure domain logic   │  │ Prisma (SQLite)    │  │ z-ai-web-dev-sdk         │
│ src/lib/*           │  │ src/lib/db.ts      │  │ ZaiProvider (vision/chat)│
│  - exercise-data    │  │  UserProfile       │  │  MockProvider (offline)  │
│  - equipment-filter │  │  Workout           │  │                          │
│  - goal-mapper      │  │  FormCheck         │  │                          │
│  - workout-generator│  └────────────────────┘  │                          │
│  - recovery-adjuster│                            │                          │
│  - progression      │  ┌────────────────────┐  │                          │
│  - form-check       │  │ bun test (97 tests)│  │                          │
│  - weekly-review    │  │ src/lib/__tests__  │  │                          │
│  - ai               │  └────────────────────┘  └──────────────────────────┘
└─────────────────────┘
```

### Data flow

1. User creates a profile → `POST /api/profiles` → Prisma `UserProfile`.
2. User clicks "New workout" → `POST /api/workouts/generate` → calls
   `generateWorkout(profile, EXERCISES)` which:
   - filters exercises by equipment (`filterByEquipment`),
   - maps the goal to a rep/set/rest focus (`mapGoalToFocus`),
   - assembles warmup / main / cooldown blocks,
   - applies `adjustForRecovery` based on the user's recovery state,
   - computes total volume and duration.
   The result is persisted as a `Workout` row (`blocksJson` = serialized
   blocks).
3. User clicks "Form check" on an exercise → multipart upload to
   `POST /api/form-check` → `buildFormCheckPrompt` → `getChatProvider().vision()`
   → `parseFormCheckResponse` → persisted as a `FormCheck` row.
4. User marks the workout complete with an RPE → `PATCH /api/workouts/[id]`.
5. User clicks "Build next workout" → `POST /api/workouts/[id]/progress` →
   pulls history, calls `nextWorkoutProgression(history, current)`, applies
   suggestions via `applyProgressionToWorkoutExercises`, persists a new
   `Workout` row (not yet completed).
6. User clicks "Build weekly review" → `POST /api/weekly-review` → filters
   workouts to the past 7 days, calls `generateWeeklyReview`, returns the
   summary.

---

## Setup

```bash
# 1. Install deps
bun install

# 2. Configure the database (absolute path required by Prisma + SQLite)
cp .env.example .env
# Edit .env to point DATABASE_URL at the project's own db/custom.db

# 3. Create the SQLite database + Prisma client
bun run db:push

# 4. Run the dev server
bun run dev
# Open http://localhost:3000

# 5. Run the tests
bun test
```

### Environment variables

| Variable           | Required | Description                                                  |
|--------------------|----------|--------------------------------------------------------------|
| `DATABASE_URL`     | yes      | Absolute `file:` path to the SQLite database.               |
| `PKC_DISABLE_LLM`  | no       | `1` forces the `MockProvider` (offline dev, tests).          |
| `ZAI_VISION_MODEL` | no       | Override the vision model used for form-check.              |

See `.env.example` for the canonical template.

---

## Tests

`bun test` runs **97 deterministic unit tests** across **9 spec files** — all
pure functions, no database, no network.

| Spec file                          | Tests | Coverage                                                   |
|------------------------------------|------:|------------------------------------------------------------|
| `exercise-data.test.ts`            |    15 | Every exercise has all required fields + valid enums        |
| `equipment-filter.test.ts`        |     6 | `[dumbbells]` → dumbbell + bodyweight only                  |
| `goal-mapper.test.ts`             |    10 | strength/hypertrophy/endurance rep × set × rest mapping    |
| `workout-generator.test.ts`       |    14 | Duration ≤ budget, equipment-aware, recovery-adjusted     |
| `progression.test.ts`             |    11 | +5 lb / +1 rep / no-change / first-time rules              |
| `form-check.test.ts`              |    16 | Prompt building + JSON parsing + mock fallback             |
| `recovery-adjuster.test.ts`       |     7 | fatigued → 80% sets + 120% rest; fresh → unchanged          |
| `weekly-review.test.ts`           |    10 | avgRPE > 8.5 → suggestedDeload; < 7.5 → false              |
| `ai.test.ts`                       |     9 | MockProvider deterministic form-check + suggestions         |

All tests are offline: the `MockProvider` is injected via
`__setChatProviderForTest`, and `PKC_DISABLE_LLM=1` is used to confirm the
fallback path.

---

## Project structure

```
79-ai-fitness-coach/
├── prisma/
│   └── schema.prisma              # UserProfile, Workout, FormCheck models
├── db/                            # SQLite db lives here (gitignored)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Geist fonts, Toaster)
│   │   ├── page.tsx               # 3-column app (profile / workout / review)
│   │   ├── globals.css           # Tailwind + theme tokens (copied from parent)
│   │   └── api/
│   │       ├── profiles/route.ts
│   │       ├── profiles/[id]/route.ts
│   │       ├── workouts/route.ts
│   │       ├── workouts/generate/route.ts
│   │       ├── workouts/[id]/route.ts
│   │       ├── workouts/[id]/progress/route.ts
│   │       ├── form-check/route.ts
│   │       ├── weekly-review/route.ts
│   │       ├── exercises/route.ts
│   │       └── stats/route.ts
│   ├── components/ui/              # shadcn/ui subset (button, card, dialog, ...)
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── use-mobile.ts
│   └── lib/
│       ├── exercise-data.ts       # 36-exercise library + enums
│       ├── equipment-filter.ts    # filterByEquipment
│       ├── goal-mapper.ts         # mapGoalToFocus + per-exercise scaling
│       ├── workout-generator.ts   # generateWorkout (the core pure fn)
│       ├── recovery-adjuster.ts   # adjustForRecovery (fatigued → 80/120)
│       ├── progression.ts         # nextWorkoutProgression
│       ├── form-check.ts          # prompt building + parse + mock + runFormCheck
│       ├── weekly-review.ts       # generateWeeklyReview
│       ├── ai.ts                  # ChatProvider (Zai + Mock), vision method
│       ├── db.ts                  # Prisma client singleton
│       ├── utils.ts               # cn() helper
│       └── __tests__/
│           └── *.test.ts          # 9 spec files, 97 tests
├── .env.example
├── .gitignore
├── LICENSE                        # MIT
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── components.json
└── eslint.config.mjs
```

---

## Case study

The most interesting parts of this build are the four pure, testable
functions that together make the coach "adaptive":

### Adaptive progression

`nextWorkoutProgression(history, currentWorkout)` is the heart of the
feedback loop. It encodes a tiny rule set that any strength coach would
recognise:

| Condition                                   | Next session               |
|----------------------------------------------|----------------------------|
| First time the exercise appears in history    | Use the default weight     |
| All sets completed + RPE ≤ 7                  | **+5 lb**                  |
| All sets completed + RPE 8–9                  | **+1 rep**                 |
| Sets failed (`completedSets < target`)       | No change (consolidate)    |
| RPE 10 (maxed)                               | No change (recover)        |

Because the function is pure, the rule set is exhaustively covered by 11
unit tests, and the API route is a thin glue layer that pulls history from
Prisma, calls the function, applies the suggestions via
`applyProgressionToWorkoutExercises`, and persists a new `Workout` row.

### Equipment-aware workouts

`filterByEquipment(exercises, owned)` is one of the simplest pieces in the
codebase — about 8 lines — but it's what makes the app actually usable for a
home-gym user (dumbbells only) vs. a commercial-gym user (everything). The
trick is that **bodyweight is implicitly always owned**, so a user with an
empty equipment list still gets push-ups, planks, and burpees. The workout
generator runs `filterByEquipment` first, then partitions by `phase` into
warmup / main / cooldown, then scales by goal focus, then trims to the
time budget.

### Recovery-adjusted volume

`adjustForRecovery(workout, recoveryState)` is where the "fatigued" toggle
actually does something physical to the workout: every main-block exercise
gets `Math.round(sets * 0.8)` (clamped to a minimum of 2 sets so a strength
movement still has work) and `Math.round(rest * 1.2)` rounded to the nearest
5 seconds. The total volume scales to ~80% because sets dropped but reps
and weight are preserved (we keep the relative intensity the user trains at,
just less of it). The function is pure and idempotent — calling it on a
"fresh" workout returns an unchanged copy.

### Form check (mocked MVP)

The MVP form-check flow is intentionally split into three pure pieces:
`buildFormCheckPrompt` (builds a deterministic prompt that names the
exercise, lists its common errors and cues, and asks for a JSON verdict),
`parseFormCheckResponse` (tolerates ```json fences and surrounding prose,
clamps unknown ratings to `needs_work`), and `mockFormCheck` (the
deterministic fallback that returns the canonical "looks good, keep chest
tall" string). `runFormCheck` stitches them together with an injectable
`callVision` so the unit tests stay offline. The API route wires the real
`getChatProvider().vision(...)` (which uses
`zai.chat.completions.createVision` when available, or the MockProvider
when `PKC_DISABLE_LLM=1`).

### What I'd do differently

- **Real MediaPipe pose estimation** — the LLM-vision form check is a
  reasonable MVP, but a real coach needs joint angles, not vibes. I'd swap
  `runFormCheck` for a `@tensorflow-models/pose-detection`-backed path:
  capture a short clip in-browser, run MoveNet per frame, project landmarks
  against a per-exercise form rule set, and emit concrete violations
  (e.g. "knee caved at frame 23: 11° medial of toe"). The pure parsing layer
  (`parseFormCheckResponse`) already accepts the right shape, so the UI
  wouldn't change.
- **Real wearable integration** — the `recoveryState` field is a manual
  dropdown. With a Whoop or Apple Watch integration, I'd replace it with a
  real HRV / sleep score → `fresh|moderate|fatigued` mapping, and let the
  coach auto-skip a planned session when recovery is poor.
- **Real group challenges** — share a weekly plan via a short link, log
  completion, and render a friends leaderboard. The progression + weekly
  review pieces are already per-profile, so adding a `group` table that
  references profiles would be a small change.
- **Real exercise library** — pull from a fitness API (e.g. Wger, which is
  open-source) instead of the hardcoded 36-exercise library. The
  `Exercise` interface is the contract — swapping the source means
  replacing `EXERCISES` with an async fetcher + a small cache.

### Resume bullet

> Built an AI-Powered Fitness Coach in Next.js 16 + TypeScript that generates
> equipment-aware, recovery-adjusted workouts from a 36-exercise library,
> drives adaptive progression (+5 lb / +1 rep rules) from per-session RPE,
> and ships an LLM-vision form-check flow with a deterministic offline mock;
> 97 pure-function unit tests across 9 spec files cover the entire domain
> logic with no database or network dependency.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Push to GitHub

```bash
gh repo create ai-fitness-coach --public --source=. --remote=origin --push
```
