---
change_id: testing-reviewer-path-e2e
title: E2E ścieżki recenzenta — Faza 4 planu testów (ryzyko #4)
status: new
created: 2026-09-09
updated: 2026-09-09
archived_at: null
---

## Notes

Faza 4 planu testów (context/foundation/test-plan.md §3): ryzyko #4 — „recenzent nie domyka ścieżki rejestracja → potwierdzenie adresu → logowanie i ocenia produkt, do którego nie wszedł" — plus człon cross-cutting fazy (bramki, opcjonalny przegląd multimodalny).

Stan zastany na wejściu:
- Warstwa e2e istnieje jako rusztowanie, nie jako rozstrzygnięcie fazy: Playwright 1.63 w devDependencies, `playwright.config.ts` świadomie bez `webServer`, `e2e/` poza zakresem Vitest (`src/**/*.test.ts`).
- `e2e/seed.spec.ts` to seed test wedle skilla /10x-e2e. Pokrywa tor PO potwierdzeniu adresu: logowanie → skompletowanie składu domykającego próg → zapis → drużyna widoczna po odświeżeniu → usunięcie przez okno potwierdzenia. Zielony w dwóch przebiegach pod rząd, asercja przesondowana celowym psuciem (`listTeams` zwracające `[]` → czerwień na asercji ryzyka). Uruchamiany przeciwko lokalnemu stosowi Supabase; `.env` w repo wskazuje projekt hostowany, więc przebieg wymagał osobnego `.dev.vars` z kluczami `npx supabase status`.
- Wprowadzona konwencja: wyzwalacze w wyspach `client:load` są w DOM przed hydratacją, więc pierwsze kliknięcie przepada; seed ponawia klik do skutku obserwowalnego (`openFromIsland`), nigdy przez `waitForTimeout`.

Otwarte rozstrzygnięcie, które ma ugruntować badanie — to dosłownie kolumna „Context /10x-research must ground" wiersza #4 w §2: czy lokalny stos w ogóle wykonuje tor potwierdzania adresu; czym jest łapacz poczty w tym stosie (Mailpit stoi na http://127.0.0.1:54324); co da się pokryć automatem, a co musi zostać ręcznym dymem przeciwko produkcji.

Trzy drogi rozważone wstępnie, do rozstrzygnięcia w badaniu i planie:
(a) domknięcie ryzyka w 100% lokalnie — `enable_confirmations = true` na lokalnym stosie i odczyt listu z Mailpita; blokuje to twarda reguła AGENTS.md o świadomym rozjeździe potwierdzania, więc byłaby to jawna poprawka reguły, nie cicha zmiana;
(b) szew zgodny z §2 — automat na torze po potwierdzeniu (seed) plus jawnie ręczna lista kontrolna dymu między scaleniem a produkcją;
(c) zdjęcie członu przed logowaniem jako niekupującego sygnału ponad to, co Faza 2 pokrywa taniej.

Artefakt odrzucony 2026-09-09, do nieodtwarzania bez decyzji: `e2e/registration-does-not-sign-in.spec.ts` (napisany i usunięty). Wiązał wyłącznie stos z potwierdzaniem WŁĄCZONYM, czyli projekt hostowany — każdy przebieg zakładał tam trwałe, nieusuwalne konto i wysyłał realny list, a seria przebiegów padała na limicie SMTP. Do tego jego asercja w połowie sprawdzała wartość z `supabase/config.toml`, a w połowie wchodziła na teren ryzyka #3, które §2 przypisuje integracji na poziomie żądania w Fazie 2. Naruszał §1 zasadę #1 (koszt × sygnał).

Kolejność: Fazy 2 i 3 mają w §3 status `not started`. Faza 4 jest otwierana świadomie poza kolejnością — powodem jest kontekst kursowy (moduł o testach e2e), nie rewizja uzasadnienia kolejności z §3. Plan ma o tym mówić prawdę.

Wyjścia fazy: wypełnione §6.6 (kształt jak §6.2: lokalizacja, nazewnictwo, czystość, wyrocznia, test referencyjny, uruchomienie, kontrola mutacyjna), nota w §6.7, status w §3, oraz rozstrzygnięcie bramki „e2e na ścieżce persony głównej" z §5 — z uwzględnieniem, że `.github/workflows/ci.yml` woła dziś gołe `npm test`, bez `services:`, bez `env:` i bez Dockera.
