import { pick, rint } from '../../core/rand';

export interface Eq {
  text: string;
  truth: boolean;
}

/** A random equation that is right or wrong with equal odds; numbers grow with level. */
export function makeEquation(level: number): Eq {
  const max = 6 + level * 2;
  const op = level < 3 ? pick(['+', '−']) : pick(['+', '−', '×']);
  let a = rint(1, max);
  let b = rint(1, op === '×' ? Math.min(12, 3 + level) : max);
  if (op === '−' && b > a) [a, b] = [b, a];
  const real = op === '+' ? a + b : op === '−' ? a - b : a * b;
  const truth = Math.random() < 0.5;
  const shown = truth ? real : real + pick([-10, -2, -1, 1, 2, 10].filter((d) => real + d >= 0));
  return { text: `${a} ${op} ${b} = ${shown}`, truth };
}
