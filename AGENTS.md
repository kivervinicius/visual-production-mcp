# Agent operating contract (Codex, Antigravity and other MCP clients)

## Roadmap de conclusão (obrigatório para novos agentes)

Leia primeiro [docs/FINALIZATION_PLAN.md](docs/FINALIZATION_PLAN.md), [docs/TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md), [docs/PRODUCT_JOURNEY.md](docs/PRODUCT_JOURNEY.md), [docs/ACCEPTANCE_MATRIX.md](docs/ACCEPTANCE_MATRIX.md) e [docs/IMPLEMENTATION_RUNBOOK.md](docs/IMPLEMENTATION_RUNBOOK.md). Para produção guiada, utilize a [Skill visual-production-director](skills/visual-production-director/SKILL.md), quando o cliente suportar Skills; caso contrário siga este arquivo. O núcleo MCP, não a Skill, persistirá o estado e decidirá a próxima etapa. **Não marque proposta de contrato como ferramenta já implementada.**

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
