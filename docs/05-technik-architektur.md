# 05 — Technik & Architektur

## Stack-Entscheidung

| Baustein | Wahl | Begründung |
|---|---|---|
| Sprache | TypeScript (strict) | Typisierte Daten-DSL für Karten/Gegner, Refactor-Sicherheit für Claude Code |
| Build | Vite | schnell, Standard, kein Setup-Ballast |
| Inselwelt | Phaser 3 | Tilemaps, Kamera, Input, Sprite-Animation out of the box |
| Kampf-/Menü-UI | React (Overlay über Canvas) | Karten-UI ist klassisches DOM-Terrain: Layout, Hover, Drag, Accessibility |
| State-Brücke | Zustand | ein Store, von Phaser UND React konsumierbar |
| Tests | Vitest | Kampf-Kern wird testgetrieben entwickelt |
| Persistenz | localStorage (V1) | kein Backend-Risiko im Prototyp; Supabase optional später |

## Schichtenmodell

```
src/
├── core/            ← reine Logik, KEINE Engine-Imports
│   ├── combat/      ← Zustandsmaschine, Effekt-Interpreter, RNG (seedbar)
│   ├── progression/ ← XP, Level, Talente, Schattendichte, Resonanz
│   ├── economy/     ← Ressourcen, Rezepte, Prägen/Zerlegen
│   └── save/        ← Serialisierung, Versionierung des Spielstands
├── data/            ← Karten, Gegner, Rezepte, Inseln, XP-Kurve (nur Daten)
├── world/           ← Phaser: Szenen, Tilemaps, Spieler, Interaktion
├── ui/              ← React: Kampf, Inventar, Deck-Truhe, Menüs
└── shared/          ← Typen, Events, strings.ts
```

**Regel:** `core` und `data` wissen nichts von `world`/`ui`.
Kommunikation über den Zustand-Store und typisierte Events.

## Kampf-Kern als Zustandsmaschine

Phasen: `combatStart → turnStart → playerAction* → turnEnd → enemyTurn → …
→ victory | defeat`. Jede Aktion ist ein reduzierbares Event
(`PLAY_CARD`, `END_TURN`), der Kern ist eine pure Funktion
`(state, event, rng) → state`. Vorteile: deterministische Tests mit Seed,
Replay-Fähigkeit, UI komplett entkoppelt (React rendert nur den State).

## Effekt-DSL (Beispiel)

```ts
// src/data/cards/basics.ts
export const axtschlag: CardDef = {
  id: 'axtschlag',
  name: 'Axtschlag',
  type: 'attack',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'damage', amount: { base: 6, scaling: 'toolTier' }, target: 'target' }],
};
```

Der Interpreter in `core/combat/effects.ts` kennt eine geschlossene Menge an
Effekt-Kinds (`damage, block, draw, heal, applyStatus, gainEnergy, addCard,
modifyNextCardCost`). Neue Mechaniken = neuer Kind + Tests, keine
Karten-Sonderlogik. Zwei bewusste Nicht-Kinds:

- **ignoreBlock** ist kein eigener Kind, sondern das Flag `ignoresBlock` auf
  `damage` (Panzerbrecher) — Status-Multiplikatoren und Vergeltung greifen
  weiterhin, nur Block wird übersprungen.
- **retaliate** ist kein eigener Kind: Vergeltung wird per `applyStatus` mit
  `status: 'retaliate'` vergeben (Gegenhalten, Dornenwall) und im
  Schadens-Interpreter ausgelöst.

Beträge sind Zahlen oder skaliert: `{ base: 6, scaling: 'toolTier' }` —
`toolTier` kommt als Kontext über das Combat-Setup, der Bonus pro Stufe liegt
in `src/data/combat.ts`. Mehrfachschläge über `times` (Sturzflug `2×2`),
Stärke zählt pro Treffer (StS-Konvention).

## Gegner-KI

Pro Gegner ein deklaratives Absichtsmuster: entweder fester Zyklus
(`[attack8, defend6, attack8, buff]`) oder gewichteter Zustandsautomat mit
einfachen Bedingungen (`hpBelow: 0.5 → enrage`). Absicht wird eine Runde im
Voraus bestimmt und angezeigt.

## Spielstand

Ein versioniertes JSON-Dokument: Spieler (Level/XP/Talente/HP), Sammlung +
aktives Deck, Inventar, Insel-Zustände (Erkundung %, Dichte, gereinigt,
Resonanz-Bestwerte), Quest-Flags. `save/`-Modul kapselt Migrationen zwischen
Versionen von Tag 1 an.

**Format (Save V1, M2):** Envelope `{ v, checksum, payload }` — `payload` ist
der JSON-String der Spieldaten, `checksum` ein FNV-1a-Hash darüber (reiner
Korruptionsdetektor), `v` die Save-Version. V1 persistiert Inventar, geerntete
Nodes, Schattendichte und Spielerposition/-zone; Deck/Sammlung kommen in M3
als V2 mit Migration. Migrationen sind eine Kette `v → v+1` in
`core/save/save.ts`; Saves mit unbekannter (neuerer) Version werden nie
geraten, sondern abgelehnt.

**Backup-Slot (Doppel-Write):** Zwei localStorage-Keys
(`crystal-cove.save` + `.backup`). Beim Speichern rotiert der bisherige
Primär-Inhalt in den Backup-Slot, dann wird neu in den Primär-Slot
geschrieben — das Backup ist immer der letzte vollständig geschriebene Stand.

**Recovery-Verhalten:** Beim Laden wird der Primär-Slot vollständig geprüft
(JSON, Envelope, Checksumme, Version, Schema). Schlägt irgendeine Prüfung
fehl, wird das Backup geladen, der Primär-Slot damit geheilt und dem Spieler
ein Wiederherstellungs-Hinweis gezeigt. Sind beide Slots defekt, startet ein
frisches Spiel. Storage ist als Interface injiziert — die gesamte Logik in
`core/save/` ist DOM-frei und getestet (inkl. Korruptions-Szenarien).

**Autosave-Trigger (konservativ, M2):** nach Kampf-Ende, nach jeder
Ernte-/Inventar-/Dichte-Änderung sowie beim Verlassen der Seite
(`beforeunload`, sichert die Spielerposition). Nie während eines laufenden
Kampfs — Kämpfe sind nicht resumierbar. Kreaturen-Despawns nach Siegen werden
bewusst NICHT persistiert (szenen-lokal): solange es keine Respawn-Mechanik
gibt, wäre ein persistierter Despawn dauerhafter Weltverlust; nach einem
Reload erscheinen Kreaturen wieder, die Beute bleibt erhalten.

## Offene Entscheidungen (bewusst vertagt)

- Touch-/Mobile-Steuerung (nach M3 evaluieren)
- Supabase für Cloud-Saves/Telemetrie (frühestens nach V1)
- Audio-Stack (howler.js wahrscheinlich, Entscheidung in M5)
