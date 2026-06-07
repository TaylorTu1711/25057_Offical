import React from 'react';
import BarChart_Pareto from '../BarChart_Pareto';
import '../../css/AppModal.css';

export default function AnalysisErrorModal({
  open,
  labelsChartErr,
  tooltipLabelsChartErr,
  dataValuesChartErr,
  onClose,
}) {
  if (!open) return null;

  const hasData = dataValuesChartErr?.some((v) => v > 0);

  return (
    <div className="app-modal app-modal-overlay" onClick={onClose}>
      <div
        className="app-modal-panel app-modal-panel--analysis"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="app-modal-title">Biểu đồ Pareto</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng" />
        </div>

        <hr />

        <div className="app-modal-chart-wrap app-modal-chart-wrap--analysis-main">
          {!hasData ? (
            <div className="d-flex align-items-center justify-content-center h-100 w-100 text-muted">
              Chưa có dữ liệu cảnh báo
            </div>
          ) : (
            <BarChart_Pareto
              labels={labelsChartErr}
              tooltipLabels={tooltipLabelsChartErr}
              dataValues={dataValuesChartErr}
            />
          )}
        </div>
      </div>
    </div>
  );
}
