# AGENTS.md — Crystal Cove

Einstiegspunkt für alle Coding-Agenten (Claude Code u. a.).
Pflichtlektüre-Reihenfolge: diese Datei → CLAUDE.md (Konventionen &
Architekturregeln) → docs/12-implementierungsplan.md → ROADMAP.md →
Fach-Doc des aktuellen Tasks.

## Projekt in einem Satz

Browser-Spiel: Cozy Island-Adventure (Phaser-3-Inselwelt) mit
Slay-the-Spire-Kartenkämpfen (React-Overlay); die Insel erzeugt das Deck.

## Setup & Befehle

```bash
npm ci                # Abhängigkeiten
npm run dev           # Dev-Server (Vite)
npm run verify        # typecheck + lint + test — muss vor JEDEM Commit grün sein
npm run test          # Vitest
npm run sim -- --deck starter --enemy blighted_boar --n 1000   # Balancing-Simulator (ab M1)
npm run build         # Produktions-Build
```

## Struktur (Details: docs/05)

`src/core` reine Spiellogik (KEINE Engine-Imports) · `src/data` alle
Balancing-Daten · `src/world` Phaser · `src/ui` React · `src/shared`
Typen/Events/strings.ts. UI konsumiert core über den Zustand-Store — nie umgekehrt.

## Eiserne Regeln

1. Balancing nur in `src/data` (`data:`-Commits), keine Magic Numbers im Code.
2. Kampf-Kern deterministisch, RNG injizierbar, neue Mechanik = neue Tests.
3. Design steht in docs/ — Code folgt Docs; Widersprüche melden, nicht raten.
4. Nicht-Features aus docs/12 niemals eigenmächtig einbauen.
5. Strings nur über `shared/strings.ts` (Deutsch zuerst).
6. Conventional Commits; kleine, fokussierte Commits pro Task.

## Agenten-Roster (Definitionen: .claude/agents/)

| Agent | Wofür delegieren |
|---|---|
| core-engineer | Kampf-/Progressions-/Ökonomie-Logik in core/ inkl. Tests |
| ui-engineer | React-UI & Phaser-Szenen nach docs/11 und docs/04 |
| content-smith | Karten/Gegner/Rezepte/NPCs in src/data, synchron zu docs/ |
| balance-analyst | Simulator-Läufe, Winrate-Reports, Daten-Tuning-Vorschläge |
| qa-playtester | Akzeptanzkriterien & Regressionsliste je Meilenstein (Veto-Recht) |
| consistency-auditor | Widerspruchssuche Docs↔Docs↔Code vor jedem Meilenstein |
| release-manager | CI, Builds, GitHub Pages, itch.io, Lizenz-Audit (ASSETS.md) |

Faustregel: Hauptsession orchestriert, genau ein federführender Agent pro Task.

## Definition of Done (jeder Task)

verify grün · Tests für neue Logik · Daten in src/data · betroffene Docs
aktuell · ROADMAP-Checkbox abgehakt · Commit gepusht.

## Eskalation an den Menschen

Doc-Widerspruch, fehlende Design-Grundlage, neue Dependency,
Balancing-Korridor (55–95 %) nach 2 Iterationen verfehlt, Nicht-Feature-Bedarf.
