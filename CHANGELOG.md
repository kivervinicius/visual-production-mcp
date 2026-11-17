# Changelog

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