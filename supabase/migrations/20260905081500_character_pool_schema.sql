-- Pula postaci: enum siedmiu kompetencji, tabele characters i perks, RLS wyłącznie do odczytu.
--
-- Polecenie `create type` poniżej jest dosłownym wynikiem renderCompetencyEnum(COMPETENCIES)
-- z src/lib/domain/character-pool-sql.ts — test zgodności sprawdza to znak w znak, więc zmiana
-- nazwy kompetencji zaczyna się w src/lib/domain/types.ts i wymaga nowej migracji, nie edycji
-- tego pliku.
--
-- Pula jest zamknięta (PRD → Non-Goals: „tworzenie własnych postaci przez gracza"): jedyne
-- polityki to select dla authenticated. Zero polityk insert/update/delete; anon nie dostaje nic,
-- bo cała aplikacja stoi za logowaniem (FR-004).

create type public.competency as enum ('combat', 'hacking', 'stealth', 'engineering', 'medicine', 'negotiation', 'navigation');

create table public.characters (
  id text primary key,
  name text not null,
  description text not null,
  specialization public.competency not null,
  -- Kolejność listy w lewej kolumnie okna wyboru członka (FR-013) — deterministyczna, nie przypadkowa.
  sort_order integer not null,
  -- Odroczona, żeby upsert zmieniający kolejność nie wywrócił się na przejściowym duplikacie.
  constraint characters_sort_order_key unique (sort_order) deferrable initially deferred
);

create table public.perks (
  id text primary key,
  character_id text not null references public.characters (id) on delete cascade,
  name text not null,
  competency public.competency not null,
  -- Kolejność perków u postaci (FR-014).
  sort_order integer not null,
  constraint perks_character_id_sort_order_key unique (character_id, sort_order) deferrable initially deferred
);

create index perks_character_id_idx on public.perks (character_id);

alter table public.characters enable row level security;
alter table public.perks enable row level security;

create policy "authenticated can read characters"
  on public.characters
  for select
  to authenticated
  using (true);

create policy "authenticated can read perks"
  on public.perks
  for select
  to authenticated
  using (true);
