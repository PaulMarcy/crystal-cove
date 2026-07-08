import { useEffect, useState } from 'react';
import { strings } from '../../shared/strings';
import { useGameStore } from '../../shared/store';

/**
 * Inventory overlay (M2). docs/11 covers combat UI only — until a dedicated
 * inventory spec exists this is a simple toggle panel (key I) listing item
 * name + count (never color-only information).
 */
export function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'i' || event.key === 'I') setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const entries = Object.entries(inventory).filter(([, count]) => count > 0);
  const itemNames = strings.items as Readonly<Record<string, string>>;

  return (
    <>
      <div className="inventory-hint">{strings.inventory.toggleHint}</div>
      {open && (
        <section className="inventory-panel" aria-label={strings.inventory.title}>
          <h2 className="inventory-title">{strings.inventory.title}</h2>
          {entries.length === 0 ? (
            <p className="inventory-empty">{strings.inventory.empty}</p>
          ) : (
            <ul className="inventory-list">
              {entries.map(([itemId, count]) => (
                <li key={itemId} className="inventory-row">
                  <span>{itemNames[itemId] ?? itemId}</span>
                  <span className="inventory-count">×{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
