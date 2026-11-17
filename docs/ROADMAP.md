# Roadmap and honest status

## P0 — Implemented locally, tests passing

- New dependency-light domain core with canonical manifests and per-account mappings.
- Content-addressed local reference library (SHA-256), bundle export, idempotent job planning.
- Independent manual account balances, no merged quota or credentials.
- Operator approval via local CLI, per-account dispatch cap, `submission_unknown` hold.
- Upstream MCP adapter supports tool discovery and allowlisted generation forwarding.

## P1 — Next: verify one real Google Flow session

Acceptance: connect to Flow MCP already authenticated in operator's Chrome; verify tool schema, account identity and ability to list account-local project and existing `MT-EP01-INICIOS-v1` without modifying it. Confirm current terms and account eligibility. No paid operation until dry run passes.

## P2 — First paid generation with evidence

Acceptance: create one trial shot from a genuine approved manifest, obtain persisted job/operation ID, fetch/download file, verify media hash and duration, record measured credits. Test uncertain-submit behavior. Document real browser selector versions.

## P3 — Portable references across accounts

Acceptance: with separately authorized account B, create its native project, upload only missing images, create/reuse character references, and generate one shot. Confirm that the original source project A is not modified. Never claim native project IDs or balances are transferable.

## P4 — Ten-account coordination (subject to provider permissions)

Acceptance: manually connect each profile, explicit operator authorization, checks of distinct profile identity/credits, fair scheduling, no double-charge, crash recovery, audit logs, account-specific isolation and suspension on service-imposed limits. Test with mock accounts first; never use extra accounts to bypass limits or protections.

## P5 — Higgsfield adapter

Acceptance: official API credentials in local secret manager; Elements and media reference support; job polling; pricing reconciliation; consistency comparison against same canonical references.

## P6 — Episodes and editing

Acceptance: extract approved episode shots from editorial repository, generate all required references and clips, independent quality review, FFmpeg edit list with sound/subtitles, deterministic artifacts and publish-ready vertical exports.

## Before public release

Pin dependency versions and lockfile; add lint/typechecking, integration test containers, storage migrations, audit event log, full user documentation, provider policy review, credential threat model, and verified licensing for any vendored parts.