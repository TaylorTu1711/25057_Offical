import { memo, useEffect, useRef } from 'react';
import { POLL_INTERVALS } from '../../config/polling';

const TAU = Math.PI * 2;

/** Giữ quay thêm một nhịp poll — tránh khựng khi status nhấp nháy 1 lần. */
const SPIN_HOLD_MS = POLL_INTERVALS.status + 800;

const GEAR_COLORS = [
  { color: '#2563eb', holeStroke: '#1d4ed8' },
  { color: '#22c55e', holeStroke: '#16a34a' },
  { color: '#eab308', holeStroke: '#ca8a04' },
];

const STOPPED_GEAR_COLOR = { color: '#9ca3af', holeStroke: '#6b7280' };

const GEAR_LAYOUT = [
  {
    cx: 112,
    cy: 190,
    outerR: 88,
    innerR: 68,
    holeR: 44,
    teeth: 12,
    speed: 1,
    phaseOffset: 0,
  },
  {
    cx: 284,
    cy: 190,
    outerR: 88,
    innerR: 68,
    holeR: 44,
    teeth: 12,
    speed: -1,
    phaseOffset: Math.PI / 12,
  },
  {
    cx: 198,
    cy: 95,
    outerR: 74,
    innerR: 57,
    holeR: 37,
    teeth: 12,
    speed: 1,
    phaseOffset: Math.PI / 24,
  },
];

function buildGears(running) {
  return GEAR_LAYOUT.map((layout, index) => ({
    ...layout,
    ...(running ? GEAR_COLORS[index] : STOPPED_GEAR_COLOR),
    speed: running ? layout.speed : 0,
  }));
}

function getGearClusterMetrics(gears) {
  const bounds = gears.reduce(
    (box, gear) => ({
      minX: Math.min(box.minX, gear.cx - gear.outerR),
      maxX: Math.max(box.maxX, gear.cx + gear.outerR),
      minY: Math.min(box.minY, gear.cy - gear.outerR),
      maxY: Math.max(box.maxY, gear.cy + gear.outerR),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const centerX = gears.reduce((sum, gear) => sum + gear.cx, 0) / gears.length;
  const centerY = gears.reduce((sum, gear) => sum + gear.cy, 0) / gears.length;

  return { bounds, width, height, centerX, centerY };
}

function drawGear(ctx, cx, cy, outerR, innerR, holeR, teeth, phase, color, holeStroke) {
  const step = TAU / teeth;
  const toothHalf = step * 0.23;
  const r = 4;

  const rx = (rad, a) => cx + rad * Math.cos(a);
  const ry = (rad, a) => cy + rad * Math.sin(a);

  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const mid = phase + i * step;
    const gapNext = mid + step * 0.5;
    const A = mid - step * 0.5 + (step * 0.5 - toothHalf);
    const B = mid - toothHalf;
    const C = mid + toothHalf;
    const D = gapNext - (step * 0.5 - toothHalf);

    if (i === 0) {
      ctx.moveTo(rx(innerR, A), ry(innerR, A));
    }

    ctx.arcTo(rx(innerR, B), ry(innerR, B), rx(outerR, B), ry(outerR, B), r);
    ctx.arcTo(rx(outerR, B), ry(outerR, B), rx(outerR, C), ry(outerR, C), r);
    ctx.arcTo(rx(outerR, C), ry(outerR, C), rx(innerR, D), ry(innerR, D), r * 0.5);
    ctx.arcTo(rx(innerR, D), ry(innerR, D), rx(innerR, gapNext - 0.001), ry(innerR, gapNext - 0.001), r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, holeR, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, holeR, 0, TAU);
  ctx.strokeStyle = holeStroke;
  ctx.lineWidth = 3.5;
  ctx.stroke();
}

const GEAR_FIT_PADDING = 0.94;

/** Tâm khoảng trống giữa 3 bánh răng (tọa độ gốc 500×320). */
const GEAR_LABEL_CENTER = { x: 198, y: 152 };

function drawStatusLabel(ctx, running) {
  const { x, y } = GEAR_LABEL_CENTER;
  const label = running ? 'RUN' : 'STOP';
  const color = running ? '#16a34a' : '#dc2626';
  const fontSize = 56;

  ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeText(label, x, y);
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
}

const ThreeGears = ({ isRunning = true }) => {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const tRef = useRef(0);
  const rafRef = useRef(null);
  const spinRef = useRef(isRunning);
  const spinHoldTimerRef = useRef(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (isRunning) {
      if (spinHoldTimerRef.current) {
        clearTimeout(spinHoldTimerRef.current);
        spinHoldTimerRef.current = null;
      }
      spinRef.current = true;
      return undefined;
    }

    spinHoldTimerRef.current = setTimeout(() => {
      spinRef.current = false;
      spinHoldTimerRef.current = null;
    }, SPIN_HOLD_MS);

    return () => {
      if (spinHoldTimerRef.current) {
        clearTimeout(spinHoldTimerRef.current);
        spinHoldTimerRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const animSpeed = 0.016;
    let active = true;

    const draw = () => {
      const displayWidth = wrapper.clientWidth;
      const displayHeight = wrapper.clientHeight;
      if (!displayWidth || !displayHeight) return;

      const running = spinRef.current;
      const gears = buildGears(running);
      const cluster = getGearClusterMetrics(gears);
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(displayWidth * dpr);
      const pixelHeight = Math.round(displayHeight * dpr);

      if (
        canvasSizeRef.current.width !== pixelWidth
        || canvasSizeRef.current.height !== pixelHeight
      ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        canvasSizeRef.current = { width: pixelWidth, height: pixelHeight };
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const scale =
        Math.min(displayWidth / cluster.width, displayHeight / cluster.height) * GEAR_FIT_PADDING;
      const offsetX = displayWidth / 2 - cluster.centerX * scale;
      const offsetY = displayHeight / 2 - cluster.centerY * scale;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      gears.forEach((gear) => {
        const phase = gear.phaseOffset + gear.speed * tRef.current * animSpeed;
        drawGear(
          ctx,
          gear.cx,
          gear.cy,
          gear.outerR,
          gear.innerR,
          gear.holeR,
          gear.teeth,
          phase,
          gear.color,
          gear.holeStroke,
        );
      });

      drawStatusLabel(ctx, running);
      ctx.restore();
    };

    const loop = () => {
      if (!active) return;
      draw();
      if (spinRef.current) {
        tRef.current += 1;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="three-gears">
      <canvas
        ref={canvasRef}
        className="three-gears__canvas"
        aria-hidden="true"
      />
    </div>
  );
};

export default memo(ThreeGears);
