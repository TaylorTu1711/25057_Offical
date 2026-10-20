import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizePercentWidths = (widths, columnOrder, defaultWidths, minWidths) => {
  const result = columnOrder.reduce((acc, key) => {
    const min = minWidths[key] ?? 8;
    acc[key] = clamp(Number(widths[key]) || defaultWidths[key], min, 100);
    return acc;
  }, {});

  const total = columnOrder.reduce((sum, key) => sum + result[key], 0);
  if (Math.abs(total - 100) > 0.5) {
    return { ...defaultWidths };
  }

  return result;
};

export default function useResizableTableColumns(
  storageKey,
  columnOrder,
  defaultWidths,
  minWidths = {},
) {
  const readSavedWidths = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...defaultWidths };
      const parsed = JSON.parse(raw);
      return normalizePercentWidths(parsed, columnOrder, defaultWidths, minWidths);
    } catch {
      return { ...defaultWidths };
    }
  };

  const [widths, setWidths] = useState(readSavedWidths);
  const [resizingKey, setResizingKey] = useState(null);
  const widthsRef = useRef(widths);
  const startWidthsRef = useRef(widths);
  const startXRef = useRef(0);
  const tableWidthRef = useRef(0);

  widthsRef.current = widths;

  const getNextColumnKey = useCallback(
    (key) => {
      const index = columnOrder.indexOf(key);
      return index >= 0 && index < columnOrder.length - 1
        ? columnOrder[index + 1]
        : null;
    },
    [columnOrder],
  );

  const onResizeStart = useCallback(
    (key, event) => {
      if (!getNextColumnKey(key)) return;

      event.preventDefault();
      event.stopPropagation();

      const table = event.currentTarget.closest('table');
      tableWidthRef.current = table?.offsetWidth || 1;
      startXRef.current = event.clientX;
      startWidthsRef.current = { ...widthsRef.current };
      setResizingKey(key);
    },
    [getNextColumnKey],
  );

  useEffect(() => {
    if (!resizingKey) return undefined;

    const nextKey = getNextColumnKey(resizingKey);
    if (!nextKey) return undefined;

    document.body.classList.add('resizable-table-col-resizing');

    const onMove = (event) => {
      const deltaPx = event.clientX - startXRef.current;
      const deltaPercent = (deltaPx / tableWidthRef.current) * 100;
      const minCurrent = minWidths[resizingKey] ?? 8;
      const minNext = minWidths[nextKey] ?? 8;

      const startCurrent = startWidthsRef.current[resizingKey];
      const startNext = startWidthsRef.current[nextKey];

      let nextCurrent = startCurrent + deltaPercent;
      let nextNext = startNext - deltaPercent;

      if (nextCurrent < minCurrent) {
        const shift = minCurrent - nextCurrent;
        nextCurrent = minCurrent;
        nextNext -= shift;
      }
      if (nextNext < minNext) {
        const shift = minNext - nextNext;
        nextNext = minNext;
        nextCurrent -= shift;
      }

      nextCurrent = clamp(nextCurrent, minCurrent, 100 - minNext);
      nextNext = clamp(nextNext, minNext, 100 - minCurrent);

      setWidths((prev) => ({
        ...prev,
        [resizingKey]: Number(nextCurrent.toFixed(2)),
        [nextKey]: Number(nextNext.toFixed(2)),
      }));
    };

    const onUp = () => {
      setResizingKey(null);
      localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      document.body.classList.remove('resizable-table-col-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizingKey, getNextColumnKey, minWidths, storageKey]);

  const widthsPercent = columnOrder.reduce((acc, key) => {
    acc[key] = `${widths[key]}%`;
    return acc;
  }, {});

  return {
    widths,
    widthsPercent,
    resizingKey,
    onResizeStart,
  };
}
