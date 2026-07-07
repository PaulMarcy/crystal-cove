import type { StatusId, StatusMap } from '../../core/combat/types';
import { strings } from '../../shared/strings';
import { statusIcons } from './icons';

/**
 * Status effect icons + stack numbers (docs/11 Spieler-/Gegner-Status).
 * Shared between PlayerView and EnemyView. Tooltip explains each status.
 */
export function StatusRow({ statuses }: { statuses: StatusMap }) {
  const entries = (Object.entries(statuses) as [StatusId, number][]).filter(
    ([, stacks]) => stacks > 0,
  );
  if (entries.length === 0) return null;
  return (
    <div className="status-row">
      {entries.map(([id, stacks]) => (
        <span key={id} className="status-chip" data-status={id}>
          <span aria-hidden>{statusIcons[id]}</span>
          <span className="status-stacks">{stacks}</span>
          <span className="tooltip" role="tooltip">
            <strong>
              {strings.statuses[id].name} {stacks}
            </strong>
            <br />
            {strings.statuses[id].description}
          </span>
        </span>
      ))}
    </div>
  );
}
