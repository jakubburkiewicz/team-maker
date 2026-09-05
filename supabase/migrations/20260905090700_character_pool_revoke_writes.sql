-- Obrona w głąb dla zamkniętej puli postaci.
--
-- Supabase nadaje rolom anon i authenticated wszystkie przywileje tabelowe na nowych tabelach
-- w schemacie public (alter default privileges … grant all on tables). Jedyną barierą przed
-- zapisem do characters i perks jest więc RLS z 20260905081500_character_pool_schema.sql —
-- brak polityk insert/update/delete. To wystarcza, ale jeden `create policy … for insert`
-- dodany przez pomyłkę otworzyłby zapis. Cofnięcie przywilejów zapisu na poziomie GRANT
-- sprawia, że pula jest zamknięta niezależnie od polityk (PRD → Non-Goals: „tworzenie
-- własnych postaci przez gracza").
--
-- Odczyt zostaje bez zmian: select dla authenticated nadal przechodzi przez polityki RLS,
-- anon nadal dostaje zero wierszy, bo nie ma polityki.

revoke insert, update, delete, truncate on public.characters from anon, authenticated;
revoke insert, update, delete, truncate on public.perks from anon, authenticated;
