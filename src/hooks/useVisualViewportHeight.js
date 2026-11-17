import { useEffect } from 'react';

// Keeps the app exactly as tall as the visible area (above the on-screen keyboard
// and inside mobile browser toolbars), so the message input never slides off-screen.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--app-height', `${vv.height}px`);
      // iOS scrolls the page when the keyboard opens; keep the app anchored at the top.
      if (vv.offsetTop > 0) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--app-height');
    };
  }, []);
}
