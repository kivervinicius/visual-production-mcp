# Priorities after v0.4: story-first production is local, provider generation is not

## Full end-to-end audit (2026-11-17)

| Stage | Implementation | Missing acceptance evidence |
| --- | --- | --- |
| Narrative intake and immutable version | Done (MCP + CLI; SHA-256) | OCR/PDF/DOCX ingestion and direct cloud document integration |
| Cast and environmental visual bible | Done as agent-assisted, source-anchored plan | Visual media creation in Flow and verified reference reuse |
| Scene segmentation / shot board | Done as agent-assisted, editor-approved plan | Automated semantic quality grading and narration/timing alignment |
| Character / environment reference images | DAG planned per account | Authentic image-generation adapter, image receipt, thumbnails, editorial comparison |
| Shot still images | DAG planned per account with reference dependencies | Verify image+reference support in actual installed Flow tools; preflight refuses dropped inputs |
| Video from start frame | DAG planned per account | Authenticated frame-to-video run, asset correlation, download, cost quote |
| SceneBuilder composition | Optional DAG operation | Adapter support and reliable exported clips |
| Audio, subtitles, edit and final MP4 | Edit manifest only | Audio pipeline, caption alignment, FFmpeg assembly, approved continuity report |
| Cross-account reuse | Canonical identity, hashes and local bindings | Authorized multi-account transfer and actual incremental provider hydration, subject to terms |

**The repository is not yet a zero-touch video generator.** A single approved user narrative can now produce a tested local plan. It cannot independently render and deliver a finished video without a working provider bridge.

## Next engineering tasks (recommended order)

1. Connect one approved Google Flow upstream, probe tools/schema/auth/project and actual model capabilities; confirm one image from a character brief.
2. Upload/reuse a reference in the same account and generate one shot image with the exact references intact.
3. Generate one paid video from that verified image, correlate job->asset and ingest original media with SHA-256/FFprobe.
4. Editorial review gate and first reproducible local MP4 export from verified files.
5. Persist explicit per-account live quotes, lease/resume crash recovery, provider-side health and circuit breakers.
6. Incremental canonical reference hydration in a second account only if permitted by the provider; never reuse native IDs.
7. Progressively homologate Flow's advanced editing, SceneBuilder, Agent, Tools, avatars and voices; then Higgsfield.

---

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

## Atualização F2 / v0.6

Biblioteca visual versionada, impacto por plano e seleção editorial de stills estão implementados **apenas localmente**. Ao compilar um roteiro que fixa uma referência aprovada, o compilador cria um passo `asset.upload` por conteúdo SHA-256, sem gerar novamente a imagem de personagem/local. Isto não equivale à homologação de upload real em Flow. O mapeamento operador-confirma `providerAssetId` precisa ser testado com bridge autenticada. Ver [VISUAL_LIBRARY.md](VISUAL_LIBRARY.md), [issue #12](https://github.com/kivervinicius/visual-production-mcp/issues/12).

## Atualização F3 / v0.7 (bridge parcial)

O adaptador `src/providers/google-flow/miyakejima.mjs` implementa inspeção live de conta/capabilities e um caminho controlado de geração de **imagem sem referências** e **vídeo somente por texto** via MCP upstream independente. Poll e download do mesmo UUID são possíveis, com re-hash e validação local. Essa implementação não garante autenticação efetiva ou produção ao vivo no ambiente do desenvolvedor; um teste autenticado do operador é necessário. `asset.upload`, `video.frames`, `video.ingredients`, native project ID e live quote continuam como bloqueios para o episódio completo. Referência operacional: [FLOW_LIVE_BRIDGE.md](FLOW_LIVE_BRIDGE.md).
