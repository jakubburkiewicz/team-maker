---
starter_id: 10x-astro-starter
package_manager: npm
project_name: team-maker
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

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
realtime. Wdrożenie idzie na Cloudflare Workers ze static assets — adapter Astro 6 nie
obsługuje już Cloudflare Pages, więc komendą jest `wrangler deploy`, nie `wrangler pages deploy`
— a GitHub Actions z auto-wdrożeniem po scaleniu domyka pętlę: PR → testy → wdrożenie. Stos
przechodzi wszystkie cztery bramki przyjazne dla agenta, więc nie potrzebuje kompensacji
w CLAUDE.md.
