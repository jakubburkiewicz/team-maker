-- Zasiew puli postaci: dwanaście postaci i trzydzieści sześć perków.
--
-- Treść poniżej jest dosłownym wynikiem renderCharacterPoolInserts(CHARACTER_POOL)
-- z src/lib/domain/character-pool-sql.ts; test zgodności (character-pool-sql.test.ts) sprawdza
-- to znak w znak. Autorskim źródłem prawdy jest src/lib/domain/character-pool.ts — zmiana
-- treści zaczyna się tam i kończy NOWĄ migracją zasiewową z tym samym wyrenderowanym blokiem
-- upsert; ten plik po zastosowaniu na produkcji jest niezmienny.

insert into public.characters (id, name, description, specialization, sort_order)
values
  ('vesper', 'Vesper Kane', 'Ex-corporate strike-team lead who walked out mid-contract and kept the rifle.', 'combat', 0),
  ('torque', 'Dolores "Torque" Amani', 'Chop-shop mechanic who rebuilds anything with a power cell, usually while it is still running.', 'engineering', 1),
  ('sable', 'Sable Nine', 'Ninth clone of a decommissioned infiltration line and the only one still unaccounted for.', 'stealth', 2),
  ('wren', 'Cassius Wren', 'Disbarred arbitration lawyer who now settles corporate disputes in back rooms, for a percentage.', 'negotiation', 3),
  ('oyelaran', 'Dr. Imani Oyelaran', 'Ripperdoc with a suspended licence and a basement clinic that never turns anyone away.', 'medicine', 4),
  ('halloran', 'Kit Halloran', 'Undercity courier who has memorised every maintenance tunnel the city forgot it had.', 'navigation', 5),
  ('ghostline', 'Ren "Ghostline" Takahashi', 'Netrunner who flatlined on the wire once and came back with better handles.', 'hacking', 6),
  ('marlow', 'Marlow Baptiste', 'Retired cage fighter who still takes bodyguard work when the rent is due.', 'combat', 7),
  ('volk', 'Petra Volk', 'Drone engineer blacklisted by three arms manufacturers for making their designs work properly.', 'engineering', 8),
  ('halo', 'Aurelio "Halo" Reyes', 'Combat medic who left the corporate militias with a saint''s reputation and a smuggler''s contacts.', 'medicine', 9),
  ('cipher', 'Nadia "Cipher" Kessler', 'Cryptographer who sold the same backdoor to four megacorps and is still collecting from all of them.', 'hacking', 10),
  ('juno', 'Juno Farr', 'Cat burglar who specialises in floors that do not officially exist.', 'stealth', 11)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  specialization = excluded.specialization,
  sort_order = excluded.sort_order;

insert into public.perks (id, character_id, name, competency, sort_order)
values
  ('vesper-breach-protocols', 'vesper', 'Breach Protocols', 'hacking', 0),
  ('vesper-extraction-routes', 'vesper', 'Extraction Routes', 'navigation', 1),
  ('vesper-field-triage', 'vesper', 'Field Triage', 'medicine', 2),
  ('torque-improvised-weapons', 'torque', 'Improvised Weapons', 'combat', 0),
  ('torque-service-tunnels', 'torque', 'Service Tunnel Access', 'navigation', 1),
  ('torque-parts-broker', 'torque', 'Parts Broker', 'negotiation', 2),
  ('sable-lock-spoofing', 'sable', 'Lock Spoofing', 'hacking', 0),
  ('sable-rooftop-routes', 'sable', 'Rooftop Routes', 'navigation', 1),
  ('sable-silent-takedown', 'sable', 'Silent Takedown', 'combat', 2),
  ('wren-plain-sight', 'wren', 'Hiding in Plain Sight', 'stealth', 0),
  ('wren-clinic-contacts', 'wren', 'Clinic Contacts', 'medicine', 1),
  ('wren-data-subpoena', 'wren', 'Data Subpoena', 'hacking', 2),
  ('oyelaran-cyberware-tuning', 'oyelaran', 'Cyberware Tuning', 'engineering', 0),
  ('oyelaran-bedside-manner', 'oyelaran', 'Bedside Manner', 'negotiation', 1),
  ('oyelaran-quiet-hands', 'oyelaran', 'Quiet Hands', 'stealth', 2),
  ('halloran-jury-rigged-rides', 'halloran', 'Jury-Rigged Rides', 'engineering', 0),
  ('halloran-street-brawler', 'halloran', 'Street Brawler', 'combat', 1),
  ('halloran-shadow-running', 'halloran', 'Shadow Running', 'stealth', 2),
  ('ghostline-camera-blind', 'ghostline', 'Camera Blind', 'stealth', 0),
  ('ghostline-hardware-splicing', 'ghostline', 'Hardware Splicing', 'engineering', 1),
  ('ghostline-biomonitor-reads', 'ghostline', 'Biomonitor Reads', 'medicine', 2),
  ('marlow-intimidation', 'marlow', 'Intimidation', 'negotiation', 0),
  ('marlow-district-knowledge', 'marlow', 'District Knowledge', 'navigation', 1),
  ('marlow-armour-maintenance', 'marlow', 'Armour Maintenance', 'engineering', 2),
  ('volk-firmware-exploits', 'volk', 'Firmware Exploits', 'hacking', 0),
  ('volk-medical-drones', 'volk', 'Medical Drones', 'medicine', 1),
  ('volk-recon-drones', 'volk', 'Recon Drones', 'navigation', 2),
  ('halo-suppressive-fire', 'halo', 'Suppressive Fire', 'combat', 0),
  ('halo-smuggler-network', 'halo', 'Smuggler Network', 'negotiation', 1),
  ('halo-evac-planning', 'halo', 'Evac Planning', 'navigation', 2),
  ('cipher-leverage', 'cipher', 'Leverage', 'negotiation', 0),
  ('cipher-ghost-identity', 'cipher', 'Ghost Identity', 'stealth', 1),
  ('cipher-sidearm-drills', 'cipher', 'Sidearm Drills', 'combat', 2),
  ('juno-first-aid', 'juno', 'First Aid', 'medicine', 0),
  ('juno-security-bypass', 'juno', 'Security Bypass', 'engineering', 1),
  ('juno-keycard-cloning', 'juno', 'Keycard Cloning', 'hacking', 2)
on conflict (id) do update set
  character_id = excluded.character_id,
  name = excluded.name,
  competency = excluded.competency,
  sort_order = excluded.sort_order;
