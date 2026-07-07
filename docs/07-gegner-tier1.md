# 07 — Gegner-Roster Tier 1 (Heimatbucht) für M1

Leitprinzip: **Jeder Gegner ist eine Lektion.** Werte sind V1-Richtwerte
(Playtest-Anpassungen als `data:`-Commits). Schattendichte-Skalierung
(+10 % HP & Schaden pro Stufe) kommt multiplikativ obendrauf.

## Normale Gegner

| ID | Name | HP | Zyklus (Absichten) | Lektion |
|---|---|---|---|---|
| shadow_rat | Schattenratte | 12 | Biss 3 → Biss 3 → Nagen 4 | Baseline |
| blighted_boar | Befallenes Wildschwein | 22 | Schnauben (+2 Stärke) → Rammstoß 6 (+Stärke) | Tempo: schnell töten |
| thorn_creeper | Dornenkriecher | 18 | Dornenpanzer (4 Block, Vergeltung 2) → Peitschenhieb 5 → Ranken (1 Schwäche) | Vergeltung, Timing |
| copper_beetle | Kupferkäfer | 16 (+4 Start-Block) | Einigeln (6 Block) ⇄ Zwicken 4 | Block brechen, Burst |
| shadow_gull | Schattenmöwe | 12 | Sturzflug 2×2 → Kreischen (1 Schwäche) | Debuffs, Kill-Order |

## Elite

| ID | Name | HP | Zyklus | Besonderheit |
|---|---|---|---|---|
| thorn_terror | Dornenschreck | 38 | Dornenwall (8 Block, Vergeltung 3) → Doppelhieb 2×5 → Wildwuchs (mischt 1 Erschöpfung in Spieler-Ablage) | Ab Dichte 2: +1 zufälliges Affix (Gepanzert/Dornig/Zehrend) |

## Boss (Vorab-Spezifikation für M4)

**Wurzelwächter** — 90 HP, Dungeon „Verwachsene Höhle".
Zyklus: Wurzelgriff (fügt Spieler 1 Verwurzelt-Zustandskarte zu) →
Erdstampfer 12 (wird 1 Runde vorher groß telegrafiert) → Rindenhaut (10 Block).
Unter 50 % HP: Zorn-Modus — Zyklus verkürzt auf [Wurzelgriff → Erdstampfer 14].
Verwurzelt (Zustandskarte): unspielbar, verstopft die Hand, verschwindet am Zugende.

## Begegnungstabelle Heimatbucht

| Gebiet | Dichte 0–1 | Dichte 2 | Dichte 3 (+ Schattenrisse) |
|---|---|---|---|
| Strand | Ratte · Möwe · Ratte+Ratte | Möwe+Ratte · Käfer | Möwe+Möwe+Ratte |
| Wiese | Schwein · Ratte+Ratte | Möwe+Schwein (Kill-Order!) · Elite 15 % | Schwein+Schwein · Elite 30 % |
| Waldrand | Kriecher · Kriecher+Ratte | Kriecher+Käfer · Elite 20 % | Kriecher+Kriecher+Möwe · Elite 35 % |

Tutorial-Kämpfe (siehe docs/06) nutzen die shadow_rat-Varianten
`shadow_rat_tutorial` „Schattenratte" (10 HP, Zyklus nur [Biss 3]) und
2× „Schattenmaus" (7 HP, [Biss 2 → Ducken 3 Block]).

## XP

Begegnung Tier 1: 15 XP Basis + 7 XP je zusätzlichem Gegner.
Elite-Begegnung: 38 XP. Boss: 300 XP.
XP werden pro Begegnung in core/progression berechnet:
15 + 7×(Zusatzgegner); Elite 38; Boss 300 — Werte in src/data/progression.

## Beutetabellen

| Gegner | Garantiert | Chance |
|---|---|---|
| Schattenratte | 1–2 Schattenfaser | 30 % 1 Beere |
| Wildschwein | 1 Zähes Leder | 60 % 2 Fleisch (Küche) |
| Dornenkriecher | 2 Ranken | 40 % 1 Harz |
| Kupferkäfer | 1–2 Kupfererz (Schmiede-Link!) | 25 % 1 Käferpanzer |
| Schattenmöwe | 2 Federn | 20 % 1 Glanzstück (Verkauf 15 Münzen) |
| Dornenschreck (Elite) | 3 Ranken + 1 Herzdorn (Prägematerial selten) | 25 % Talisman „Dornenring" (Spieler erhält Vergeltung 1 dauerhaft im Kampf) |
| Alle Schattenkreaturen | +1 Schattenstaub (Schrein-Währung) | — |

Dichte 3 / Schattenrisse: Beutemengen ×2, Chance-Drops +20 Prozentpunkte.

## Absicht-Icon-Vokabular (UI)

| Icon | Bedeutung | Anzeige |
|---|---|---|
| Schwert + Zahl | Angriff | echte Zahl inkl. Buffs; Mehrfachschlag „2×2" |
| Schild | Verteidigung | Blockwert |
| Pfeil hoch | Selbst-Buff | Buff-Symbol |
| Wirbel | Debuff gegen Spieler | Status-Symbol |
| Karten-Symbol | Deck-Manipulation | z. B. Erschöpfung |

## Datenformat (Vorgabe für src/data/enemies/tier1.ts)

```ts
export const copperBeetle: EnemyDef = {
  id: 'copper_beetle',
  name: 'Kupferkäfer',
  tier: 1,
  hp: 16,
  startBlock: 4,
  pattern: { kind: 'cycle', steps: [
    { intent: 'defend', effects: [{ kind: 'block', amount: 6, target: 'self' }] },
    { intent: 'attack', effects: [{ kind: 'damage', amount: 4, target: 'player' }] },
  ]},
  loot: {
    guaranteed: [{ item: 'copper_ore', min: 1, max: 2 }, { item: 'shadow_dust', min: 1, max: 1 }],
    chance: [{ item: 'beetle_shell', min: 1, max: 1, p: 0.25 }],
  },
};
```

Boss-Muster nutzen `kind: 'phased'` mit `hpBelow`-Übergängen (siehe docs/05).
