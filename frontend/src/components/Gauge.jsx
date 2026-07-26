import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
export default function Gauge({
  value = 0,
  min = 0,
  max = 100,
  label = '',
  unit = '',
  warningThreshold = 70,
  dangerThreshold = 90,
  size = 160,
  reverse = false, 
}) {
  const radius = 58;
  const strokeWidth = 8;
  const center = 75;
  const startAngle = 150;
  const endAngle = 390;
  const totalAngle = endAngle - startAngle;
  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = (clampedValue - min) / (max - min);
  const needleAngle = startAngle + percentage * totalAngle;
  const getColor = () => {
    const pct = percentage * 100;
    if (reverse) {
      if (pct <= (100 - dangerThreshold)) return { color: '#ef4444', glow: 'gauge-glow-red', status: 'danger' };
      if (pct <= (100 - warningThreshold)) return { color: '#f59e0b', glow: 'gauge-glow-yellow', status: 'warning' };
      return { color: '#10b981', glow: 'gauge-glow-green', status: 'normal' };
    } else {
      if (pct >= dangerThreshold) return { color: '#ef4444', glow: 'gauge-glow-red', status: 'danger' };
      if (pct >= warningThreshold) return { color: '#f59e0b', glow: 'gauge-glow-yellow', status: 'warning' };
      return { color: '#10b981', glow: 'gauge-glow-green', status: 'normal' };
    }
  };
  const { color, glow, status } = getColor();
  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };
  const describeArc = (cx, cy, r, start, end) => {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };
  const bgArc = describeArc(center, center, radius, startAngle, endAngle);
  const valueEnd = startAngle + percentage * totalAngle;
  const valueArc = percentage > 0.01 ? describeArc(center, center, radius, startAngle, valueEnd) : '';
  const needleEnd = polarToCartesian(center, center, radius - 15, needleAngle);
  const ticks = useMemo(() => {
    const count = 12;
    const result = [];
    for (let i = 0; i <= count; i++) {
      const angle = startAngle + (i / count) * totalAngle;
      const outer = polarToCartesian(center, center, radius + 6, angle);
      const inner = polarToCartesian(center, center, radius + (i % 3 === 0 ? 14 : 10), angle);
      result.push({ x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y, major: i % 3 === 0 });
    }
    return result;
  }, []);
  return (
    <div className={`flex flex-col items-center ${glow}`} style={{ width: size, height: size + 30 }}>
      <svg
        viewBox="0 0 150 150"
        width={size}
        height={size}
        className="overflow-visible"
      >
        {}
        <path
          d={bgArc}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {}
        {valueArc && (
          <motion.path
            d={valueArc}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ filter: status === 'danger' ? `drop-shadow(0 0 6px ${color})` : 'none' }}
          />
        )}
        {}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? '#475569' : '#334155'}
            strokeWidth={tick.major ? 1.5 : 0.8}
          />
        ))}
        {}
        <motion.line
          x1={center}
          y1={center}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={false}
          animate={{ x2: needleEnd.x, y2: needleEnd.y }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        {}
        <circle cx={center} cy={center} r={4} fill={color} />
        <circle cx={center} cy={center} r={2} fill="#0a0e17" />
        {}
        <text
          x={center}
          y={center + 20}
          textAnchor="middle"
          className="font-display"
          fill={color}
          fontSize="18"
          fontWeight="700"
          fontFamily="Orbitron, sans-serif"
        >
          {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
        </text>
        {}
        <text
          x={center}
          y={center + 32}
          textAnchor="middle"
          fill="#64748b"
          fontSize="9"
          fontFamily="Inter, sans-serif"
        >
          {unit}
        </text>
      </svg>
      {}
      <span className="text-xs text-dash-muted font-medium tracking-wide mt-1 uppercase">
        {label}
      </span>
    </div>
  );
}
