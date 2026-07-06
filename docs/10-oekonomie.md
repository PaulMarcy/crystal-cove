# 10 — Crafting-Ökonomie (Heimatbucht V1)

## Design-Formeln

1. **Prägekosten nach Seltenheit:** Gewöhnlich = 4–6 Einheiten Sammelmaterial ·
   Selten = 8–12 + 1 Spezialmaterial (Kampf-Drop) · Episch = Elite-/Boss-Material.
2. **Flussrate (wichtigste Stellschraube):** 1 Tier-1-Begegnung ≈ Material im
   Wert von 1/3 gewöhnlicher Karte → **~3 Begegnungen pro neuer Karte**.
   Alle Preise sind aus dieser Rate rückgerechnet.
3. **Zerlegen:** 50 % Erstattung, abgerundet. Spezialmaterial wird nie erstattet.

## Ressourcenkatalog Tier 1

| Quelle | Ressourcen |
|---|---|
| Sammeln | Holz, Stein, Kupfererz, Beeren, Kürbis & Chili (Farming), Honig (selten, Dichte 2+) |
| Angeln (Steg) | Fisch |
| Kampf-Drops | Schattenfaser, Zähes Leder, Fleisch, Ranken, Harz, Käferpanzer, Federn, Glanzstück, Herzdorn (Elite), Schattenstaub (alle Schattenwesen) |
| Währung | Münzen |

## Schmiede

| St. | Karte | Kosten | Effekt |
|---|---|---|---|
| 1 | Funkenschlag | 2 Kupfer + 2 Holz | 1⚡ · 4 Schaden, ziehe 1 (Onboarding) |
| 1 | Schwerer Hieb | 3 Kupfer + 1 Stein | 2⚡ · 10 Schaden (Maro-Kette 1) |
| 1 | Steinwall | 2 Stein + 1 Holz | 1⚡ · 7 Block |
| 1 | Wurfbeil | 2 Kupfer + 1 Feder | 0⚡ · 4 Schaden |
| 2 | Panzerbrecher | 2 Kupfer + 2 Käferpanzer | 1⚡ · 6 Schaden, ignoriert Block (Maro-Kette 2) |
| 2 | Doppelschlag | 4 Kupfer + 1 Leder | 1⚡ · 2×4 Schaden |
| 2 (Bruna 1) | Gegenhalten | 2 Holz + 2 Ranken | 1⚡ · 4 Block, Vergeltung 3 |
| 2 (Bruna 2) | Riposte | 2 Kupfer + 2 Ranken | 1⚡ · 6 Schaden, +6 falls diese Runde geblockt |

## Küche (Gerichte = Verbrauchskarten)

| St. | Gericht | Kosten | Effekt |
|---|---|---|---|
| 1 | Beerensnack | 3 Beeren | heilt 5 |
| 1 | Kürbiseintopf | 1 Kürbis + 1 Fleisch | heilt 8 (Tilda-Kette 1) |
| 2 | Chili-Spieß | 1 Chili + 2 Fleisch | +2 Stärke für den Kampf (Tilda-Kette 2) |
| 2 | Gebratener Fisch | 2 Fisch | heilt 6, ziehe 1 |

Gerichte verlassen das Deck nach Nutzung (Nachkochen nötig). Slots pro
Expedition: 1, ab Haus-Ausbau bzw. Lv 12 → 2 (siehe docs/02/09).

## Kristallschrein (Orin)

| Funktion | Kosten | Effekt |
|---|---|---|
| Splitterblitz prägen | 8 Schattenstaub + 1 Kupfer | 2⚡ · 8 Schaden, ziehe 1 |
| Kristallschild prägen | 6 Schattenstaub + 2 Stein | 1⚡ · 5 Block, nächste Karte −1⚡ |
| **Karten-Upgrade (Karte+)** | gewöhnlich: 5 Staub + 20 Münzen · selten: 10 Staub + 40 Münzen | Hauptwert +2 bis +3 (StS-Prinzip), 1 Upgrade pro Karte |

## Werkzeugstufen (Schmiede)

| Stufe | Upgrade-Kosten | Axtschlag-Schaden | Sonstiges |
|---|---|---|---|
| 1 Kupfer (Start) | — | 6 | — |
| 2 Verstärkt | 3 Kupfer + 2 Leder (Maro) | 8 | Ernten +1 Ertrag |
| 3 Eisen (Glutfelsen) | Eisen — Insel 3 | 10 | erschließt harte Erzadern |

## Münz-Ökonomie

**Quellen:** Glanzstück-Verkauf (15), Überschussmaterial (1–3/Stück),
Schwarzes Brett (10–25 pro Bitte).
**Senken:** Schrein-Upgrades, Piyas Sortiment (Spezialmaterial: Käferpanzer 12,
Harz 10, Herzdorn 60 — rotiert pro Weltkarten-Besuch, teurer als Erspielen →
Kaufen ist Abkürzung, nie Pflicht).

## Konsistenz-Fixes (dieser Commit)

- doc 09: Steg kostet 4 Holz + 4 Ranken (statt Hartholz — das ist Insel-2-exklusiv)
- doc 09: Piya-Boot Teil 1 kostet 10 Holz + 4 Leder (statt Hartholz) —
  verhinderte Deadlock: Insel-2-Material für Insel-2-Freischaltung
