# Changelog

## 0.5.0 — durable stage guidance (issue #11)

- Added a ten-stage StageEngine with persisted evidence-derived status, a single actionable next step, and cursor-based incremental events.
- Added three read-only MCP tools: `production_get_status`, `production_get_next_action`, `production_events`.
- Added operator-only editorial decisions with exact draft SHA-256 version checks and the ability to request revisions without implicit approvals.
- Preserved legacy story and workflow APIs; prevented legacy editorial approval of an explicitly rejected unchanged draft.
- Added restart/resume, idempotent event, uncertain provider response, and unverified-media tests. **No real video generation or final assembly is claimed**.


## Unreleased — finalization planning and documentation

- Added a concrete v1.0 delivery roadmap, product journey, target architecture, acceptance matrix, implementation runbook, contributing guide and documentation index.
- Added a provider-neutral Visual Production Director Skill for agent-guided, source-grounded planning.
- Added documentation link validation in CI (`npm run docs:check`), with a regression test.
- No claims of live Google Flow generation or final video export were added.

## 0.4.0 — Story-first guided planning

- Added `studio_story_start`, `studio_story_list`, `studio_story_status`, `studio_story_draft`, `studio_story_source`, `studio_story_submit_cast`, `studio_story_submit_storyboard` and `studio_story_prepare` MCP tools.
- Added durable source snapshot and SHA-256, literal excerpt provenance checks, cast/scene/shot schema checks, progress guide, source coverage warning and explicit operator-only editorial approval.
- Compiles a canonical production, immutable Flow DAG, character/location reference plans, frame-to-video shot dependencies, storyboard, character bible, runbook and edit order; **no remote generation implied**.
- Rejects adapter mappings that silently discard source frames, reference images, aspect ratio, duration or other supplied creative input.
- Introduces resumable drafts for multiple agents, complete Portuguese README, canonical examples, and tests for the new guided stages.
- CI now includes an actual MCP stdio handshake smoke test with the SDK; this verifies tool registration but not provider connectivity.
- Known gaps remain: real authenticated Flow adapter, automatic remote asset synchronization, result recovery/ingestion for workflows, final FFmpeg assembly and npm SDK handshake verification.


## 0.3.0 — Flow workflow foundation

- Added 23 documented Google Flow operations in an explicit, non-live capability catalog.
- Added immutable workflow DAGs, dependencies, local account binding checks and approval-aware credit reservation.
- Added operator-configured, schema-inspected upstream MCP mapping and guarded one-shot execution.
- Fixed false success when an upstream returns a prepared form/job ID without a positive submission state.
- Resolved canonical `asset:` and same-account `step:` inputs; blocked cross-account native IDs.
- Added workflow CLI commands, MCP tools, documentation and 27 local tests.
- **Not yet validated against authenticated Flow or Higgsfield accounts; no credits used.**

# Changelog

## 0.5.0 — durable stage guidance (issue #11)

- Added a ten-stage StageEngine with persisted evidence-derived status, a single actionable next step, and cursor-based incremental events.
- Added three read-only MCP tools: `production_get_status`, `production_get_next_action`, `production_events`.
- Added operator-only editorial decisions with exact draft SHA-256 version checks and the ability to request revisions without implicit approvals.
- Preserved legacy story and workflow APIs; prevented legacy editorial approval of an explicitly rejected unchanged draft.
- Added restart/resume, idempotent event, uncertain provider response, and unverified-media tests. **No real video generation or final assembly is claimed**.


## 0.2.0 — production metadata and media integrity

- Added reusable immutable character catalog keyed by explicit `libraryId@version` and reference hashes.
- Added remote binding hashes, versions and operator-reported provenance.
- Added per-account preflight diagnostics and an optional upstream MCP tool discovery probe.
- Added verified local media import, SHA-256 receipts, FFprobe video inspection, image signatures and mandatory pending editorial review.
- Restricted ambiguous job reconciliation and creative review to the local operator CLI; MCP clients cannot self-authorize paid job reconciliation.
- Made first state initialization atomic against competing readers using link-after-write.
- Expanded core reliability coverage from 6 to 12 Node tests.
- Explicitly documented unsupported live provider operations and prioritized Google Flow adapter backlog.

## 0.1.0 — initial foundation

- Canonical manifest import/export, account and native project bindings, independent budget planning, approvals and guarded upstream discovery/dispatch.
