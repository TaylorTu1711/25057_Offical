import React, { useMemo } from 'react';

const VIEW = 220;
const CX = 110;
const CY = 108;
const R = 100;

const COLORS = {
  run: '#22c55e',
  runDeep: '#16a34a',
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

function steppedCallout(midDeg, side) {
  const onPie = polar(CX, CY, R * 0.62, midDeg);
  const rim = polar(CX, CY, R + 2, midDeg);

  let labelX;
  let labelY;
  let mid1;
  let mid2;

  if (side === 'run') {
    labelX = Math.min(VIEW - 40, Math.max(rim.x + 22, CX + 30));
    labelY = Math.min(VIEW - 24, Math.max(rim.y + 2, CY + 10));
    mid1 = { x: rim.x + 8, y: rim.y };
    mid2 = { x: labelX, y: rim.y };
  } else {
    labelX = Math.max(40, Math.min(rim.x - 22, CX - 30));
    labelY = Math.max(22, Math.min(rim.y - 2, CY - 12));
    mid1 = { x: rim.x - 8, y: rim.y };
    mid2 = { x: labelX, y: rim.y };
  }

  return {
    onPie,
    path: `M ${onPie.x} ${onPie.y} L ${rim.x} ${rim.y} L ${mid1.x} ${mid1.y} L ${mid2.x} ${mid2.y} L ${labelX} ${labelY}`,
    label: { x: labelX, y: labelY },
  };
}

/**
 * Pie Cắt gọt / Ngưng — phong cách mẫu (pie đặc + nhãn % + chú thích).
 */
export default function MidaRunStopPieChart({
  runSeconds = 0,
  onSeconds = 0,
}) {
  const { runPct, stopPct } = useMemo(() => {
    const on = Math.max(0, Number(onSeconds) || 0);
    const run = Math.max(0, Math.min(Number(runSeconds) || 0, on || Number(runSeconds) || 0));
    if (on <= 0) {
      if (run <= 0) return { runPct: 0, stopPct: 0 };
      return { runPct: 100, stopPct: 0 };
    }
    const r = (run / on) * 100;
    return {
      runPct: Number(r.toFixed(2)),
      stopPct: Number((100 - r).toFixed(2)),
    };
  }, [runSeconds, onSeconds]);

  const geometry = useMemo(() => {
    const runSweep = clamp01(runPct / 100) * 360;
    const stopSweep = clamp01(stopPct / 100) * 360;
    const runStart = 0;
    const runEnd = runSweep;
    const stopStart = runEnd;
    const stopEnd = runEnd + stopSweep;

    return {
      runPath: describeWedge(CX, CY, R, runStart, runEnd),
      stopPath: describeWedge(CX, CY, R, stopStart, stopEnd),
      runCallout: steppedCallout(runStart + runSweep / 2, 'run'),
      stopCallout: steppedCallout(stopStart + stopSweep / 2, 'stop'),
      showRun: runSweep > 1,
      showStop: stopSweep > 1,
    };
  }, [runPct, stopPct]);

  const empty = runPct === 0 && stopPct === 0;

  return (
    <div className="mida-gauge mida-run-stop-pie">
      <div className="mida-run-stop-pie__chart">
        {empty ? (
          <div className="mida-run-stop-pie__empty">Chưa có dữ liệu</div>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="mida-run-stop-pie__svg"
            role="img"
            aria-label={`Cắt gọt ${runPct}%, Ngưng ${stopPct}%`}
          >
            <defs>
              <radialGradient id="midaPieRunGrad" cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor={COLORS.runDeep} />
              </radialGradient>
              <radialGradient id="midaPieStopGrad" cx="40%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor={COLORS.stopDeep} />
              </radialGradient>
              <filter id="midaPieSoftShadow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#94a3b8" floodOpacity="0.35" />
              </filter>
              <filter id="midaPieBadgeShadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodOpacity="0.28" />
              </filter>
            </defs>

            <g filter="url(#midaPieSoftShadow)">
              {geometry.showRun ? (
                <path
                  d={geometry.runPath}
                  fill="url(#midaPieRunGrad)"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              ) : null}
              {geometry.showStop ? (
                <path
                  d={geometry.stopPath}
                  fill="url(#midaPieStopGrad)"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              ) : null}
            </g>

            {/* Outer white rim */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
            />

            {geometry.showRun ? (
              <g>
                <path
                  d={geometry.runCallout.path}
                  fill="none"
                  stroke={COLORS.runDeep}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle
                  cx={geometry.runCallout.onPie.x}
                  cy={geometry.runCallout.onPie.y}
                  r="4"
                  fill="#fff"
                  stroke={COLORS.runDeep}
                  strokeWidth="1.8"
                />
                <g filter="url(#midaPieBadgeShadow)">
                  <rect
                    x={geometry.runCallout.label.x - 40}
                    y={geometry.runCallout.label.y - 16}
                    width="80"
                    height="32"
                    rx="8"
                    fill={COLORS.runDeep}
                  />
                  <text
                    x={geometry.runCallout.label.x}
                    y={geometry.runCallout.label.y + 6}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="16"
                    fontWeight="800"
                  >
                    {runPct}%
                  </text>
                </g>
              </g>
            ) : null}

            {geometry.showStop ? (
              <g>
                <path
                  d={geometry.stopCallout.path}
                  fill="none"
                  stroke={COLORS.stopDeep}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle
                  cx={geometry.stopCallout.onPie.x}
                  cy={geometry.stopCallout.onPie.y}
                  r="4"
                  fill="#fff"
                  stroke={COLORS.stopDeep}
                  strokeWidth="1.8"
                />
                <g filter="url(#midaPieBadgeShadow)">
                  <rect
                    x={geometry.stopCallout.label.x - 40}
                    y={geometry.stopCallout.label.y - 16}
                    width="80"
                    height="32"
                    rx="8"
                    fill={COLORS.stopDeep}
                  />
                  <text
                    x={geometry.stopCallout.label.x}
                    y={geometry.stopCallout.label.y + 6}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="16"
                    fontWeight="800"
                  >
                    {stopPct}%
                  </text>
                </g>
              </g>
            ) : null}
          </svg>
        )}
      </div>
      {!empty ? (
        <div className="mida-run-stop-pie__legend">
          <span className="mida-run-stop-pie__legend-item mida-run-stop-pie__legend-item--run">
            <i aria-hidden="true" /> Cắt gọt
          </span>
          <span className="mida-run-stop-pie__legend-item mida-run-stop-pie__legend-item--stop">
            <i aria-hidden="true" /> Ngưng
          </span>
        </div>
      ) : null}
    </div>
  );
}
