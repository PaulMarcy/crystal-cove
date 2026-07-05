# ROADMAP — Crystal Cove

Vertikale Schnitte: Jeder Meilenstein endet in etwas Spielbarem.
Claude Code arbeitet Tasks top-down ab und hakt sie per Commit ab.

## M0 — Projekt-Setup
- [ ] Vite + TypeScript (strict) + React + Phaser 3 + Zustand + Vitest aufsetzen
- [ ] Ordnerstruktur gemäß docs/05 anlegen, ESLint + Prettier
- [ ] npm-Scripts: `dev`, `build`, `test`, `typecheck`, `lint`
- [ ] Leere Phaser-Szene + React-Overlay rendern („Hello Island")
- [ ] CI-freundlicher Check: `npm run verify` (typecheck + lint + test)

## M1 — Kampf-Prototyp (Risiko zuerst: macht der Kern Spaß?)
- [ ] Kampf-Zustandsmaschine in `core/combat` (seedbarer RNG, pure reducer)
- [ ] Effekt-Interpreter: damage, block, draw, heal, applyStatus, gainEnergy
- [ ] Statuseffekte: Stärke, Verwundbar, Schwäche, Gift
- [ ] Starter-Deck (12 Karten) + 4 Gegner Tier 1 + 1 Elite als Daten
- [ ] Gegner-Absichten (Zyklus-Muster) inkl. Anzeige-Daten
- [ ] React-Kampf-UI: Hand, Energie, Stapel, Gegner mit Absicht, Sieg/Niederlage
- [ ] Unit-Tests: Kartenkosten, Block-Verfall, Gift-Tick, Mischen, Sieg/Niederlage
- [ ] Playtest-Kriterium: 3 Kämpfe in Folge fühlen sich unterschiedlich an

## M2 — Insel-Slice (Heimatbucht Minimalfassung)
- [ ] Tilemap Heimatbucht (kleiner Ausschnitt), Spielerbewegung, Kollision
- [ ] 3 erntbare Ressourcen (Holz, Kupfer, Beeren) + Inventar
- [ ] Kreaturen auf der Karte; Berührung → Übergang in den Kampf und zurück
- [ ] Kampf-Beute: Ressourcen-Drops nach Gegnertyp
- [ ] Spielstand speichern/laden (localStorage, versioniert)

## M3 — Crafting-Loop (Insel füttert Deck)
- [ ] Schmiede: 5 prägbare Karten aus Erz/Holz (Rezepte als Daten)
- [ ] Kräuterküche: 3 Gerichte als Verbrauchskarten
- [ ] Deck-Truhe: Kampfdeck (12) aus Sammlung zusammenstellen
- [ ] Karten zerlegen (Teilerstattung)
- [ ] Werkzeug-Upgrade Kupferaxt → Eisenaxt hebt Karte „Axtschlag" an

## M4 — Progression
- [ ] XP-System + Level 1–10 mit Meilensteinen (Deck 15, Talisman-Slot 1)
- [ ] Talentbaum V1 (3 Zweige × 3 Stufen)
- [ ] Erkundungsfortschritt + Schattendichte 0–3 auf der Heimatbucht (Eliten ab 2)
- [ ] Dungeon „Verwachsene Höhle": 3 Kämpfe + Boss Wurzelwächter, ohne Heilung
- [ ] Reinigung der Insel nach Boss-Sieg (Dichte dauerhaft 0)

## M5 — Content & Polish
- [ ] Nebelwald (Insel 2) mit Gift-Schule (12 Karten)
- [ ] Resonanz-Stufen 1–3 für die Verwachsene Höhle
- [ ] Animation/Juice-Pass: Karten-Hover, Treffer-Shake, Partikel
- [ ] Audio-Grundgerüst, Balancing-Pass mit Playtest-Daten
