import React from 'react';
import MidaRadialTickGauge from './MidaRadialTickGauge';

const BAR_SEGMENTS = 20;

const THEMES = {
  voltage: {
    label: 'ĐIỆN ÁP',
    color: '#3b82f6',
    faded: 'rgba(59, 130, 246, 0.18)',
  },
  current: {
    label: 'DÒNG ĐIỆN',
    color: '#ef5350',
    faded: 'rgba(239, 83, 80, 0.18)',
  },
  power: {
    label: 'CÔNG SUẤT',
    color: '#7c3aed',
    faded: 'rgba(124, 58, 237, 0.18)',
  },
};

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function formatValue(value, digits) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SegmentedBar({ ratio, color, faded }) {
  const filled = Math.round(BAR_SEGMENTS * clamp01(ratio));

  return (
    <div className="mida-elec-bar" aria-hidden="true">
      {Array.from({ length: BAR_SEGMENTS }, (_, i) => {
        const fromBottom = BAR_SEGMENTS - 1 - i;
        const active = fromBottom < filled;
        return (
          <span
            key={i}
            className="mida-elec-bar__seg"
            style={{ background: active ? color : faded }}
          />
        );
      })}
    </div>
  );
}

function MetricCard({ theme, children, className = '' }) {
  return (
    <div
      className={`mida-elec-card ${className}`.trim()}
      style={{ ['--mida-elec-color']: theme.color }}
    >
      <div className="mida-elec-card__label">{theme.label}</div>
      {children}
    </div>
  );
}

/**
 * Thẻ điện — ĐIỆN ÁP full-width; CÔNG SUẤT | DÒNG ĐIỆN.
 */
export default function MidaElectricalCards({
  voltage = 0,
  current = 0,
  powerKw = 0,
  voltageMax = 300,
  currentMax = 50,
  powerMaxKw = 10,
}) {
  const v = Number(voltage) || 0;
  const a = Number(current) || 0;
  const pKw = Number(powerKw) || 0;

  return (
    <div className="mida-elec-stack">
      <div className="mida-elec-stack__pair mida-elec-stack__pair--single">
        <MetricCard theme={THEMES.voltage} className="mida-elec-card--bar">
          <div className="mida-elec-card__body mida-elec-card__body--bar">
            <div
              className="mida-elec-card__value"
              style={{ color: THEMES.voltage.color }}
              translate="no"
            >
              {formatValue(v, 2)}
              <span className="mida-elec-card__unit">V</span>
            </div>
            <SegmentedBar
              ratio={v / voltageMax}
              color={THEMES.voltage.color}
              faded={THEMES.voltage.faded}
            />
          </div>
        </MetricCard>
      </div>

      <div className="mida-elec-stack__top">
        <MetricCard theme={THEMES.power} className="mida-elec-card--radial">
          <div className="mida-elec-card__body">
            <MidaRadialTickGauge
              ratio={pKw / powerMaxKw}
              color={THEMES.power.color}
              faded={THEMES.power.faded}
              centerText={`${formatValue(pKw, 2)}kW`}
            />
          </div>
        </MetricCard>

        <MetricCard theme={THEMES.current} className="mida-elec-card--radial">
          <div className="mida-elec-card__body">
            <MidaRadialTickGauge
              ratio={a / currentMax}
              color={THEMES.current.color}
              faded={THEMES.current.faded}
              centerText={`${formatValue(a, 2)}A`}
            />
          </div>
        </MetricCard>
      </div>
    </div>
  );
}
