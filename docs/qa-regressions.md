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

## Ab M2 (Insel-Slice & Save)

- [ ] Save überlebt Browser-Neustart/Reload (Inventar, geerntete Nodes,
  Position, Zone; geernteter Baum bleibt nach Reload despawnt).
- [ ] Save-Korruption Primärslot (at rest, z. B. Checksumme manipulieren) →
  Reload → Backup lädt, Recovery-Notice („Spielstand wiederhergestellt")
  erscheint, Primärslot wird geheilt, OK-Button schließt die Notice.
- [ ] Beide Slots korrupt → Fresh Start ohne Konsolen-Fehler, Welt spielbar.
- [ ] Insel→Kampf→Insel ohne Reload (Kreaturen-Kontakt UND Dev-Testkampf).
- [ ] Sieg: Beute im Inventar, Loot-Toast auf der Insel, Kreatur despawnt.
- [ ] Rückzug/Niederlage: Kreatur bleibt, Grace-Periode (~1,5 s) verhindert
  Sofort-Retrigger bei Kontakt; Spieler kann sich in der Grace lösen.
  Regression zu Issue M2-1: explizit mit Kampfdauer > 1,5 s testen.
- [ ] Ernten: Prompt bei Node-Nähe, E erntet (Holz/Stein/Kupfer/Beeren),
  Node despawnt, Inventar-Zähler stimmt; I öffnet/schließt Inventar-Panel.
- [ ] Begegnungen zonen-korrekt: Spielerzone bestimmt Tabelle (docs/07);
  Dichte 0–1 nie Elite; Elite nur thorn_terror + genau 1 Affix
  (Stichprobe: Sampler über `rollEncounter`, feste Seeds).

## Ab M3 (Crafting-Loop)

- [ ] **Kern-Hook:** Erz/Stein sammeln → Schmiede: „Schwerer Hieb" prägen
  (3 Kupfer + 1 Stein abgezogen) → Deck-Truhe: Karte ins Deck (12er-Regel,
  Besitz-Zähler) → Encounter: geprägte Karte ist im Kampf-Deck, wird gezogen
  und ist spielbar.
- [ ] **Zerlegen (docs/10):** Schwerer Hieb zerlegen → +1 Kupfer, +0 Stein
  (50 % pro Posten, floor); Karte verlässt Sammlung UND Deck; Deck < 12
  blockiert Kampfstart (kein Softlock — Deck-Truhe zum Auffüllen erreichbar);
  Starterkarten nicht zerlegbar; Spezialmaterial (Kampf-Drops, z. B. Feder
  im Wurfbeil) wird nie erstattet.
- [ ] **Werkzeugstufe:** Upgrade „Verstärkt" (3 Kupfer + 2 Leder, Schmiede 1)
  → toolTier 2; Axtschlag-Schaden im Kampf 6 → 8; Ernte-Ertrag +1
  (Nodes und Farm-Beete).
- [ ] **Gerichte:** Beerensnack im Kampf spielen → nach Kampfende (egal ob
  Sieg/Rückzug/Niederlage) aus Deck + Besitz entfernt; „Ins Deck" blockiert;
  Nachkochen in der Küche (3 Beeren) stellt die Starter-Kopie wieder her
  (Marker geklärt, keine zerlegbare Crafted-Kopie).
- [ ] **Werkstatt-UI:** Schmiede/Küche/Deck-Truhe öffnen; fehlende Materialien
  als „(fehlt)" markiert; Tier-2-Rezepte „Benötigt Ausbaustufe 2" gesperrt;
  Esc schließt.
- [ ] **Farming:** Pflanzen auf Beet → Ernten vor Reife blockiert → Schlafen
  bis growthSleeps (Kürbis 2) → Ernte liefert yield (+Werkzeugbonus), Beet
  wieder leer; Schlaf respawnt Harvest-Nodes.
- [ ] **Save V2:** Roundtrip (Reload) erhält Sammlung, Deck, toolTier,
  consumedStarterDishes, farmPlots, sleepCount; Korruptions-/Backup-Pfad
  wie ab M2 weiterhin grün.

## Offene Issues

- **M2-1 (gefixt 2026-07-10, working tree): Grace-Periode nach Kampf
  wirkungslos bei Kämpfen > 1,5 s.**
  Fix: `gracePending`-Flag in `HeimatbuchtScene`; Grace wird im ersten
  Update-Frame NACH `scene.resume()` gestempelt statt mit der eingefrorenen
  Pause-Uhr. Re-Test grün: Rückzug- und Niederlage-Pfad halten ~1,5 s Grace
  (kein Sofort-Retrigger), Lösen während der Grace verhindert Re-Encounter,
  bei anhaltendem Kontakt Retrigger erst nach Ablauf. Ursprungsbefund:
  `HeimatbuchtScene` pausiert im Kampf; `contactGraceUntil = this.time.now +
  1500` wird mit der beim Pausieren EINGEFRORENEN Scene-Uhr berechnet, nach
  `scene.resume()` springt `time.now` auf die Echtzeit → Grace ist bereits
  abgelaufen. Folge: Nach Rückzug/Niederlage bei Kontakt sofortiger
  Re-Encounter ohne einen Frame Spielerkontrolle (Encounter-Falle).
  Repro: Kreatur berühren → Kampf > 1,5 s laufen lassen → Rückzug →
  „Zurück zur Insel" → nächster Frame startet sofort neuen Kampf.
  Messwerte (Dev, Seed egal): pauseTime=frozenNow=41372,2;
  graceUntil=42872,2; Echtzeit bei Kampfende=43858,3 > graceUntil.

## Durchläufe

| Datum | Commit | Ergebnis | Anmerkungen |
|---|---|---|---|
| 2026-07-08 | 959ea0a (+ working tree UI) | grün | M1-Abnahme, alle Punkte oben verifiziert; Sim: Normal 100 %, Elite 89 % |
| 2026-07-09 | 3689162 (+ working tree) | rot (1 Bug) | M2-Abnahme: Save/Recovery, Loop, Ernten, Zonen-Tabellen, Sim (Normal 100 %, Elite 89 %) grün; Veto wegen Issue M2-1 (Grace-Periode wirkungslos) |
| 2026-07-10 | ba51d0c (+ working tree Fix) | grün | Re-Test M2-1: Grace hält nach Rückzug UND Niederlage (Kampf > 1,5 s), Lösen möglich, Retrigger erst nach Ablauf; verify grün (150 Tests); Veto aufgehoben — M2 abgenommen |
| 2026-07-11 | 4405f63 (+ working tree) | grün | M3-Abnahme: verify grün (231 Tests); Sim Normal 100 %, Elite 89 % (Seed 1000); E2E per Store-Treiber: Kern-Hook (Prägen→Deck→Ziehen/Spielen im Kampf), Zerlegen (1 Kupfer + 0 Stein, Feder nie erstattet, Deck < 12 blockiert Kampf), Werkzeug 6→8 + Ernte +1, Gericht verbrauchen/Nachkochen, Farming (Kürbis 2 Schlaf), Save-V2-Roundtrip, Korruption primär→Backup-Recovery+Heilung, beide Slots korrupt→Fresh Start ohne Konsolenfehler — M3 abgenommen |
