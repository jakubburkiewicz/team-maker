# Lista drużyn na stronie głównej — Krótki plan

> Pełny plan: `context/changes/2026-09-06-teams-list-as-home/plan.md`

## Co i dlaczego

Treść listy drużyn przenosi się z `/teams` na `/`, a `/dashboard` i `/teams` (indeks) znikają wraz
z osieroconą stroną startową szablonu `Welcome.astro`. Dziś strona główna produktu reklamuje
„10x Astro Starter", a jedyny ekran chroniony poza domeną drużyn jest przykładem z szablonu.
Punkty 3, 4 i 5 z listy zmian zgłoszonych przez użytkownika.

## Punkt wyjścia

`src/pages/index.astro` to osiem linii renderujących `<Welcome />`. Gotowy widok listy — z trzema
gałęziami (awaria odczytu / stan pusty / lista) i banerem `?deleted=1` — żyje w
`src/pages/teams/index.astro`. Ochrona tras stoi na `PROTECTED_ROUTES` w `src/middleware.ts:4`,
dopasowywanej przez `startsWith`. Trzynaście linków w sześciu plikach celuje w `/dashboard`
lub `/teams`.

## Pożądany stan końcowy

Zalogowany gracz otwiera `/` i od razu widzi swoje drużyny; niezalogowany trafia na `/auth/signin`.
`/dashboard` i `/teams` dają 404, a żaden link w `src/` do nich nie prowadzi. Podtrasy
`/teams/new`, `/teams/[id]` i `/teams/[id]/embark` mają niezmienione adresy. Spełniona jest bramka
wstępna planu `2026-09-06-app-shell-header-nav`.

## Kluczowe podjęte decyzje

| Decyzja                     | Wybór                                                            | Dlaczego                                                                                                          |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Ochrona `/`                 | Czysty `src/lib/routes.ts` + test, dopasowanie dokładne dla `/`  | `startsWith("/")` łapie `/auth/signin` → pętla przekierowań; middleware importuje `astro:*`, więc bez wydzielenia reguła jest nietestowalna. |
| Sposób przenosin            | Dosłownie, do jednego pliku `index.astro`                        | Diff czyta się jako przenosiny; bramka planu siostrzanego wymaga `listTeams` wprost w `index.astro`.                |
| Okno przejściowe z linkami  | Przekierować na `/`, nie kasować                                 | Aplikacja działa po każdym commicie; kasację zrobi `app-shell-header-nav`, który te pliki i tak otwiera.             |
| Wylogowanie                 | `signout.ts` bez zmian; formularz `Sign out` przenosi się do nagłówka `/` | Jedno źródło reguły „niezalogowany → logowanie" (ceną jedno 302). Faza 2 kasuje **oba** dzisiejsze wyzwalacze signout, więc bez tego FR-003 zostaje bez ścieżki w UI aż do `app-shell-header-nav`. |
| `Topbar.astro`              | Zostaje mimo osierocenia; poprawiamy tylko `href` (`:13`)        | Kasację deklaruje `app-shell-header-nav` §Faza 2 — dublowanie dałoby konflikt planów. Ale `href="/dashboard"` musi zniknąć, inaczej strażnik 3.1 nie może być zielony. |
| Przyciski „new team"        | Oba zostają, duplikat przyjęty                                   | Przenosiny nie podejmują decyzji należących do `team-action-buttons`; stan pusty musi zachować CTA (FR-005, US-01).  |
| Weryfikacja                 | Test reguły + strażniki grep kotwiczone na `href="…"`            | `href="/teams"` nie trafia w `href="/teams/new"` ani w polskie komentarze o `/teams` (lekcja S-06).                  |
| Sprzątanie poza `src/`      | `README.md` (`:144`, `:146`) i `AGENTS.md` (`:33`)               | Oba kłamią po zmianie: README o trasie, AGENTS.md o `PROTECTED_ROUTES` — a AGENTS.md agent czyta przed kodem. `LibBadge.astro` był osierocony już wcześniej. |

## Zakres

**W zakresie:** `src/lib/routes.ts` + test; `src/pages/index.astro` przejmuje treść listy;
`src/middleware.ts` przechodzi na moduł; kasacja `dashboard.astro`, `teams/index.astro`,
`Welcome.astro`; `delete.ts` → `/?deleted=1`; przekierowanie linków w `new.astro`, `[id].astro`,
`embark.astro`, `TeamNotFound.astro`, `Topbar.astro` (sam `href`); formularz `Sign out` na `/`;
dokumentacja w `README.md` i `AGENTS.md`.

**Poza zakresem:** nagłówek i menu (`app-shell-header-nav`, w tym kasacja `Topbar.astro`); ikonowe
akcje na pozycjach listy (`team-action-buttons`); `signout.ts` i `signin.ts`; wydzielenie
komponentu listy; `LibBadge.astro`; schemat bazy, migracje i RLS.

## Architektura / Podejście

```
src/lib/routes.ts  ◀── routes.test.ts        (dokładne: "/"  ·  prefiksowe: "/teams", "/api/teams")
        │ importuje
        ▼
src/middleware.ts  ──▶  isProtectedRoute(pathname)

src/pages/teams/index.astro  ──przenosiny──▶  src/pages/index.astro   (czysty SSR, zero client:*)
src/pages/dashboard.astro    ──kasacja
src/components/Welcome.astro ──kasacja

delete.ts:  /teams?deleted=1  ──▶  /?deleted=1
```

## Fazy w skrócie

| Faza                       | Co dostarcza                                                            | Kluczowe ryzyko                                                                                     |
| -------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1. Moduł ochrony tras      | `src/lib/routes.ts` + test; zero podłączenia, zero zmian widocznych      | Pułapka `startsWith("/")` — pętla przekierowań, której nie łapie ani lint, ani typy, ani build         |
| 2. Przenosiny              | Lista na `/`, middleware na module, kasacja trzech plików, `delete.ts`   | Middleware i treść muszą wejść jednym commitem — rozjazd daje albo martwy ekran, albo naruszenie FR-004 |
| 3. Odwołania               | Cztery strony + osierocony `Topbar` przekierowane na `/`; README i AGENTS.md | Trzy linki siedzą w gałęziach awarii — dosięga ich wyłącznie sonda z tymczasowym `throw` w repo        |

**Wymagania wstępne:** brak — ta zmiana jest wymaganiem wstępnym dla
`2026-09-06-app-shell-header-nav` i idzie przed nim.
**Szacowany wysiłek:** ~1 sesja w 3 fazach; 2 nowe pliki, 9 zmodyfikowanych, 3 usunięte.

## Otwarte ryzyka i założenia

- **Trzy zmiany dotykają tych samych czterech stron.** `app-shell-header-nav` usuwa linki, które
  Faza 3 tutaj przekierowuje, a `team-action-buttons` przebudowuje pozycje listy przeniesionej
  w Fazie 2. Kolejność `teams-list-as-home` → `app-shell-header-nav` → `team-action-buttons` jest
  wiążąca; odwrócenie któregokolwiek kroku wymusza ponowne odczytanie numerów linii.
- **Gałęzie awarii są nieosiągalne z działającą konfiguracją.** Trzy z przekierowywanych linków
  weryfikuje wyłącznie sonda: tymczasowy `throw` w `getCharacterPool` / `getTeamSummary`, cofany
  przed commitem. Zdjęcie kluczy Supabase **nie** działa — middleware odbija na logowanie, zanim
  frontmatter chronionej trasy się wykona.
- **Brak testów integracyjnych** (AGENTS.md zabrania bootstrapować Astro): poza regułą tras cała
  zmiana opiera się na `npm run build` i krokach ręcznych.

## Kryteria sukcesu (podsumowanie)

- Zalogowany gracz od razu po zalogowaniu widzi listę własnych drużyn na `/` i przechodzi z niej
  pełną pętlę CRUD bez trafienia w 404.
- Niezalogowany na `/` ląduje na formularzu logowania — bez pętli przekierowań, a `/auth/*` dalej
  renderuje się bez sesji.
- `/dashboard` i `/teams` nie istnieją, a w `src/` nie ma już `href="/dashboard"` ani `href="/teams"`.
