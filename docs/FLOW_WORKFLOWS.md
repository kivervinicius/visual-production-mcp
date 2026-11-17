# Google Flow: versioned workflow orchestration (v0.3.0)

The **Flow product catalog** is distinct from **live account capabilities** and **upstream MCP tool support**. The 23 operations currently enumerated in `src/flow-operations.mjs` represent documented product concepts, NOT 19 implemented/verified browser automations.

## Concepts

- **Canonical project**: local approved original scripts, character bible, reference images and hashes. Import it with `studio_import_project`; keep its editorial source in Git.
- **Flow project binding**: account-specific native project, character and asset IDs. One account cannot reuse another account's native IDs.
- **Workflow**: immutable DAG of operations such as `image.generate`, `video.frames`, `scene.compose`. A step refers to earlier outputs with `step:opening-frame`, or imported canonical assets with `asset:reference-id`.
- **Adapter**: operator-owned `.studio/adapters.json` mapping each canonical operation to an *actually installed* upstream MCP tool and its parameter schema. No random tool names or arbitrary code run in a mapping.
- **Approval**: mandatory CLI operator confirmation for **every remote-mutating workflow step**, including image requests, which may use daily generation quotas instead of monthly video credits.
- **Submission evidence**: remote operation ID **and** positive provider status. A prepared form, tool error, missing status or unclear response becomes `submission_unknown`, never success.
- **Completion evidence**: an operator reconciles the output in Flow before marking `completed`. Auto-download/correlation and media validation for workflow steps are future work; completion currently stores *operator-reported*, not independently verified, evidence.

## Current operation groups

| Group | Operations | Notes |
|---|---|---|
| Project | `project.create` | Must bind newly-created native ID afterward |
| Assets | `asset.upload`, `asset.organize`, `asset.export` | Asset upload requires real adapter |
| Characters | `character.create`, `character.update`, `avatar.create`, `voice.create` | The local character bible remains immutable |
| Images | `image.generate`, `image.edit`, `image.upscale` | Image daily quotas may apply; not assumed free/unlimited |
| Videos | `video.text`, `video.frames`, `video.ingredients`, `video.edit`, `video.extend`, `video.upscale` | Model and plan eligibility inspected live; no silent fallback |
| Scenes | `scene.compose`, `scene.export` | Actual Scenebuilder support depends on adapter |
| Flow Agent | `agent.prompt` | May create or edit media; never automatically classified read-only |
| Custom Flow Tools | `tool.create`, `tool.update`, `tool.run` | Not the same as MCP tools; Flow custom mini-apps have own quotas |

## Local setup

```bash
npm install
npm test
mkdir -p .studio
cp examples/upstreams.example.json .studio/upstreams.json
cp examples/adapters.example.json .studio/adapters.json
# Review the actual upstream schema and edit adapters.json before any paid operation.
npm run operator -- import examples/production.example.json
# Register an AUTHORIZED account via studio_register_account; use id "g1" for the sample.
npm run operator -- workflow-import examples/workflow.flow.example.json
npm run operator -- workflow-plan demo-story-001
```

The sample DAG intentionally will **not run end-to-end without a real, authenticated provider adapter**. It creates a Flow project, generates a still, animates the still as a start frame, and arranges the result in a scene. After project creation, manually verify and register the returned project ID via `studio_bind_project`. Likewise, all subsequent operator confirmations are separate. This prevents fictional project IDs and wrong-account uploads.

### Agent tool contract

- `studio_flow_capabilities`: static documented surface, **not live capabilities**.
- `studio_workflow_import`: immutable manifest import, no provider operations.
- `studio_workflow_list`, `studio_workflow_status`, `studio_workflow_plan`: read-only state and DAG readiness.
- `studio_workflow_inspect_step`: verifies installed upstream MCP tool, mapping and JSON Schema input shape; **does not prove** authenticated Flow workspace, available model or live credit balance.
- `studio_workflow_execute_step`: exactly one attempt for a separately approved step. Does not rotate accounts, silently modify prompts/models, or retry unknown submissions.

### Operator CLI

```bash
npm run operator -- workflow-approve demo-story-001 new-project
npm run operator -- workflow-reconcile demo-story-001 new-project PROVIDER_OPERATION_ID
npm run operator -- workflow-complete demo-story-001 new-project PROVIDER_PROJECT_ID "Manually verified in Flow project list"
```

A workflow step may also produce a provider asset ID. The completion `providerAssetId` field is generic; for project creation the operator must separately call `studio_bind_project` with the native **project** ID, and future versions will provide typed output schemas.

## What remains **not implemented**

1. Verified account authentication, browser session health, account-plan availability and model/cost quotes.
2. Real project creation, incremental reference sync, native character/voice creation, editing, Scenebuilder and Tool creation unless a compatible upstream actually provides each respective tool and the operator supplies a validated mapping.
3. Automated polling, correlating downloaded files to native operations, image/video QC for workflow steps, final FFmpeg editing and contact sheets.
4. High-throughput worker, persistent broker, SQLite WAL, retry/lease recovery.
5. Enforcing provider service terms programmatically. An operator must review terms, especially multi-account use and quotas. No CAPTCHA/rate-limit evasion or internal RPC calls.

## External references

- https://support.google.com/flow/answer/16353334
- https://support.google.com/flow/answer/16935718
- https://support.google.com/flow/answer/16729550
- https://support.google.com/flow/answer/16935308
- https://support.google.com/flow/answer/17104535
- https://support.google.com/flow/answer/17093911
- https://support.google.com/flow/answer/16352836