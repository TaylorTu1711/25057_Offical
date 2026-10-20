import React from 'react';
import useLiveCumulativeRuntime from '../../hooks/useLiveCumulativeRuntime';
import {
  formatCumulativeRuntime,
  formatRuntimeDays,
  parseRuntimeSeconds,
} from '../../utils/formatDuration';

const pad2 = (n) => String(n).padStart(2, '0');

/** Đồng hồ thời gian chạy lũy kế — tick nội bộ, không re-render cả trang máy. */
const CumulativeRuntimeDisplay = ({ serverSeconds, isRunning, machineId }) => {
  const totalSeconds = useLiveCumulativeRuntime(serverSeconds, isRunning, machineId);
  const { hours, minutes, seconds } = parseRuntimeSeconds(totalSeconds);
  const label = formatCumulativeRuntime(totalSeconds);
  const daysLabel = formatRuntimeDays(totalSeconds);

  return (
    <div className="machine-runtime-display-wrap">
      <div
        className="machine-runtime-display"
        role="group"
        aria-label={label}
        title={label}
      >
        <div className="machine-runtime-display__unit">
          <span className="machine-runtime-display__value">{hours}</span>
          <span className="machine-runtime-display__label">Giờ</span>
        </div>
        <span className="machine-runtime-display__sep" aria-hidden="true">
          :
        </span>
        <div className="machine-runtime-display__unit">
          <span className="machine-runtime-display__value">{pad2(minutes)}</span>
          <span className="machine-runtime-display__label">Phút</span>
        </div>
        <span className="machine-runtime-display__sep" aria-hidden="true">
          :
        </span>
        <div className="machine-runtime-display__unit">
          <span className="machine-runtime-display__value">{pad2(seconds)}</span>
          <span className="machine-runtime-display__label">Giây</span>
        </div>
      </div>
      <div className="machine-runtime-display__days" aria-hidden="true">
        <span className="machine-runtime-display__days-value">{daysLabel}</span>
        <span className="machine-runtime-display__days-unit"> ngày</span>
      </div>
    </div>
  );
};

export default React.memo(CumulativeRuntimeDisplay);
