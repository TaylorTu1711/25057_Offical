import React, { useMemo } from 'react';

const CX = 104;
const CY = 110;
const VIEW = 220;
const OUTER_R = 88;
const INNER_R = 62;
const STROKE = 17;
const TRACK = '#e8edf5';

const STYLES = {
  performance: {
    color: '#f59e0b',
    colorDeep: '#ea580c',
    label: 'KHAI THÁC',
  },
  utilization: {
    color: '#38bdf8',
    colorDeep: '#0284c7',
    label: 'VẬN HÀNH',
  },
};

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

function formatPct(value) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

/** Góc bắt đầu từ đỉnh (-90°), tiến theo chiều kim đồng hồ trong SVG = tăng góc. */
function polar(cx, cy, r, degFromTopClockwise) {
  const rad = ((degFromTopClockwise - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, ratio) {
  const t = clamp01(ratio);
  if (t <= 0) return '';
  if (t >= 0.999) {
    // full circle: two half-arcs
    const a = polar(cx, cy, r, 0);
    const b = polar(cx, cy, r, 180);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y} A ${r} ${r} 0 1 1 ${a.x} ${a.y}`;
  }
  const endDeg = t * 360;
  const start = polar(cx, cy, r, 0);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function calloutLayout(r, side) {
  // Cố định nhãn bên phải theo vị trí mẫu:
  // inner (xanh) ~2 giờ, outer (cam) ~4 giờ
  const deg = side === 'inner' ? 52 : 118;
  const onRing = polar(CX, CY, r, deg);
  const elbow = polar(CX, CY, r + (side === 'outer' ? 18 : 24), deg);

  let label;
  if (side === 'inner') {
    label = {
      x: Math.min(VIEW - 38, elbow.x + 36),
      y: Math.max(20, Math.min(CY - 14, elbow.y - 4)),
    };
  } else {
    label = {
      x: Math.min(VIEW - 38, elbow.x + 32),
      y: Math.min(VIEW - 20, Math.max(CY + 24, elbow.y + 4)),
    };
  }

  return { onRing, elbow, label, endDeg: deg };
}

/**
 * Gauge hiệu suất 2 vòng đồng tâm (style radial bar + nhãn %).
 * Ngoài = khai thác, trong = vận hành.
 */
export default function MidaDualEfficiencyGauge({
  performanceValue = 0,
  utilizationValue = 0,
  performanceFormula = '',
  utilizationFormula = '',
}) {
  const perfPct = formatPct(performanceValue);
  const utilPct = formatPct(utilizationValue);
  const perfRatio = clamp01(Number(performanceValue) / 100);
  const utilRatio = clamp01(Number(utilizationValue) / 100);

  const outerArc = useMemo(() => describeArc(CX, CY, OUTER_R, perfRatio), [perfRatio]);
  const innerArc = useMemo(() => describeArc(CX, CY, INNER_R, utilRatio), [utilRatio]);
  const outerCallout = useMemo(() => calloutLayout(OUTER_R, 'outer'), []);
  const innerCallout = useMemo(() => calloutLayout(INNER_R, 'inner'), []);

  return (
    <div className="mida-gauge mida-gauge--dual mida-gauge--radial-bars mida-gauge--has-formula">
      <div className="mida-gauge__chart mida-gauge__chart--dual-bars">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="mida-dual-bars__svg"
          aria-label="Hiệu suất khai thác và vận hành"
          role="img"
        >
          <defs>
            <linearGradient id="midaPerfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={STYLES.performance.color} />
              <stop offset="100%" stopColor={STYLES.performance.colorDeep} />
            </linearGradient>
            <linearGradient id="midaUtilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={STYLES.utilization.color} />
              <stop offset="100%" stopColor={STYLES.utilization.colorDeep} />
            </linearGradient>
            <filter id="midaCalloutShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Tracks */}
          <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke={TRACK} strokeWidth={STROKE} />
          <circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke={TRACK} strokeWidth={STROKE} />

          {/* Progress arcs */}
          {outerArc ? (
            <path
              d={outerArc}
              fill="none"
              stroke="url(#midaPerfGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ) : null}
          {innerArc ? (
            <path
              d={innerArc}
              fill="none"
              stroke="url(#midaUtilGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ) : null}

          {/* Outer callout (cam / khai thác) — bên phải dưới */}
          <path
            d={`M ${outerCallout.onRing.x} ${outerCallout.onRing.y} L ${outerCallout.elbow.x} ${outerCallout.elbow.y} L ${outerCallout.label.x - 12} ${outerCallout.label.y}`}
            fill="none"
            stroke={STYLES.performance.colorDeep}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle
            cx={outerCallout.onRing.x}
            cy={outerCallout.onRing.y}
            r="4"
            fill="#fff"
            stroke={STYLES.performance.colorDeep}
            strokeWidth="1.6"
          />
          <g filter="url(#midaCalloutShadow)">
            <rect
              x={outerCallout.label.x - 34}
              y={outerCallout.label.y - 14}
              width="68"
              height="28"
              rx="7"
              fill={STYLES.performance.colorDeep}
            />
            <text
              x={outerCallout.label.x}
              y={outerCallout.label.y + 5}
              textAnchor="middle"
              fill="#fff"
              fontSize="14"
              fontWeight="800"
            >
              {perfPct}%
            </text>
          </g>

          {/* Inner callout (xanh / vận hành) — bên phải trên */}
          <path
            d={`M ${innerCallout.onRing.x} ${innerCallout.onRing.y} L ${innerCallout.elbow.x} ${innerCallout.elbow.y} L ${innerCallout.label.x - 12} ${innerCallout.label.y}`}
            fill="none"
            stroke={STYLES.utilization.colorDeep}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle
            cx={innerCallout.onRing.x}
            cy={innerCallout.onRing.y}
            r="4"
            fill="#fff"
            stroke={STYLES.utilization.colorDeep}
            strokeWidth="1.6"
          />
          <g filter="url(#midaCalloutShadow)">
            <rect
              x={innerCallout.label.x - 34}
              y={innerCallout.label.y - 14}
              width="68"
              height="28"
              rx="7"
              fill={STYLES.utilization.colorDeep}
            />
            <text
              x={innerCallout.label.x}
              y={innerCallout.label.y + 5}
              textAnchor="middle"
              fill="#fff"
              fontSize="14"
              fontWeight="800"
            >
              {utilPct}%
            </text>
          </g>
        </svg>
      </div>
      <div className="mida-gauge__legend">
        <span className="mida-gauge__legend-item mida-gauge__legend-item--performance">
          <i aria-hidden="true" /> KHAI THÁC
        </span>
        <span className="mida-gauge__legend-item mida-gauge__legend-item--utilization">
          <i aria-hidden="true" /> VẬN HÀNH
        </span>
      </div>
      <div className="mida-gauge__formula" role="tooltip">
        <div className="mida-gauge__formula-title">Hiệu suất khai thác: {perfPct}%</div>
        {performanceFormula ? (
          <div className="mida-gauge__formula-text">{performanceFormula}</div>
        ) : null}
        <div className="mida-gauge__formula-title" style={{ marginTop: '0.35rem' }}>
          Hiệu suất vận hành: {utilPct}%
        </div>
        {utilizationFormula ? (
          <div className="mida-gauge__formula-text">{utilizationFormula}</div>
        ) : null}
      </div>
    </div>
  );
}
