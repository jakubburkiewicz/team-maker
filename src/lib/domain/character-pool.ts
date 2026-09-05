import type { PoolCharacter } from "@/lib/domain/types";

/**
 * Zamknięta pula dwunastu postaci — autorskie źródło prawdy dla całego projektu.
 *
 * Z tej stałej generowana jest migracja zasiewowa (`character-pool-sql.ts`), a test zgodności
 * pilnuje, żeby plik migracji zawierał dosłownie jej wyrenderowany obraz. Identyfikatory postaci
 * i perków trafiają do bazy jako klucze główne — są stabilne i nie wolno ich zmieniać bez nowej
 * migracji. Kolejność w tablicy jest kolejnością listy w oknie wyboru członka (`sort_order`).
 *
 * Dobór jest wiążącym warunkiem poprawności z PRD → Business Logic: `character-pool.test.ts`
 * dowodzi wyczerpującym przeszukaniem, że istnieje skład domykający próg. Rozkład specjalizacji:
 * combat ×2, hacking ×2, stealth ×2, engineering ×2, medicine ×2, negotiation ×1, navigation ×1;
 * każda kompetencja jest osiągalna z perków co najmniej pięciu różnych postaci.
 *
 * Treść jest po angielsku — spójnie z językiem interfejsu (`lang="en"`).
 */
export const CHARACTER_POOL: readonly PoolCharacter[] = [
  {
    id: "vesper",
    name: "Vesper Kane",
    description: "Ex-corporate strike-team lead who walked out mid-contract and kept the rifle.",
    specialization: "combat",
    perks: [
      { id: "vesper-breach-protocols", name: "Breach Protocols", competency: "hacking" },
      { id: "vesper-extraction-routes", name: "Extraction Routes", competency: "navigation" },
      { id: "vesper-field-triage", name: "Field Triage", competency: "medicine" },
    ],
  },
  {
    id: "torque",
    name: 'Dolores "Torque" Amani',
    description: "Chop-shop mechanic who rebuilds anything with a power cell, usually while it is still running.",
    specialization: "engineering",
    perks: [
      { id: "torque-improvised-weapons", name: "Improvised Weapons", competency: "combat" },
      { id: "torque-service-tunnels", name: "Service Tunnel Access", competency: "navigation" },
      { id: "torque-parts-broker", name: "Parts Broker", competency: "negotiation" },
    ],
  },
  {
    id: "sable",
    name: "Sable Nine",
    description: "Ninth clone of a decommissioned infiltration line and the only one still unaccounted for.",
    specialization: "stealth",
    perks: [
      { id: "sable-lock-spoofing", name: "Lock Spoofing", competency: "hacking" },
      { id: "sable-rooftop-routes", name: "Rooftop Routes", competency: "navigation" },
      { id: "sable-silent-takedown", name: "Silent Takedown", competency: "combat" },
    ],
  },
  {
    id: "wren",
    name: "Cassius Wren",
    description: "Disbarred arbitration lawyer who now settles corporate disputes in back rooms, for a percentage.",
    specialization: "negotiation",
    perks: [
      { id: "wren-plain-sight", name: "Hiding in Plain Sight", competency: "stealth" },
      { id: "wren-clinic-contacts", name: "Clinic Contacts", competency: "medicine" },
      { id: "wren-data-subpoena", name: "Data Subpoena", competency: "hacking" },
    ],
  },
  {
    id: "oyelaran",
    name: "Dr. Imani Oyelaran",
    description: "Ripperdoc with a suspended licence and a basement clinic that never turns anyone away.",
    specialization: "medicine",
    perks: [
      { id: "oyelaran-cyberware-tuning", name: "Cyberware Tuning", competency: "engineering" },
      { id: "oyelaran-bedside-manner", name: "Bedside Manner", competency: "negotiation" },
      { id: "oyelaran-quiet-hands", name: "Quiet Hands", competency: "stealth" },
    ],
  },
  {
    id: "halloran",
    name: "Kit Halloran",
    description: "Undercity courier who has memorised every maintenance tunnel the city forgot it had.",
    specialization: "navigation",
    perks: [
      { id: "halloran-jury-rigged-rides", name: "Jury-Rigged Rides", competency: "engineering" },
      { id: "halloran-street-brawler", name: "Street Brawler", competency: "combat" },
      { id: "halloran-shadow-running", name: "Shadow Running", competency: "stealth" },
    ],
  },
  {
    id: "ghostline",
    name: 'Ren "Ghostline" Takahashi',
    description: "Netrunner who flatlined on the wire once and came back with better handles.",
    specialization: "hacking",
    perks: [
      { id: "ghostline-camera-blind", name: "Camera Blind", competency: "stealth" },
      { id: "ghostline-hardware-splicing", name: "Hardware Splicing", competency: "engineering" },
      { id: "ghostline-biomonitor-reads", name: "Biomonitor Reads", competency: "medicine" },
    ],
  },
  {
    id: "marlow",
    name: "Marlow Baptiste",
    description: "Retired cage fighter who still takes bodyguard work when the rent is due.",
    specialization: "combat",
    perks: [
      { id: "marlow-intimidation", name: "Intimidation", competency: "negotiation" },
      { id: "marlow-district-knowledge", name: "District Knowledge", competency: "navigation" },
      { id: "marlow-armour-maintenance", name: "Armour Maintenance", competency: "engineering" },
    ],
  },
  {
    id: "volk",
    name: "Petra Volk",
    description: "Drone engineer blacklisted by three arms manufacturers for making their designs work properly.",
    specialization: "engineering",
    perks: [
      { id: "volk-firmware-exploits", name: "Firmware Exploits", competency: "hacking" },
      { id: "volk-medical-drones", name: "Medical Drones", competency: "medicine" },
      { id: "volk-recon-drones", name: "Recon Drones", competency: "navigation" },
    ],
  },
  {
    id: "halo",
    name: 'Aurelio "Halo" Reyes',
    description: "Combat medic who left the corporate militias with a saint's reputation and a smuggler's contacts.",
    specialization: "medicine",
    perks: [
      { id: "halo-suppressive-fire", name: "Suppressive Fire", competency: "combat" },
      { id: "halo-smuggler-network", name: "Smuggler Network", competency: "negotiation" },
      { id: "halo-evac-planning", name: "Evac Planning", competency: "navigation" },
    ],
  },
  {
    id: "cipher",
    name: 'Nadia "Cipher" Kessler',
    description: "Cryptographer who sold the same backdoor to four megacorps and is still collecting from all of them.",
    specialization: "hacking",
    perks: [
      { id: "cipher-leverage", name: "Leverage", competency: "negotiation" },
      { id: "cipher-ghost-identity", name: "Ghost Identity", competency: "stealth" },
      { id: "cipher-sidearm-drills", name: "Sidearm Drills", competency: "combat" },
    ],
  },
  {
    id: "juno",
    name: "Juno Farr",
    description: "Cat burglar who specialises in floors that do not officially exist.",
    specialization: "stealth",
    perks: [
      { id: "juno-first-aid", name: "First Aid", competency: "medicine" },
      { id: "juno-security-bypass", name: "Security Bypass", competency: "engineering" },
      { id: "juno-keycard-cloning", name: "Keycard Cloning", competency: "hacking" },
    ],
  },
];
