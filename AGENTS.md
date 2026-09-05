# Repository Guidelines

team-maker is an Astro 6 SSR app (React 19 islands, Tailwind 4, Supabase auth) deployed to Cloudflare Workers. Product and stack context live in @context/foundation/prd.md and @context/foundation/tech-stack.md.

## Hard rules

- `createClient()` in `src/lib/supabase.ts` returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset — both are `optional: true` in the `astro.config.mjs` env schema. Null-check it before every use, the way `src/middleware.ts` and `src/pages/api/auth/signin.ts` do.
- Read those secrets only from `astro:env/server`. Never `import.meta.env` or `process.env` for Supabase credentials.
- Auth API routes signal failure by redirecting with `?error=<encodeURIComponent(message)>`, not by returning JSON. Keep that shape.
- Never write to `context/archive/` — archived changes are immutable.
- The test runner is Vitest: `npm test` runs `vitest run` (single pass, no watch) over `src/**/*.test.ts`. Tests are pure — they must not bootstrap Astro or Supabase, so nothing under test may import `astro:*` or `@/lib/supabase`. `zod` is still not a dependency; do not add zod validation unless asked.
- Deploy target is Cloudflare **Workers with static assets**, not Cloudflare Pages — `@astrojs/cloudflare` v13+ dropped Pages support. The deploy command is `npx wrangler deploy`; `wrangler pages deploy` is wrong and will fail.
- Local dev is `npm run dev` — Astro 6 runs the real `workerd` runtime through the Cloudflare Vite plugin. Do not use `wrangler dev`. Local secrets live in `.env` (gitignored; wrangler 4.90 loads it the same way it loads `.dev.vars`), production secrets in `npx wrangler secret put <NAME>`.
- Never run `supabase config push`. `supabase/config.toml` configures the **local** `supabase start` stack only; the hosted project is configured in the Supabase dashboard. The project **is linked** (since 2026-09-05, for `supabase db push`), so the command would work — and the CLI may even suggest it after `link`. Pushing would send `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]` and the `email_sent = 2` rate limit to production, pointing production email links at localhost. The only sanctioned path to the hosted database is `supabase db push`, which applies `supabase/migrations/` and nothing else.
- Email confirmation is ON in production and OFF in `config.toml` (`enable_confirmations`, line 209). That split is deliberate — see `context/deployment/deploy-plan.md`. Do not "fix" it.

## Commands

- Full script list: the `scripts` block in @package.json (`dev`, `build`, `preview`, `lint`, `lint:fix`, `format`, `test`).
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
- Data modules in `src/lib/` (e.g. `character-pool-repo.ts`) take the Supabase client as an argument and **throw** `Error` on query failure or impossible state (empty pool) — they never swallow. Callers in pages and API routes must catch and map to `?error=` or a page state; an uncaught throw in the Worker is a 500.
- Prefix deliberately unused variables with `_`; `no-console` is a lint warning. Formatting is enforced by @.prettierrc.json via eslint-plugin-prettier.
- Node 22.14.0 (`.nvmrc`).

## Commits and CI

- Conventional Commits, scope optional: `feat:`, `docs(foundation):`.
- husky + lint-staged auto-fix staged files on commit (see `lint-staged` in @package.json).
- `.github/workflows/ci.yml` runs on `main` for both push and pull requests: `npx astro sync`, then `npm run lint`, then `npm test`, then `npm run build`. Run those four locally before pushing. `npm test` sits before `build` on purpose — `build` is the only step that needs the Supabase secrets, so the tests still signal on runs without them.
