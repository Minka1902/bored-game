export const nextSequence = (seq: number[], r: () => number): number[] => [...seq, Math.floor(r() * 4)];

export function checkInput(seq: number[], inputs: number[]): 'ok' | 'wrong' | 'complete' {
  if (inputs.length > seq.length) return 'wrong';
  for (let i = 0; i < inputs.length; i++) if (inputs[i] !== seq[i]) return 'wrong';
  return inputs.length === seq.length ? 'complete' : 'ok';
}
