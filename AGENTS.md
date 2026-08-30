# Repository Guidelines

team-maker is an Astro 6 SSR app (React 19 islands, Tailwind 4, Supabase auth) deployed to Cloudflare Workers. Product and stack context live in @context/foundation/prd.md and @context/foundation/tech-stack.md.

## Hard rules

- `createClient()` in `src/lib/supabase.ts` returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset — both are `optional: true` in the `astro.config.mjs` env schema. Null-check it before every use, the way `src/middleware.ts` and `src/pages/api/auth/signin.ts` do.
- Read those secrets only from `astro:env/server`. Never `import.meta.env` or `process.env` for Supabase credentials.
- Auth API routes signal failure by redirecting with `?error=<encodeURIComponent(message)>`, not by returning JSON. Keep that shape.
- Never write to `context/archive/` — archived changes are immutable.
- No test runner is installed, and `zod` is not a dependency. Do not add test commands or zod validation unless asked.

## Commands

- Full script list: the `scripts` block in @package.json (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`).
- `npx astro sync` — regenerate `.astro/types.d.ts`. Not a script: run it by hand on a fresh clone before `lint`, as CI does, or type-checked rules fail on missing generated types.

## Project structure

Baseline layout: @README.md. What it omits — shadcn primitives sit in `src/components/ui/`, shared helpers in `src/lib/`, route protection in `src/middleware.ts`, and planning docs under `context/`, one folder per in-flight change at `context/changes/<change-id>/`.

## Conventions

- Import through the `@/*` alias (`./src/*`), not deep relative paths.
- Every page is server-rendered (`output: "server"`); do not add `prerender` exports — none exist today.
- Use React only where interactivity is needed, hydrated from `.astro` with `client:load`. Forms POST natively to `src/pages/api/`.
- PascalCase for Astro and React components; shadcn primitives stay lowercase (`ui/button.tsx`). Add them with `npx shadcn@latest add <name>` ("new-york" style).
- Merge Tailwind classes with `cn()` from `@/lib/utils`; do not concatenate class strings.
- Protect a route by adding its path to `PROTECTED_ROUTES` in `src/middleware.ts`.
- Prefix deliberately unused variables with `_`; `no-console` is a lint warning. Formatting is enforced by @.prettierrc.json via eslint-plugin-prettier.
- Node 22.14.0 (`.nvmrc`).

## Commits and CI

- Conventional Commits, scope optional: `feat:`, `docs(foundation):`.
- husky + lint-staged auto-fix staged files on commit (see `lint-staged` in @package.json).
- `.github/workflows/ci.yml` triggers only on `master`, but this repo's branch is `main` — CI does not currently run. Verify with `npm run lint && npm run build` before pushing.
