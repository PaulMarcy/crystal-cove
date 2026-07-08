# ASSETS.md — Lizenz-Register

Jedes fremde Asset (Grafik, Audio, Font, Tileset) wird hier ab dem ersten
Import dokumentiert (Pflicht laut docs/08). CC0 bevorzugen.

| Asset | Quelle | Lizenz | Verwendung | Hinzugefügt |
| ----- | ------ | ------ | ---------- | ----------- |
| _(noch keine Fremd-Assets)_ | — | — | — | — |

## Selbst generierte Platzhalter (keine Fremd-Assets, kein Lizenzbedarf)

| Asset | Erzeugt durch | Verwendung |
| ----- | ------------- | ---------- |
| `public/assets/tilesets/heimatbucht.png` | `scripts/generate-heimatbucht.ts` (deterministisch, Palette aus docs/04) | Platzhalter-Tileset Heimatbucht (M2, Grafikstufe 1) |
| `public/assets/maps/heimatbucht.json` | `scripts/generate-heimatbucht.ts` | Tiled-JSON-Map Heimatbucht (Zonen Strand/Wiese/Waldrand) |
| Spieler-Sprite (Laufzeit-Textur) | `src/world/scenes/HeimatbuchtScene.ts` | Platzhalter-Spielerfigur |

## Regeln

- Kein Import ohne Eintrag hier (Datei, Quelle-URL, Lizenz, ggf. Attributionstext).
- CC0 bevorzugen; bei CC-BY den geforderten Credit-Text mit aufnehmen.
- Vor Release (M8): Vollaudit — jede Zeile gegen die Quelle prüfen.
