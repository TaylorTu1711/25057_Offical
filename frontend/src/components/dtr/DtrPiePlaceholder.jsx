import React from 'react';

/**
 * Placeholder biểu đồ tròn DTR — chỉ khung UI, chưa gắn dữ liệu.
 */
export default function DtrPiePlaceholder({
  title = 'BIỂU ĐỒ TRÒN',
  emptyText = 'Chưa có dữ liệu',
}) {
  return (
    <div className="dtr-pie-card card shadow d-flex flex-column min-h-0">
      <div className="chart-title-brand machine-chart-head dtr-pie-card__head">
        <div className="dtr-pie-card__title">{title}</div>
      </div>
      <div className="dtr-pie-card__body flex-grow-1 min-h-0 d-flex align-items-center justify-content-center">
        <div className="dtr-pie-card__ring" aria-hidden="true">
          <div className="dtr-pie-card__empty">{emptyText}</div>
        </div>
      </div>
    </div>
  );
}
