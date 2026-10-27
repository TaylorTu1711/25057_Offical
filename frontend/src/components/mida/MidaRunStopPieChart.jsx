import React, { useId, useMemo } from 'react';
import MidaChartExpand from './MidaChartExpand';

const VIEW = 220;
const CX = 110;
const CY = 108;
const R = 100;

const COLORS = {
  run: '#22c55e',
  runDeep: '#16a34a',
  setup: '#f59e0b',
  setupDeep: '#d97706',
  stop: '#ef4444',
  stopDeep: '#dc2626',
};

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

function polar(cx, cy, r, degFromTopClockwise) {
  const rad = ((degFromTopClockwise - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Wedge pie từ startDeg → endDeg (theo chiều kim đồng hồ, 0° = đỉnh). */
function describeWedge(cx, cy, r, startDeg, endDeg) {
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  if (sweep < 0.4) return '';
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  if (sweep >= 359.6) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

function radialCallout(midDeg) {
  const onPie = polar(CX, CY, R * 0.62, midDeg);
  const label = polar(CX, CY, R + 32, midDeg);
  const labelX = Math.min(VIEW - 40, Math.max(40, label.x));
  const labelY = Math.min(VIEW - 18, Math.max(18, label.y));
  return {
    onPie,
    path: `M ${onPie.x} ${onPie.y} L ${labelX} ${labelY}`,
    label: { x: labelX, y: labelY },
  };
}

function roundPct(n) {
  return Number((Number(n) || 0).toFixed(2));
}

/**
 * Pie Cắt gọt / Setup / Ngưng — phong cách mẫu (pie đặc + nhãn % + chú thích).
 * % tính trên time_on: cắt gọt = time_running, setup = time_setup, ngưng = phần còn lại.
 */
export default function MidaRunStopPieChart({
  runSeconds = 0,
  setupSeconds = 0,
  onSeconds = 0,
  expandable = true,
}) {
  const uid = useId().replace(/:/g, '');
  const { runPct, setupPct, stopPct } = useMemo(() => {
    const on = Math.max(0, Number(onSeconds) || 0);
    let run = Math.max(0, Number(runSeconds) || 0);
    let setup = Math.max(0, Number(setupSeconds) || 0);

    if (on <= 0) {
      const total = run + setup;
      if (total <= 0) return { runPct: 0, setupPct: 0, stopPct: 0 };
      const r = (run / total) * 100;
      return {
        runPct: roundPct(r),
        setupPct: roundPct(100 - r),
        stopPct: 0,
      };
    }

    if (run > on) run = on;
    if (run + setup > on) setup = Math.max(0, on - run);

    const runPct = roundPct((run / on) * 100);
    const setupPct = roundPct((setup / on) * 100);
    const stopPct = roundPct(Math.max(0, 100 - runPct - setupPct));
    return { runPct, setupPct, stopPct };
  }, [runSeconds, setupSeconds, onSeconds]);

  const slices = useMemo(() => {
    const defs = [
      { key: 'run', pct: runPct, fill: `url(#midaPieRunGrad-${uid})`, stroke: COLORS.runDeep },
      { key: 'setup', pct: setupPct, fill: `url(#midaPieSetupGrad-${uid})`, stroke: COLORS.setupDeep },
      { key: 'stop', pct: stopPct, fill: `url(#midaPieStopGrad-${uid})`, stroke: COLORS.stopDeep },
    ];
    let cursor = 0;
    return defs.map((slice) => {
      const sweep = clamp01(slice.pct / 100) * 360;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;
      return {
        ...slice,
        sweep,
        path: describeWedge(CX, CY, R, start, end),
        callout: radialCallout(start + sweep / 2),
        show: sweep > 1,
      };
    });
  }, [runPct, setupPct, stopPct, uid]);

  const empty = runPct === 0 && setupPct === 0 && stopPct === 0;

  return (
    <div className="mida-gauge mida-run-stop-pie">
      {expandable ? (
        <MidaChartExpand
          title="CẮT GỌT · SETUP · NGƯNG"
          variant="pie"
          buttonClassName="mida-chart-expand-btn--corner"
        >
          <MidaRunStopPieChart
            runSeconds={runSeconds}
            setupSeconds={setupSeconds}
            onSeconds={onSeconds}
            expandable={false}
          />
        </MidaChartExpand>
      ) : null}
      <div className="mida-run-stop-pie__chart">
        {empty ? (
          <div className="mida-run-stop-pie__empty">Chưa có dữ liệu</div>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="mida-run-stop-pie__svg"
            role="img"
            aria-label={`Cắt gọt ${runPct}%, Setup ${setupPct}%, Ngưng ${stopPct}%`}
          >
            <defs>
              <radialGradient id={`midaPieRunGrad-${uid}`} cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor={COLORS.runDeep} />
              </radialGradient>
              <radialGradient id={`midaPieSetupGrad-${uid}`} cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor={COLORS.setupDeep} />
              </radialGradient>
              <radialGradient id={`midaPieStopGrad-${uid}`} cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor={COLORS.stopDeep} />
              </radialGradient>
              <filter id={`midaPieSoftShadow-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#94a3b8" floodOpacity="0.35" />
              </filter>
              <filter id={`midaPieBadgeShadow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodOpacity="0.28" />
              </filter>
            </defs>

            <g filter={`url(#midaPieSoftShadow-${uid})`}>
              {slices.map((slice) => (
                slice.show ? (
                  <path
                    key={slice.key}
                    d={slice.path}
                    fill={slice.fill}
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                ) : null
              ))}
            </g>

            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
            />

            {slices.map((slice) => (
              slice.show ? (
                <g key={`${slice.key}-callout`}>
                  <path
                    d={slice.callout.path}
                    fill="none"
                    stroke={slice.stroke}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={slice.callout.onPie.x}
                    cy={slice.callout.onPie.y}
                    r="4"
                    fill="#fff"
                    stroke={slice.stroke}
                    strokeWidth="1.8"
                  />
                  <g filter={`url(#midaPieBadgeShadow-${uid})`}>
                    <rect
                      x={slice.callout.label.x - 40}
                      y={slice.callout.label.y - 16}
                      width="80"
                      height="32"
                      rx="8"
                      fill={slice.stroke}
                    />
                    <text
                      x={slice.callout.label.x}
                      y={slice.callout.label.y + 6}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="16"
                      fontWeight="800"
                    >
                      {slice.pct}%
                    </text>
                  </g>
                </g>
              ) : null
            ))}
          </svg>
        )}
      </div>
      {!empty ? (
        <div className="mida-run-stop-pie__legend">
          <span className="mida-run-stop-pie__legend-item mida-run-stop-pie__legend-item--run">
            <i aria-hidden="true" /> Cắt gọt
          </span>
          <span className="mida-run-stop-pie__legend-item mida-run-stop-pie__legend-item--setup">
            <i aria-hidden="true" /> Setup
          </span>
          <span className="mida-run-stop-pie__legend-item mida-run-stop-pie__legend-item--stop">
            <i aria-hidden="true" /> Ngưng
          </span>
        </div>
      ) : null}
    </div>
  );
}
