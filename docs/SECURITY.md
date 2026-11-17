# Security, acceptable usage and billing

- **Separate accounts do not equal shared credits.** The server only assigns work to independently authorized accounts and maintains account-local bindings. It does not transfer, redeem or aggregate provider subscription credits.
- **Service restrictions take precedence.** Do not use multiple accounts to circumvent rate limits, usage caps, automated-access restrictions, subscription terms, or anti-abuse controls. Treat quotas and CAPTCHA as hold signals; never solve them through rotation or stealth.
- **Human spending approval.** Generation jobs start as `awaiting_approval`. MCP clients deliberately have no tool to authorize spending. The operator runs `npm run operator -- approve <job-id>` after reviewing the live price and account.
- **Manual credit reports.** v0.1 values are operator-entered, not queried live. Costs are estimates, not guarantees. The operator must check the provider price and available balance immediately before approving.
- **Separate authentication profiles.** Each upstream process should use its own authenticated Chrome profile or provider key. Do not share browser user-data directories concurrently or duplicate session tokens into the repo.
- **Subprocess trust boundary.** The `.studio/upstreams.json` file is trusted operator configuration; it contains executable paths. Do not accept upstream executable paths from agents, issue text or untrusted project manifests.
- **Indeterminate responses.** If an upstream returns success without a durable job identifier or throws after attempting a submission, the local state is `submission_unknown`. No automatic retry or reassignment.
- **MCP is not an access-control boundary.** Use an isolated local machine/user, explicit account permissions, limited filesystem access and a trusted agent client. Never expose the stdio service as a public endpoint.
- **Privacy and IP.** Only upload media the project has rights to use. Do not place real user assets, voice recordings, contact details or secrets in public repositories.
- **Project artifact security.** `.studio` is ignored by git. Bundle export contains local approved references; do not treat the bundle as safe to publish without a content review.

Relevant official policy/feature references: https://policies.google.com/terms , https://support.google.com/flow/answer/16526234 , https://support.google.com/flow/answer/16935308 , https://open.higgsfield.ai/quick-start .