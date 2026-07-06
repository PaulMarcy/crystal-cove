# 13 — Dialog-System (Kurz-Spezifikation, M5)

## Layout

Portrait links (Pixel-Art, ~96 px) · Name-Plakette darüber · Textbox unten
über volle Breite (UI-Braun #3A2E28, Papier-Innenfläche) · blinkender
Weiter-Indikator (▼) unten rechts. Weiter per Klick/Leertaste — KEIN Auto-Advance.

## Textregeln

- Max. 2 Zeilen à ~60 Zeichen pro Box; längere Inhalte auf mehrere Boxen splitten
- **Lumen-Regel (aus docs/06): max. 1 Satz pro Box** — gilt hart im Tutorial
- Typewriter-Effekt; Geschwindigkeit über Einstellung (sofort / schnell / normal)
- Alle Texte über shared/strings.ts (keine Literale in Dialogdaten)

## Auswahl-Optionen (Choices)

Max. 3 Optionen, vertikal unter der Textbox, Auswahl-Highlight Orange #FF9A4A.
V1 nur zwei Einsatzfälle: Quest-Annahme („Annehmen" / „Später") und
Piyas Handel öffnen. Verzweigende Gespräche sind Nicht-Ziel V1.

## Quest-Integration

Quest-Angebot zeigt Belohnungs-Icons in der Box · Annahme erzeugt
Questlog-Eintrag · Abschluss-Dialog öffnet danach das Belohnungs-Panel.
Ein NPC mit offenem Kettenfortschritt trägt ein Symbol über dem Kopf
(! neue Quest · ? abschlussbereit) — nie nur Farbe.

## Technik

Dialoge sind Daten: src/data/dialogs — { id, speaker, lines: stringKeys[],
choices?: [{ labelKey, action }] }. Ein schlanker Dialog-Player in ui/ rendert;
Flags/Quest-Folgen laufen als Events durch core (Regel 1 aus docs/05).
Trigger-Bedingungen (Ankunft, Kettenstand) kommen aus core/progression.
