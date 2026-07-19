import React, { useMemo } from 'react';

const RADIAL_TICKS = 64;
const ARC_START_DEG = 135;
const ARC_SPAN_DEG = 270;
const FULL_START_DEG = -90;
const FULL_SPAN_DEG = 360;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * Gauge dạng vạch tick (POWER/CURRENT: bán nguyệt; fullCircle: vòng đủ 360°).
 */
export default function MidaRadialTickGauge({
  ratio,
  color,
  faded,
  centerText,
  fullCircle = false,
}) {
  const ticks = useMemo(() => {
    const filled = Math.round(RADIAL_TICKS * clamp01(ratio));
    const cx = 50;
    const cy = fullCircle ? 50 : 52;
    const inner = fullCircle ? 30 : 28;
    const outer = fullCircle ? 46 : 44;
    const startDeg = fullCircle ? FULL_START_DEG : ARC_START_DEG;
    const spanDeg = fullCircle ? FULL_SPAN_DEG : ARC_SPAN_DEG;
    // Vòng đầy đủ: chia đều 360° không trùng vạch đầu/cuối
    const divisor = fullCircle ? RADIAL_TICKS : RADIAL_TICKS - 1;

    return Array.from({ length: RADIAL_TICKS }, (_, i) => {
      const deg = startDeg + (spanDeg * i) / divisor;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        key: i,
        x1: cx + inner * cos,
        y1: cy + inner * sin,
        x2: cx + outer * cos,
        y2: cy + outer * sin,
        active: i < filled,
      };
    });
  }, [ratio, fullCircle]);

  return (
    <div className={`mida-elec-radial${fullCircle ? ' mida-elec-radial--full' : ''}`}>
      <svg viewBox="0 0 100 100" className="mida-elec-radial__svg" aria-hidden="true">
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.active ? color : faded}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="mida-elec-radial__value" style={{ color }} translate="no">
        {centerText}
      </div>
    </div>
  );
}
