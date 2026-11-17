# Provider adapter contract (design target, not implemented as a generic interface yet)

The core must not know Playwright selectors, browser cookies, undocumented RPC IDs, model-specific endpoints or provider credit schedules.

A provider adapter should expose these **separate** capabilities:

1. `inspectSession()` → verified account identity, consent/access state, provider service availability; credentials remain in that adapter's secure local profile.
2. `inspectCapabilities()` → supported media, models, aspect ratios, duration, required reference formats, pricing / credit quotes when displayed.
3. `findProject(canonicalProjectId)` and `createProject()` → native IDs and deterministic association. Project clone across accounts must **not** be assumed available.
4. `ensureReferences(projectId, sha256[])` → inspect already uploaded reference media and upload only missing hashes, with explicit native IDs.
5. `ensureCharacters(libraryId, version, imageHashes[])` → upsert only if the provider actually supports native characters; otherwise declare image-only reference strategy explicitly.
6. `prepareShot(shot, nativeProject, referenceMappings)` → validated, exact provider arguments without spending credits. Must report unsupported features without silently substituting.
7. `quoteShot(prepared)` → live credit quote where supported; return `unknown` otherwise.
8. `submitApproved(prepared, approvedJobId)` → a single paid attempt with persistent provider operation ID or `submission_unknown`.
9. `reconcile(operationId)` → read-only status and exact native media IDs; never blind retry.
10. `download(operationId, assetId)` → original supported export into sandbox, verify asset identity, hash the result.

All methods must use typed errors: `AUTH_REQUIRED`, `UI_CHANGED`, `PROJECT_MISMATCH`, `UNSUPPORTED_CAPABILITY`, `RATE_LIMITED`, `CREDIT_QUOTE_CHANGED`, `SUBMISSION_UNKNOWN`, `DOWNLOAD_FAILED`.

## Selected engineering references

- vener/Google-Flow-MCP: production story and continuity DAG, confirm-before-spend, abnormal activity stop signals.
- Souvik988/google-flow-mcp: durable job state machine, exact asset correlation, recovery of already generated output, FFprobe QC. **Do not copy the project's watermark-removal pipeline.**
- miyakejima/google-flow-mcp: account capability inspection and diagnostic screenshots, avoid model/ratio guessing.
- RohaanA/google-flow-mcp: native characters and reference transfer concerns.
- Higgsfield official MCP/API: prefer documented supported integration over scraping.

This is an integration specification, not a claim that any referenced MCP currently supports all methods. Verified live contract coverage must be tracked in an adapter test matrix before labeling an integration ready.