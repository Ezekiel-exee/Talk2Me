import { useRef } from 'react';

// Closes a drawer when the user swipes it back toward its edge.
// direction: 'left' for a drawer on the left edge, 'right' for one on the right.
export function useSwipeToClose(direction, onClose) {
  const start = useRef(null);

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if ((direction === 'left' && dx < 0) || (direction === 'right' && dx > 0)) onClose();
    },
  };
}
