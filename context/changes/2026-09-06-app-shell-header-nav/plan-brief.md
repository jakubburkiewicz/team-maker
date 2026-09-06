# Wspólny nagłówek z użytkownikiem i menu nawigacyjnym — Krótki plan

> Pełny plan: `context/changes/2026-09-06-app-shell-header-nav/plan.md`

## Co i dlaczego

Każda strona dostaje ten sam pasek u góry: e-mail zalogowanego gracza po lewej, menu
`Your teams` / `New team` / `Sign out` po prawej. Taki pasek już istnieje, ale wisi na jednej
stronie startowej, a strony domenowe mają zamiast niego trzynaście rozsypanych linków powrotnych
celujących w trasy, które właśnie znikają. Punkty 1 i 2 z listy zmian zgłoszonych przez użytkownika.

## Punkt wyjścia

`src/components/Topbar.astro` renderuje dokładnie żądaną zawartość, ale jest montowany wyłącznie
w `src/components/Welcome.astro:28`, czyli tylko na `/`. `src/layouts/Layout.astro` ma każda strona,
lecz jest czystą powłoką HTML i nie zna sesji. Nawigacja żyje w per-stronowych linkach
„← Back to dashboard" i „← Your teams", powtórzonych osobno w gałęziach awarii.

## Pożądany stan końcowy

Zalogowany gracz widzi identyczny nagłówek na `/`, `/teams/new`, `/teams/[id]`,
`/teams/[id]/embark` i na ekranie „Team not found", z wyróżnioną pozycją odpowiadającą bieżącemu
widokowi. Żadna strona nie ma już własnego linku nawigacyjnego. Ekrany `/auth/*` zostają bez nagłówka.

## Kluczowe podjęte decyzje

| Decyzja              | Wybór                                                                    | Dlaczego                                                                                             |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Kolejność            | `teams-list-as-home` jest wymaganiem wstępnym; menu celuje od razu w `/` | Zero martwych i tymczasowych linków, każdy plik dotykany raz.                                        |
| Montaż powłoki       | Nowy `AppLayout.astro` opakowujący `Layout.astro`                        | Przynależność widać w imporcie strony, a `Layout` zostaje czystą powłoką HTML dla `/auth/*`.         |
| Przełącznik nagłówka | Sam wybór layoutu, **bez** propsa `header`                               | Prop byłby cichym przełącznikiem — nowa strona go zapomni, a lint i typy tego nie łapią.             |
| Zasięg               | Strony domenowe + `TeamNotFound`; `/auth/*` bez                          | 404 przestaje być ślepą uliczką; pasek nad formularzem logowania byłby szumem.                       |
| Linki powrotne       | Usunąć wszystkie, zostawić `<h1>`                                        | Jedno źródło nawigacji zamiast trzynastu linków przy usuwanych trasach.                              |
| `Topbar.astro`       | Nowy `AppHeader.astro`, stary skasowany                                  | Po usunięciu `Welcome.astro` jest osierocony, a martwego `.astro` nie łapie lint ani typy.           |
| Stan aktywny         | `aria-current="page"` + wyróżnienie                                      | Recenzent bez kontekstu widzi, gdzie jest; przy czystym SSR atrybut jest darmowy.                    |
| Układ paska          | Lewo e-mail · prawo nawigacja + `Sign out`                               | Zgłoszenie wskazuje dzisiejszy `Topbar` jako wzorzec; `Sign out` zostaje `<form method="POST">`.     |
| Weryfikacja          | Czysty `src/lib/nav.ts` + test + grepy zakotwiczone na składni           | Jedyna logika zmiany staje się testowalna, a grepy nie trafiają w polskie komentarze w tych plikach. |

## Zakres

**W zakresie:** `src/lib/nav.ts` + test (pozycje menu i reguła aktywnej ścieżki);
`src/components/AppHeader.astro`; `src/layouts/AppLayout.astro`; migracja pięciu plików na powłokę
(`index.astro`, `teams/new.astro`, `teams/[id].astro`, `teams/[id]/embark.astro`,
`team/TeamNotFound.astro`); usunięcie `Topbar.astro` i wszystkich linków powrotnych.

**Poza zakresem:** `Layout.astro` i `/auth/*`; `middleware.ts` i trasa `signout`; usunięcie
`/dashboard`, `/teams` i `Welcome.astro` (robi to `teams-list-as-home`); ikonowe akcje na liście
(`team-action-buttons`); responsywność i menu mobilne (PRD → Non-Goals).

## Architektura / Podejście

```
Layout.astro  ──opakowany przez──▶  AppLayout.astro  ──renderuje──▶  AppHeader.astro
(bez zmian)                        (kontener + nagłówek)             │ importuje
                                                                      ▼
                                                        src/lib/nav.ts ◀── nav.test.ts

AppLayout: / · /teams/new · /teams/[id] · /teams/[id]/embark · TeamNotFound
Layout:    /auth/signin · /auth/signup · /auth/confirm-email
```

Powłoka jest czystym SSR — zero `client:*`, zero dodatkowego JS. `Astro.locals.user` wypełnia już
`src/middleware.ts:13` przy każdym żądaniu, więc nagłówek nie robi żadnego zapytania i middleware
nie wymaga zmian.

## Fazy w skrócie

| Faza                            | Co dostarcza                                                           | Kluczowe ryzyko                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Czysty moduł nawigacji       | `src/lib/nav.ts` + test                                                | Pułapka `startsWith("/")` — prefiks dla `/` czyni „Your teams" aktywnym wszędzie; stąd tryb `exact` i test wprost |
| 2. Powłoka i pierwszy konsument | `AppHeader`, `AppLayout`, `TeamNotFound` w powłoce, `Topbar` skasowany | Niezmiennik S-07: `TeamNotFound` nie może dostać propsów — różnica odpowiedzi obu tras na cudze id jest wyciekiem |
| 3. Migracja stron domenowych    | Cztery strony na powłoce, linki powrotne usunięte                      | Drugi zestaw linków ukryty w gałęziach awarii, których nie widać bez wyłączenia Supabase                          |

**Wymagania wstępne:** `2026-09-06-teams-list-as-home` wdrożony pierwszy — usuwa `/dashboard`,
`/teams` i `Welcome.astro`, przenosi listę drużyn na `/`, dopisuje `/` do `PROTECTED_ROUTES`.

**Szacowany wysiłek:** ~1–2 sesje w 3 fazach; 3 nowe pliki, 6 zmodyfikowanych lub usuniętych.

## Otwarte ryzyka i założenia

- **Plan opisuje pliki w stanie po wymaganiu wstępnym.** `src/pages/index.astro` renderuje dziś
  `<Welcome />`; jeśli zmiana siostrzana ukształtuje ten plik inaczej, niż zakłada Faza 3 pkt 1,
  jego numery linii i nazwy gałęzi trzeba przeczytać na nowo.
- **Prop szerokości kontenera** jest jedynym propem powłoki; karta na `embark` jest wyśrodkowana
  w pionie, więc może wymusić drugi wymiar — ryzyko przyjęte jako tanie.
- **Brak testów integracyjnych** (`AGENTS.md` zabrania bootstrapować Astro): reguła aktywnej ścieżki
  jest testowana, sam markup nagłówka weryfikuje wyłącznie `npm run build` plus kroki ręczne.

## Kryteria sukcesu (podsumowanie)

- Gracz ma ten sam nagłówek na wszystkich pięciu ekranach i z każdego dociera do listy drużyn,
  kompletowania nowej i wylogowania bez przycisku wstecz.
- Wyróżniona pozycja zawsze odpowiada widokowi: `Your teams` tylko na `/`, `New team` tylko na `/teams/new`.
- W `src/` nie ma już `href="/dashboard"` ani `href="/teams"`, a pętla CRUD przechodzi bez regresji.
