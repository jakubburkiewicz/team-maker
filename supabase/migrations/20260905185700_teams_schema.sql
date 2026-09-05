-- Drużyny gracza: pierwsza tabela z danymi użytkownika, od pierwszej migracji odcięta na właściciela.
--
-- Jeden wiersz = jedna drużyna, cały skład w kolumnie jsonb (S-03, decyzja z sesji planowania):
-- zapis i późniejsza podmiana składu (S-05) są atomowe z konstrukcji, bez RPC — PostgREST nie ma
-- transakcji między tabelami. Bez klucza obcego do characters: pula jest zamknięta i zasiewana
-- upsertem, więc FK nie kupiłby integralności, której schemat i tak nie ma. Próg siedmiu
-- kompetencji NIE jest powtarzany w SQL — egzekwuje go trasa POST /api/teams przez evaluateTeam
-- (jedno źródło reguły, z testem w CI); RLS pilnuje wyłącznie własności.
--
-- Polityki: wyłącznie insert i select dla authenticated (S-03 potrzebuje tylko tych dwóch).
-- Obie w jednej migracji, bo `insert … returning` filtruje zwrócone wiersze polityką select —
-- bez niej zapis by się udał, a klient dostałby błąd „0 rows". Polityki update/delete dokładają
-- S-05 i S-06 własnymi migracjami — razem z `grant update` / `grant delete`, bo przywileje
-- poniżej są cofnięte.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nazwa-hash (FR-011): 8 znaków hex, losowa, nieedytowalna; S-05 nie umieszcza jej w update.
  name text not null default upper(left(replace(gen_random_uuid()::text, '-', ''), 8)),
  -- Skład w kształcie TeamComposition z src/lib/domain/types.ts: [{ characterId, perkIds }].
  composition jsonb not null check (jsonb_typeof(composition) = 'array'),
  created_at timestamptz not null default now(),
  constraint teams_user_id_name_key unique (user_id, name)
);

create index teams_user_id_idx on public.teams (user_id);

alter table public.teams enable row level security;

-- `(select auth.uid())` zamiast gołego `auth.uid()` — zalecenie Supabase: funkcja liczona raz
-- na zapytanie, nie na wiersz.
create policy "owner can insert teams" on public.teams
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "owner can read teams" on public.teams
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.teams from anon;
-- Obrona w głąb na poziomie GRANT, wzorzec `20260905090700_character_pool_revoke_writes.sql`:
-- Supabase nadaje `authenticated` wszystkie przywileje na nowych tabelach w `public`. RLS domyka
-- UPDATE/DELETE (brak polityk = zero wierszy), ale **nie dotyczy TRUNCATE** — ten filtruje wyłącznie
-- przywilej. `insert`/`select` zostają, bo wymagają ich polityki powyżej.
revoke update, delete, truncate on public.teams from authenticated;
