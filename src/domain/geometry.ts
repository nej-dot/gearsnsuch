export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (v: Vec2, factor: number): Vec2 => ({
  x: v.x * factor,
  y: v.y * factor,
});

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const length = (v: Vec2): number => Math.hypot(v.x, v.y);

export const normalize = (v: Vec2): Vec2 => {
  const magnitude = length(v);

  if (magnitude < 1e-9) {
    return { x: 1, y: 0 };
  }

  return scale(v, 1 / magnitude);
};

export const perpendicular = (v: Vec2): Vec2 => ({ x: -v.y, y: v.x });

export const rotate = (v: Vec2, radians: number): Vec2 => {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    x: v.x * cosine - v.y * sine,
    y: v.x * sine + v.y * cosine,
  };
};

export const midpoint = (a: Vec2, b: Vec2): Vec2 => scale(add(a, b), 0.5);

export const angleOf = (v: Vec2): number => Math.atan2(v.y, v.x);

export const radiansToDegrees = (radians: number): number => radians * (180 / Math.PI);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const formatNumber = (value: number, digits = 2): string => value.toFixed(digits);

