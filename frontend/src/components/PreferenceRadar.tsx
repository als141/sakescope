'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PreferenceAxis } from '@/types/preferences';

interface PreferenceRadarProps {
  axes: PreferenceAxis[];
  size?: number;
  className?: string;
  title?: string;
}

const toRadian = (degree: number) => (degree * Math.PI) / 180;

function clampLevel(level: number) {
  if (Number.isNaN(level)) return 1;
  return Math.max(1, Math.min(5, Math.round(level)));
}

/**
 * Lightweight radar chart rendered with SVG (no extra deps).
 */
function PreferenceRadarBase({ axes, size = 260, className, title }: PreferenceRadarProps) {
  const normalizedAxes = useMemo(
    () =>
      axes.slice(0, 6).map((axis, index) => ({
        ...axis,
        level: clampLevel(axis.level),
        index,
      })),
    [axes],
  );

  if (normalizedAxes.length < 3) {
    return null;
  }

  const paddedSize = size;
  const center = paddedSize / 2;
  const radius = paddedSize / 2 - 22;
  const angleStep = (2 * Math.PI) / normalizedAxes.length;
  const levels = 5;

  const points = normalizedAxes
    .map((axis) => {
      const angle = angleStep * axis.index - Math.PI / 2; // start at top
      const r = (axis.level / levels) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {title && (
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
      )}
      <svg
        width={paddedSize}
        height={paddedSize}
        viewBox={`0 0 ${paddedSize} ${paddedSize}`}
        className="text-muted-foreground/70"
      >
        {/* concentric guides */}
        {[1, 2, 3, 4, 5].map((level) => {
          const r = (level / levels) * radius;
          return (
            <circle
              key={level}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          );
        })}

        {/* axis lines */}
        {normalizedAxes.map((axis) => {
          const angle = angleStep * axis.index - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={axis.key}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          );
        })}

        {/* filled polygon */}
        <polygon
          points={points}
          fill="url(#radarFill)"
          stroke="currentColor"
          strokeWidth={2}
          strokeOpacity={0.9}
        />

        {/* glowing gradient */}
        <defs>
          <radialGradient id="radarFill" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
          </radialGradient>
        </defs>

        {/* axis circles for points */}
        {normalizedAxes.map((axis) => {
          const angle = angleStep * axis.index - Math.PI / 2;
          const r = (axis.level / levels) * radius;
          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);
          return (
            <g key={`${axis.key}-point`}>
              <circle
                cx={x}
                cy={y}
                r={5}
                fill="var(--background)"
                stroke="currentColor"
                strokeWidth={2}
              />
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fontSize="10"
                fill="var(--foreground)"
                style={{ pointerEvents: 'none' }}
              >
                {axis.level}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm text-[11px] sm:text-xs text-muted-foreground">
        {normalizedAxes.map((axis) => (
          <div key={axis.key} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2 py-1.5 bg-background/80">
            <span className="truncate font-semibold text-foreground">{axis.label}</span>
            <span className="text-xs tabular-nums text-primary font-semibold">{axis.level}/5</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const PreferenceRadar = memo(PreferenceRadarBase);
