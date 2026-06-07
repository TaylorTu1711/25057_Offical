import React from 'react';
import { formatCumulativeRuntime, parseRuntimeSeconds } from '../../utils/formatDuration';

const pad2 = (n) => String(n).padStart(2, '0');

const CumulativeRuntimeDisplay = ({ totalSeconds }) => {
  const { hours, minutes, seconds } = parseRuntimeSeconds(totalSeconds);
  const label = formatCumulativeRuntime(totalSeconds);

  return (
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
  );
};

export default CumulativeRuntimeDisplay;
