# Security Policy

## Supported branch

Security fixes are applied to `main` and then released through the normal reviewed deployment process.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, private data, or steps that could endanger the production site.

Report suspected vulnerabilities privately to the repository owner. Include:

- A concise description of the issue
- The affected file, route, or component
- Reproduction steps that avoid destructive actions
- The expected and observed behavior
- Suggested remediation, when available

## Credential handling

Never commit API keys, passwords, access tokens, application passwords, service-role keys, private keys, `.env.local`, or production configuration values.

If a secret is exposed:

1. Revoke or rotate it immediately.
2. Remove it from the current codebase.
3. Assess repository history and logs.
4. Document the incident and remediation.

## Editorial safety boundary

Security controls must not remove the mandatory human-approval gate. CAIOS may research, draft, score, and recommend. It must not publish to WordPress or social platforms without explicit approval from The Chile.
