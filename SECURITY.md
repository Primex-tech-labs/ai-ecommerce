# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| `main`  | ✅        |
| < 0.1.0 | ❌        |

## Reporting a Vulnerability

Please **do not open a public issue** for security problems.

Report privately via GitHub's [Security Advisories](https://github.com/Primex-tech-labs/ai-ecommerce/security/advisories/new)
or email **security@primextechlabs.dev** with:

- A description of the issue and its impact
- Reproduction steps or a proof of concept
- Affected component and version/commit
- Any suggested remediation

You can expect an acknowledgement within **72 hours** and a remediation plan
within **7 days** for valid reports.

## Scope

In scope:

- `apps/` (web storefront and API)
- `contracts/` (Soroban escrow)
- `packages/` (shared libraries)
- `infra/` and deployment configuration

Out of scope:

- Vulnerabilities in third-party dependencies (report upstream)
- Issues requiring physical access or social engineering

## Handling Secrets

Never commit secrets or private keys. Use `.env.example` for documented
variables and rotate any credential that is accidentally exposed.
