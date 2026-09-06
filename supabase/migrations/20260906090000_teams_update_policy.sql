-- Podmiana składu zapisanej drużyny (S-05, FR-009): domknięcie zobowiązania zapisanego
-- w komentarzu `20260905185700_teams_schema.sql:12-14` — tamta migracja cofnęła przywilej
-- `update` i nie założyła polityki, więc bez tego pliku update przechodzi bez błędu
-- i podmienia **zero wierszy**.
--
-- Przywilej nadany **kolumnowo**, nie tabelowo: `grant update (composition)` jest miejscem,
-- w którym baza egzekwuje FR-011 („nazwa-hash nieedytowalna") oraz niezmienność `user_id`,
-- `id` i `created_at`. Kod aplikacji wysyła wyłącznie `{ composition }`, ale to jest druga,
-- niezależna bariera: próba zapisu innej kolumny kończy się błędem uprawnień z Postgresa,
-- nie cichym pominięciem.
--
-- Próg siedmiu kompetencji dalej **nie** jest powtarzany w SQL — egzekwuje go
-- `gateTeamSubmission` wołane przez obie trasy zapisu (jedno źródło reguły, z testem w CI);
-- RLS pilnuje wyłącznie własności.
--
-- Plik nie nadaje ani nie odblokowuje żadnego przywileju usuwania wierszy ani czyszczenia
-- tabeli — usuwanie drużyny to S-06, z własną migracją.

-- `using` wybiera wiersze, które wolno zmienić; `with check` blokuje przepisanie wiersza
-- na cudze konto — sam `using` na to nie wystarcza. `(select auth.uid())` zamiast gołego
-- `auth.uid()` jak w istniejących politykach: funkcja liczona raz na zapytanie, nie na wiersz.
create policy "owner can update teams" on public.teams
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant update (composition) on public.teams to authenticated;
