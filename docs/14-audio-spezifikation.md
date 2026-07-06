# 14 — Audio-Spezifikation V1 (M6)

## Kanäle & Einstellungen

Getrennte Lautstärken: Master · Musik · SFX (persistiert, M6-Einstellungen).
Musik-Ducking: −6 dB während Jingles (Sieg, Level-Up).

## SFX-Liste v1 (Ereignis → Sound)

**Kampf:** Karte ziehen (Papier-Flip) · Karte spielen/Angriff (Whoosh) ·
Treffer Gegner (Impact) · Treffer Spieler (dumpfer Impact) · Block gewinnen
(Holz-Klack) · Block absorbiert (Schild-Tock) · Gift-Tick (Blubb) ·
Karte unbezahlbar (kurzes „Nope" + Wackeln) · Sieg-Jingle (~2 s) ·
Niederlage (sanfte Abblende, KEIN Verlierer-Klang) · Beute einsammeln (Pling)

**Insel:** Schritte Gras/Sand (je 2 Varianten, alternierend) · Holz hacken ·
Erz picken · Pflücken · Bau fertig (Hammer + Mini-Jingle) · Schlafen
(warme Abblende) · Kristall aktivieren (Schimmern) · Schattenriss-Ambience (Loop)

**UI:** Hover (sehr leise) · Klick · Menü auf/zu · Quest angenommen ·
Quest abgeschlossen · Level-Up (hell, warm)

## Musik v1

2 Loops: Insel ruhig (2–3 min) · Kampf (60–90 s, nahtlos loopbar).
Boss-Variante optional (Backlog). Übergang Insel↔Kampf: 400 ms Crossfade.

## Produktion & Regeln (0 €, docs/08)

SFX primär selbst generiert mit jsfxr/ChipTone (dadurch lizenzfrei eigene
Werke), Rest CC0 von freesound.org. Musik CC0. JEDE fremde Datei in ASSETS.md
(Quelle, Lizenz, ggf. Attribution für die itch-Seite).
Format: OGG (Fallback MP3) über howler.js · SFX mono, 44,1 kHz ·
Namenskonvention: sfx_<bereich>_<ereignis>_<nn>.ogg (z. B. sfx_combat_hit_01.ogg).
