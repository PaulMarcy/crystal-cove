export interface TargetingLayerProps {
  /** Origin of the arrow (selected card center), container coordinates. */
  origin: { x: number; y: number } | null;
  /** Current cursor position, container coordinates. */
  cursor: { x: number; y: number } | null;
  /** Ring around the hovered VALID target (docs/11: invalid → no ring). */
  targetRing: { x: number; y: number; r: number } | null;
}

/**
 * SVG overlay for click-click targeting (docs/11): dashed orange arrow from
 * the selected card to the cursor; orange ring only on valid targets.
 * Pure presentation — validity is decided by core/combat/view selectors.
 */
export function TargetingLayer({ origin, cursor, targetRing }: TargetingLayerProps) {
  if (!origin || !cursor) return null;
  return (
    <svg className="targeting-layer" aria-hidden>
      <defs>
        <marker id="arrow-head" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--color-action)" />
        </marker>
      </defs>
      <line
        x1={origin.x}
        y1={origin.y}
        x2={cursor.x}
        y2={cursor.y}
        stroke="var(--color-action)"
        strokeWidth="3"
        strokeDasharray="8 6"
        markerEnd="url(#arrow-head)"
      />
      {targetRing && (
        <circle
          cx={targetRing.x}
          cy={targetRing.y}
          r={targetRing.r}
          fill="none"
          stroke="var(--color-action)"
          strokeWidth="3"
          className="target-ring"
        />
      )}
    </svg>
  );
}
