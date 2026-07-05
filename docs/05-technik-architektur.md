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
  effects: [{ kind: 'damage', amount: { base: 6, scaling: 'toolTier' }, target: 'enemy' }],
};
```

Der Interpreter in `core/combat/effects.ts` kennt eine geschlossene Menge an
Effekt-Kinds (`damage, block, draw, heal, applyStatus, gainEnergy, addCard, …`).
Neue Mechaniken = neuer Kind + Tests, keine Karten-Sonderlogik.

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

## Offene Entscheidungen (bewusst vertagt)

- Touch-/Mobile-Steuerung (nach M3 evaluieren)
- Supabase für Cloud-Saves/Telemetrie (frühestens nach V1)
- Audio-Stack (howler.js wahrscheinlich, Entscheidung in M5)
