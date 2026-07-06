# Crystal Cove (Arbeitstitel)

Cozy Island-Adventure trifft Deckbuilding-Kampf.
Inselwelt im Stil von *Island of Mine* (Top-Down, Pixel-Art, Erkunden, Farmen, Dorfbau) —
Kämpfe laufen als Kartenduell im Stil von *Slay the Spire*.

**Kern-Hook:** Die Insel IST der Deckbuilder. Werkstätten wandeln Ressourcen in Karten,
Werkzeuge existieren doppelt (Axt auf der Insel = Angriffskarte im Kampf),
Ernte wird zu Verbrauchskarten, NPCs lehren Kartenschulen.

## Repo-Struktur

| Pfad | Inhalt |
|---|---|
| `CLAUDE.md` | Arbeitsanweisungen und Konventionen für Claude Code |
| `ROADMAP.md` | Meilensteine M0–M5 mit Definition of Done |
| `docs/01-vision.md` | Spielvision, Design-Säulen, Referenzen |
| `docs/02-progression.md` | XP, Level, Talente, Inseln, Schattendichte, Resonanz |
| `docs/03-kampf-und-karten.md` | Kampfregeln, Karten-Ökonomie, Crafting |
| `docs/04-art-direction.md` | Stil, Palette, Asset-Pipeline |
| `docs/05-technik-architektur.md` | Tech-Stack, Architektur, Datenmodell |

## Entwicklung

```bash
npm ci          # Abhängigkeiten
npm run dev     # Dev-Server (Vite)
npm run verify  # typecheck + lint + test — Pflicht vor jedem Commit
```

Stack: TypeScript (strict) · Vite · Phaser 3 (Inselwelt) · React (Kampf-/Menü-UI) ·
Zustand · Vitest. Details: `docs/05-technik-architektur.md`.

## Lizenz

Code: [MIT](LICENSE) (Entscheidung M0). Fremd-Assets: je Eintrag in `ASSETS.md`.

## Status

M0 (Projekt-Setup) in Arbeit, siehe `ROADMAP.md`.
