# CLAUDE.md — Crystal Cove

Diese Datei steuert, wie Claude Code in diesem Repository arbeitet.

## Projektkontext

Browser-Spiel: Cozy Island-Adventure (Top-Down-Inselwelt, Erkunden/Farmen/Bauen)
mit Deckbuilding-Kämpfen im Stil von Slay the Spire.
Vollständiges Konzept in `docs/`, Arbeitsplan in `ROADMAP.md`.
**Vor jeder größeren Aufgabe die relevanten docs lesen** — insbesondere
`docs/03-kampf-und-karten.md` für alles Kampfbezogene und
`docs/05-technik-architektur.md` für Architekturentscheidungen.

## Tech-Stack (verbindlich, Begründung in docs/05)

- TypeScript, strict mode
- Vite als Build-Tool
- Phaser 3 für die Inselwelt (Tilemaps, Bewegung, Interaktion)
- React (per Overlay) für Kampf-UI, Menüs, Inventar — DOM eignet sich besser für Karten-UI
- Zustand für gemeinsamen State zwischen Phaser und React
- Vitest für Tests
- Speicherstand: localStorage (V1); Supabase erst später und nur nach Rücksprache

## Architektur-Grundregeln

1. **Spiellogik ist Engine-frei.** Kampfsystem, Progression und Ökonomie leben in
   `src/core/` als reine TypeScript-Module ohne Phaser/React-Imports.
   UI-Schichten konsumieren `core` — nie umgekehrt.
2. **Alles Balancing ist Daten, kein Code.** Karten, Gegner, Rezepte, XP-Kurve,
   Talente liegen als typisierte Objekte in `src/data/`. Keine Magic Numbers
   in der Logik. Ziel: Balancing-Änderungen ohne Logik-Änderung.
3. **Kampfsystem deterministisch & testbar.** Der Kampf-Kern ist eine
   Zustandsmaschine mit injizierbarem RNG (Seed). Jede neue Karten-Mechanik
   bekommt Unit-Tests gegen den Kampf-Kern.
4. **Effekte als Daten-DSL.** Karteneffekte werden deklarativ beschrieben
   (z. B. `{ type: 'damage', amount: 6, target: 'enemy' }`), ein Interpreter in
   `core/combat/` führt sie aus. Keine frei programmierten Effekt-Funktionen
   pro Karte.
5. **Ein Feature = ein vertikaler Schnitt.** Erst spielbar machen, dann verbreitern.

## Konventionen

- Code, Bezeichner, Commits: **Englisch**. Spielinhalte/Strings: **Deutsch**,
  von Anfang an über eine zentrale `strings.ts` (spätere Lokalisierung).
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `data:` für
  reine Balancing-Änderungen).
- Kleine, fokussierte Commits; nach jedem abgeschlossenen Task committen.
- Keine neuen Dependencies ohne kurze Begründung im Commit-Body.

## Definition of Done (pro Task)

- `npm run typecheck`, `npm run lint` und `npm run test` laufen grün
- Neue Kampf-/Progressionslogik hat Tests
- Balancing-Werte liegen in `src/data/`, nicht im Code
- ROADMAP.md-Checkbox des Tasks abgehakt

## Was Claude Code NICHT ohne Rücksprache tut

- Tech-Stack-Wechsel oder neue Frameworks
- Änderungen am Spieldesign, die docs/ widersprechen (stattdessen: Widerspruch
  benennen und nachfragen)
- Online-Features, Accounts, Datenbank-Anbindung
