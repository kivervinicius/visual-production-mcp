# Engineering backlog — audited after v0.2.0

Status names: DONE = covered by local tests, PARTIAL = interface/guard exists but no live provider E2E, OPEN = not implemented. Never mistake a mocked or locally verified feature for an authenticated Flow operation.

| Priority | Work | State | Acceptance condition |
| --- | --- | --- | --- |
| P0 | Stable local manifests, hashes and character registry | DONE | Same `libraryId@version` never changes silently; 2 projects share the same canonical character digest |
| P0 | Provider session isolation and policy checks | PARTIAL | Each account binds a real session verified read-only; provider policy reviewed before bulk automation |
| P0 | Prevent double credit spend after timeout | DONE local | `submission_unknown` never retries; only operator CLI may reconcile using provider evidence |
| P0 | Provider adapter contracts | OPEN | Inspected MCP schema maps native project, reference, generation and job status; no agent-guessed arguments |
| P0 | Real Google Flow integration | OPEN | Can create one native project, sync references, submit and correlate one job using a single authenticated account |
| P0 | Cross-account replay | OPEN | With two authorized accounts, sync same source images and character definitions, verify changed remote IDs and no duplicate asset uploads |
| P1 | Persistent jobs and crash recovery | PARTIAL | JSON state persists under lock, but browser/job recovery still requires the upstream bridge and manual reconciliation |
| P1 | Technical media validation and provenance | DONE local | Validate real file, record SHA-256, bytes, video stream/geometry via ffprobe, never mutate original |
| P1 | Provider video download | OPEN | Correlate provider job ID with exact asset and save locally; no gallery-order assumptions |
| P1 | Provider-specific capability detection | PARTIAL | Contract discovered live; implementation must verify login/project/model/ratio/credits before submission |
| P1 | Review contact sheets/story continuity | OPEN | FFmpeg contact sheet + reviewable evidence; reject yields a *new* variant, not silent overwrite |
| P1 | Postproduction and export | OPEN | Deterministic edit manifest, subtitles, audio and FFmpeg output with approved shots only |
| P2 | SQLite WAL state backend | OPEN | Durable migrations, lease-based worker queue, multi-process contention and backup/restore tests |
| P2 | Higgsfield native adapter | OPEN | Use official MCP/API, discover actual capabilities and output IDs; no invented feature parity |
| P2 | Optional operations dashboard | OPEN | Local authenticated UI without storing secrets; show accounts, jobs, errors, approvals |
| P2 | Hardening and community release | OPEN | CI integration fixtures, supply-chain scanning, provider policy notes, signed release, reproducible packages |

## Engineering choices

- Build a clean independent repository, **not** a fork with hidden dependencies on one Flow UI release.
- Treat third-party MCPs as upstream implementations, not as libraries to merge wholesale. Do a license/quality review before copying code.
- Preserve source editorials and immutable media. The producer coordinates; it does not rewrite scripts or strip watermarks.
- Character references use a global `libraryId` and version. Native Flow/Higgsfield character IDs are only account-bound projections.
- One shot may have different provider results; avoid claiming bit-identical replay or guaranteed consistency across models.
- Credit estimates are informational until provider confirms costs. Explicit per-job operator approval remains necessary.