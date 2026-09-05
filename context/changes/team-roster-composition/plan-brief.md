# Kompletowanie składu drużyny (S-01) — Krótki plan

> Pełny plan: `context/changes/team-roster-composition/plan.md`

## Co i dlaczego

Pierwszy ekran domenowy: strona `/teams/new`, na której zalogowany gracz kompletuje drużynę
z zamkniętej puli dwunastu postaci — otwiera okno wyboru członka (lista po lewej, szczegóły po
prawej), dodaje do sześciu różnych postaci, usuwa członka i cały czas widzi skład. To najtańszy
sposób, żeby pula z F-02 spotkała się z prawdziwym interfejsem, i warunek wstępny wykresu (S-02)
oraz zapisu (S-03).

## Punkt wyjścia

Domena i dane są gotowe: `evaluateTeam` zna limity jako `violations`, `getCharacterPool` zwraca
posortowaną pulę i **rzuca** przy awarii lub pustym wyniku. Interfejsu domenowego nie ma wcale:
jedyny prymityw shadcn to `Button`, jedyna wyspa React to formularz logowania, dashboard to
karta z „Sign out". Przegląd F-02 zostawił martwy punkt: „jak S-01 obsłuży błąd strony".

## Pożądany stan końcowy

Gracz wchodzi z dashboardu na `/teams/new`, widzi `0/6` i sześć slotów, „Recruit" otwiera okno
z dwunastoma postaciami, „Add to team" wypełnia slot, postać w drużynie jest oznaczona „In team"
i nie do dodania, przy `6/6` nie da się dodać nikogo, „Remove" zwalnia slot. Niezalogowany
trafia na logowanie; przy niedostępnej puli strona pokazuje kartę błędu, nigdy 500.

## Kluczowe podjęte decyzje

| Decyzja                     | Wybór                                                      | Dlaczego (1 zdanie)                                                                                         |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Trwałość draftu             | Tylko pamięć wyspy, F5 zeruje                              | Zero kodu i drugiego źródła prawdy; spójne z Non-Goalem „wersje robocze" (niewiadoma z roadmapy rozstrzygnięta). |
| Trasa i wejście             | `/teams/new`, link z dashboardu i Topbara, prefiks `/teams` chroniony | Jeden wpis w `PROTECTED_ROUTES` obejmie listę i szczegóły z S-04/S-05.                                    |
| Egzekwowanie limitów        | Czysty `src/lib/domain/roster.ts` (`addMember`/`removeMember`) + testy | Limit ma dowód w `npm test`, nie tylko szary przycisk; test zgodności z `evaluateTeam` pilnuje jednego źródła prawdy. |
| Okno wyboru                 | shadcn `Dialog` (Radix)                                    | Focus trap/Esc/aria za darmo, konwencja `npx shadcn add`; S-06 użyje go do potwierdzenia usunięcia.          |
| Testy                       | Tylko czyste testy modułu składu                           | Zgodne z twardą regułą (bez Astro/Supabase); jsdom to temat Modułu 3.                                       |
| Postacie już w drużynie     | Widoczne, oznaczone „In team", nie do dodania              | Obcy widzi całą pulę i regułę „brak powtórzeń" bez tutoriala.                                               |
| Awaria puli                 | Stan błędu na stronie `/teams/new`, log w `console.error`  | Konwencja AGENTS.md „strona łapie i mapuje na stan strony"; brak 500 i brak treści błędu w URL.             |
| Widok składu                | Sześć stałych slotów + licznik `N/6`                       | Limit widoczny bez czytania; S-02 dopisze perki do zajętej karty.                                            |

## Zakres

**W zakresie:** moduł `roster.ts` z testami · strona `/teams/new` (SSR, chroniona, stan błędu) ·
wyspa `TeamComposer` z `RosterSlot` · prymityw `dialog.tsx` · `MemberPickerDialog` (lista +
szczegóły: nazwa, opis, specjalizacja, trzy perki tylko do odczytu z nazwanym limitem 2 z 3) ·
linki z dashboardu i Topbara · zapis rozstrzygnięcia niewiadomej w roadmapie.

**Poza zakresem:** wybór perków, wykres, werdykt i „Wyrusz na zlecenie" (S-02) · zapis, tabela
`teams`, hash (S-03) · lista drużyn (S-04) · trwałość draftu · testy komponentów React ·
mobile · zmiany motywu/tokenów shadcn.

## Architektura / Podejście

`new.astro` (SSR) → `createClient` + null-check → `getCharacterPool` w `try/catch` → props
`pool` do `<TeamComposer client:load>` albo karta błędu. `TeamComposer` trzyma `composition`
w `useState`, rysuje sześć `RosterSlot`, otwiera `MemberPickerDialog`; każdy ruch przechodzi
przez `addMember`/`removeMember` z `@/lib/domain`. Stan „wybrana postać" żyje wewnątrz
`DialogContent`, więc resetuje się przy każdym otwarciu bez `useEffect` (react-hooks 7).

## Fazy w skrócie

| Faza                              | Co dostarcza                                                  | Kluczowe ryzyko                                                   |
| --------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Moduł składu w domenie         | `roster.ts` + testy limitów i zgodności z `evaluateTeam`      | Drugie źródło prawdy o limitach — pilnuje test zgodności          |
| 2. Strona `/teams/new` + sloty    | Chroniona strona, stan błędu, wyspa z sześcioma slotami       | Lint react-compiler/react-hooks 7 przy pierwszej wyspie ze stanem |
| 3. Okno wyboru członka            | shadcn `Dialog`, `MemberPickerDialog`, pełna pętla dodaj/usuń | Jasny motyw prymitywu wymaga nadpisania klas; nowa zależność      |

**Wymagania wstępne:** F-02 zarchiwizowane (pula w bazie, RLS dla `authenticated`); konto
testowe z potwierdzonym adresem; `.env` z kluczami Supabase do weryfikacji ręcznej.
**Szacowany wysiłek:** ~2–3 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- `npx shadcn@latest add dialog` może dotknąć `global.css`/`components.json` — sprawdzić
  `git diff` po wygenerowaniu i cofnąć wszystko poza `dialog.tsx` i `package.json`.
- Migracja `revoke_writes` z F-02 mogła nie zostać wypchnięta na produkcję (punkt F6 przeglądu)
  — nie blokuje, ale to ostatnia chwila przed interfejsem czytającym pulę produkcyjną.
- Podłączenie modułu do wyspy ma tylko weryfikację ręczną — przyjęte świadomie.
- Wygląd „cosmic" starteru zostaje; klimat cyberpunk to warstwa treści, nie motywu.

## Kryteria sukcesu (podsumowanie)

- Obcy bez tutoriala dobiera sześć różnych postaci przez okno wyboru i widzi skład; nie da się
  dodać siódmego członka ani tej samej postaci dwa razy — a `npm test` to dowodzi.
- `/teams/new` odrzuca niezalogowanych i nigdy nie zwraca 500 przy niedostępnej puli.
- `npx astro sync && npm run lint && npm test && npm run build` przechodzą.
