/**
 * Geometria wykresu pajęczynowego — cała matematyka w czystym module, testowalnym bez jsdom.
 *
 * Moduł nie zna domeny: klucze osi i wartości są parametrami, więc mieszka w `src/lib/` obok
 * `utils.ts`, nie w `src/lib/domain/`. Komponent SVG (`CompetencyRadar`) jest tylko rzutem
 * policzonych tu punktów i nie liczy nic sam — dzięki temu Guardrail PRD „wykres zawsze zgodny
 * ze składem" ma dowód w `radar-geometry.test.ts`, a nie w oglądaniu ekranu.
 */

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarAxis<K extends string> {
  key: K;
  /** Koniec osi — punkt wartości `max`. */
  end: RadarPoint;
  /** Zakotwiczenie etykiety: `labelOffset` za końcem osi, na jej przedłużeniu. */
  label: RadarPoint;
  /** `text-anchor` etykiety: `middle` dla osi pionowych (|cos| < ε), `start` po prawej, `end` po lewej. */
  anchor: "start" | "middle" | "end";
}

export interface RadarLayout<K extends string> {
  size: number;
  center: RadarPoint;
  radius: number;
  /** Wartość na końcu osi: max(2 × threshold, najwyższa wartość) — nigdy nie obcina. */
  max: number;
  axes: readonly RadarAxis<K>[];
  thresholdRing: readonly RadarPoint[];
  polygon: readonly RadarPoint[];
}

export interface RadarLayoutOptions {
  size: number;
  threshold: number;
  /** Margines na etykiety między końcem osi a krawędzią `viewBox`; musi pomieścić najdłuższą etykietę. */
  labelMargin?: number;
  /** Odstęp etykiety od końca osi, na jej przedłużeniu. */
  labelOffset?: number;
}

const DEFAULT_LABEL_MARGIN = 56;
const DEFAULT_LABEL_OFFSET = 12;

/** Poniżej tej wartości |cos| oś jest traktowana jako pionowa (błąd zaokrąglenia `Math.cos(-π/2)`). */
const VERTICAL_EPSILON = 1e-9;

/**
 * Wartość na końcu osi. Domyślnie 2 × próg, żeby pierścień progu leżał w połowie promienia;
 * gdy jakaś wartość przekracza, skala rośnie zamiast ucinać wielokąt.
 */
export function radarScaleMax(values: readonly number[], threshold: number): number {
  return Math.max(2 * threshold, ...values);
}

/** Pierwsza oś wskazuje w górę (−90°), kolejne zgodnie z ruchem wskazówek zegara, równo co 360°/n. */
export function radarLayout<K extends string>(
  keys: readonly K[],
  values: Readonly<Record<K, number>>,
  options: RadarLayoutOptions,
): RadarLayout<K> {
  const { size, threshold, labelMargin = DEFAULT_LABEL_MARGIN, labelOffset = DEFAULT_LABEL_OFFSET } = options;
  const center: RadarPoint = { x: size / 2, y: size / 2 };
  const radius = size / 2 - labelMargin;
  const max = radarScaleMax(
    keys.map((key) => values[key]),
    threshold,
  );

  const directions = keys.map((_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / keys.length;
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  const pointAt = (index: number, distance: number): RadarPoint => ({
    x: center.x + directions[index].cos * distance,
    y: center.y + directions[index].sin * distance,
  });

  // Przy `max === 0` (próg 0 i same zera) każdy punkt leży w środku — bez dzielenia przez zero.
  const distanceFor = (value: number): number => (max > 0 ? (radius * value) / max : 0);

  const axes = keys.map((key, index): RadarAxis<K> => {
    const { cos } = directions[index];
    let anchor: RadarAxis<K>["anchor"] = "middle";
    if (Math.abs(cos) >= VERTICAL_EPSILON) {
      anchor = cos > 0 ? "start" : "end";
    }

    return { key, end: pointAt(index, radius), label: pointAt(index, radius + labelOffset), anchor };
  });

  return {
    size,
    center,
    radius,
    max,
    axes,
    thresholdRing: keys.map((_, index) => pointAt(index, distanceFor(threshold))),
    polygon: keys.map((key, index) => pointAt(index, distanceFor(values[key]))),
  };
}
