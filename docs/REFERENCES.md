# Engineering references (evaluate rather than blindly copy)

Readmes/release descriptions are not E2E compatibility evidence. No code from these third-party projects is vendored in v0.1.

| Repository | Potentially reusable idea | Validation required |
|---|---|---|
| https://github.com/miyakejima/google-flow-mcp | Live Flow capabilities, account sessions, local download validation, Codex/Antigravity integration | Install on Windows/Linux, check latest release/Flow UI, verify identity |
| https://github.com/wenlei-xu/flow-mcp | Per-profile OS advisory leases, browser pool | Confirm multi-account path and test session ownership |
| https://github.com/Mitanshp5/Google-Flow_MCP | Submission uncertainty circuit breaker, UI-vs-RPC cross-check, story DAG | Confirm policy, maintenance, safety and license |
| https://github.com/hainguyen-keyti/google-flow-mcp | Spend ledger and before/after balance guard, UI change survey | macOS-specific design; port only documented safety behaviors |
| https://github.com/vener/Google-Flow-MCP | Editorial script/character continuity/budget architecture | Audit actual source and tests, license |
| https://github.com/Souvik988/google-flow-mcp | Durable jobs and recovery, idempotency patterns | Audit actual source and tests, license |
| https://github.com/RohaanA/google-flow-mcp | Native Flow characters and scenes | Inspect maintenance and current UI |
| https://github.com/ParkSangGwon/google-flow-mcp | Diagnostics and simpler tool surface | Compare tool contract with alternatives |
| https://open.higgsfield.ai/quick-start | Official API lifecycle, reference upload, status/cancel | Verify model-specific costs and endpoint schemas |

Read the license in every upstream repo before copying implementation code. Prefer adapter interfaces + independent original implementations. Treat documentation as design evidence, not production verification.