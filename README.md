# Visual Production MCP

[![CI](https://github.com/kivervinicius/visual-production-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/kivervinicius/visual-production-mcp/actions/workflows/ci.yml)

**v0.3.0 — experimental, local-first production coordinator.** Not a working end-to-end Google Flow / Higgsfield video generator yet.

A provider-neutral Model Context Protocol (MCP) server to help coding agents such as Codex and Antigravity plan audiovisual productions, share **immutable character identities** across episodes, track account-local projects, allocate independent per-account budgets and preserve downloaded results.

**Important:** A canonical production in this repository is **not** a Google Flow project. Provider-local projects must be created, populated and verified separately. This project does not transfer Google credits between accounts, bypass provider restrictions or make private APIs official.

## New in v0.3: Google Flow workflows

- A canonical **23-operation Flow catalog**, covering image, video, frame-to-video, ingredients, video edit/extend, scenes, characters, asset organization, Flow Agent and custom Flow Tools. This is a **documented-product catalog, not verified live automation**.
- Immutable DAG workflows (`studio_workflow_import`) with dependency checks, account-scoped references, explicit spend estimates and recovery-safe states. Plan/inspect/execute steps independently.
- Operator-owned adapter mappings that bind operation-specific inputs to **discovered real upstream MCP tools**. A schema preflight runs before any dispatch attempt.
- Workflow execution is one-shot, human-approved and fail-closed. A returned `jobId` **without evidence of actual submission** does not count as successful paid generation.
- Cross-account native media IDs are rejected; the transfer path is canonical download/import/rebind, not ID reuse.
- 27 local automated tests. Provider login, actual Flow generation and end-to-end video delivery **not yet validated**.

See [Flow workflow contract](docs/FLOW_WORKFLOWS.md), [example workflow](examples/workflow.flow.example.json) and [example adapter](examples/adapters.example.json).

## What works now

- Local `production.json` import/export with path validation and SHA-256-addressed reference files.
- Versioned cross-project character registry using an explicit `libraryId` (e.g. `arquivo-amanha/vesper`) and immutable `version` / reference hashes; projects without `libraryId` are scoped by project ID.
- Account-specific native project, asset and character bindings. `studio_sync_plan` reports missing dependencies. Bindings are operator-reported until an adapter verifies them.
- Independent, operator-entered credit estimates. Job planning is idempotent, and paid dispatch requires explicit local operator approval. No automatic account rotation or retries after ambiguous submissions.
- Read-only `studio_preflight`: missing references, local upstream configuration and optionally discovered MCP tool names; it does **not** verify login or live balance.
- `studio_ingest_result`: requires a submitted provider operation ID, copies an existing local file into content-addressed storage, validates image signature or uses FFprobe to inspect video, records the hash and sets **editorial review to pending**.
- Local-only operator CLI for reconciliation of uncertain submissions and editorial approval/rejection.
- MCP v2 stdio host with upstream MCP discovery and a restrictive allowlisted dispatch bridge.
- 27 Node built-in tests (local core and simulated MCP adapter); provider/browser end-to-end tests remain outstanding.

## Install

Requires Node.js 20+, `npm` and FFprobe for importing videos.

```bash
npm install
npm run check
npm test
cp examples/upstreams.example.json .studio/upstreams.json  # create .studio first
```

Correct first-time setup:

```bash
mkdir -p .studio
cp examples/upstreams.example.json .studio/upstreams.json
```

In Codex, register the server with the absolute path after installing packages:

```bash
codex mcp add visual-production -- node /absolute/path/to/visual-production-mcp/src/server.mjs
```

Antigravity and other MCP hosts should use `command=node`, `args=[absolute path to src/server.mjs]`, and optionally `STUDIO_HOME=/absolute/workspace/.studio`. Avoid running several simultaneous **provider browser sessions** against the same Chrome profile. No Google credentials or cookies should be placed in source control.

## Workflow

1. Build a versioned production manifest from editorial source files (do not invent story details). `studio_import_project` registers the local production.
2. `studio_register_account` for each separately authorized provider session, setting `creditEstimate` from that account (not a global pool).
3. `studio_plan` creates a persistent set of independent shot jobs, defaulting to `awaiting_approval`.
4. For each assigned shot, `studio_sync_plan` describes missing resources on that account. Create them through a verified provider integration and `studio_bind_project` with native IDs.
5. `studio_preflight` checks local prerequisites. A human checks the real provider login, project, available options, expected credit quote and terms.
6. Human approves expenditure: `npm run operator -- approve <jobId>`. Dispatch via `studio_dispatch_job` only if upstream tool name/inputs can be verified. Upstream output is not assumed successful just because it returned text.
7. If a submission was ambiguous, inspect Flow **manually** and run `npm run operator -- reconcile <jobId> <externalJobId>` only after validating the operation. **Do not submit again automatically.**
8. Download the generated file through the provider's supported interface, then `studio_ingest_result` with that local path. Only an existing provider job with a known operation ID can be completed.
9. After inspecting story, continuity and visual quality, human runs `npm run operator -- review <jobId> approved|rejected [note]`.
10. `studio_bundle` exports the original canonical manifest and reference bytes; this does not clone a native Flow project.

## MCP tools (21)

| Tool | Purpose |
| --- | --- |
| `studio_status` | Account/project/job state |
| `studio_library` | Versioned character catalog |
| `studio_import_project` | Canonical manifest import |
| `studio_register_account` | Logical authorized account |
| `studio_update_balance` | Operator-entered balance estimate |
| `studio_bind_project` | Provider-specific native bindings |
| `studio_sync_plan` | Find missing remote characters and references |
| `studio_plan` | Idempotent shot assignment |
| `studio_preflight` | Read-only compatibility check |
| `studio_discover_upstream` | List real available upstream tool schemas |
| `studio_dispatch_job` | Guarded one-shot generation dispatch |
| `studio_record_failure` | Record provider failures/unknown submissions |
| `studio_ingest_result` | Hash and validate an existing media file |
| `studio_bundle` | Export a portable source package |

### Workflow-specific tools

`studio_flow_capabilities`, `studio_workflow_import`, `studio_workflow_list`, `studio_workflow_status`, `studio_workflow_plan`, `studio_workflow_inspect_step`, `studio_workflow_execute_step`.

**Human-only operations are intentionally not exposed via MCP**: approve credit spend, reconcile ambiguous submissions and approve editorial quality. An agent's self-declared `operatorConfirmed=true` is not sufficient authorization.

## Source layout

- `src/core.mjs`: production manifests, character catalog, account bindings, planning and job state.
- `src/upstream.mjs`: local MCP subprocess and guarded generation dispatch.
- `src/preflight.mjs`: read-only diagnostics; never requests paid generation.
- `src/media.mjs`: immutable result ingestion and manual editorial review.
- `src/server.mjs`: MCP tools; `src/cli.mjs`: local operator-only actions.
- `docs/BACKLOG.md`: audited blockers and prioritized milestones.
- `docs/ADAPTER_CONTRACT.md`: expected Google Flow / Higgsfield adapter boundary.
- `docs/REFERENCES.md`: external projects used as references; no third-party code copied.

## Limitations and policy

The server does not yet independently (a) create projects and upload reference characters into Google Flow, (b) clone projects between accounts, (c) verify live credit balances, (d) download Flow media, (e) generate videos through an authenticated account, or (f) assemble final episodes with FFmpeg. Real integration must be validated separately in each provider's permitted workflows.

Accounts remain separate. Do not automate signups, rotate accounts to evade rate limits, bypass CAPTCHAs, remove provenance marks, or call undocumented private endpoints. Your own account access does not guarantee that multi-account automation is permitted under provider terms.

License: MIT, original source only. State and media under `.studio/` are excluded from Git.