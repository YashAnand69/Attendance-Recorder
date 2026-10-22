// A similarity score is not a probability. Reject malformed templates and close ties.
export const MATCH_THRESHOLD = 0.55;
export const MATCH_MARGIN = 0.05;
export function descriptorDistance(first: Float32Array, second: Float32Array): number {
  if (first.length !== 128 || second.length !== 128) return Infinity;
  let sum = 0;
  for (let i = 0; i < first.length; i++) {
    if (!Number.isFinite(first[i]) || !Number.isFinite(second[i])) return Infinity;
    sum += (first[i] - second[i]) ** 2;
  }
  return Math.sqrt(sum);
}
export function chooseFaceMatch<T>(candidates: { student: T; distance: number }[]) {
  let best: { student: T; distance: number } | undefined;
  let runnerUp = Infinity;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.distance) || candidate.distance < 0) continue;
    if (!best || candidate.distance < best.distance) {
      runnerUp = best?.distance ?? Infinity;
      best = candidate;
    } else if (candidate.distance < runnerUp) runnerUp = candidate.distance;
  }
  return best && best.distance <= MATCH_THRESHOLD && runnerUp - best.distance >= MATCH_MARGIN
    ? best : null;
}
