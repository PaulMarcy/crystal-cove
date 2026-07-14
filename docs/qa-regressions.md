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
  Tier-1-Normalgegner ≥ 95 %.
- [ ] Elite-Korridor bei realer Spawn-Dichte (Eliten erst ab Dichte 2):
  `npm run sim -- --deck starter --enemy thorn_terror --n 1000 --density 2
  --seed 1000` → 55–95 % (M4-Tuning 0d83b4c: 58,8 %). Hinweis: bei
  Default-Dichte 0 liegt thorn_terror seit dem Tuning bei 96,3 % — das ist
  ok, weil Dichte 0–1 nie Eliten spawnt (Encounter-Regel docs/07).
- [ ] Dichte-Nachweis (M4): `--enemy blighted_boar --density 0` vs.
  `--density 3` unterscheiden sich messbar (ØTurns/ØHP; HP-Skalierung
  16→21 beim Käfer in encounterCombat).

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

## Ab M4 (Progression, Dungeon, Niederlage-Fluss)

- [ ] **XP/Level:** Kurve round(100·n^1.5); Level-Up heilt um den
  Max-HP-Zugewinn (+5); HUD zeigt Stufe, XP-Fortschritt, HP, Erkundungs-%.
- [ ] **Talentbaum (T):** 3×3-Panel öffnet/schließt (T/Esc); Sequenzregel
  (Stufe 2 vor Stufe 1 verweigert); Punktebudget floor(Level/3); Talisman-
  Sektion zeigt Slots (1 ab Lv 8) und Dornenring-Effekt.
- [ ] **Deck-Limit:** ab Lv 4 akzeptiert die Deck-Truhe eine 13. Karte
  (Obergrenze 15, Untergrenze 12 bleibt).
- [ ] **Erkundung → Dichte:** Marker-Entdeckung (5 Marker Heimatbucht) hebt
  Dichte bei 40/60/80 % auf 1/2/3 (Schwellen 25/50/75); XP 25 (Gebiet) /
  40 (Schrein); idempotent (zweite Entdeckung = false).
- [ ] **Dungeon-Run:** Eingang → 4 Räume; HP-Übertrag ohne Heilung
  (z. B. 55→47→7); Raum 3 Elite mit genau 1 Affix ab Dichte 2; Gegner
  dichte-skaliert (Käfer 16→21 bei D3); Orin-Flag nach Raum-2-Sieg
  (persistiert, Panel-Feedback); Boss Wurzelwächter phased (Zorn-Phase
  unter 50 % HP, phaseIndex 0→1); Abschluss = +300 XP (statt Encounter-XP)
  + completedDungeons.
- [ ] **Reinigung:** Nach Boss-Sieg zeigt HUD „Gereinigt"; Insel-Encounter
  und Dungeon-Wiederholung unskaliert (effektive Dichte 0, keine
  Eliten/Affixe/Loot-Boni); Standort-Chip im Kampf „Heimatbucht · Gereinigt".
- [ ] **Niederlage (Insel & Dungeon):** HP 0 → Aufwachen voll geheilt,
  sleepCount+1 (Beete wachsen, Nodes respawnen), 50 % der Run-Beute weg
  (floor pro Posten, gedeckelt auf Bestand), Deck/XP/Talismane unangetastet,
  lootSinceRest reset; Reload danach konsistent.
- [ ] **Dungeon-Rückzug/Aufgeben:** gleicher Beute-Malus, aber KEIN
  Schlafzyklus, HP bleibt; Feld-Rückzug bleibt malusfrei.
- [ ] **Deck < 12 im Dungeon:** Raumkampf verweigert, Panel zeigt Hinweis,
  „Aufgeben" bleibt erreichbar (kein Softlock).
- [ ] **Talisman:** Dornenring-Drop (25 %, bei D3 +20 pp & Menge ×2 —
  docs/07); Anlegen ab Lv 8 (Slot 1, zweiter Ring verweigert); Kampfstart
  mit Vergeltung 1 (player.statuses.retaliate = 1 in Encounters).
- [ ] **Save V3:** Roundtrip erhält xp, Talente, Marker, rescuedNpcs,
  completedDungeons, owned/equippedTalismans, playerHp, lootSinceRest;
  Korruption primär → Backup-Recovery inkl. aller M4-Felder.

## Offene Issues

- **Randnotizen M4 (kein Veto, 2026-07-14):**
  1. Veralteter Kommentar `src/shared/store.ts` (Interface-Doku zu
     `abandonDungeonRun`): „TODO(M4 Task 5) … kein Malus vorerst" — der
     Malus IST implementiert und getestet. Kommentar entfernen.
  2. Ketten-Korridor 50–65 % soll laut docs/12 „ab M4 am Dungeon gemessen"
     werden — der Simulator hat keinen Ketten-/Dungeon-Modus (nur
     Einzel-Encounter). Messwerkzeug fehlt; anekdotisch ist die D3-Kette
     Elite→Boss mit HP-Übertrag sehr hart (Bot-Durchläufe scheitern meist
     am Boss nach dem Eliteraum). → balance-analyst, spätestens M7.
  3. Design-Kante: Gericht im Dungeon-Raum konsumiert → Deck 11 < 12 →
     nächster Raum verweigert; einziger Ausweg ist Aufgeben (50 %-Malus).
     Kein Softlock, aber ein harter Doppel-Malus fürs Kartenspielen.
  4. `endCombat()` ohne laufenden Kampf beendet einen aktiven Dungeon-Run
     still (dungeonEndedWithoutVictory-Pfad); nur per Store-Misuse
     erreichbar, UI ruft endCombat nur aus dem Outcome-Panel.
  5. Dev-„Testkampf starten" nutzt weder persistierte HP noch Talismane
     (Fixture, 50/50) — bewusst, aber beim Testen nicht verwechseln.

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
| 2026-07-14 | 70863e7 (+ working tree) | grün | M4-Abnahme: verify grün (365 Tests); Sim: Normal 100 %, Elite D2 58,8 % (Korridor), Dichte-Nachweis Eber D0 2,6 Züge/48,2 HP vs. D3 3,2 Züge/43,6 HP, Boss solo D0 100 %/D3 71,4 % (noise); E2E per Store-Treiber: Erkundung 5 Marker → Dichte 1/2/3 (XP 25/40), Talent-Sequenzregel + Punktebudget, Deck 13 ab Lv 4, Dungeon-Run komplett (HP-Übertrag 55→47→7, Orin nach Raum 2, Elite-Affix ab D2, Zorn-Phase < 50 %, +300 XP, Reinigung: HUD „Gereinigt", Encounter/Re-Run unskaliert), Niederlage Insel & Dungeon (voll geheilt, sleep+1, Beute −50 % floor, Reload konsistent), Dungeon-Aufgeben/Rückzug-Malus ohne Schlaf, Deck<12-Hinweis + Aufgeben erreichbar, Dornenring (Slot 1 ab Lv 8, Vergeltung 1 ab Kampfstart), Save-V3-Roundtrip + Korruptions-Recovery mit allen M4-Feldern, keine Konsolenfehler — M4 abgenommen (Randnotizen s. u.) |
| 2026-07-11 | 4405f63 (+ working tree) | grün | M3-Abnahme: verify grün (231 Tests); Sim Normal 100 %, Elite 89 % (Seed 1000); E2E per Store-Treiber: Kern-Hook (Prägen→Deck→Ziehen/Spielen im Kampf), Zerlegen (1 Kupfer + 0 Stein, Feder nie erstattet, Deck < 12 blockiert Kampf), Werkzeug 6→8 + Ernte +1, Gericht verbrauchen/Nachkochen, Farming (Kürbis 2 Schlaf), Save-V2-Roundtrip, Korruption primär→Backup-Recovery+Heilung, beide Slots korrupt→Fresh Start ohne Konsolenfehler — M3 abgenommen |
