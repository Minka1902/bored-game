import { createLoop } from './loop';
import { bindPointers, type PointerHandlers } from './input';
import { createStage, type Stage } from './stage';
import type { GameContext, GameInstance } from './types';

export interface CanvasGameSpec {
  update?(dt: number, t: number): void;
  render(g: CanvasRenderingContext2D, s: Stage): void;
  pointer?: PointerHandlers;
  key?(e: KeyboardEvent): void;
  keyUp?(e: KeyboardEvent): void;
  resize?(s: Stage): void;
  destroy?(): void;
}

/**
 * Wires a stage, a frame loop, pointers and keys to a game spec, and maps the
 * GameInstance lifecycle onto them so every game cleans up the same way.
 */
export function canvasGame(
  ctx: GameContext,
  make: (s: Stage) => CanvasGameSpec,
  opts: { maxDpr?: number; alpha?: boolean } = {},
): GameInstance {
  const stage = createStage(ctx.root, opts);
  const spec = make(stage);
  stage.onResize((s) => spec.resize?.(s));
  const unbind = spec.pointer ? bindPointers(stage.canvas, spec.pointer) : () => {};
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    // keys aimed at a focused control (game-over buttons, settings switches) are not game input
    if ((e.target as Element | null)?.closest?.('button, input, a, select, textarea')) return;
    spec.key?.(e);
  };
  const onKeyUp = (e: KeyboardEvent) => spec.keyUp?.(e);
  if (spec.key) window.addEventListener('keydown', onKey);
  if (spec.keyUp) window.addEventListener('keyup', onKeyUp);
  const loop = createLoop((dt, t) => {
    spec.update?.(dt, t);
    spec.render(stage.g, stage);
  });
  loop.start();
  let destroyed = false;

  return {
    pause: () => loop.stop(),
    resume: () => {
      if (!destroyed) loop.start();
    },
    destroy() {
      destroyed = true;
      loop.stop();
      unbind();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      spec.destroy?.();
      stage.destroy();
    },
  };
}
