# Architecture

The system overview (PWA → Next.js on Vercel → Supabase + Anthropic) is in the [README](../README.md#architecture).
Per-feature design decisions live in `openspec/changes/*/design.md` (and `openspec/specs/` once archived).

## Nutrition

### Meal draft pipeline

Photo, text description, re-log and planned meals all become an unsaved **draft** that the user confirms.
The model reads the photo with the user's own key; nutrients come from USDA FoodData Central / Open Food Facts,
falling back to the model's labelled estimate. The server recomputes nutrients from per-100 g × grams on save.

```mermaid
sequenceDiagram
    autonumber
    box rgb(30,41,59) Client
    participant U as User (PWA)
    participant B as Browser (canvas)
    end
    box rgb(30,41,59) Server
    participant API as /api/meals/recognize
    participant M as Nutrient matcher
    participant DB as Supabase (Postgres + Storage)
    end
    box rgb(30,41,59) External
    participant C as Claude (claude-opus-5-5, user key)
    participant USDA as USDA FoodData Central
    participant OFFDB as Open Food Facts
    end

    U->>B: capture photo
    B->>B: resize ≤1568 px long edge, re-encode JPEG (drops EXIF)
    B->>API: POST /api/meals/photo (re-encoded again server-side)
    API->>DB: store meal-photos/{user_id}/{uuid}.jpg (private)
    B->>API: POST /api/meals/recognize {photoPath} | {description}
    API->>API: getAnthropicClient(userId) (MissingAiKeyError → 409)
    API->>DB: download photo (owner-only storage policy)
    API->>C: image/text + structured output schema (items[], per-100 g estimate)
    C-->>API: structured JSON (parsed_output)
    API->>API: Zod validate (1 retry on failure)
    par per item, 3 s timeout each
        API->>M: match(item)
        M->>USDA: search (generic foods)
        M->>OFFDB: search (branded / EU products)
        M-->>API: best match + alternatives | fallback "estimated"
    end
    API-->>U: MealDraft {items, matches, nutrients, confidence}
    U->>U: edit grams / swap / add / remove (client recompute)
    U->>API: POST /api/meals (confirmed draft)
    API->>API: Zod validate, recompute nutrients server-side
    API->>DB: insert meals + meal_items (RLS)
    DB-->>U: saved, totals refresh
```

### Daily target calculation

Targets are deterministic (`src/lib/nutrition/targets.ts`); the LLM never sets them. Today is recomputed on
every read, past days are frozen once stored.

```mermaid
graph TD
    subgraph Inputs
        P[Profile<br/>sex, age, height, lifestyle]:::info
        W[Trend weight]:::info
        BF[Latest confirmed BF%<br/>+ measured date]:::info
        G[Goal phase + rate]:::info
        A[Today's activities<br/>+ strength sessions]:::info
        H[28-day intake + weight history]:::info
    end

    BF --> Q1{BF ≤ 90 days old?}
    Q1 -- yes --> KM[BMR = 370 + 21.6 × LBM<br/>Katch-McArdle]:::ok
    Q1 -- no --> MSJ[BMR = Mifflin-St Jeor]:::warn
    P --> MSJ
    W --> MSJ
    KM --> BF_[baseline_f = BMR × NEAT]
    MSJ --> BF_
    H --> Q2{≥14 complete days<br/>and ≥10 weigh-ins?}
    Q2 -- yes --> AD[baseline = blend of<br/>observed and formula]:::ok
    Q2 -- no --> FO[baseline = baseline_f]:::warn
    BF_ --> AD
    BF_ --> FO
    A --> EX[exercise_kcal<br/>no double counting]
    AD --> MT[maintenance = baseline + exercise]
    FO --> MT
    EX --> MT
    G --> GA[goal adjustment<br/>cut / lean gain / recomposition / maintain]
    MT --> GA
    GA --> F1{target ≥ BMR?}
    F1 -- no --> R1[raise to BMR + warn]:::bad
    F1 -- yes --> F2{EA ≥ 30 kcal/kg FFM?}
    R1 --> F2
    F2 -- no --> R2[raise target + warn RED-S]:::bad
    F2 -- yes --> MAC[protein → fat → carbs remainder]
    R2 --> MAC
    MAC --> F3{carbs ≥ day-class floor?}
    F3 -- no --> R3[raise carbs and kcal + warn]:::warn
    F3 -- yes --> OUT[Targets + explanation]:::ok
    R3 --> OUT

    classDef default fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    classDef info fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    classDef ok fill:#1e293b,stroke:#22c55e,color:#e2e8f0
    classDef warn fill:#1e293b,stroke:#f59e0b,color:#e2e8f0
    classDef bad fill:#1e293b,stroke:#ef4444,color:#e2e8f0
```

## Coach

Pure logic lives in `src/lib/coach/` (phase, plan schema, guardrails, readiness, adjustments, planned energy, weekly review); `src/server/coach/` loads data, calls the model and persists. Specs and decisions: `openspec/changes/add-coach/`.

### Weekly plan generation

```mermaid
sequenceDiagram
  autonumber
  box rgb(30,41,59) Client
    participant U as Coach tab
  end
  box rgb(30,41,59) Server
    participant R as POST /api/coach/plan
    participant DB as Supabase (RLS)
    participant V as validatePlan (pure)
  end
  box rgb(30,41,59) External
    participant C as Claude Opus 5.5 (user's key)
  end
  U->>R: generate(week_start)
  R->>DB: preferences, profile, goal, 4 weeks of activities + sets, exercise library
  R->>R: buildPlanContext() (aggregates only) + closed exercise list (refs e1…eN)
  R->>C: structured output (ModelWeekPlanSchema)
  C-->>R: plan
  R->>V: map refs → library ids, WeekPlanSchema, 7 guardrails
  alt violations or invalid
    R->>C: one repair: previous plan + every problem
    C-->>R: plan
    R->>V: re-validate
    alt still structurally invalid
      R-->>U: error + retry (nothing saved)
    end
  end
  R->>DB: training_plans (draft, warnings) + planned_sessions
  U->>U: edits re-run validatePlan in the browser
  U->>R: accept(acknowledged)
  R->>V: re-validate server-side
  R->>DB: accept_training_plan() supersedes the week's active plan
```

### Daily readiness and session adjustment

```mermaid
graph TD
  subgraph Client
    CI[Check-in<br/>sleep, soreness, energy, stress 1–5<br/>+ optional pain flag]
  end
  subgraph Server
    SIG[Signals vs 28-day baseline<br/>needs ≥ 14 days, else unavailable]
    PAIN{Pain flag?}
    RED{Mean ≤ 2.0<br/>or ≥ 3 negatives<br/>or ≥ 2 negatives and mean < 3?}
    AMB{Mean < 3<br/>or any item = 1<br/>or ≥ 1 negative?}
    R[RED<br/>rest · mobility · walk ≤ 30 min<br/>pain → see a professional]
    A[AMBER<br/>quality → easy same duration<br/>long −25% · strength −1 set, RPE ≤ 8]
    G[GREEN<br/>as planned]
    CH{Use suggestion<br/>or keep original}
    NUT[Open planned sessions → estimated energy<br/>→ nutrition targets until recorded]
  end
  CI --> PAIN
  SIG --> RED
  PAIN -- yes --> R
  PAIN -- no --> RED
  RED -- yes --> R
  RED -- no --> AMB
  AMB -- yes --> A
  AMB -- no --> G
  R --> CH
  A --> CH
  G --> NUT
  CH --> NUT

  style CI fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style SIG fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style PAIN fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style RED fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style AMB fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style CH fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style NUT fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
  style R fill:#1e293b,stroke:#ef4444,color:#e2e8f0
  style A fill:#1e293b,stroke:#f59e0b,color:#e2e8f0
  style G fill:#1e293b,stroke:#22c55e,color:#e2e8f0
```

Auto-completion: after a workout session is created, a FIT run is imported or Apple Health workouts are ingested, `syncPlannedCompletions` links each new item to the earliest open compatible session of the active plan on the same local date (one item → one session). Manual mark/skip/undo sets `manual` and is never overridden.
