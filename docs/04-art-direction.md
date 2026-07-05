# 04 — Art Direction

## Stilrichtung

Warme, verspielte **Pixel-Art** in Top-Down-Perspektive (Referenz: Island of Mine,
Wildfrost für den Kampfbildschirm). Hochwertigkeit entsteht durch Konsistenz,
UI-Qualität und Animation — nicht durch Detailgrad.

## Farbregeln (Palette V1)

| Rolle | Farbe | Hex-Anker |
|---|---|---|
| Wiese / Natur | warmes Grün | #8FBF6F |
| Sand / Wege | Creme | #ECD9A3 |
| Wasser | freundliches Türkisblau | #79BFD1 |
| Kristall / Magie / Fortschritt | Violett | #9668D8 |
| Schatten-Korruption | dunkles Violett-Grau | #55486E |
| Interaktion / Hinweis / spielbare Karte | warmes Orange | #FF9A4A |
| UI-Grund | dunkles Warmbraun | #3A2E28 |

Feste Bedeutungen: **Violett = Magie/Fortschritt, dunkles Violett = Bedrohung,
Orange = „hier kannst du handeln"**. Diese Logik gilt auf Insel, im Kampf und im UI.

## Zwei Detailstufen pro Motiv

1. **Spielfeld-Sprites** (klein, 16–32 px Basis): klare Silhouetten,
   wenige Töne, Lesbarkeit vor Detail. Jede Kreatur/Klasse muss als
   Silhouette erkennbar sein.
2. **Karten-Artworks & Portraits** (groß): detaillierte Illustrationen im
   selben Farbklima. Hier entsteht die emotionale Bindung.

## Asset-Pipeline

- **UI, Kartenrahmen, Overlays:** als Code (HTML/CSS bzw. Engine-Grafik),
  keine Bilder — scharf, lokalisierbar, animierbar
- **Tiles & Spielfeld-Sprites:** Phase 1 mit gekauften/freien Pixel-Packs
  prototypisieren (der Island-of-Mine-Entwickler verkauft passende
  „Pixel Kingdom"-Asset-Packs auf itch.io — stilistisch naheliegend);
  später durch eigene/AI-gestützte Assets ersetzen
- **Karten-Artworks:** AI-Pipeline mit Style-Referenzblatt: ein Master-Artwork
  definiert Palette + Rendering, alle weiteren Generationen laufen mit
  Bildreferenz. Nachbearbeitung: Freistellen, Farbkorrektur auf Palette
- **Animation ist Pflicht, nicht Kür:** Karten-Hover/-Ausspielanimation,
  Treffer-Feedback (Shake, Blitz), Idle-Wippen der Sprites, Partikel bei
  Kristall-Effekten. Balatro-Lektion: Bewegung verkauft flache Grafik.

## Kampfbildschirm-Layout

Statische Bühne: Spieler-Avatar links, 1–3 Gegner rechts (Absicht-Icons über
den Köpfen), Handfächer unten, Energie-Anzeige links unten, Nachzieh-/
Ablagestapel in den Ecken. Hintergrund = Biom der aktuellen Insel.
