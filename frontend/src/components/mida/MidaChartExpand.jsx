import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

export default function MidaChartExpand({
  title,
  extraHead = null,
  variant = 'chart',
  buttonClassName = '',
  children,
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

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

  return (
    <>
      <button
        type="button"
        className={`mida-chart-expand-btn ${buttonClassName}`.trim()}
        onClick={() => setOpen(true)}
        title="Phóng to biểu đồ"
        aria-label={`Phóng to ${title}`}
      >
        <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div className="mida-chart-fs" role="presentation">
              <div
                className="mida-chart-fs__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
              >
                <div className="mida-chart-fs__head">
                  <div className="mida-chart-fs__title" id={titleId}>
                    {title}
                  </div>
                  {extraHead}
                  <button
                    type="button"
                    className="mida-chart-expand-btn mida-chart-expand-btn--close"
                    onClick={() => setOpen(false)}
                    title="Thu nhỏ"
                    aria-label="Đóng biểu đồ phóng to"
                  >
                    <i className="bi bi-fullscreen-exit" aria-hidden="true" />
                  </button>
                </div>
                <div className={`mida-chart-fs__body mida-chart-fs__body--${variant}`}>
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
