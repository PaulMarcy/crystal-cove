# 12 — Implementierungsplan (Übergabe an Claude Code)

Dieser Plan ergänzt ROADMAP.md um Arbeitsweise, Akzeptanzkriterien,
Agenten-Zuordnung und Skill-Einsatz. Er ist das Einstiegsdokument für die
Umsetzung. Reihenfolge der Pflichtlektüre: AGENTS.md → CLAUDE.md → dieses
Dokument → jeweilige Fach-Docs.

## Arbeitsweise

1. **Ein Task = ein Arbeitspaket:** Task aus ROADMAP wählen → betroffene Docs
   lesen → implementieren → Tests → `npm run verify` grün → Commit →
   Checkbox abhaken. Keine parallelen Baustellen.
2. **Bei Widerspruch zwischen Docs:** nicht still entscheiden — Widerspruch
   benennen (wie der Hartholz-Fix in docs/10) und im Zweifel nachfragen.
3. **Design-Änderungen** nur als Doc-Änderung + Code, nie Code allein.
4. **Balancing-Änderungen** ausschließlich in src/data als `data:`-Commit,
   idealerweise mit Simulator-Beleg im Commit-Body.

## Vollständigkeits-Check (geschlossene Lücken)

| Aspekt | Regelung |
|---|---|
| Zeit/Farming | Wachstum pro Schlafphase, kein Tageszyklus (docs/10) |
| Dialog-System | M5: Portrait + Textbox + Weiter, Choices vorbereitet |
| Menüs/Pause/Einstellungen | M6 inkl. Lautstärken, Textgeschwindigkeit, Effekte reduzieren, Vollbild, Schriftgröße |
| Audio-Inhalte | M6: SFX-Liste v1 + 2 CC0-Musik-Loops; Quellen in ASSETS.md |
| Save-Robustheit | Backup-Slot, Versionierung, Recovery bei Korruption (M2) |
| Balancing-Werkzeug | Headless-Simulator `npm run sim` ab M1 |
| Release-Pflichten | M8: Lizenz, ASSETS.md-Audit, itch-Seite, semver ↔ Save-Version |
| Accessibility | Nie-nur-Farbe (erfüllt: Icons), Schriftgröße, Effekte reduzieren |

**Explizite Nicht-Features (nicht „hilfreich" hinzufügen):** Tag/Nacht-Zyklus,
Hunger/Ausdauer, Werkzeug-Haltbarkeit, Permadeath, Multiplayer, Telemetrie/
Analytics, Echtgeld, Backend/Accounts.

## Akzeptanzkriterien je Meilenstein

- **M0:** `npm run verify` läuft lokal und in GitHub Action; leere Szene +
  Overlay sichtbar; Skills installiert (Nachweis: /skills-Listing im PR-Text).
- **M1:** Alle docs/07-Gegner und docs/10-Karten spielbar; Sim-Lauf
  starter vs. jeden Gegner liegt zwischen 55–95 % Winrate (sonst data:-Fix);
  UI erfüllt alle 7 Zustände aus docs/11; Testabdeckung core/combat > 80 %.
- **M2:** Loop Insel→Kampf→Insel ohne Reload; Save überlebt Browser-Neustart
  und absichtliche Korruption (Recovery-Test).
- **M3:** Kern-Hook erlebbar: Erz sammeln → Karte prägen → im Kampf ziehen;
  Zerlegen erstattet korrekt; Werkzeugstufe skaliert Axtschlag.
- **M4:** Dungeon-Run inkl. Boss & Orin-Rettung; Dichte verändert nachweislich
  Gegnerwerte (Sim-Vergleich D0 vs. D3); Niederlage-Fluss ohne Sackgasse.
- **M5:** Alle 6 NPC-Ketten abschließbar; Piya-Kette endet mit gesperrter
  Weltkarten-Insel 2 (sichtbar-verwehrtes-Ziel-Muster).
- **M6:** Onboarding in < 35 Min. durchspielbar (Selbsttest mit Timer-Log);
  Skip erzeugt Beat-6-Zustand; alle Einstellungen persistiert.
- **M7:** 60 fps auf Mittelklasse-Laptop (Chrome-Profiler-Beleg); Kartenpool
  ≥ 30; Regressions-Checkliste grün.
- **M8:** Spiel öffentlich auf itch.io UND GitHub Pages spielbar; ASSETS.md
  deckt 100 % der Fremd-Assets.

## Agenten (Definition in .claude/agents/, Übersicht in AGENTS.md)

| Agent | Zuständig für | Haupteinsatz |
|---|---|---|
| core-engineer | core/ + Tests, Effekt-DSL, Zustandsmaschinen | M1, M2, M4 |
| ui-engineer | ui/ + world/ (React, Phaser), docs/11-Treue | M1–M3, M5, M6 |
| content-smith | src/data ↔ docs-Sync, neue Karten/Gegner/Rezepte | M1, M3, M5, M7 |
| balance-analyst | Simulator bauen/fahren, Winrate-Reports, data:-Vorschläge | M1, M4, M7 |
| qa-playtester | Akzeptanzkriterien prüfen, Regressionsliste, Bug-Repros | jedes M-Ende |
| consistency-auditor | Doc↔Doc- und Doc↔Code-Widersprüche finden | vor M-Start |
| release-manager | Builds, CI, Pages/itch-Deploy, Lizenz-Audit | M0, M8 |

Orchestrierung: Hauptsession plant und delegiert; pro Task höchstens ein
Agent federführend. qa-playtester hat Veto auf Meilenstein-Abschluss.

## Skill-Einsatz je Phase (Quellen: docs/08)

| Phase | Skills |
|---|---|
| M0 | Router-Setup; ggf. skill-creator (anthropics/skills) für projekteigenen Balancing-Skill |
| M1 | card-game (Deck/Hand/Ablage-Muster), phaser-core |
| M2 | phaser-core, phaser-arcade-physics, save-systems |
| M3–M5 | rpg (Inventar/Quests/Stats), save-systems |
| M6 | save-systems (Slots/Settings) |
| M7 | game-feel (Juice) |
| M8 | itch-publish |

## CI/GitHub (in M0 anzulegen)

- `.github/workflows/verify.yml`: bei jedem Push `npm ci && npm run verify`
- `.github/workflows/deploy.yml`: manuell/Tag → Build → GitHub Pages
- Branch-Modell: trunk-based, direkt auf main (Solo-Projekt); Tags `v0.x`
- Save-Version wird bei jedem Format-Change erhöht + Migration in core/save

## Eskalationsregeln (wann Claude Code den Menschen fragt)

Design-Widerspruch zwischen Docs · Feature ohne Doc-Grundlage nötig ·
Balancing außerhalb 55–95 %-Korridor trotz zwei data:-Iterationen ·
neue Dependency · alles aus „Nicht-Features".
