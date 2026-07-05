# 08 — Toolchain & Kostenplan (Ziel: 0 €)

Grundsatz: Ausschließlich kostenlose / Open-Source-Werkzeuge. Einzige laufende
Kosten: vorhandenes Claude-Abo. Jede Abweichung braucht eine bewusste Entscheidung.

## Claude-Code-Skills (Teil von M0-Setup)

| Quelle | Was | Lizenz | Install |
|---|---|---|---|
| `gamedev-skills/awesome-gamedev-agent-skills` | Router + 66 Game-Dev-Skills. Relevant: `phaser-core`, `phaser-arcade-physics`, `card-game` (Deck/Hand/Ablage → M1), `rpg` (Stats/Leveling → M4), `save-systems`, `game-feel` (Juice → M5), `itch-publish` | Apache-2.0 | `claude plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills` → `claude plugin install router@awesome-gamedev-agent-skills` + `web-engines@…` (schlankes Bundle) oder Voll-Install `gamedev@…` |
| `anthropics/skills` | offizieller Marketplace; v. a. `skill-creator` für spätere projekteigene Skills (z. B. Crystal-Cove-Balancing-Skill mit unseren Datenformaten) | Anthropic | `/plugin install example-skills@anthropic-agent-skills` (bei Bedarf) |

**Sicherheitsregel:** Skills führen Code aus. Nur geprüfte Quellen; vor Install
die SKILL.md-Dateien überfliegen. Keine Skills mit externen API-Abhängigkeiten
(potenzielle Kosten/Datenabfluss).

## Code-Stack (fixiert in docs/05)

Node.js LTS · npm · Vite · TypeScript strict · Phaser 3 · React · Zustand ·
Vitest · ESLint + Prettier · howler.js (Audio, ab M5) — alles MIT/OSS, 0 €.

## Content-Tools

| Zweck | Tool | Kosten | Anmerkung |
|---|---|---|---|
| Pixel-Art | LibreSprite oder Pixelorama | 0 € | Aseprite (~20 €) bewusst NICHT — Funktionsumfang für uns gleichwertig |
| Schnellskizzen | Piskel (Browser) | 0 € | |
| Tilemaps | Tiled Map Editor | 0 € (pay what you want) | Phaser lädt Tiled-JSON nativ — Standard-Workflow |
| Platzhalter-Assets | Kenney.nl (CC0), freie Cozy-Tilesets auf itch.io, OpenGameArt | 0 € | CC0 bevorzugen (keine Attributionspflicht). „Pixel Kingdom"-Packs (Island-of-Mine-Dev): optional & kostenpflichtig → vertagt |
| SFX | jsfxr / ChipTone (Browser) | 0 € | Retro-SFX-Generatoren |
| Audio-Bearbeitung | Audacity | 0 € | |
| Musik | CC0 (freesound.org, OpenGameArt); später LMMS | 0 € | Lizenz je Track in ASSETS.md dokumentieren |
| Fonts | freie Pixel-Fonts (z. B. Google Fonts, itch.io-Freefonts) | 0 € | Lizenz prüfen & dokumentieren |

## Repo, CI, Deployment

| Zweck | Wahl | Kosten |
|---|---|---|
| Remote-Repo | GitHub, public | 0 € |
| CI | GitHub Actions: `npm run verify` bei jedem Push | 0 € (public repos) |
| Hosting | itch.io (HTML5-Upload via butler, Skill vorhanden) und/oder GitHub Pages | 0 € |
| Backend | KEINS — localStorage. Supabase-Free-Tier nur nach expliziter Entscheidung (Komplexität, nicht Kosten, ist das Argument) | 0 € |

## Pflichten

- `ASSETS.md` im Repo: Quelle + Lizenz jedes fremden Assets ab dem ersten Import
- Neue Tools/Dependencies nur mit OSS-Lizenz oder expliziter 0-€-Prüfung
- M0-Checkliste erweitert um: Skills installieren, GitHub-Remote + Actions einrichten
