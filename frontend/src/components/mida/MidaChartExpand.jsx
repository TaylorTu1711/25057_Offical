import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function MidaChartExpand({
  title,
  extraHead = null,
  variant = 'chart',
  buttonClassName = '',
  tone = '',
  children,
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const toneBtnClass = tone === 'plenma' ? 'mida-chart-expand-btn--plenma' : '';
  const toneFsClass = tone === 'plenma' ? 'mida-chart-fs--plenma' : '';
  /** Chặn ghost-click mobile: chạm cột biểu đồ → click ảo trúng nút đóng. */
  const ignoreCloseUntilRef = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const armCloseGuard = () => {
    ignoreCloseUntilRef.current = Date.now() + 450;
  };

  const handleClose = (event) => {
    if (Date.now() < ignoreCloseUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`mida-chart-expand-btn ${toneBtnClass} ${buttonClassName}`.trim()}
        onClick={() => setOpen(true)}
        title="Phóng to biểu đồ"
        aria-label={`Phóng to ${title}`}
      >
        <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div
              className={`mida-chart-fs ${toneFsClass}`.trim()}
              role="presentation"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="mida-chart-fs__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mida-chart-fs__head">
                  <div className="mida-chart-fs__title" id={titleId}>
                    {title}
                  </div>
                  {extraHead}
                  <button
                    type="button"
                    className={`mida-chart-expand-btn mida-chart-expand-btn--close ${toneBtnClass}`.trim()}
                    onClick={handleClose}
                    title="Thu nhỏ"
                    aria-label="Đóng biểu đồ phóng to"
                  >
                    <i className="bi bi-fullscreen-exit" aria-hidden="true" />
                  </button>
                </div>
                <div
                  className={`mida-chart-fs__body mida-chart-fs__body--${variant}`}
                  onPointerDown={armCloseGuard}
                  onTouchStart={armCloseGuard}
                >
                  {variant === 'chart' ? (
                    <div className="machine-chart-plot mida-chart-fs__plot">
                      <div className="machine-chart-plot-inner">{children}</div>
                    </div>
                  ) : (
                    children
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
