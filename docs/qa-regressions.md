# QA-Regressions-Checkliste (Kampf, ab M1)

Wiederholbarer Durchlauf vor jedem Meilenstein-Abschluss. Grundlage:
docs/11 (UI-Zustände), docs/12 (Akzeptanzkriterien). Durchführung im
Dev-Server (`npm run dev` → „Testkampf starten", Standard: Ratte + Möwe).
Automatisierte Basis: `npm run verify` und
`npm run sim -- --deck starter --all --n 1000 --seed 1000` müssen grün sein.

Legende: [ ] offen · [x] geprüft & OK — Datum/Commit im Abschnitt unten eintragen.

## Kern-Flows

- [ ] **Kampf starten:** „Testkampf starten" → Kampfbildschirm mit allen Zonen
  (Standort-Chip, Rückzug, Spieler-HP, Gegner + Absichts-Chips, Hand 5 Karten,
  Energie 3/3, Nachzieh-/Ablagestapel-Zähler, „Zug beenden").
- [ ] **Karte ohne Ziel spielen:** Holzschild klicken (gewählt: Doppelrahmen,
  Hebung, Rotation 0) → zweiter Klick spielt sie; Block-Chip erscheint,
  Energie sinkt, Ablagestapel +1.
- [ ] **Karte mit Ziel spielen (Multi-Gegner-Targeting):** Axtschlag wählen →
  gestrichelter oranger Pfeil zur Maus; Hover über Gegner zeigt orangen Ring
  NUR auf gültigen Zielen; Klick auf Gegner → Karte fliegt zum Ziel →
  Schaden korrekt (Gegner-Hover-Tooltip zeigt exakte HP) → Ablage +1.
- [ ] **Unspielbare Karte:** Energie auf 0 bringen → 1⚡-Karte ist abgedunkelt
  mit grauem Kosten-Gem; Klick löst Wackeln aus, kein Effekt; 0⚡-Karten
  bleiben spielbar.
- [ ] **Zug beenden:** Gegner agieren sichtbar; Block absorbiert Schaden;
  Absichts-Chips aktualisieren sich NACH der Gegneraktion (nächster
  Zyklus-Schritt, echte Zahlen inkl. Buffs, Mehrfachschlag „2×3");
  neue Hand (5 Karten), Energie wieder 3/3.
- [ ] **Sieg:** Beide Gegner besiegt → Beute-Panel mit garantierten Drops
  (inkl. Schattenstaub) → „Zurück zur Insel" beendet den Kampf (kein Softlock).
- [ ] **Niederlage:** HP auf 0 (nur „Zug beenden" drücken) → sanfte Abblende
  (`outcome-backdrop--fade`), Text „Erschöpft … Du wachst sicher in deinem
  Bett auf" (kein Game-Over-Schrei) → Button führt zurück (kein Softlock).
- [ ] **Rückzug Erfolg:** „Rückzugsversuch (75 %)" → Panel „Rückzug gelungen —
  ohne Beute" → zurück zur Insel.
- [ ] **Rückzug Fehlschlag:** Bei Misserfolg läuft der Kampf weiter, die Gegner
  agieren (Spieler verliert die Runde), Button bleibt nutzbar.
- [ ] **Status-Anzeige:** Schwäche am Spieler erscheint als Icon mit
  Tooltip-Erklärung („Verursacht 25 % weniger Angriffsschaden").
- [ ] **Konsole:** Während des gesamten Durchlaufs keine Fehler/Warnungen
  in der Browser-Konsole.

## Sim-Stichprobe (feste Seeds)

- [ ] `npm run sim -- --deck starter --all --n 1000 --seed 1000`:
  Tier-1-Normalgegner ≥ 95 %, Elite (thorn_terror) 55–95 %.

## Ab M2 (Vorbereitung)

- [ ] Save überlebt Browser-Neustart.
- [ ] Save-Korruption → Recovery ohne Datenverlust-Softlock.
- [ ] Insel→Kampf→Insel ohne Reload.

## Durchläufe

| Datum | Commit | Ergebnis | Anmerkungen |
|---|---|---|---|
| 2026-07-08 | 959ea0a (+ working tree UI) | grün | M1-Abnahme, alle Punkte oben verifiziert; Sim: Normal 100 %, Elite 89 % |
