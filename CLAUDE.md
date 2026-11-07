# game-ledger: instructions for Claude Code

## What this is

A portfolio project: a wallet ledger and an event-sourced game-round service in TypeScript and PostgreSQL, with Terraform for AWS. People who review code read this repository, so small, clear changes matter more than speed.

## Who writes what

I write the core by hand: the ledger, its concurrency handling and idempotency in `wallet/`, the event-sourced rounds (later, in `rounds/`), and the Terraform in `infra/`.

- Change that code only when the task names it. You may read it, review it and write tests against it.
- If you find a bug or something worth refactoring there, report it. Do not fix it in passing.
- Stay inside the task. No drive-by renames, reformatting or dependency upgrades.

## Git

- You can commit, but never push to origin, on any branch. I push and open the pull requests.
- Work on a branch named `agent/<short-topic>`, never on `main`.
- One logical change per commit, with a message that says what changed and why. Keep the `Co-Authored-By` line.
- Never rewrite history: no amend, rebase or reset on commits you did not make in this session.

## Commands

```bash
npm ci                        # install
npm run typecheck             # tsc, type-check only
npm test                      # Node's built-in test runner, all workspaces
npm run lint                  # Biome: lint and format check
npm run format                # Biome: apply fixes
npm run dev -w wallet         # run one service with reload
docker compose up -d --wait   # PostgreSQL on localhost:5433
```

Before you commit, `npm run lint`, `npm run typecheck` and `npm test` must pass. Say in your summary what you ran and what you did not.

## Code rules

- Node 24 runs the TypeScript files directly. There is no build step and no `dist`.
- Relative imports end in `.ts`. Type-only imports use `import type`.
- No `enum`, no constructor parameter properties, no namespaces. Use union types or `as const` objects.
- Tests use `node:test` and `node:assert/strict`, in `<service>/test/*.test.ts`.
- Tests that touch the database run against the real PostgreSQL from `docker-compose.yml`, not mocks.
- Ask before adding a dependency.
- Never weaken or delete a test to make it pass.

## Infrastructure and secrets

- In `infra/` you may run `terraform fmt` and `terraform validate`. Never run `plan`, `apply` or `destroy`, and never run an `aws` command that changes anything.
- Never read, print or commit `.env` files or anything that looks like a credential.
