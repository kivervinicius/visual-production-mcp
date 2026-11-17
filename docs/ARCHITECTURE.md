# Architecture

## Boundaries

```
Codex / Antigravity / MCP agents
            |
   Visual Production MCP  <--- canonical source-controlled production.json
            |
  State + asset and media repository
   (.studio/state.json, .studio/assets/<sha256>.*, outputs/<job>/<sha256>.*)
            |
   Provider bridge (stdio MCP client)
       /                  \
Google Flow MCP         Higgsfield MCP/API (future)
per-account profile     per-project credentials
            |
 remote account-local projects and media
```

## Versioned entities

- `Production`: ID, versioned source location, title, references, characters, shots.
- `Asset`: local content hash and immutable bytes. External URLs are not a reliable cross-provider source of truth.
- `Character`: canonical `libraryId` and immutable version/description/reference SHA-256 values, with provider-neutral catalog. A `flowCharacterId` or `higgsfieldElementId` is *only a binding*.
- `Shot`: canonical prompt, aspect ratio, duration, characters, references, expected estimated credits. Prompt may be derived only from checked-out editorial material.
- `Account`: logical identity, provider, locally configured upstream bridge ID, manual credits, authorization, max parallelism. Passwords/cookies are never stored.
- `Binding`: canonical project + provider account => native project ID, remote asset IDs and remote character IDs.
- `Job`: canonical shot + provider + variant, assigned account, estimated credits, external job ID, state, eventual local result.

## Production flow

1. Validate and import versioned manifest, hash/store references.
2. Operator registers/authorizes accounts; all credit information is explicitly labeled estimated.
3. Allocate shots by capacity/budget, idempotently. No credit pooling or automatic rotation after exhaustion.
4. For each assigned account, `studio_sync_plan` reports only missing provider-local assets and characters. Create or upload them with a provider adapter and then record binding.
5. Operator explicitly approves each payable job.
6. Dispatcher uses a configured upstream MCP to attempt submission once.
7. A confirmed persistent operation ID means submitted; otherwise hold in `submission_unknown` and request reconciliation.
8. Import a previously downloaded provider file, hash and validate its technical format (implemented); provider polling/download not yet implemented.
9. Operator reviews output against editorial requirements; deterministic FFmpeg composition is a future milestone.

## State machine

```
awaiting_approval --[operator approve]--> approved
      |                                 | 
      +--[cancel]---------------------> cancelled
                                        |
                                        +--[claim]--> submitting
                                                     |    |    
                                          [job id] submitted   submission_unknown
                                                     |            |
                                               complete/failed  manually reconcile
```

A submission of unknown status MUST NOT be retried automatically. The v0.1 core keeps a durable state file with an atomic rename under a cross-process directory lock. A manual recovery process is required for an abandoned `.studio/state.lock`. For scale, replace the JSON state layer with SQLite (WAL, transactions, concurrency leases).

## Multi-provider design

A `Character` remains provider-neutral, but each provider can interpret it differently. Do not expose a fictional universal 'face lock': character consistency depends on model capabilities. Provider adapters should advertise real capabilities such as native characters, image references, end-frame conditioning, aspect ratios, motion inputs and export formats. Cross-account content should be *reconstructed from approved references and metadata*, never assumed identical byte-for-byte or cloned through unsupported APIs.

## Future data migration

A production can be re-imported unchanged. Changing content after jobs exist is deliberately blocked in v0.1, pending explicit production revision tooling. Do not silently overwrite prior approvals or affect generated jobs.

## v0.2 boundaries

The library is content-addressed and project-independent only when an explicit shared `libraryId` is provided. Provider media IDs and character IDs remain account-bound. Binding reports may be stale until inspected by a native adapter. `studio_preflight.localReady` is not a proof of authentication, available credits, or browser reliability. Unknown submissions cannot be accepted as successful from an MCP client; the local operator must reconcile an external operation ID.