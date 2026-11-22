export function random(min, max) {
  return min + Math.random() * (max - min);
}

// Angle difference (a rectangle looks identical after rotating 180°, so modulo PI)
export function angleDifference(a, b) {
  let diff = Math.abs(a - b) % Math.PI;
  return Math.min(diff, Math.PI - diff);
}