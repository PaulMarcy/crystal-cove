# ROADMAP — Crystal Cove

Vertikale Schnitte: Jeder Meilenstein endet in etwas Spielbarem.
Detailplan mit Akzeptanzkriterien, Agenten- und Skill-Zuordnung: docs/12.
Claude Code arbeitet Tasks top-down ab und hakt sie per Commit ab.

## M0 — Projekt-Setup
- [x] Vite + TypeScript (strict) + React + Phaser 3 + Zustand + Vitest aufsetzen
- [x] Ordnerstruktur gemäß docs/05 anlegen, ESLint + Prettier
- [x] npm-Scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `verify`, `sim`
- [x] Leere Phaser-Szene + React-Overlay rendern („Hello Island")
- [x] Claude-Code-Skills installieren (docs/08): gamedev-Router + web-engines
- [x] GitHub-Remote (public) + Actions: verify.yml (Push) & deploy.yml (Pages, manuell)
- [x] ASSETS.md anlegen (Lizenz-Register) · LICENSE-Entscheidung dokumentieren

## M1 — Kampf-Prototyp
- [x] Kampf-Zustandsmaschine in core/combat (seedbarer RNG, pure Reducer)
- [x] Effekt-Interpreter: damage, block, draw, heal, applyStatus, gainEnergy, addCard, ignoreBlock, retaliate
- [x] Statuseffekte: Stärke, Verwundbar, Schwäche, Gift, Vergeltung
- [x] Daten: Starter-Deck + alle Karten aus docs/10 + Gegner/Elite aus docs/07
- [x] Gegner-Absichten (cycle/phased) inkl. „echte Zahl"-Berechnung
- [x] Kampf-UI vollständig nach docs/11 (Zonen, Zustände, Targeting)
- [x] Headless-Simulator: `npm run sim -- --deck starter --enemy blighted_boar --n 1000`
- [x] Unit-Tests: Kosten, Block-Verfall, Gift-Tick, Mischen, Sieg/Niederlage, Seeds
- [x] Playtest-Kriterium: 3 Kämpfe in Folge fühlen sich unterschiedlich an

## M2 — Insel-Slice (Heimatbucht minimal)
- [x] Tilemap Heimatbucht (Strand + Wiese + Waldrand), Bewegung, Kollision (Tiled-Import)
- [x] Ernten: Holz, Stein, Kupfer, Beeren + Inventar-UI
- [x] Kreaturen auf Karte, Begegnungs-Trigger → Kampf → Rückkehr mit Beute
- [x] Begegnungstabellen nach Gebiet (docs/07)
- [x] Save V1: localStorage, versioniert, Backup-Slot, Korruptions-Recovery

## M3 — Crafting-Loop
- [x] Schmiede + Küche St. 1 (Rezepte aus docs/10), Werkstatt-UI
- [x] Deck-Truhe (Kampfdeck 12 aus Sammlung), Karten zerlegen (50 %)
- [x] Gerichte als Verbrauchskarten inkl. Nachkochen
- [x] Werkzeugstufe 2 („Verstärkt") hebt Axtschlag 6→8
- [x] Farming: Beete, Wachstum pro Schlafphase (docs/10)

## M4 — Progression
- [x] XP/Level 1–10 + Meilensteine (Deck 15, Talisman-Slot 1), Talentbaum 3×3
- [x] Erkundungs-% + Schattendichte 0–3 (Eliten ab 2, Affixe)
- [ ] Dungeon „Verwachsene Höhle": 3 Kämpfe + Wurzelwächter (phased), Orin-Rettung
- [ ] Reinigung (Dichte dauerhaft 0), Talismane funktional; offen aus Task 2: Schattenrisse (Dichte 3, docs/07: Beute ×2, Chance-Drops +20 pp — Loot-Konstanten liegen in data/encounters/tier1, Map-Spawn + Encounter-Mechanik fehlen)
- [ ] Niederlage-Fluss: Aufwachen im Bett + Beute-Malus

## M5 — Dorf, NPCs & Quests
- [ ] Bauplatz-System B1–B9 (docs/09), Bau-UI
- [ ] Dialog-System (Portrait, Textbox, Weiter; Choices vorbereitet)
- [ ] NPC-Ankunftstrigger, Freundschaftsketten aller 6 NPCs, Questlog minimal
- [ ] Markt + Schwarzes Brett (Münz-Ökonomie), Angeln (Steg)
- [ ] Schrein: Verzaubern + Karten-Upgrade (Karte+)
- [ ] Piya-Kette bis „Überfahrt freigeschaltet" (Weltkarte zeigt Insel 2 gesperrt)

## M6 — Onboarding, Menüs, Audio, Einstellungen
- [ ] Onboarding Beats 1–6 (docs/06) inkl. Skript-Kämpfe, Flags, Skip-Option
- [ ] Hauptmenü (Neu/Laden/Slots), Pause, Beute-Panel, Game-Over-frei-Niederlage
- [ ] Einstellungen: SFX-/Musik-Lautstärke, Textgeschwindigkeit, Effekte reduzieren, Vollbild, Schriftgröße
- [ ] Audio-Grundgerüst (howler.js): SFX-Liste v1 (Karte, Treffer, Block, Ernte, Bau, UI) + 2 Musik-Loops (Insel, Kampf) aus CC0
- [ ] strings.ts vollständig (DE), EN-Gerüst

## M7 — Polish, Balancing & Content-Fill
- [ ] Juice-Pass (docs/11-Feedback + game-feel-Skill), Grafik-Stufe 2 (docs/04)
- [ ] Balancing-Pass mit Simulator-Reports + Playtests, Kartenpool auf ~30 füllen
- [ ] Performance: 60 fps Budget, Textur-Atlas, Insel-Lazy-Load
- [ ] Regressions-Checkliste QA (docs/12), Bugfix-Runde

## M8 — Release
- [ ] itch.io-Seite (Texte, Screenshots, GIF) + Butler-Upload (itch-publish-Skill)
- [ ] GitHub Pages Deploy, Versionierung v1.0 (semver ↔ Save-Version)
- [ ] ASSETS.md final geprüft (jede Lizenz), LICENSE im Repo
- [ ] Post-Release-Backlog: Nebelwald (Insel 2), Resonanz 1–3, Deko-Bau, Touch
