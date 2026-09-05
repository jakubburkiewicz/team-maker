import { COMPETENCIES, type Competency } from "@/lib/domain";
import { radarLayout } from "@/lib/radar-geometry";
import { cn } from "@/lib/utils";

interface CompetencyRadarProps {
  /** Siedem sum z `evaluateTeam` — czytane tylko przy pustym `violations` (umowa `evaluate-team.ts`). */
  scores: Readonly<Record<Competency, number>>;
  threshold: number;
}

const SIZE = 320;

/**
 * Wykres pajęczynowy siedmiu kompetencji z pierścieniem progu (FR-016).
 *
 * Ręczny inline SVG bez biblioteki, animacji i stanu: pozycje i kotwice etykiet przychodzą
 * z `radarLayout`, komponent nie liczy nic sam. Paleta cosmic literałami klas Tailwind
 * (`fill-*` / `stroke-*`), jak reszta ekranów drużyn — tokeny `--chart-*` są jasne i jest ich pięć.
 */
export function CompetencyRadar({ scores, threshold }: CompetencyRadarProps) {
  const layout = radarLayout(COMPETENCIES, scores, { size: SIZE, threshold });
  const toPoints = (points: readonly { x: number; y: number }[]) => points.map((p) => `${p.x},${p.y}`).join(" ");
  const summary = COMPETENCIES.map((competency) => `${competency} ${scores[competency]}`).join(", ");
  const thresholdLabel = layout.thresholdRing[0];

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Competency scores: ${summary}. Threshold ${threshold}.`}
      className="w-full max-w-sm"
    >
      {layout.axes.map((axis) => (
        <line
          key={axis.key}
          x1={layout.center.x}
          y1={layout.center.y}
          x2={axis.end.x}
          y2={axis.end.y}
          className="stroke-white/15"
          strokeWidth={1}
        />
      ))}

      <polygon
        points={toPoints(layout.thresholdRing)}
        className="fill-none stroke-purple-300/70"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text
        x={thresholdLabel.x + 6}
        y={thresholdLabel.y - 4}
        className="fill-purple-300/70 text-[10px]"
        textAnchor="start"
      >
        threshold {threshold}
      </text>

      <polygon points={toPoints(layout.polygon)} className="fill-purple-500/30 stroke-purple-300" strokeWidth={2} />
      {layout.polygon.map((point, index) => (
        <circle key={COMPETENCIES[index]} cx={point.x} cy={point.y} r={3} className="fill-purple-200" />
      ))}

      {layout.axes.map((axis) => (
        <text
          key={axis.key}
          x={axis.label.x}
          y={axis.label.y}
          textAnchor={axis.anchor}
          dominantBaseline="middle"
          className={cn("text-xs font-medium", scores[axis.key] >= threshold ? "fill-emerald-300" : "fill-blue-100/60")}
        >
          {axis.key} {scores[axis.key]}
        </text>
      ))}
    </svg>
  );
}
