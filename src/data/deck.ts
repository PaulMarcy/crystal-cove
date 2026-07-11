/**
 * Deck-building rules (Deck-Truhe, M3). Pure data — assembly/validation
 * logic lives in core/deck (CLAUDE.md rule 2).
 *
 * Sources:
 * - docs/03 "Deck = Rucksack": Kampfdeck 12–18 Karten je nach Level;
 *   V1 start value is 12 (docs/02: Lv 4 → 15, Lv 20 → 18 — level system
 *   is a later milestone, until then the size is fixed at 12).
 * - docs/10 Küche: "Slots pro Expedition: 1" — at most 1 dish card in the
 *   deck (Lv 12 / Haus-Ausbau raises it to 2 later, docs/02/09).
 * - Copy limit: none in the docs (starter deck itself runs 4× Axtschlag);
 *   the natural cap is the number of owned copies (starter set + crafted
 *   collection, both multisets).
 */
export const deckConfig = {
  /** Exact combat deck size (docs/03 starter value). */
  deckSize: 12,
  /** Max dish (Gericht) cards per expedition deck (docs/10 Küche). */
  dishSlots: 1,
} as const;
