# Beyond v0.3: Flow parity without a brittle browser robot

## Evidence-based prioritization

| Reference implementation | Feature to learn from | Decision | Why |
| --- | --- | --- | --- |
| vener/Google-Flow-MCP | Directed storyboard/character continuity DAG, spend confirmation, circuit breakers | PARTIAL now, extend later | Continuity and cost boundaries matter more than selectors |
| Souvik988/google-flow-mcp | Persisted jobs and recovered media outputs | NEXT | Lost downloads must not consume duplicate credits |
| miyakejima/google-flow-mcp | Live account capability inspection, exact job->asset correlation, Codex/Antigravity onboarding | NEXT | Avoid invalid models, mismatched account, wrong gallery item |
| RohaanA/google-flow-mcp | Character tools, provider-local characters | NEXT | Rebuild from canonical references rather than assuming ID portability |
| Google Flow official help | Agent, images, frames, ingredients, edit, extend, scenes, custom Tools, voices, avatars | Cataloged | Provider surface changes; capability gates must be inspected live |
| Higgsfield official MCP/API | Official adapter alternative | DEFER | Do not merge a second provider before Flow E2E is credible |

## Release milestones

### M0 — v0.3 delivered locally

- Operation catalog, immutable DAGs, account-scoped IDs, manual budget reservation, approval, upstream schema mapping, fail-closed responses, operator CLI, tests.
- No authenticated Flow credit-consuming E2E test; no "full Flow parity" claim.

### M1 — one authenticated account (issue #1)

- Verify signed-in workspace and exact account without extracting secrets.
- Detect model, image/video quota, dimensions, durations, live credit quote and selected Flow project.
- Implement project create or find, reference asset upload with verified digest, character create or fallback to images.
- Submit one approved render, correlate operation ID with media ID, inspect status, retrieve original and technical QC.
- Capture trace/screenshots on UI mismatch; stop on CAPTCHA, restriction, login failure and rate-limit signals.

### M2 — incremental cross-project sync (issue #2)

- Each account has its own persistent authenticated worker and explicit per-account consent.
- For each requested shot: compare canonical reference hash against remotely verified catalog, upload only missing references, maintain per-project translation map.
- Never reuse provider IDs across accounts; copy exported original reference bytes instead.
- Distinguish local estimated credits from live actual quote, enforce per-account budget approvals and limits.
- Test only a permitted secondary account after confirming applicable terms; no auto-rotation to bypass restrictions.

### M3 — episode delivery (issues #3 and #4)

- Durable scheduler with `CREATED`, `PREPARED`, `APPROVED`, `SUBMITTING`, `SUBMITTED`, `GENERATING`, `DOWNLOADING`, `REVIEW_REQUIRED`, `DONE`, `UNKNOWN`, `FAILED`.
- Operator intervention after unknown submission; reconcile rather than blindly retry.
- FFprobe inspect originals; FFmpeg contact sheet; human continuity/copyright review; export editing manifest and final episode.
- Preserve origin hashes, provider IDs, prompts, costs and media version lineage.

### M4 — Flow-specific advanced tools

- Scenebuilder clips/trimming, image draw/select, video edit and insert/remove/camera where available, Agent tools, avatar/voice management and custom Flow Tools.
- For each operation: versioned schema, feature detection, model eligibility matrix, rollback behavior, contract fixtures and explicit unsupported errors.

### M5 — Higgsfield and extensibility

- Provider-neutral character/shot schemas; first official Higgsfield API/MCP integration; no forced feature equivalence.
- Persistent local UI only after reliable operator CLI and MCP are established.

## Known technical debt

- `state.json` uses coarse-grained filesystem lock; a resilient scheduler should migrate to SQLite WAL, with migration and backups.
- Upstream stdio process starts independently per inspect/execute, wasting time and risking browser reconnection behavior; a per-account managed worker is preferred.
- `npm install` was not possible in the code-generation runtime because the registry was unavailable; v0.3 tests exercise pure Node and simulated upstream calls. The SDK's actual MCP handshake and external browser workflow still require local verification and CI.
- `studio_workflow_complete` is operator-reported evidence, not an independently verified provider media receipt.
- An image generated in an earlier step is represented by a provider-local asset ID; true cross-account reuse requires export -> canonical import -> new binding.
- SDK v2 is targeted; add a committed npm lockfile from a network-enabled environment for reproducibility.