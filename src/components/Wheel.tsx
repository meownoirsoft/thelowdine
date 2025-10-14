'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bodoni_Moda } from 'next/font/google';
const bodoni = Bodoni_Moda({ subsets: ['latin'], weight: ['700'] });

type WheelDatum = {
  option: string;
  style?: { backgroundColor?: string; textColor?: string };
};

interface WheelProps {
  data: WheelDatum[];
  mustStartSpinning: boolean;
  prizeNumber: number; // index in data
  onStopSpinning: () => void;
  size?: number; // px
  spinDurationMs?: number;
}

export default function Wheel({
  data,
  mustStartSpinning,
  prizeNumber,
  onStopSpinning,
  size = 256,
  spinDurationMs = 6500,
}: WheelProps) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const prevMustRef = useRef(false);

  const slices = data.length;
  const sliceAngle = 360 / Math.max(1, slices);

  const colors = useMemo(() => {
    const red = '#b91c1c'; // tailwind red-700
    const black = '#111827'; // tailwind gray-900 as black
    return data.map((_, i) => ({
      bg: i % 2 === 0 ? red : black,
      fg: '#ffffff',
    }));
  }, [data]);

  useEffect(() => {
    if (!prevMustRef.current && mustStartSpinning && slices > 0) {
      // total spins + target landing
      const extraSpins = 6 + Math.floor(Math.random() * 5); // 6-10 full rotations for variability
      // Normalize current angle to [0,360)
      const current = ((angle % 360) + 360) % 360;
      // Center of selected slice angle (in degrees) relative to +X axis
      const centerDeg = prizeNumber * sliceAngle + sliceAngle / 2;
      // Desired absolute alignment under top pointer (-90deg from +X)
      // Add a small random jitter within the slice to avoid repeated edge landings
      const jitter = (Math.random() - 0.5) * Math.min(15, sliceAngle * 0.5); // ± up to ~15° or half-slice cap
      const desired = -90 - centerDeg + jitter;
      // Forward delta from current to desired
      const deltaToCenter = ((desired - current) % 360 + 360) % 360;
      // Build a target that guarantees forward motion and extra full rotations
      const targetAngle = angle - current + (current + deltaToCenter) + extraSpins * 360;
      setSpinning(true);
      // First normalize to current to avoid browser optimizing tiny diffs
      setAngle(angle - current + current);
      // trigger transition to target on next frame
      requestAnimationFrame(() => setAngle(targetAngle));
      const t = setTimeout(() => {
        setSpinning(false);
        // Normalize stored angle to avoid unbounded growth
        setAngle(((targetAngle % 360) + 360) % 360);
        onStopSpinning();
      }, spinDurationMs + 50);
      return () => clearTimeout(t);
    }
    prevMustRef.current = mustStartSpinning;
  }, [mustStartSpinning, prizeNumber, sliceAngle, slices, onStopSpinning, spinDurationMs]);

  const radius = size / 2;
  const fontSize = Math.max(10, size / 18);

  return (
    <div style={{ width: size, height: size, position: 'relative', borderRadius: '50%', boxShadow: '0 0 0 6px #c9a227' }}>
      {/* pointer */}
      <div
        style={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '18px solid #c9a227',
          zIndex: 3,
          filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))',
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          borderRadius: '50%',
          boxShadow: '0 0 12px rgba(0,0,0,0.5)',
          transform: `rotate(${angle}deg)`,
          transition: spinning ? `transform ${spinDurationMs}ms cubic-bezier(0.15, 0.85, 0.25, 1)` : undefined,
          background: '#1e293b',
        }}
      >
        <g transform={`translate(${radius}, ${radius})`}>
          {data.map((d, i) => {
            const startAngle = (i * sliceAngle * Math.PI) / 180;
            const endAngle = ((i + 1) * sliceAngle * Math.PI) / 180;
            const x1 = Math.cos(startAngle) * radius;
            const y1 = Math.sin(startAngle) * radius;
            const x2 = Math.cos(endAngle) * radius;
            const y2 = Math.sin(endAngle) * radius;
            const largeArc = sliceAngle > 180 ? 1 : 0;
            const pathData = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
            const midAngle = (startAngle + endAngle) / 2;
            // Position labels close to the rim with less inward padding
            const inset = radius * 0.9;
            // Smaller tangent offset so there's less apparent top padding
            const pad = Math.max(1, size * 0.012);
            const nx = Math.cos(midAngle + Math.PI / 2);
            const ny = Math.sin(midAngle + Math.PI / 2);
            const tx = Math.cos(midAngle) * inset + nx * pad;
            const ty = Math.sin(midAngle) * inset + ny * pad;
            return (
              <g key={i}>
                <path d={pathData} fill={colors[i].bg} stroke="#c9a227" strokeWidth={0.5} />
                <text
                  className={bodoni.className}
                  x={tx}
                  y={ty}
                  fill={colors[i].fg}
                  fontSize={fontSize}
                  fontWeight={700}
                  style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${(midAngle * 180) / Math.PI}, ${tx}, ${ty})`}
                >
                  {d.option.length > 18 ? d.option.slice(0, 17) + '…' : d.option}
                </text>
              </g>
            );
          })}
        </g>
        {/* center cap */}
        <circle cx={radius} cy={radius} r={size * 0.08} fill="#1e293b" stroke="#c9a227" strokeWidth={4} />
      </svg>
    </div>
  );
}
