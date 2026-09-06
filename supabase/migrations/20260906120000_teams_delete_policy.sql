-- Usunięcie własnej drużyny (S-06, FR-010): domknięcie zobowiązania zapisanego w komentarzu
-- `20260905185700_teams_schema.sql:12-14` — tamta migracja cofnęła przywilej usuwania wierszy
-- i nie założyła polityki, więc bez tego pliku `delete` przechodzi bez błędu i kasuje
-- **zero wierszy**: awaria cicha, nie do odróżnienia od „to cudza drużyna".
--
-- Przywilej nadany **tabelowo**, inaczej niż `grant update (composition)` z
-- `20260906090000_teams_update_policy.sql`. To nie jest poluzowanie tamtej decyzji: kolumnowa
-- granulacja istnieje dla `update` i `insert`, bo tam jest co zawęzić — przy usuwaniu znika cały
-- wiersz, więc nie ma kolumny do wskazania. Jedyną barierą przeciw skasowaniu cudzego wiersza
-- jest `using` w polityce poniżej (US-04).
--
-- `delete … returning` przechodzi przez politykę `select` („owner can read teams",
-- `20260905185700_teams_schema.sql:37-39`) — i to na niej stoi kontrakt `TeamSummary | null`
-- funkcji `deleteTeam`: skasowany wiersz wraca, a jego brak znaczy „nie było czego kasować".
-- Zawężenie polityki `select` w przyszłości rozbroiłoby to rozróżnienie bez żadnego błędu.
--
-- Czego ten plik **nie** nadaje: niczego dla roli `anon` (`revoke all` ze schematu zostaje w mocy)
-- ani przywileju czyszczenia całej tabeli — ten pozostaje cofnięty, bo RLS go nie filtruje.
-- Polityki `insert`, `select` i `update` są nietknięte.

-- Polityka `for delete` przyjmuje wyłącznie `using` — Postgres odrzuca drugą klauzulę, bo przy
-- usuwaniu nie powstaje nowy wiersz do sprawdzenia. To różnica wobec polityki `update` z S-05,
-- która celowo ma obie. `(select auth.uid())` zamiast gołego `auth.uid()` jak w trzech
-- istniejących politykach: funkcja liczona raz na zapytanie, nie na wiersz.
create policy "owner can delete teams" on public.teams
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant delete on public.teams to authenticated;
