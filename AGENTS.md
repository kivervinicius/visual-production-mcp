# Agent operating contract (Codex, Antigravity and other MCP clients)

## Roadmap de conclusão (obrigatório para novos agentes)

Leia primeiro [docs/FINALIZATION_PLAN.md](docs/FINALIZATION_PLAN.md), [docs/TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md), [docs/PRODUCT_JOURNEY.md](docs/PRODUCT_JOURNEY.md), [docs/ACCEPTANCE_MATRIX.md](docs/ACCEPTANCE_MATRIX.md) e [docs/IMPLEMENTATION_RUNBOOK.md](docs/IMPLEMENTATION_RUNBOOK.md). Para produção guiada, utilize a [Skill visual-production-director](skills/visual-production-director/SKILL.md), quando o cliente suportar Skills; caso contrário siga este arquivo. O núcleo MCP, não a Skill, persistirá o estado e decidirá a próxima etapa. **Não marque proposta de contrato como ferramenta já implementada.**

## Guided progress on every new session (v0.5)

**Always consult `production_get_status` and `production_get_next_action`** for a known story before acting on the user's "continue". Use `production_events` with a saved cursor to report only new events and avoid duplicate warnings. The StageEngine uses ten phases and distinguishes `DRAFT_READY`, `AWAITING_APPROVAL`, `BLOCKED`, and `AWAITING_VERIFICATION` from completed work. Provider-reported completion does not prove a validated local asset or final movie. Read [StageEngine](docs/STAGE_ENGINE.md).

Editorial approval uses the operator-only `production-decision` CLI and a real `reviewVersion` SHA-256 from status. Never call shell commands to autoapprove on behalf of an agent. The legacy `story-approve` command remains for compatibility, but cannot override a rejected identical draft.

## When the user provides only a story

**Do not require the user to learn JSON, prompts, shot lists, model names or accounts.** Guide them with these seven MCP tools in this order:

1. `studio_story_start`: save the full original narrative; never overwrite an existing story ID with different text.
2. `studio_story_source`: read **every chunk** until `hasMore=false`, preserve all named entities and chronological beats.
3. `studio_story_submit_cast`: propose **only source-grounded** cast, environment and a coherent `visualStyle`. Each sourceExcerpt must match literal text. Any invented visual characteristic is flagged in `assumptions`, not misrepresented as story canon.
4. `studio_story_submit_storyboard`: build all scenes, then each shot with literal `sourceExcerpt`, `visualPrompt`, `motionPrompt`, duration, cast IDs and optionally camera/audio. Check `sourceCoveragePercent`; the goal is the full story without inventing missing scenes.
5. Stop for editorial review. Show scene count, shot order, style, character designs and assumptions. User/operator executes `npm run operator -- story-approve <storyId>`.
6. The user selects an **authorized, independently registered** provider account. Call `studio_story_prepare` with a manual video credit estimate to compile production/workflow/character bible/edit manifest. This does **not** call Flow.
7. `studio_workflow_plan` → `studio_workflow_inspect_step` → operator `workflow-approve` → `studio_workflow_execute_step` for individual operations only when adapter, exact account/project, quote and human consent are verified. Review each resulting image/video before relying on it.

For agent handoff or session recovery, use `studio_story_status` and `studio_story_draft`: the state is in the workspace, not in the chat history.

The human can ask to revise cast **before** storyboarding or storyboard **before** editorial approval. After approval, create a new version/ID instead of mutating the canonical narrative.

## Product constraints

- The original narrative is the source of truth. Do not rewrite dialog, add characters/events or skip narrative beats without asking the user. Original story quotes are required for every cast entity and shot.
- Canonical character IDs/references stay versioned; provider-native IDs are per-account and per-project. Don't leak or reuse a provider media ID in another account.
- Flow's product-operation catalog is not proof that an installed MCP implements every action. Always inspect actual tool names, JSON Schema, the exact authorized account, active project, model capabilities and real credit quote.
- Never treat `ready_for_confirmation`, a mere job ID without positive submission status, a screenshot of a form, or a mock as completed generation.
- Human-only actions (`story-approve`, `workflow-approve`, uncertain-submission reconciliation, editorial review) must **not** be self-approved by the agent.
- Avoid consuming credits on speculative/low-quality material: approve visual style/character sheets first, then reference images, then one shot, before batching the full episode.
- Do not bypass account quotas, bans, CAPTCHAs, anti-bot controls or conditions of the providers; never automate account creation or rotate accounts to evade limits.
- Secrets never go into prompt, repo, JSON manifests, logs or screenshots; operator's authenticated browser profile remains isolated.
- If upstream doesn't support references, frame-to-video, duration, quality or character operations, fail visibly. **Do not silently discard creative input or downgrade model/ratio**.

## Repo development rules

- Local source files use ESM Node and builtin test runner; keep core and guide tools runnable without network access.
- SDK MCP stdout is reserved for protocol traffic. Diagnostics go to stderr, never stdout.
- Tests must cover every state transition and unknown result, with simulated MCPs; do not mark mocked generations as verified live functionality.
- Maintain README.md and CHANGELOG.md when adding workflow stages and clarify status vs real provider integration.
- Check `npm run check`, `npm run docs:check` and `npm test`; SDK integration requires separate npm install and CI checks.
- Never claim media production succeeded without a verified provider operation and inspected original asset.

## Helpful pointers

- [Complete walkthrough](README.md)
- [Example story](examples/story.example.md), [cast](examples/cast.example.json), [storyboard](examples/storyboard.example.json)
- [Flow operations and contracts](docs/FLOW_WORKFLOWS.md)
- [Pending actual integrations](docs/IMPLEMENTATION_GAPS.md)

## F2 — Biblioteca visual

Antes de regenerar um personagem ou ambiente, consulte `studio_visual_list` e `studio_visual_get`. Não reutilize um ID remoto de outra conta; use o ID global e o hash aprovado, e programe upload ao projeto de destino. Não chame `studio_visual_propose` de aprovação: aprovação ocorre no CLI do operador com fingerprint conferido. Registre variantes de quadros com `studio_visual_shot_submit` e somente informe que um quadro está aprovado após `visual-shot-review` pelo operador. Se um modelo não suportar todas as referências, **falhe explicitamente**; não descarte ingredientes silenciosamente. Para instruções completas, consulte [Biblioteca visual](docs/VISUAL_LIBRARY.md).

## Flow live bridge F3 (v0.7)

Para uma conta Google Flow autorizada, prefira `studio_flow_live_account` e `studio_flow_live_step` antes de executar. A bridge v0.7 é limitada a `image.generate` sem referências e `video.text`. Não converter `video.frames` nem `video.ingredients` em `video.text`, não apagar `referenceImages` ou startFrame para fazer a chamada passar. Aprovação financeira somente no CLI pelo operador. `studio_flow_submit_step` permite **uma submissão**, e `studio_flow_reconcile_step` consulta o mesmo job. Sem conta autenticada e mídia real validada, informe `BLOCKED`/`NOT_LIVE_TESTED` e não invente sucesso. Veja [docs/FLOW_LIVE_BRIDGE.md](docs/FLOW_LIVE_BRIDGE.md).

## Media Composer v0.8 — evidence boundary

- Read `docs/MEDIA_COMPOSER.md` before preparing any local render. Use `production_render_story_plan` to inspect an approved account-free story and operator `render-export <storyId>` to create its local package. Use `production_render_template` to derive required shots and `production_render_plan` to check exact local media. Do not fabricate missing files or omit canonical shots.
- Render is an **operator-only CLI** action: `npm run operator -- render <RENDER_INPUTS.json>`. Do not call FFmpeg through generic shell tools in place of the validated contract unless the operator explicitly requests manual troubleshooting.
- `PREVIEW_RENDERED` proves a technically inspected local MP4, **not** editorial approval, Google Flow generation, or final DELIVERY.
- Never change an approved shot duration or map IDs from other projects to force a successful render; create new versions and request editorial approval instead.

## v0.8.1: selecting completed Flow videos for local render

Use `production_render_flow_link_plan` for read-only matching of archived provider jobs to an approved `video-*` storyboard slot. The agent must never select or approve footage itself: present the original and hashes to the operator. Only CLI `render-flow-attach <workflowId> <stepId> <packageDir> <clipSha256> <mappingSha256>` changes the render mapping. Keep all earlier mapping revisions and media immutable; run `render-plan` and `render` afterward. A completed provider job is **not** editorial approval. Read [FLOW_TO_RENDER.md](docs/FLOW_TO_RENDER.md).
