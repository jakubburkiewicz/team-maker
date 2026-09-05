import { describe, expect, it } from "vitest";

import { radarLayout, radarScaleMax, type RadarPoint } from "@/lib/radar-geometry";

/**
 * Dowód, że wielokąt jest wiernym rzutem wartości. Klucze są własne (litery), nie `COMPETENCIES` —
 * helper nie zna domeny i test też nie powinien.
 */

const SEVEN = ["a", "b", "c", "d", "e", "f", "g"] as const;
type Seven = (typeof SEVEN)[number];

const FOUR = ["n", "e", "s", "w"] as const;

function zeros<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function distance(a: RadarPoint, b: RadarPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleFrom(center: RadarPoint, point: RadarPoint): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

describe("radarScaleMax", () => {
  it("dla wartości nieprzekraczających 2 × próg zwraca 2 × próg (próg 2 → 4)", () => {
    expect(radarScaleMax([0, 0, 0], 2)).toBe(4);
    expect(radarScaleMax([2, 4, 1], 2)).toBe(4);
    expect(radarScaleMax([], 2)).toBe(4);
  });

  it("gdy jakaś wartość przekracza 2 × próg, zwraca tę wartość — skala rośnie zamiast obcinać", () => {
    expect(radarScaleMax([2, 5, 1], 2)).toBe(5);
    expect(radarScaleMax([9], 2)).toBe(9);
  });
});

describe("radarLayout — osie", () => {
  const layout = radarLayout(SEVEN, zeros(SEVEN), { size: 320, threshold: 2 });

  it("n kluczy daje n osi w kolejności kluczy", () => {
    expect(layout.axes.map((axis) => axis.key)).toEqual([...SEVEN]);
  });

  it("pierwsza oś kończy się dokładnie nad środkiem", () => {
    expect(layout.axes[0].end.x).toBeCloseTo(layout.center.x);
    expect(layout.axes[0].end.y).toBeCloseTo(layout.center.y - layout.radius);
  });

  it("każdy koniec osi jest w odległości radius od środka", () => {
    for (const axis of layout.axes) {
      expect(distance(layout.center, axis.end)).toBeCloseTo(layout.radius);
    }
  });

  it("kąt między kolejnymi osiami to 2π / n, zgodnie z ruchem wskazówek zegara", () => {
    const step = (2 * Math.PI) / SEVEN.length;
    for (let index = 1; index < layout.axes.length; index += 1) {
      const previous = angleFrom(layout.center, layout.axes[index - 1].end);
      const current = angleFrom(layout.center, layout.axes[index].end);
      const delta = (current - previous + 2 * Math.PI) % (2 * Math.PI);
      expect(delta).toBeCloseTo(step);
    }
  });

  it("radius = size / 2 − labelMargin, center w połowie size", () => {
    expect(layout.center).toEqual({ x: 160, y: 160 });
    expect(layout.radius).toBe(160 - 56);
    expect(radarLayout(FOUR, zeros(FOUR), { size: 200, threshold: 1, labelMargin: 20 }).radius).toBe(80);
  });
});

describe("radarLayout — wartości", () => {
  it("wartość 0 daje wierzchołek w środku, wartość max — na końcu osi", () => {
    const values: Record<Seven, number> = { ...zeros(SEVEN), b: 4 };
    const layout = radarLayout(SEVEN, values, { size: 320, threshold: 2 });

    expect(layout.max).toBe(4);
    expect(distance(layout.center, layout.polygon[0])).toBeCloseTo(0);
    expect(layout.polygon[1].x).toBeCloseTo(layout.axes[1].end.x);
    expect(layout.polygon[1].y).toBeCloseTo(layout.axes[1].end.y);
  });

  it("wartość równa progowi leży na pierścieniu progu — w połowie promienia przy domyślnej skali", () => {
    const values: Record<Seven, number> = { ...zeros(SEVEN), c: 2 };
    const layout = radarLayout(SEVEN, values, { size: 320, threshold: 2 });

    expect(layout.polygon[2].x).toBeCloseTo(layout.thresholdRing[2].x);
    expect(layout.polygon[2].y).toBeCloseTo(layout.thresholdRing[2].y);
    expect(distance(layout.center, layout.thresholdRing[2])).toBeCloseTo(layout.radius / 2);
  });

  it("punkt wartości v leży w odległości radius × v / max od środka", () => {
    const values: Record<Seven, number> = { ...zeros(SEVEN), a: 1, d: 3 };
    const layout = radarLayout(SEVEN, values, { size: 320, threshold: 2 });

    expect(distance(layout.center, layout.polygon[0])).toBeCloseTo((layout.radius * 1) / 4);
    expect(distance(layout.center, layout.polygon[3])).toBeCloseTo((layout.radius * 3) / 4);
  });

  it("wartość powyżej 2 × progu rozciąga skalę: wielokąt sięga końca osi, pierścień progu się cofa", () => {
    const values: Record<Seven, number> = { ...zeros(SEVEN), e: 5 };
    const layout = radarLayout(SEVEN, values, { size: 320, threshold: 2 });

    expect(layout.max).toBe(5);
    expect(distance(layout.center, layout.polygon[4])).toBeCloseTo(layout.radius);
    expect(distance(layout.center, layout.thresholdRing[4])).toBeCloseTo((layout.radius * 2) / 5);
    for (const point of layout.polygon) {
      expect(distance(layout.center, point)).toBeLessThanOrEqual(layout.radius + 1e-9);
    }
  });

  it("polygon i thresholdRing mają po jednym punkcie na klucz w kolejności kluczy", () => {
    const values: Record<Seven, number> = { a: 1, b: 2, c: 3, d: 4, e: 0, f: 2, g: 1 };
    const layout = radarLayout(SEVEN, values, { size: 320, threshold: 2 });

    expect(layout.polygon).toHaveLength(SEVEN.length);
    expect(layout.thresholdRing).toHaveLength(SEVEN.length);
    SEVEN.forEach((key, index) => {
      expect(distance(layout.center, layout.polygon[index])).toBeCloseTo((layout.radius * values[key]) / 4);
    });
  });

  it("wejściowe values nie są mutowane", () => {
    const values: Record<Seven, number> = { a: 1, b: 2, c: 3, d: 4, e: 0, f: 2, g: 1 };
    const snapshot = { ...values };

    radarLayout(SEVEN, values, { size: 320, threshold: 2 });

    expect(values).toEqual(snapshot);
  });

  it("próg 0 i same zera nie dzielą przez zero — wszystko w środku", () => {
    const layout = radarLayout(FOUR, zeros(FOUR), { size: 200, threshold: 0 });

    expect(layout.max).toBe(0);
    for (const point of [...layout.polygon, ...layout.thresholdRing]) {
      expect(distance(layout.center, point)).toBeCloseTo(0);
    }
  });
});

describe("radarLayout — etykiety", () => {
  it("każda etykieta leży w [0, size] na obu osiach dla n = 7 i domyślnych marginesów", () => {
    const layout = radarLayout(SEVEN, zeros(SEVEN), { size: 320, threshold: 2 });

    for (const axis of layout.axes) {
      expect(axis.label.x).toBeGreaterThanOrEqual(0);
      expect(axis.label.x).toBeLessThanOrEqual(320);
      expect(axis.label.y).toBeGreaterThanOrEqual(0);
      expect(axis.label.y).toBeLessThanOrEqual(320);
    }
  });

  it("etykieta leży labelOffset za końcem osi, na jej przedłużeniu", () => {
    const layout = radarLayout(SEVEN, zeros(SEVEN), { size: 320, threshold: 2, labelOffset: 12 });

    for (const axis of layout.axes) {
      expect(distance(layout.center, axis.label)).toBeCloseTo(layout.radius + 12);
      expect(angleFrom(layout.center, axis.label)).toBeCloseTo(angleFrom(layout.center, axis.end));
    }
  });

  it("kotwica: góra middle, prawo start, dół middle, lewo end (n = 4)", () => {
    const layout = radarLayout(FOUR, zeros(FOUR), { size: 200, threshold: 1 });

    expect(layout.axes.map((axis) => axis.anchor)).toEqual(["middle", "start", "middle", "end"]);
  });

  it("dla n = 7 oś w górę ma middle, osie po prawej start, po lewej end", () => {
    const layout = radarLayout(SEVEN, zeros(SEVEN), { size: 320, threshold: 2 });

    for (const axis of layout.axes) {
      const dx = axis.end.x - layout.center.x;
      if (Math.abs(dx) < 1e-9) {
        expect(axis.anchor).toBe("middle");
      } else {
        expect(axis.anchor).toBe(dx > 0 ? "start" : "end");
      }
    }
    expect(layout.axes.map((axis) => axis.anchor)).toEqual(["middle", "start", "start", "start", "end", "end", "end"]);
  });
});
