# 06 — Onboarding: Die ersten 30 Minuten

## Prinzipien

1. Zeigen statt erklären — jede Mechanik wird einmal aktiv benutzt, bevor die nächste kommt
2. Eine neue Sache pro Beat
3. Der Kern-Hook „Insel wird Deck" wird bis Minute ~15 ERLEBT, nicht erzählt
4. Tutorial-Kämpfe mit geskripteter Starthand (fester RNG-Seed)
5. Alle Schritte als Save-Flags; Skip-Option für Wiederspieler

## Beat-Ablauf

| Beat | Zeit | Inhalt | Lehrt |
|---|---|---|---|
| 1 Ankommen | 0–2 | Strand, Wrackkiste mit Kupferaxt (oranger Schimmer) | Laufen, Interagieren; Farbregel Orange = Aktion |
| 2 Pfad | 2–6 | Baum blockiert Weg (Axt); Mentor **Lumen** (Kristallfuchs, Einzeiler); 4 Treibholz + 3 Beeren; unerreichbarer Kristallsplitter hinter Dornen als Neugier-Anker | Ernten; Sammelchip statt Questlog |
| 3 Erster Kampf | 6–10 | Schattenratte, Tutorial-Variante `shadow_rat_tutorial` (10 HP, greift für 3). Zug 1: Hand = 3 Angriffe. Zug 2: Absicht-Highlight + Holzschild. Zug 3+: frei. Sieg → sofort Level 2 | Karte spielen, Energie, Block vs. Absicht |
| 4 Lager (HOOK) | 10–16 | Lichtung: Zelt (Schlafen = Speichern) + Kochstelle bauen. Beeren → Beerensnack: **Gericht fliegt sichtbar als Karte ins Deck.** Lumen: „Alles, was die Insel dir gibt, kannst du in den Kampf tragen." | Bauen; Insel→Deck erleben |
| 5 Erster Kristall | 16–23 | Zweiter Kampf: 2 Gegner (Zielwahl). Kristall → Nebel weicht, Teilgebiet öffnet sich; Erkundungs-% erscheint | Zielwahl; Freischalt-Loop |
| 6 Schmiede | 23–30 | Ruine reparieren (Holz+Kupfer), erste Prägung **Funkenschlag** (1⚡, 4 Schaden, 1 ziehen). Deck-Truhe: Karte einlegen. Abschluss: Blick auf Dungeon („noch zu stark") + Weltkarte mit 4 vernebelten Inseln | Prägen; Deck = Rucksack; Nah- und Fernziel |

## Zustand nach 30 Minuten

Level 2–3 · ~15 Karten (inkl. 1 Gericht, 1 geprägte) · Lager mit Zelt, Kochstelle,
Schmiede · alle Kernverben einmal ausgeführt · zwei Ziele (Höhle, Archipel).

## Tutorial-Kampf-Skripte (für core/combat)

- Kampf 1 „Schattenratte": `shadow_rat_tutorial` (10 HP, eigene Variante analog
  Schattenmaus, siehe docs/07); seed fix; Zug-1-Hand = [Axtschlag, Axtschlag,
  Steinwurf]; Zug-2-Hand enthält garantiert Holzschild; Gegnerzyklus
  [attack3, attack3, ...]
- Kampf 2 „Zwei Schattenmäuse": seed fix; je 7 HP, Zyklus [attack2, defend3]
- Beide Kämpfe geben keine Zustands-Karten und können praktisch nicht verloren
  werden (Fail-Safe: bei HP<5 heilt Lumen einmalig 10)

## Offene Punkte

- Genauer Wortlaut von Lumens Zeilen (max. 1 Satz pro Einblendung)
- Skip-Variante: Startpaket = Beat-6-Zustand
