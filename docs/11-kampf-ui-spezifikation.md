# 11 — Kampf-UI-Spezifikation (M1, React-Overlay)

Referenz: Cozy-Mockup aus der Design-Session (statische Bühne, Heimatbucht-Wiese).
Farben & Regeln aus docs/04. Diese Spezifikation ist verbindlich für M1.

## Zonen-Layout (16:9, skaliert responsiv)

| Zone | Position | Inhalt |
|---|---|---|
| Bühne | oberes ~65 % | Biom-Hintergrund; Spieler links, 1–3 Gegner rechts |
| Standort-Chip | oben links | „<Gebiet> · Dichte <n>" (bzw. Dungeon-Raum „2/4") |
| Rückzug | oben rechts | Freies Feld: Kampf verlassen ohne Strafe; Dungeon: „Dungeon verlassen" mit Beute-Malus |
| Spieler-Status | unter Spielerfigur | HP als Zahl (42/55) + Herz; Block-Chip (Schild + Zahl), nur sichtbar wenn > 0 |
| Gegner-Status | unter jedem Gegner | HP-Balken ohne Zahl (Hover: exakte Werte); Statuseffekt-Icons daneben |
| Absichts-Chip | über jedem Gegner | Icon-Vokabular aus docs/07; Angriffszahlen IMMER inkl. Buffs („echte Zahl"); Mehrfachschlag „2×2" |
| Hand | unten Mitte | Fächer, max. Rotation ±12°, Überlappung erlaubt |
| Energie | unten links | Orb „3/3", Orange |
| Nachziehstapel | Ecke unten links | Kartenrücken + Zähler |
| Ablagestapel | Ecke unten rechts | Kartenrücken + Zähler |
| Zug beenden | rechts über Ablage | oranger Primärknopf |

## Karten-Anatomie (86×120 Basisverhältnis)

Kosten-Gem oben links (Orange = bezahlbar, Grau = zu teuer) · Name ·
Icon/Artwork Mitte · Typ-Streifen unten: Angriff #C9584A, Fertigkeit #79BFD1,
Kraft #9668D8, Gericht #8FBF6F, Zustand #55486E.

## Interaktionszustände

| Zustand | Darstellung |
|---|---|
| spielbar | normale Darstellung, oranger Kosten-Gem |
| nicht spielbar (Energie) | Karte leicht abgedunkelt, Gem grau; Klick → kurzes Kopfschütteln-Wackeln |
| Hover | Karte hebt sich 8 px, leichte Neigung Richtung Cursor, Tooltip mit Volltext |
| gewählt | hebt sich 26 px, Rotation 0, oranger Doppelrahmen |
| Zielwahl (Angriff/Einzelziel) | gestrichelter oranger Pfeil Karte→Cursor; gültiges Ziel: oranger Ring; ungültig: kein Ring |
| Ziel bestätigt | Karte fliegt zum Ziel, Effekt, dann auf Ablage |
| Gegner-Hover | exakte HP + Statuserklärungen als Tooltip |

## Ablauf-Feedback (Pflicht ab M1, Juice-Ausbau M5)

Kartenzug: Karten gleiten einzeln vom Stapel in den Fächer (60 ms Versatz) ·
Treffer: Ziel zuckt 4 px + weißer Blitz 80 ms · Block-Gewinn: Schild-Chip ploppt ·
Gift-Tick: grüner Puls am HP-Balken · Absichten aktualisieren sich NACH der
Gegneraktion sichtbar (erst Aktion, dann neue Absicht einblenden) ·
Sieg: Beute-Panel; Niederlage: sanfte Abblende → Aufwachen im Bett (kein „GAME OVER"-Schrei).

## Komponenten-Zuordnung (src/ui/combat/)

CombatScreen (liest nur Store) → Stage, EnemyView (+IntentChip, StatusRow,
HpBar), PlayerView (+HpPlate, BlockChip), Hand (+CardView), EnergyOrb,
PileBadge ×2, EndTurnButton, RetreatButton, TargetingLayer (Pfeil/Ring, Canvas
oder SVG-Overlay). Alle Aktionen dispatchen Events an core/combat — keine
Spiellogik in Komponenten (docs/05, Regel 1).

## Nicht-Ziele in M1

Kein Drag-and-Drop (Klick-Klick reicht; DnD evtl. M5), keine Partikel,
keine Soundeffekte, keine Portrait-Artworks (Icons genügen).
