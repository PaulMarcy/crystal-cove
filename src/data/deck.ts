/**
 * Deck-building rules (Deck-Truhe, M3/M4). Pure data — assembly/validation
 * logic lives in core/deck (CLAUDE.md rule 2).
 *
 * Sources:
 * - docs/03 "Deck = Rucksack": Kampfdeck 12–18 Karten je nach Level.
 *   The deck size is a RANGE (M4 decision): minimum 12, maximum from the
 *   level milestones in src/data/progression.ts (Lv 1–3: 12, ab Lv 4: 15;
 *   core/progression.deckLimitForLevel resolves it).
 * - docs/10 Küche: "Slots pro Expedition: 1" — at most 1 dish card in the
 *   deck (Lv 12 / Haus-Ausbau raises it to 2 later, docs/02/09).
 * - Copy limit: none in the docs (starter deck itself runs 4× Axtschlag);
 *   the natural cap is the number of owned copies (starter set + crafted
 *   collection, both multisets).
 */
export const deckConfig = {
  /** Minimum combat deck size — combat may not start below this (docs/03). */
  minSize: 12,
  /** Max dish (Gericht) cards per expedition deck (docs/10 Küche). */
  dishSlots: 1,
} as const;
