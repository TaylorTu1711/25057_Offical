import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULTS = {
  storageKey: 'tree_sidebar_width',
  defaultWidth: 250,
  minWidth: 180,
  maxWidth: 520,
};

const clampWidth = (value, minWidth, maxWidth) =>
  Math.min(maxWidth, Math.max(minWidth, value));

const readSavedWidth = (storageKey, defaultWidth, minWidth, maxWidth) => {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return defaultWidth;
  const parsed = parseInt(saved, 10);
  return Number.isFinite(parsed) ? clampWidth(parsed, minWidth, maxWidth) : defaultWidth;
};

export default function useTreeSidebarResize(options = {}) {
  const storageKey = options.storageKey ?? DEFAULTS.storageKey;
  const defaultWidth = options.defaultWidth ?? DEFAULTS.defaultWidth;
  const minWidth = options.minWidth ?? DEFAULTS.minWidth;
  const maxWidth = options.maxWidth ?? DEFAULTS.maxWidth;

  const [width, setWidth] = useState(() =>
    readSavedWidth(storageKey, defaultWidth, minWidth, maxWidth),
  );
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  widthRef.current = width;

  const onResizeStart = useCallback((event) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = widthRef.current;
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return undefined;

    document.body.classList.add('tree-sidebar-resizing');

    const onMove = (event) => {
      const delta = event.clientX - startXRef.current;
      setWidth(clampWidth(startWidthRef.current + delta, minWidth, maxWidth));
    };

    const onUp = () => {
      setIsResizing(false);
      localStorage.setItem(storageKey, String(widthRef.current));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      document.body.classList.remove('tree-sidebar-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, storageKey, minWidth, maxWidth]);

  return { width, isResizing, onResizeStart };
}
