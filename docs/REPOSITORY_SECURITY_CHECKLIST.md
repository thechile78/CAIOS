# Repository Security Checklist

## Completed in code

- Minimal GitHub Actions permissions
- CI concurrency cancellation
- Critical dependency audit
- CodeQL workflow
- Dependabot configuration
- Pull request safety template
- Security reporting policy

## Lockfile policy

A `package-lock.json` is intentionally not included until it can be generated from the current `package.json` using a trusted environment with npm registry access.

Required command:

```bash
npm install
```

Review the generated diff, run the complete test suite, and only then update CI from `npm install` to `npm ci` and re-enable npm caching.

Never accept a placeholder, hand-written, truncated, or unrelated lockfile.

## Manual GitHub settings

Configure these in repository settings before production deployment:

1. Protect `main`.
2. Require pull requests before merging.
3. Require successful CI and CodeQL checks.
4. Require branches to be current before merging.
5. Block force pushes and branch deletion.
6. Enable vulnerability alerts.
7. Enable secret scanning and push protection where available.
8. Limit GitHub App and automation permissions to the minimum required.

## Deployment boundary

No pull request should deploy directly to production. Changes should pass CI, receive human approval, deploy to staging, and be verified before a separate production release.

## Editorial boundary

CAIOS may research, rank, summarize, and draft. It must not publish or schedule public content without explicit approval from The Chile.
