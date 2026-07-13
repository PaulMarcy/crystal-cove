import { useState } from 'react';
import { currentRoom } from '../../core/world/dungeon';
import { dungeonsById } from '../../data/dungeons/verwachseneHoehle';
import { useGameStore } from '../../shared/store';
import { strings } from '../../shared/strings';

/**
 * Dungeon run panel (M4, docs/03): shown between rooms while a run is
 * active and no combat is running. Renders ONLY store state; both buttons
 * dispatch store actions (no game logic here — transitions live in
 * core/world/dungeon via the store).
 *
 * Placeholder look grade 1 "Funktional" (docs/04): panel style follows the
 * existing outcome/workshop panels; orange only on the actionable button.
 */
export function DungeonPanel() {
  const run = useGameStore((s) => s.currentDungeonRun);
  const lastRescuedNpc = useGameStore((s) => s.lastRescuedNpc);
  const startRoomCombat = useGameStore((s) => s.startDungeonRoomCombat);
  const abandon = useGameStore((s) => s.abandonDungeonRun);
  const [deckBlocked, setDeckBlocked] = useState(false);

  if (!run) return null;
  const dungeon = dungeonsById[run.dungeonId];
  if (!dungeon) return null;
  const room = currentRoom(dungeon, run);
  if (!room) return null;

  const npcName =
    lastRescuedNpc !== null
      ? (strings.npcs[lastRescuedNpc as keyof typeof strings.npcs] ?? lastRescuedNpc)
      : null;

  return (
    <div className="outcome-backdrop">
      <div className="dungeon-panel">
        <h2 className="dungeon-title">{dungeon.name}</h2>
        <p className="dungeon-room">
          {strings.dungeonRun.roomProgress
            .replace('{current}', String(run.roomIndex + 1))
            .replace('{total}', String(dungeon.rooms.length))}
          {' — '}
          <strong>{room.name}</strong>
        </p>
        {/* HP als Text + Zahlen — Information nie nur über Farbe (docs/11). */}
        <p className="dungeon-hp">
          {strings.dungeonRun.hpLabel
            .replace('{hp}', String(run.hp))
            .replace('{maxHp}', String(run.maxHp))}
        </p>
        <p className="dungeon-hint">
          {room.boss ? strings.dungeonRun.bossRoomHint : strings.dungeonRun.noHealHint}
        </p>

        {/* Orin-Rettung (docs/09, Raum 2): Sprite-Platzhalter + Textfeedback.
            Das Dialog-System ist M5 — hier bewusst nur eine Mini-Sequenz. */}
        {npcName !== null && (
          <div className="dungeon-rescue" role="status">
            <span className="dungeon-rescue-sprite" aria-hidden>
              🧙
            </span>
            <div>
              <strong>{strings.dungeonRun.npcRescued.replace('{npc}', npcName)}</strong>
              <p className="dungeon-rescue-body">{strings.dungeonRun.orinRescuedBody}</p>
            </div>
          </div>
        )}

        {deckBlocked && <p className="dungeon-deck-blocked">{strings.dungeonRun.deckIncomplete}</p>}

        <div className="dungeon-actions">
          {/* Orange = handlungsfähig (docs/04): der Kampf-Button. */}
          <button
            className="end-turn-button"
            onClick={() => {
              if (!startRoomCombat()) setDeckBlocked(true);
            }}
          >
            {strings.dungeonRun.startFight}
          </button>
          {/* Aufgeben jederzeit möglich (docs/03) — neutraler Stil. */}
          <button className="dungeon-abandon-button" onClick={abandon}>
            {strings.dungeonRun.abandon}
          </button>
        </div>
      </div>
    </div>
  );
}
