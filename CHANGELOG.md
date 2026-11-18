# Changelog

## 0.8.1 — Flow archive → Media Composer (local bridge)

- Added read-only `production_render_flow_link_plan` for an existing completed Flow video with a content-addressed local receipt, verified job/account/story/shot, expected duration and ratio.
- Added operator-only `render-flow-plan` and `render-flow-attach`; selecting a clip preserves the original, existing variants and previous mapping revision, and atomically updates only the corresponding render slot.
- Render fingerprints and QC/RENDER manifests retain declared Flow job/asset provenance without equating technical completion with editorial approval.
- Added 8 tests with real MP4 inputs; no Google credentials, paid generation, or frames-mode support claimed.


## 0.8.0 — F4 Media Composer (local preview)

- Added an isolated FFmpeg/FFprobe renderer that consumes canonical `EDIT_MANIFEST.json` + `production.json` and explicit `RENDER_INPUTS.json`, supporting source images with micro-motions or local video clips.
- Added optional audio, SRT sidecar and MP4 subtitle track, H.264/AAC, technical QC, immutable fingerprinted renders and SHA-256 evidence.
- MCP exposes read-only `production_render_template` and `production_render_plan`; rendering itself is operator-only via `render-init`, `render-plan`, and `render`.
- New E2E offline tests create physical images/video/audio and verify a final MP4; no provider account or credits required.
- Remaining F4 work: image/clip QC beyond metadata, automatic mapping of Flow downloads, editorial delivery approval and recovery/queue scaling.


## 0.7.0 — Flow upstream bridge (F3 pilot, not live-certified)

- Added first-party adapter to the operator-managed `miyakejima/google-flow-mcp` tool contract with live account/profile inspection, capability/schema checks and single approved dispatch for image.generate/video.text.
- Added deterministic reconciliation/download of a single persistent Flow job, SHA-256 archive, image signature and FFprobe verification; editorial approval remains separate.
- Refuses silent mode changes, unsupported references/frames, account fallback and unverified model/ratio/duration; `submission_unknown` blocks retry.
- Added bridge tests, configuration example, MCP tools/CLI and complete operator guide; no authenticated provider generation claimed.


## 0.6.0 — F2: biblioteca visual e referências portáveis

- Identidades visuais globais versionadas (personagem/local/estilo/objeto), propostas imutáveis, aprovação CLI e hashes locais verificados.
- Candidatos de still por plano com seleção humana e histórico de variantes sem sobrescrever mídia.
- Compile histórias com referências aprovadas: cópias canônicas + asset.upload em vez de regenerar personagens/locais; versão fixada e validação de descrição.
- Vínculo de IDs de assets remoto no workflow após conclusão explicitamente conferida pelo operador (sem afirmação de verificação independente no Flow).
- Impacto seletivo por plano e progresso visual observável no StageEngine; eventos de decisões.
- Novas ferramentas studio_visual_*; testes de regressão para reutilização, integridade, múltiplas contas e concorrência.
- **Não implementado:** upload real, geração de frames e vídeo via Flow autenticado, montagem MP4, controle editorial automatizado de imagens.

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

## 0.8.0 — F4 Media Composer (local preview)

- Added an isolated FFmpeg/FFprobe renderer that consumes canonical `EDIT_MANIFEST.json` + `production.json` and explicit `RENDER_INPUTS.json`, supporting source images with micro-motions or local video clips.
- Added optional audio, SRT sidecar and MP4 subtitle track, H.264/AAC, technical QC, immutable fingerprinted renders and SHA-256 evidence.
- MCP exposes read-only `production_render_template` and `production_render_plan`; rendering itself is operator-only via `render-init`, `render-plan`, and `render`.
- New E2E offline tests create physical images/video/audio and verify a final MP4; no provider account or credits required.
- Remaining F4 work: image/clip QC beyond metadata, automatic mapping of Flow downloads, editorial delivery approval and recovery/queue scaling.


## 0.7.0 — Flow upstream bridge (F3 pilot, not live-certified)

- Added first-party adapter to the operator-managed `miyakejima/google-flow-mcp` tool contract with live account/profile inspection, capability/schema checks and single approved dispatch for image.generate/video.text.
- Added deterministic reconciliation/download of a single persistent Flow job, SHA-256 archive, image signature and FFprobe verification; editorial approval remains separate.
- Refuses silent mode changes, unsupported references/frames, account fallback and unverified model/ratio/duration; `submission_unknown` blocks retry.
- Added bridge tests, configuration example, MCP tools/CLI and complete operator guide; no authenticated provider generation claimed.


## 0.6.0 — F2: biblioteca visual e referências portáveis

- Identidades visuais globais versionadas (personagem/local/estilo/objeto), propostas imutáveis, aprovação CLI e hashes locais verificados.
- Candidatos de still por plano com seleção humana e histórico de variantes sem sobrescrever mídia.
- Compile histórias com referências aprovadas: cópias canônicas + asset.upload em vez de regenerar personagens/locais; versão fixada e validação de descrição.
- Vínculo de IDs de assets remoto no workflow após conclusão explicitamente conferida pelo operador (sem afirmação de verificação independente no Flow).
- Impacto seletivo por plano e progresso visual observável no StageEngine; eventos de decisões.
- Novas ferramentas studio_visual_*; testes de regressão para reutilização, integridade, múltiplas contas e concorrência.
- **Não implementado:** upload real, geração de frames e vídeo via Flow autenticado, montagem MP4, controle editorial automatizado de imagens.

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

## v0.8.2 — gflow-cli reference preflight

- Implemented read-only, hash-checked preparation for `video.frames` → `i2v` and `video.ingredients` → `r2v`.
- Added `studio_gflow_frame_plan`, CLI `flow-frame-plan [--live]`, schema/auth preflight and 13 fault/contract tests.
- Paid execution, native project confirmation and live credit quote remain deliberately unsupported until authenticated E2E validation.
