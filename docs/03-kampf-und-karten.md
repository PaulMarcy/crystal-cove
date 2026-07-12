# 03 — Kampfsystem & Karten-Ökonomie

## Kampfkern (Slay-the-Spire-Prinzip)

- Rundenbasiertes Duell: Spieler unten, 1–3 Gegner oben
- **Zugstart:** 5 Karten ziehen, 3 Energie
- Karten kosten 0–3 Energie; Handrest wandert am Zugende auf den Ablagestapel;
  leerer Nachziehstapel → Ablage wird neu gemischt
- **Block** verfällt zu Beginn des eigenen nächsten Zuges
- **Gegner-Absichten** sind sichtbar (Icon + Zahl: greift für 8 an / blockt / wirkt Fluch)
- Statuseffekte V1: Stärke, Verwundbar (+50 % erlittener Schaden), Schwäche
  (−25 % ausgeteilter Schaden), Gift (Schaden am Zugende, −1 pro Runde),
  **Vergeltung X** (wer diese Einheit mit einem Angriff trifft, erleidet
  X Schaden — normaler Schaden, wird von Block des Angreifers abgefangen;
  stapelbar, hält den ganzen Kampf)
- **Konditional „geblockt diese Runde"** (z. B. Riposte „+6 falls diese Runde
  geblockt"): erfüllt, wenn der Spieler im aktuellen Spielerzug mindestens
  1 Block durch einen Karteneffekt erhalten hat. Reihenfolge zählt: erst
  Block-Quelle spielen, dann die Konditional-Karte. Block aus Vorrunden
  zählt nicht (verfällt ohnehin zu Zugbeginn).
- Kartentypen: **Angriff**, **Fertigkeit**, **Kraft** (dauerhaft im Kampf),
  **Gericht** (Verbrauchskarte, verlässt nach Nutzung das Deck bis zum Nachkochen),
  **Zustand** (negativ: Erschöpfung, Benommen)
- **Zustandskarten** (Erschöpfung, Benommen): unspielbar (keine
  Energie-Interaktion), verstopfen die Hand, verschwinden am Zugende.
  Existieren nur im laufenden Kampf, nie in der Sammlung.

## Zug-Phasen & Reihenfolge (verbindlich für core/combat)

Der Spieler beginnt. Ablauf:

1. **Kampfstart:** Start-Block der Gegner anwenden, Erst-Absichten bestimmen
   (sichtbar vor dem ersten Spielerzug).
2. **Spielerzug-Start:** Spieler-Block verfällt, 5 Karten ziehen, Energie auf 3.
3. **Spieleraktionen:** Karten spielen, solange Energie/Hand es hergeben.
4. **Spielerzug-Ende:** Gift-Tick beim Spieler, danach Gift −1;
   Handrest ablegen.
5. **Gegnerzug, je Gegner:** Gegner-Block verfällt, Aktion ausführen,
   Gift-Tick beim Gegner, neue Absicht wird sichtbar (erst nach der Aktion,
   siehe docs/11).
6. Weiter bei 2.

**Schadensformel:** (Basis + Stärke) × 0,75 bei Schwäche des Angreifers
× 1,5 bei Verwundbar des Ziels, abrunden, dann gegen Block verrechnen.
Gift ignoriert Block.

## Rückzug

- **Freies Feld:** Rückzugsversuch als Aktion im Spielerzug,
  Erfolgschance Basiswert 75 % (Balancing-Wert in src/data).
  Erfolg: Kampf endet sofort, keine Beute. Scheitern: Aktion verbraucht,
  Zug endet, Gegner agieren. Das Wanderer-Talent (docs/02) erhöht die Chance.
- **Dungeon:** Aufgeben jederzeit garantiert, Beute-Malus (wie gehabt).

## Cozy-Anpassungen gegenüber StS

1. **Kein Permadeath, kein Run-Reset.** Niederlage: Aufwachen im Bett,
   Schattenkreatur behält einen Teil der getragenen Beute. Welt und Deck bleiben.
2. **Persistente Welt statt Roguelike.** StS-Spannung entsteht in **Dungeons**:
   3–5 Kämpfe am Stück ohne Heilung, Wächter am Ende, Aufgeben jederzeit möglich
   (Beute des Durchgangs verfällt teilweise).
3. **Deck = Rucksack.** Vor Expeditionen stellt man an der Deck-Truhe das
   Kampfdeck zusammen (min. 12 Karten; 12–18 ist die levelabhängige
   OBERGRENZE, keine Exaktgröße — Meilensteine in docs/02) aus der
   Gesamtsammlung.
   Vorbereitungs-Ritual + Lösung des Deck-Bloat-Problems.

## Die Insel füttert das Deck (Kern-Hook)

| Insel-System | Deck-Effekt |
|---|---|
| **Schmiede** | prägt Angriffs-/Verteidigungskarten aus Erz + Holz |
| **Kräuterküche** | Ernte → Gerichte = Verbrauchskarten (Heilung, Buffs) |
| **Kristallschrein** | verzaubert Karten (Magie-Varianten), Karten-Upgrades |
| **Werkzeuge** | existieren doppelt: Axt = Karte „Axtschlag"; Werkzeug-Upgrade verbessert automatisch die Karte |
| **NPCs** | lehren Kartenschulen (Fischerin → Konter, Einsiedler → Kristallmagie) |
| **Gegner-Beute** | Kreaturen droppen Ressourcen ihres Bioms (Waldwesen → Hartholz) |

Karten können an der Werkstatt **zerlegt** werden (Teil-Material zurück) —
die Sammlung bleibt kuratierbar.

## Gegner-Design

Schattenkreaturen = korrumpierte Inselwesen (befallenes Wildschwein,
Kristallgolem, Pilzschrecken). Jeder Gegner hat ein kleines, lesbares
Verhaltensmuster (2–4 Absichten im Zyklus oder einfacher Zustandsautomat).
Bosse bewachen die Inselkristalle → Story-Fortschritt läuft durch den Kampf.

## Starter-Deck (12 Karten, Heimatbucht)

| Karte | Typ | Kosten | Effekt |
|---|---|---|---|
| Axtschlag ×4 | Angriff | 1 | 6 Schaden (skaliert mit Werkzeugstufe) |
| Holzschild ×4 | Fertigkeit | 1 | 5 Block |
| Steinwurf ×2 | Angriff | 0 | 3 Schaden |
| Verschnaufen ×1 | Fertigkeit | 1 | 2 Karten ziehen |
| Beerensnack ×1 | Gericht | 0 | 5 HP heilen (Verbrauch) |

## Balancing-Basiswerte (V1-Richtwerte, in src/data pflegen)

- Gegner-HP Tier 1: normal 12–22, Elite ~38, Boss 90
- Gegnerschaden Tier 1: 5–14 pro Angriff (Sim-Kalibrierung M1: +50 % auf V0-Werte)
- Bei Abweichungen ist das Gegner-Roster in docs/07 maßgeblich
- Tier-Progression: HP ×1,6 / Schaden ×1,35 pro Tier (vor Schattendichte)
- Spieler-HP: 50 + 5×(Level−1)
- Dungeon Heimatbucht: 3 Kämpfe + Boss

Alle Werte sind Startpunkte für Playtests — Änderungen als `data:`-Commits.
