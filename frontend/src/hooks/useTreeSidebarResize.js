import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'tree_sidebar_width';
const DEFAULT_WIDTH = 250;
const MIN_WIDTH = 180;
const MAX_WIDTH = 520;

const clampWidth = (value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

const readSavedWidth = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_WIDTH;
  const parsed = parseInt(saved, 10);
  return Number.isFinite(parsed) ? clampWidth(parsed) : DEFAULT_WIDTH;
};

export default function useTreeSidebarResize() {
  const [width, setWidth] = useState(readSavedWidth);
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
      setWidth(clampWidth(startWidthRef.current + delta));
    };

    const onUp = () => {
      setIsResizing(false);
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      document.body.classList.remove('tree-sidebar-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  return { width, isResizing, onResizeStart };
}
