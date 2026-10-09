import { createLoop } from './loop';
import { bindPointers, type PointerHandlers } from './input';
import { createStage, type Stage } from './stage';
import type { GameContext, GameInstance } from './types';

export interface CanvasGameSpec {
  update?(dt: number, t: number): void;
  render(g: CanvasRenderingContext2D, s: Stage): void;
  pointer?: PointerHandlers;
  key?(e: KeyboardEvent): void;
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
    spec.key?.(e);
  };
  if (spec.key) window.addEventListener('keydown', onKey);
  const loop = createLoop((dt, t) => {
    spec.update?.(dt, t);
    spec.render(stage.g, stage);
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    destroy() {
      loop.stop();
      unbind();
      window.removeEventListener('keydown', onKey);
      spec.destroy?.();
      stage.destroy();
    },
  };
}
