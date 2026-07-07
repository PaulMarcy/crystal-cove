/**
 * Headless balancing simulator CLI (M1).
 *
 * Usage:
 *   npm run sim -- --deck starter --enemy blighted_boar --n 1000
 *   npm run sim -- --deck starter --enemies shadow_rat,shadow_gull --n 1000
 *   npm run sim -- --deck starter --all --n 1000 [--seed 1000]
 *
 * Flags:
 *   --deck <id>        deck to simulate (default: starter)
 *   --enemy <id>       single enemy encounter
 *   --enemies <a,b>    multi-enemy encounter (all in ONE combat)
 *   --all              one single-enemy run per tier-1 enemy incl. elite
 *   --n <count>        runs per matchup (default: 1000)
 *   --seed <number>    base seed; runs use seed..seed+n-1 (default: 1000)
 *
 * No dependencies — args parsed by hand (CLAUDE.md: no new deps).
 */
import { starterDeck } from '../src/data/cards/tier1';
import {
  allEnemies,
  blightedBoar,
  copperBeetle,
  shadowGull,
  shadowRat,
  thornCreeper,
  thornTerror,
} from '../src/data/enemies/tier1';
import type { CardDef, EnemyDef } from '../src/core/combat/types';
import { runSimulation, type SimResult } from './simlib';

const decks: Record<string, readonly CardDef[]> = { starter: starterDeck };

/** M1 report set: the 5 normal tier-1 enemies plus the elite (docs/12). */
const m1Enemies: readonly EnemyDef[] = [
  shadowRat,
  blightedBoar,
  thornCreeper,
  copperBeetle,
  shadowGull,
  thornTerror,
];

function enemyById(id: string): EnemyDef {
  const enemy = allEnemies.find((e) => e.id === id);
  if (!enemy) {
    console.error(`sim: unknown enemy '${id}'. Known: ${allEnemies.map((e) => e.id).join(', ')}`);
    process.exit(1);
  }
  return enemy;
}

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args.set(arg.slice(2), next);
      i++;
    } else {
      args.set(arg.slice(2), 'true');
    }
  }
  return args;
}

function formatRow(label: string, r: SimResult): string {
  const pct = (r.winrate * 100).toFixed(1).padStart(5);
  const turns = r.avgTurns.toFixed(1).padStart(5);
  const hp = Number.isNaN(r.avgHpOnWin) ? '  n/a' : r.avgHpOnWin.toFixed(1).padStart(5);
  const outliers =
    r.defeatSeeds.length > 0 ? ` losses e.g. seeds ${r.defeatSeeds.slice(0, 3).join(',')}` : '';
  const timeouts = r.timeouts > 0 ? ` TIMEOUTS ${r.timeouts}` : '';
  return `${label.padEnd(28)} ${pct} %   ${turns}    ${hp}${timeouts}${outliers}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const deckId = args.get('deck') ?? 'starter';
  const deck = decks[deckId];
  if (!deck) {
    console.error(`sim: unknown deck '${deckId}'. Known: ${Object.keys(decks).join(', ')}`);
    process.exit(1);
  }
  const n = Number(args.get('n') ?? 1000);
  const baseSeed = Number(args.get('seed') ?? 1000);
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(baseSeed)) {
    console.error('sim: --n and --seed must be numbers (n >= 1).');
    process.exit(1);
  }

  const matchups: { label: string; enemies: EnemyDef[] }[] = [];
  if (args.has('all')) {
    for (const enemy of m1Enemies) matchups.push({ label: enemy.id, enemies: [enemy] });
  } else if (args.has('enemies')) {
    const ids = args
      .get('enemies')!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    matchups.push({ label: ids.join('+'), enemies: ids.map(enemyById) });
  } else {
    const id = args.get('enemy') ?? 'blighted_boar';
    matchups.push({ label: id, enemies: [enemyById(id)] });
  }

  console.log(`deck=${deckId}  n=${n}  seeds=${baseSeed}..${baseSeed + n - 1}  policy=greedy`);
  console.log(`${'matchup'.padEnd(28)} winrate  ØTurns  ØHP(win)`);
  for (const matchup of matchups) {
    const result = runSimulation({ deck, enemies: matchup.enemies, n, baseSeed });
    console.log(formatRow(matchup.label, result));
  }
}

main();
