import React from 'react';
import MidaRadialTickGauge from './MidaRadialTickGauge';

/** Palette riêng cho 2 gauge hiệu suất — tông đằm, ít neon hơn */
const STYLES = {
  utilization: {
    color: '#0e7490',
    faded: 'rgba(14, 116, 144, 0.2)',
  },
  performance: {
    color: '#b45309',
    faded: 'rgba(180, 83, 9, 0.2)',
  },
};

/**
 * Biểu đồ % — style tick radial vòng đầy đủ (giống POWER, đủ 360°).
 * @param {number} value - 0..100
 * @param {string} label
 * @param {'utilization'|'performance'} variant
 * @param {string} [formula] - công thức hiện khi hover
 */
export default function MidaGaugeChart({
  value = 0,
  label = '',
  variant = 'performance',
  formula = '',
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const display = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  const style = STYLES[variant] || STYLES.performance;
  const tooltip = formula
    ? `${label}: ${display}%\n${formula}`
    : `${label}: ${display}%`;

  return (
    <div
      className={`mida-gauge mida-gauge--${variant} mida-gauge--radial${formula ? ' mida-gauge--has-formula' : ''}`}
      style={{ ['--mida-elec-color']: style.color }}
      title={tooltip}
    >
      {label ? <div className="mida-gauge__label">{label}</div> : null}
      <div className="mida-gauge__chart mida-gauge__chart--radial">
        <MidaRadialTickGauge
          ratio={pct / 100}
          color={style.color}
          faded={style.faded}
          centerText={`${display}%`}
          fullCircle
        />
      </div>
      {formula ? (
        <div className="mida-gauge__formula" role="tooltip">
          <div className="mida-gauge__formula-title">{label}</div>
          <div className="mida-gauge__formula-text">{formula}</div>
        </div>
      ) : null}
    </div>
  );
}
