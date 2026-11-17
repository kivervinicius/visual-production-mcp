# Agent operating policy (Codex / Antigravity / other MCP clients)

1. The canonical `production.json` and its declared `source` repo/ref/path are the single source of truth. Never invent lines, characters, settings or shots absent from the approved material.
2. Separate production and provider projects: each provider account has independent project IDs, remote reference IDs and authentication. Never assume assets exist across accounts.
3. Reuse existing media first. For `Arquivo Amanhã`, preserve `MT-EP01-INICIOS-v1`; inventory it before adding anything.
4. First call `studio_status`, then `studio_sync_plan` to determine which references are actually missing. Never recreate an entire project as a shortcut.
5. `studio_plan` is safe/dry in terms of paid generation, but it stores reservations. Verify cost quotes in the live provider UI; credit estimates are manual, not authoritative.
6. Do not dispatch unless an operator explicitly approved the job through the CLI and confirmed the account's provider access, policy and balance.
7. If any job has `submission_unknown`, do not retry, rotate account, or call another paid generation for that shot. Reconcile based on provider UI and logs.
8. Do not use automation to evade service limits, CAPTCHA, paywalls or account protections. Surface limits and require authorized human intervention.
9. Never put auth tokens, passwords, cookies, emails or Chrome profile secrets in manifests, commits, screenshots or reports.
10. Before making a patch: run `npm test` and `npm run check`; add regression coverage for changed state transitions.
11. Prefer public, documented provider APIs where available; isolate browser automation behind replaceable adapters. Never invoke undocumented paid Google RPC endpoints directly.
12. If a provider is offline, report the limitation; do not simulate a real generation or fabricate resulting media files.

### v0.2 operational constraints

- Inspect `docs/BACKLOG.md` before claiming a provider integration is functional.
- Do not mark `submission_unknown` as confirmed through MCP; this requires the separate operator CLI.
- Media import verifies technical file format only. Creative review remains human-only.
- Use shared `libraryId` and immutable `version` to reuse characters across episodes; never silently mutate a published version.
- Do not invent real-time account credit balances, available models or a provider-native project import API.

## Flow workflows (v0.3.0)

- Read `docs/FLOW_WORKFLOWS.md` and `examples/workflow.flow.example.json` before starting any work.
- Never claim a documented Flow operation is supported by the installed upstream without `studio_workflow_inspect_step` and actual UI/session validation.
- The static operation catalog is not a live capabilities list. Always select a real model and duration after inspection.
- Do not edit source scripts or canonical character references to fit the generated video. Revise versioned input under a new ID when necessary.
- Only the local operator CLI approves paid or remote-mutating steps. Agent tools may import, plan, inspect, then execute **already approved** steps one at a time.
- An operation result is `submission_unknown` if it lacks positive provider status and ID. Never automatically re-submit such operations.
- No cross-account native IDs. Export/import and rebind references for any transfer; respect platform terms/quotas.