/**
 * Central string table (German first, see CLAUDE.md conventions).
 * All player-facing text must come from here — no literals in UI/world code.
 * Card/enemy IDs are English snake_case; display names live here.
 */
export const strings = {
  game: {
    title: 'Crystal Cove',
    helloIsland: 'Hallo Insel',
  },
  ui: {
    overlayReady: 'UI-Overlay aktiv',
  },
  cards: {
    axe_strike: { name: 'Axtschlag', description: '6 Schaden (skaliert mit Werkzeugstufe).' },
    wooden_shield: { name: 'Holzschild', description: '5 Block.' },
    stone_throw: { name: 'Steinwurf', description: '3 Schaden.' },
    catch_breath: { name: 'Verschnaufen', description: 'Ziehe 2 Karten.' },
    berry_snack: { name: 'Beerensnack', description: 'Heilt 5 HP. Verbrauchskarte.' },
    spark_strike: { name: 'Funkenschlag', description: '4 Schaden, ziehe 1 Karte.' },
    heavy_blow: { name: 'Schwerer Hieb', description: '10 Schaden.' },
    stone_wall: { name: 'Steinwall', description: '7 Block.' },
    throwing_axe: { name: 'Wurfbeil', description: '4 Schaden.' },
    armor_breaker: { name: 'Panzerbrecher', description: '6 Schaden, ignoriert Block.' },
    double_strike: { name: 'Doppelschlag', description: '2×4 Schaden.' },
    counter_stance: { name: 'Gegenhalten', description: '4 Block, Vergeltung 3.' },
    riposte: {
      name: 'Riposte',
      description: '6 Schaden. (+6 falls diese Runde geblockt — folgt.)',
    },
    pumpkin_stew: { name: 'Kürbiseintopf', description: 'Heilt 8 HP. Verbrauchskarte.' },
    chili_skewer: {
      name: 'Chili-Spieß',
      description: '+2 Stärke für den Kampf. Verbrauchskarte.',
    },
    fried_fish: {
      name: 'Gebratener Fisch',
      description: 'Heilt 6 HP, ziehe 1 Karte. Verbrauchskarte.',
    },
    splinter_bolt: { name: 'Splitterblitz', description: '8 Schaden, ziehe 1 Karte.' },
    crystal_shield: { name: 'Kristallschild', description: '5 Block, nächste Karte −1⚡.' },
    exhaustion: {
      name: 'Erschöpfung',
      description: 'Unspielbar. Verschwindet am Zugende.',
    },
    dazed: { name: 'Benommen', description: 'Unspielbar. Verschwindet am Zugende.' },
  },
  enemies: {
    shadow_rat: { name: 'Schattenratte' },
    shadow_rat_tutorial: { name: 'Schattenratte' },
    shadow_mouse: { name: 'Schattenmaus' },
    blighted_boar: { name: 'Befallenes Wildschwein' },
    thorn_creeper: { name: 'Dornenkriecher' },
    copper_beetle: { name: 'Kupferkäfer' },
    shadow_gull: { name: 'Schattenmöwe' },
    thorn_terror: { name: 'Dornenschreck' },
  },
} as const;

export type Strings = typeof strings;
