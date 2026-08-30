---
bootstrapped_at: 2026-08-30T09:33:09Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: team-maker
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim frontmatter from `context/foundation/tech-stack.md`:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: team-maker
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

team-maker to aplikacja webowa o małej skali, budowana solo po godzinach z dwutygodniowym
oknem na MVP, więc rozstrzygające jest to, ile da się nie budować. 10x Astro Starter dowozi
w pudełku dokładnie te dwie rzeczy, które PRD stawia jako warunki obowiązkowe: uwierzytelnianie
e-mail + hasło z bezpiecznym magazynem haseł (FR-001…FR-003) oraz PostgreSQL z izolacją
rekordów per konto (Guardrail izolacji danych, US-04) — jedno i drugie po stronie Supabase,
gdzie polityki Row Level Security egzekwują odcięcie cudzych drużyn na poziomie dostępu do
danych, a nie tylko przekierowaniem w interfejsie (FR-004). TypeScript w całym projekcie plus
schematy walidacji na granicach dają regule domenowej — siedem kompetencji, próg 2 punktów,
limity 6 członków i 2 perków — jedno miejsce egzekwowania, wspólne dla interfejsu i zapisu,
co jest wymagane przez Guardrail "zapisana drużyna zawsze spełnia próg". React 19 jako wyspy
interaktywne obsługuje wykres pajęczynowy przeliczany lokalnie poniżej 200 ms, bez potrzeby
realtime. Wdrożenie na Cloudflare Pages jest domyślnym wyjściem startera, a GitHub Actions
z auto-wdrożeniem po scaleniu domyka pętlę: PR → testy → wdrożenie. Stos przechodzi wszystkie
cztery bramki przyjazne dla agenta, więc nie potrzebuje kompensacji w CLAUDE.md.

## Pre-scaffold verification

| Signal      | Value                                                        | Severity | Notes                                                         |
| ----------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------- |
| npm package | not run                                                      | n/a      | `cmd_template` starts with `git clone`; no `create-*` CLI package to resolve |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-08-22T21:44:30Z | fresh    | from card `docs_url`; 8 days before this run                |

No stale signal. Proceeded without warning.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Upstream `.git/` removed before move-up**: yes
**Files moved**: 19 top-level entries (full recursive tree of the starter, including `node_modules/` from the chained `npm install`)

Moved: `.env.example`, `.github/`, `.gitignore`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `README.md`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules/`, `package-lock.json`, `package.json`, `public/`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`

**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold` (existing file wins; starter copy sidelined for diffing)
**`.gitignore` handling**: moved silently — cwd had no `.gitignore`, so no append-merge was needed
**`context/` handling**: starter shipped no `context/` paths; nothing dropped. Existing `context/` untouched.
**`.bootstrap-scaffold` cleanup**: deleted (no leftover paths)

**Toolchain note (WARN-AND-CONTINUE)**: `npm install` emitted `EBADENGINE` warnings — local Node is v20.19.0, the starter's `.nvmrc` pins 22.14.0 and `astro@6.3.1` requires `node >=22.12.0`. Install still completed with exit code 0, but `npm run dev` / `npm run build` may fail until Node 22 is active (`nvm use`).

## Post-scaffold audit

**Tool**: `npm audit --json`
**Exit code**: 1 (informational only — non-zero exit is normal when advisories exist; not a halt condition)
**Summary**: 1 CRITICAL, 13 HIGH, 7 MODERATE, 2 LOW (23 total across 895 dependencies: 449 prod, 316 dev, 131 optional)
**Direct vs transitive**: 0/1/2/0 direct of total 1/13/7/2. The single direct HIGH is `astro` itself; the direct MODERATEs are `supabase` and `wrangler`. Every other finding is transitive.

#### CRITICAL findings

- **tar** `<=7.5.20` — transitive; fix: available via npm audit fix
  - node-tar applies PAX size override to intermediary GNU long-name/long-link headers, causing tar parser interpretation differential (file smuggling)
  - node-tar: Process crash via PAX numeric path type confusion
  - node-tar: Decompression/parse DoS via unlimited input
  - node-tar: Negative tar entry size causes infinite loop in archive replace
  - node-tar: Uncaught Exception DoS via NUL byte in PAX path/linkpath records
  - node-tar: Uncontrolled recursion in mapHas/filesFilter allows uncatchable stack-overflow DoS via crafted long-path tar with member selection
  - https://github.com/advisories/GHSA-vmf3-w455-68vh
  - https://github.com/advisories/GHSA-w8wr-v893-vjvp
  - https://github.com/advisories/GHSA-23hp-3jrh-7fpw
  - https://github.com/advisories/GHSA-8x88-c5mf-7j5w
  - https://github.com/advisories/GHSA-gvwx-54wh-qm9j
  - https://github.com/advisories/GHSA-r292-9mhp-454m

#### HIGH findings

- **astro** `<=7.0.9` — direct dependency; fix: available via npm audit fix
  - Astro: XSS via Unescaped Attribute Names in Spread Props
  - Astro: XSS via unescaped spread attribute names in renderHTMLElement (incomplete fix for CVE-2026-54298)
  - Astro: Cross-site scripting via unescaped transition:* directive values on hydrated islands
  - Astro: Reflected XSS via unescaped View Transition animation properties
  - Astro: Host header SSRF in prerendered error page fetch
  - Astro: Reflected XSS via unescaped slot name
  - esbuild
  - sharp
  - https://github.com/advisories/GHSA-jrpj-wcv7-9fh9
  - https://github.com/advisories/GHSA-f48w-9m4c-m7f5
  - https://github.com/advisories/GHSA-7pw4-f3q4-r2p2
  - https://github.com/advisories/GHSA-4g3v-8h47-v7g6
  - https://github.com/advisories/GHSA-2pvr-wf23-7pc7
  - https://github.com/advisories/GHSA-8hv8-536x-4wqp
- **brace-expansion** `<=1.1.17 || 3.0.0 - 5.0.8` — transitive; fix: available via npm audit fix
  - brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups
  - brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash
  - brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation
  - https://github.com/advisories/GHSA-3jxr-9vmj-r5cp
  - https://github.com/advisories/GHSA-mh99-v99m-4gvg
  - https://github.com/advisories/GHSA-rgw5-rvv9-x895
- **devalue** `5.6.3 - 5.8.0` — transitive; fix: available via npm audit fix
  - Svelte devalue: DoS via sparse array deserialization
  - https://github.com/advisories/GHSA-77vg-94rm-hx3p
- **fast-uri** `3.0.0 - 3.1.4` — transitive; fix: available via npm audit fix
  - fast-uri vulnerable to host confusion via literal backslash authority delimiter
  - fast-uri vulnerable to host confusion via backslash authority introducer
  - fast-uri vulnerable to host confusion via failed IDN canonicalization
  - https://github.com/advisories/GHSA-v2hh-gcrm-f6hx
  - https://github.com/advisories/GHSA-7p8r-x3mc-p8w7
  - https://github.com/advisories/GHSA-4c8g-83qw-93j6
- **js-yaml** `4.0.0 - 4.3.0` — transitive; fix: available via npm audit fix
  - JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases
  - js-yaml: YAML merge-key chains can force quadratic CPU consumption
  - JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported
  - https://github.com/advisories/GHSA-h67p-54hq-rp68
  - https://github.com/advisories/GHSA-52cp-r559-cp3m
  - https://github.com/advisories/GHSA-5p4m-2wfm-xmqj
- **miniflare** `<=0.0.0-fff677e35 || 3.20250204.0 - 5.20260801.0-alpha` — transitive; fix: available via npm audit fix
  - sharp
  - undici
  - ws
- **nanoid** `<=3.3.17` — transitive; fix: available via npm audit fix
  - nanoid: non-secure generators can loop indefinitely with negative size
  - nanoid: custom generators can loop indefinitely when size is zero
  - https://github.com/advisories/GHSA-28wg-ghj8-5hjv
  - https://github.com/advisories/GHSA-2v37-7h3g-55p8
- **postcss** `<=8.5.22` — transitive; fix: available via npm audit fix
  - PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset
  - PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure
  - https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
  - https://github.com/advisories/GHSA-r28c-9q8g-f849
- **sharp** `<0.35.0` — transitive; fix: available via npm audit fix
  - sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591
  - https://github.com/advisories/GHSA-f88m-g3jw-g9cj
- **svgo** `4.0.0 - 4.0.1` — transitive; fix: available via npm audit fix
  - SVGO removeScripts plugin leaves some executable scripts intact
  - https://github.com/advisories/GHSA-2p49-hgcm-8545
- **undici** `7.0.0 - 7.28.0` — transitive; fix: available via npm audit fix
  - undici vulnerable to TLS certificate validation bypass via dropped requestTls in SOCKS5 ProxyAgent
  - undici vulnerable to HTTP header injection via Set-Cookie percent-decoding
  - undici WebSocket client vulnerable to denial of service via fragment count bypass
  - undici vulnerable to cross-origin request routing via SOCKS5 proxy pool reuse
  - undici vulnerable to Set-Cookie SameSite attribute downgrade via permissive substring matching
  - undici vulnerable to cross-user information disclosure via shared cache whitespace bypass
  - undici vulnerable to downstream response desynchronization via retry interceptor
  - undici vulnerable to cross-user information disclosure and parse-time crash via degenerate private cache directives
  - undici vulnerable to CRLF Injection via blob-like body 'type' property
  - undici vulnerable to cross-user information disclosure via whitespace around equals in Cache-Control directives
  - undici vulnerable to cookie attribute injection via unsanitized domain and unparsed setCookie fields
  - undici vulnerable to HTTP response queue poisoning via keep-alive socket reuse
  - https://github.com/advisories/GHSA-vmh5-mc38-953g
  - https://github.com/advisories/GHSA-p88m-4jfj-68fv
  - https://github.com/advisories/GHSA-vxpw-j846-p89q
  - https://github.com/advisories/GHSA-hm92-r4w5-c3mj
  - https://github.com/advisories/GHSA-g8m3-5g58-fq7m
  - https://github.com/advisories/GHSA-pr7r-676h-xcf6
  - https://github.com/advisories/GHSA-8xcm-r25x-g524
  - https://github.com/advisories/GHSA-4cwx-7wf7-3272
  - https://github.com/advisories/GHSA-m8rv-5g2x-5cg5
  - https://github.com/advisories/GHSA-jr45-8vmc-qm54
  - https://github.com/advisories/GHSA-v3r7-h72x-cjcm
  - https://github.com/advisories/GHSA-35p6-xmwp-9g52
- **vite** `7.0.0 - 7.3.3` — transitive; fix: available via npm audit fix
  - launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows
  - vite: `server.fs.deny` bypass on Windows alternate paths
  - https://github.com/advisories/GHSA-v6wh-96g9-6wx3
  - https://github.com/advisories/GHSA-fx2h-pf6j-xcff
- **ws** `8.0.0 - 8.20.1` — transitive; fix: available via npm audit fix
  - ws: Uninitialized memory disclosure
  - ws: Memory exhaustion DoS from tiny fragments and data chunks
  - https://github.com/advisories/GHSA-58qx-3vcg-4xpx
  - https://github.com/advisories/GHSA-96hv-2xvq-fx4p

#### MODERATE findings

- **@astrojs/language-server** `2.14.0 - 2.16.10` — transitive; fix: available via npm audit fix
  - volar-service-yaml
- **@cloudflare/vite-plugin** `<=0.0.0-fff677e35 || 0.0.7 - 1.41.0` — transitive; fix: available via npm audit fix
  - miniflare
  - wrangler
  - ws
- **supabase** `1.1.6 - 2.98.2` — direct dependency; fix: available via npm audit fix
  - tar
- **volar-service-yaml** `<=0.0.70` — transitive; fix: available via npm audit fix
  - yaml-language-server
- **wrangler** `<=0.0.0-kickoff-demo || 3.108.0 - 4.101.0` — direct dependency; fix: available via npm audit fix
  - esbuild
  - miniflare
- **yaml** `2.0.0 - 2.8.2` — transitive; fix: available via npm audit fix
  - yaml is vulnerable to Stack Overflow via deeply nested YAML collections
  - https://github.com/advisories/GHSA-48c2-rrv3-qjmp
- **yaml-language-server** `1.11.1-08d5f7b.0 - 1.21.1-f1f5a94.0 || 1.22.1-0ae5603.0 - 1.22.1-fc5f874.0` — transitive; fix: available via npm audit fix
  - yaml

#### LOW / INFO findings

- **@babel/core** `<=7.29.0` — transitive; fix: available via npm audit fix
  - @babel/core: Arbitrary File Read via sourceMappingURL Comment
  - https://github.com/advisories/GHSA-4x5r-pxfx-6jf8
- **esbuild** `0.27.3 - 0.28.0` — transitive; fix: available via npm audit fix
  - esbuild allows arbitrary file read when running the development server on Windows
  - https://github.com/advisories/GHSA-g7r4-m6w7-qqqr

## Hints recorded but not acted on

| Hint                    | Value               |
| ----------------------- | ------------------- |
| bootstrapper_confidence | first-class         |
| quality_override        | false               |
| path_taken              | standard            |
| self_check_answers      | null                |
| team_size               | solo                |
| deployment_target       | cloudflare-pages    |
| ci_provider             | github-actions      |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                |
| has_payments            | false               |
| has_realtime            | false               |
| has_ai                  | false               |
| has_background_jobs     | false               |

No CI/CD scaffolding, no agent-context generation, and no compensation actions were performed in v1 — these hints are carried forward for the future agent-context skill.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Switch to Node 22 (`nvm use`, the repo ships `.nvmrc` pinned to 22.14.0) before running `npm run dev`.
- `git init` is not needed — this directory already has its own repo history; the starter's upstream `.git/` was removed before the move-up.
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` (`diff CLAUDE.md CLAUDE.md.scaffold`) and decide which parts to keep.
- Copy `.env.example` to `.env` and fill in Supabase credentials; configure Row Level Security early (a known gotcha for this starter).
- Address audit findings per your project's risk tolerance — the full breakdown is above. `npm audit fix` resolves every finding listed; the CRITICAL (`tar`) and the direct HIGH (`astro`) are the ones worth reviewing first.
