# 02 — Progression: XP, Level, Talente, Inseln, Schattendichte, Resonanz

## XP-System

XP gibt es ausschließlich für Erlebnisse, nie für Wiederholung:

| Quelle | XP |
|---|---|
| Kampf gewonnen (Tier 1 / 2 / 3 / 4 / 5) | 15 / 30 / 55 / 90 / 140 (+7 je zusätzlichem Gegner in Tier 1, docs/07) |
| Elite (Tier 1) | **38 (Konstante, docs/07 maßgeblich — nicht Formel ×2,5)** |
| Boss | 300 × Tier-Faktor |
| Neues Gebiet aufgedeckt | 25 |
| Schrein / Geheimnis entdeckt | 40 |
| Quest abgeschlossen | 30–150 |
| Rezept zum ersten Mal hergestellt | 10–30 |

Repetitive Tätigkeiten (Holz, Erz, Ernte) geben **kein** XP.

**Kurve:** XP für Level n→n+1 = `round(100 × n^1.5)`. Maximallevel 30.
Level-Verlauf grob synchron zu den 5 Inseln (siehe unten).

## Level-Belohnungen

- Jede Stufe: **+5 max. HP** (Start 50 → 195 auf Lv 30)
- Alle 3 Stufen: **1 Talentpunkt** (10 gesamt)
- Meilensteine:

| Level | Freischaltung |
|---|---|
| 4 | Kampfdeck-Obergrenze 12 → 15 Karten (Deck-Größe ist eine Spanne: min. 12, max. levelabhängig) |
| 8 | Talisman-Slot 1 (passive Relikte) |
| 12 | 2 Gerichte pro Expedition |
| 16 | Talisman-Slot 2 |
| 20 | Kampfdeck → 18 Karten |
| 25 | Talisman-Slot 3 |
| 30 | +1 Energie im ersten Zug jedes Kampfes |

**Bewusst NICHT am Level:** Energie pro Zug (3) und Handgröße (5) bleiben fix —
daran hängt die gesamte Kartenbalance. Stärke kommt primär aus dem Deck.

## Talente — V1 (M4): 3 Zweige × 3 Stufen, Ausbau auf 3×6 post-release

Regeln: 1 Punkt pro Talent · Stufen im Zweig sequenziell (Stufe 2 erst nach
Stufe 1) · Talentpunkte: 1 je 3 Level (Lv 3/6/9 → in M4 max. 3) · Respec:
nicht in M4.

| Zweig | Stufe 1 | Stufe 2 | Stufe 3 |
|---|---|---|---|
| **Kämpfer** | Klingenschliff — erster Angriff pro Kampf +2 Schaden | Zähigkeit — +5 max. HP | Bollwerk — Start-Block +3 in Dungeon-Kämpfen |
| **Handwerker** | Sparsame Hände — Karten-Rezepte kosten 1 Basismaterial weniger (min. 1, Spezialmaterialien unberührt) | Guter Koch — Gerichte wirken +25 % (aufgerundet) | Effizientes Zerlegen — Zerlegen erstattet 75 % statt 50 % |
| **Wanderer** | Sammlerglück — +1 Ertrag an Harvest-Nodes | Beutejäger — Kampfbeute +25 % (aufgerundet) | Kartenkenner — Erkundungs-XP (Gebiet/Schrein) +50 % |

Post-release-Kandidaten für die Stufen 4–6 (nicht in M4): „Zweite Luft"
(1×/Dungeon tödlichen Schlag mit 1 HP überleben), Karten-Upgrades günstiger,
Gefahren auf der Karte früher sichtbar, Fluchtchance aus Kämpfen.

## Inseln (feste Tiers, KEIN Level-Scaling)

| # | Insel | Tier | Empf. Level | Kartenschule | Exklusive Ressourcen | Boss |
|---|---|---|---|---|---|---|
| 1 | Heimatbucht | 1 | 1–8 | Grundlagen (Angriff/Block) | Holz, Kupfer, Basisfrüchte | Wurzelwächter |
| 2 | Nebelwald | 2 | 8–14 | Gift & Natur (DoT) | Hartholz, Leuchtpilze | Pilzmutter |
| 3 | Glutfelsen | 3 | 14–20 | Glut (Selbstschaden/Burst) | Eisen, Obsidian | Aschegolem |
| 4 | Frostarchipel | 4 | 20–26 | Frost (Block-Synergien, Verlangsamen) | Eiskristall, Frostkraut | Eisleviathan |
| 5 | Kristallherz | 5 | 26–30 | Kristallmagie | Prismenerz | Der Schattenkern |

Jede Insel bringt: neues Biom + exklusive Ressourcen, eine Kartenschule,
einen Außenposten mit NPCs/Werkstatt-Ausbauten, einen mehrstufigen Dungeon,
dessen Boss-Kristall die nächste Insel freischaltet. Reise per repariertem Boot.

Gegnerstärke hängt an der Insel, nicht am Spielerlevel: zu früh = Prügel,
Rückkehr = spürbare Macht.

## Schattendichte (Gegner werden stärker, während man erkundet)

Pro unbereinigter Insel: Dichte 0–3, steigt bei 25 % / 50 % / 75 %
Erkundungsfortschritt.

| Dichte | Effekt |
|---|---|
| 0 | Grundwerte |
| 1 | Gegner +10 % HP & Schaden |
| 2 | +20 %; **Eliten** erscheinen (Affixe: Gepanzert = 10 Start-Block, Dornig = Vergeltung, Zehrend = mischt Erschöpfungskarte in die Spieler-Ablage (nur dieser Kampf)) |
| 3 | +30 %; **Schattenrisse**: optionale Hochrisiko-Kämpfe mit bester Beute der Insel |

Inselboss besiegt → Insel **gereinigt**: Dichte dauerhaft 0, Insel wird sichere,
voll bewirtschaftbare Heimat. Dramaturgie pro Insel: ankommen → es wird ernst →
Befreiung.

## Resonanz (Aufstieg / Endgame)

Auf gereinigten Inseln schaltet der Kristallschrein wiederholbare Dungeons auf
**Resonanzstufe 1–10** frei (Ascension-Prinzip). Beispiele:

| R | Modifikator |
|---|---|
| 1 | Gegner +15 % HP |
| 2 | Eliten haben immer 1 Affix |
| 3 | Spieler startet Kämpfe mit 1 Benommen-Karte |
| 4 | Bosse erhalten zweite Phase |
| … | kumulativ |
| 10 | Alle Modifikatoren + Schattenversion des Bosses |

Belohnungen: **Prismenstaub** (Karten-Veredelung: Foil + kleiner Bonus),
einzigartige Talismane, Dorf-Trophäen. Freiwilliger Härtegrad — die cozy
Inselwelt selbst wird nie feindseliger.

## Zusammenspiel

Erkunden → XP + Schattendichte steigt → Level → HP/Talente/Deck-Kapazität →
Inseln → neue Karten/Ressourcen/Schulen → Kämpfe → XP + Material → Insel wächst.
Jede Achse füttert die anderen.
