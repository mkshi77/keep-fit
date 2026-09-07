# Keep Fit Stitch Design QA

## Visual source of truth

- Stitch project: `13678073120661419526` (`Keep Fit Mobile Prototype`), refreshed 2026-09-07 13:10:42Z.
- Visible Design Freeze screens used: Today `0ab7863b152f457eb21c25fff7022ab1`, Workout `526e78fbb9a14f4c84bb0da5d9c28e7c`, Rest `f6c7a9bd4f244cef9dc5417f03523d7d`, Summary `78a82c6495bc4a4c9a9ae216244e6602`, Records `0001c68e22c546519579e9af4eda6adc`, Coach `c5414bcbf5ba418ebffa3a61e2622677`, Exercise feedback `9142355e8b924d8f88555356349db370`.
- Source captures: `/Users/shimk/Documents/Codex/2026-09-06/github-mkshi77-keep-keep-v2-index/work/stitch-audit/reference/latest-01-today.png` through `latest-07-feedback.png`.
- The visible `DESIGN.md (Final Patch)` screen is authoritative over the older project-theme metadata: PingFang SC/Noto Sans SC/system fallback, `#080808`/`#151515` surfaces, `#9EFF3F` accent, restrained radii, no glow, one primary action.

## Implementation evidence

- Browser: Codex in-app browser with a same-origin mock API; no production Notion or paid AI calls.
- Target viewport: 390 × 844 CSS px.
- E2E screenshots (DPR 3, 1170 × 2532 px):
  - `test-results/workout-flow.e2e.ts-390×84-bfb18-o-not-overflow-horizontally/today.png`
  - `test-results/workout-flow.e2e.ts-390×84-bfb18-o-not-overflow-horizontally/workout.png`
  - `test-results/workout-flow.e2e.ts-partia-d2420-nd-retries-with-the-same-id/summary.png`
- In-app browser captures:
  - `/Users/shimk/Documents/Codex/2026-09-06/github-mkshi77-keep-keep-v2-index/work/stitch-audit/implementation/new-02-workout.jpg`
  - `/Users/shimk/Documents/Codex/2026-09-06/github-mkshi77-keep-keep-v2-index/work/stitch-audit/implementation/final-05-records.jpg`
  - `/Users/shimk/Documents/Codex/2026-09-06/github-mkshi77-keep-keep-v2-index/work/stitch-audit/implementation/final-06-coach.jpg`

The Stitch source images were exported at 780 px width (2× the 390 px design width). Local source-review captures place those screens on a 1280 × 720 canvas. Comparisons normalized both source and implementation to the 390 px CSS width; the E2E evidence retains DPR 3 for text and edge inspection.

## State and interaction coverage

- Today: loading/fallback-ready layout, start, continue, completed and recovery labels; read-only exercise list; selected exercise detail.
- Workout: current exercise, current set, ± weight/reps controls, completed/pending set log, previous/skip/next/end actions.
- Rest: dedicated full-screen timer, -15s, +15s and skip.
- Exercise feedback: dedicated screen with RIR, asymmetry, discomfort and AI hand-off.
- Summary: completion metrics, non-blocking AI review, exercise rows, return and coach actions.
- Records: period selector, training summary, weight trend, quality summary and retained calendar/history.
- Coach: live workout context, suggested prompts, conversation history/new conversation and fixed composer.
- Primary interactions tested: start, selected exercise start, draft reload, partial finish confirmation, save failure and retry, submission-id reuse/regeneration, full workout, recovery, completed lockout, AI review success/failure behavior, and tab navigation.
- Browser console: no app error observed during the visual walkthrough.

## Required fidelity surfaces

- Fonts and typography: Chinese-first PingFang SC/Noto Sans SC/system stack; compact 10–14 px supporting text, 18–28 px headings, tabular numerals for timers and metrics. No Inter dependency or synthetic italic Chinese remains in the redesigned primary screens.
- Spacing and layout rhythm: 16 px page gutters, 8–16 px vertical gaps, restrained 12–16 px radii, fixed CTA above bottom navigation, and full-height workout sub-states. The 390 × 844 E2E check reports no horizontal overflow.
- Colors and tokens: near-black background, two neutral surface elevations, muted gray hierarchy, and lime restricted to active state, CTA, completion, progress and timer cues.
- Image quality and assets: direct Notion/YouTube covers are used when available; local MP4 files provide a real video frame; the existing Keep Fit mark is the neutral fallback. No incorrect deadlift/RDL substitution and no generated CSS-art cover.
- Copy and content: labels follow the Chinese Design Freeze screens; A/B/C, plan sets/reps/weight, RIR, asymmetry, discomfort, live context and completion language remain bound to real app state.

## Full-view and focused comparison evidence

- Full-view comparisons were inspected for Today, Rest and Summary using the paired Stitch source and 390 × 844 browser screenshots in the same comparison pass.
- Focused comparisons covered Today CTA/navigation, workout current-set controls and set log, the rest timer/control row, feedback scales, summary metrics/actions, Records cards, and Coach header/context/composer. Focused evidence was necessary because the source exports place the mobile frame inside a large dark canvas.

## Comparison history

1. Initial P1: Today used a large brand header and summary card, pushing the primary CTA and navigation below the first viewport. Fix: replaced the brand block with the compact date/title/plan header and fixed the CTA above navigation. Post-fix evidence: E2E `today.png`.
2. Initial P1: rest timer and exercise feedback were embedded together at the bottom of the workout page and could overlap. Fix: introduced mutually exclusive full-screen Workout, Rest and Exercise Feedback states. Post-fix evidence: E2E `workout.png` and in-app feedback capture.
3. Initial P2: workout lacked the Design Freeze set hierarchy and explicit adjustment controls. Fix: current-set hero, completed/pending set log, ±2.5 kg and ±1 rep controls, and four-action footer.
4. Initial P2: Records retained the legacy weight/heatmap-only hierarchy. Fix: added period selection, weekly metrics, training-quality summary and grouped the retained WeightChart/StatsOverview below the new hierarchy. Post-fix evidence: `final-05-records.jpg`.
5. Initial P2: Coach used a large empty-state hero and developer-oriented labels. Fix: compact header, live context, assistant message, prompt chips and bottom composer. Post-fix evidence: `final-06-coach.jpg`.
6. Initial P2: generic fallback thumbnails were synthetic CSS art. Fix: direct cover image, local video frame or existing Keep Fit image asset only.

## Findings

No actionable P0/P1/P2 visual mismatch remains in the tested Design Freeze path. Minor P3 differences are intentional: the settings entry remains available on Today, Records retains the existing history heatmap below the Stitch summary, and fallback training thumbnails use the product mark when Notion has no direct thumbnail or local MP4.

## Final result

passed
