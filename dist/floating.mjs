/** Pure geometry helpers for pointer/keyboard movement and resize tests. */
export function clampFloatingPosition(position, viewport, size = 62, margin = 12) {
  return {
    x: Math.max(margin, Math.min(position.x, Math.max(margin, viewport.width - size - margin))),
    y: Math.max(margin, Math.min(position.y, Math.max(margin, viewport.height - size - margin))),
  };
}
export const exceedsDragThreshold = (start, current) => Math.hypot(current.x - start.x, current.y - start.y) >= 6;
