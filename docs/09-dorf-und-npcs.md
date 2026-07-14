# 09 — Dorf & NPCs (Heimatbucht V1)

## Grundsätze

1. **Ankunft durch Taten:** Jeder NPC hat einen Spielerhandlungs-Trigger (Rettung,
   Reparatur, Bau, Reinigung). Keine Zeit-/Zufalls-Events.
2. **Feste Bauplätze (V1):** Vorgezeichnete Slots im Lager, freilegen + bebauen.
   Freies Deko-Platzieren erst M5+.
3. **Freundschaft ohne Grind:** 3 Stufen pro NPC, steigen NUR über die persönliche
   Questkette. Keine täglichen Geschenke, keine Zerfalls-Mechanik.
4. **NPCs lehren Rezepte, nicht Karten:** Lektionen schalten Prägerezepte an
   Werkstätten frei — eine einzige Karten-Ökonomie.

## Bauplätze Heimatbucht

| Slot | Gebäude | Voraussetzung | Effekt |
|---|---|---|---|
| B1 | Zelt → Hütte → Haus | Onboarding / 8 Holz + 4 Stein / 12 Holz + 6 Stein + 2 Zähes Leder | Speichern; Haus: +1 Gericht-Slot auf Expedition (Cap 2 gesamt — nicht additiv mit Lv 12) |
| B2 | Kochstelle → Küche St. 2/3 | Onboarding / Tilda St.1 + 6 Holz + 4 Stein + 2 Harz / Tilda St.2 + 6 Holz + 4 Stein + 2 Harz | Gerichte-Rezepte je Stufe |
| B3 | Schmiede St. 1→3 | Beat 6 / Maro St.1 + 6 Stein + 4 Kupfer / Maro St.2 + 6 Stein + 4 Kupfer | Prägerezepte je Stufe, Werkzeug-Upgrades |
| B4 | Wohnhaus 1 | 10 Holz + 6 Stein | Tilda zieht ein |
| B5 | Steg | 4 Holz + 4 Ranken (Kriecher-Drops) | Bruna zieht ein; Angeln |
| B6 | Kristallschrein | Orin befreit + 10 Schattenstaub (unabhängig von B7 baubar) | Verzaubern, Karten-Upgrade, später Resonanz |
| B7 | Wohnhaus 2 | Orin gerettet + 10 Holz + 8 Stein + 2 Zähes Leder | Orin zieht ein (bis dahin steht er am Dorfplatz) |
| B8 | Markt | Insel gereinigt + 12 Holz + 4 Stein | Piya; Handel + Schwarzes Brett |
| B9 | Bootshaus | Piya-Kette abgeschlossen | Überfahrt Nebelwald (Insel 2) |

## NPC-Roster

### Lumen (Kristallfuchs) — Mentor
- **Ankunft:** von Anfang an (Onboarding Beat 2)
- **Funktion:** Hauptquest-Geber, diegetisches Tutorial, Insel-Lore in Einzeilern
- **Keine Freundschaftsstufen** (Story-Figur)

### Maro (Schmied)
- **Ankunft:** Schmiede-Ruine repariert
- **Funktion:** Schmiede-Ausbau, Werkzeug-Upgrades (Kupfer→Eisen…)
- **Kette:** (1) „Mein altes Werkzeug" — Kiste am Strandwrack bergen →
  Schmiede St. 2 freigeschaltet, Rezept *Schwerer Hieb* ·
  (2) „Käferpanzer" — 3 Käferpanzer (Kupferkäfer-Chance-Drop) →
  Rezept *Panzerbrecher* (ignoriert Block) ·
  (3) „Das Meisterstück" — 1 Herzdorn (Elite-Drop) →
  Talisman **Amboss-Herz** (+1 Block auf jede Verteidigungskarte)

### Tilda (Köchin)
- **Ankunft:** Wohnhaus 1 gebaut
- **Funktion:** Küchen-Ausbau, Gerichte
- **Kette:** (1) 5 Beeren + 2 Fleisch → Rezept *Kürbiseintopf* (heilt 8) ·
  (2) 3 Fische (braucht Steg → Quest verweist auf Bruna: NPC-Vernetzung) →
  Rezept *Chili-Spieß* (+2 Stärke im Kampf) ·
  (3) seltener Honig (Wiese, Dichte 2+) → Talisman **Warmer Bauch**
  (Kampfstart: heile 3)

### Bruna (alte Fischerin)
- **Ankunft:** Steg gebaut
- **Funktion:** Angeln (Minispiel-frei: Köder rein, Beute nach Gebiet),
  kauft Fisch; **lehrt Konter-Schule**
- **Kette:** (1) „Alte Netze" — 4 Ranken → Rezept *Gegenhalten* (4 Block;
  wenn getroffen: 3 Schaden zurück) · (2) „Der Riesenwels" — Angel-Quest →
  Rezept *Riposte* (6 Schaden, +6 wenn du diese Runde geblockt hast) ·
  (3) „Brunas Geschichte" — Dialog-Quest nach Reinigung →
  Talisman **Seemannsgarn** (erste Verteidigungskarte je Kampf kostet 0)

### Orin (Einsiedler-Magier)
- **Ankunft:** im Dungeon „Verwachsene Höhle" befreit (Raum 2, vor dem Boss —
  emotionale Belohnung des Dungeons)
- **Funktion:** Kristallschrein: Verzaubern (Karten-Varianten mit Schattenstaub),
  Karten-Upgrade (+Werte); später Resonanz-Verwaltung; **lehrt Kristall-Grundlagen**
- **Kette:** (1) Schrein errichten (10 Schattenstaub) → Rezept *Splitterblitz*
  (2 Energie, 8 Schaden, 1 Karte ziehen) · (2) „Resonanzprobe" — 1 Kampf mit
  mind. 3 verzauberten Karten im Deck → Upgrade-Funktion freigeschaltet ·
  (3) nach Reinigung: Rezept *Kristallschild* (5 Block, nächste Karte kostet 1 weniger)

### Piya (Händlerin)
- **Ankunft:** Insel gereinigt (ihr Boot ankert am Strand)
- **Funktion:** Markt (kauft Glanzstücke/Überschuss, verkauft seltene Materialien,
  rotierendes Sortiment pro Besuch der Weltkarte — nicht pro Echtzeit),
  Schwarzes Brett
- **Kette = Boot-Reparatur (Tor zu Insel 2):** (1) 10 Holz + 4 Zähes Leder ·
  (2) 5 Harz (Kriecher-Chance-Drop) · (3) Probefahrt-Quest →
  **Überfahrt wählbar; Insel 2 (Nebelwald) bleibt in V1 gesperrt und zeigt
  einen Hinweistext (sichtbar-verwehrtes-Ziel-Muster, siehe docs/12 M5)**

## Freundschaftsregeln

- Stufen 0–3, steigen nur durch die persönliche Kette (je Quest +1)
- Belohnungslogik: St. 1 = Rezept · St. 2 = Rezept/Funktion · St. 3 = einzigartiger Talisman
- Geschenke: rein optional, 1 Lieblingsgeschenk pro NPC gibt einmalig einen
  Dialog + kleine Materialgabe (kein Stufen-Fortschritt → kein Grind-Anreiz)

## Quest-Typen

| Typ | Geber | Belohnung | XP? |
|---|---|---|---|
| Hauptquest | Lumen | Story-Fortschritt, Freischaltungen | ja (50–150) |
| Persönliche Kette | je NPC (3 Quests) | Rezepte, Funktionen, Talismane | ja (30–80) |
| Schwarzes Brett | Markt (Pool kleiner Bitten) | Münzen + Material | **nein** (Kein-Grind-Regel aus doc 02) |

## Datenformat-Hinweis (für src/data/npcs.ts)

NPC = { id, name, arrivalTrigger (Flag/Bedingung), buildingSlot?, questChain:
[{ id, requirement, reward }], teaches?: recipeIds[] }.
Trigger-Flags kommen aus dem Save-Modul (docs/05), keine Sonderlogik pro NPC.
