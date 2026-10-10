/** Screen shake: add() trauma, apply() offsets the canvas before drawing. */
export class Shake {
  private t = 0;

  add(amount: number): void {
    this.t = Math.min(1, this.t + amount);
  }

  update(dt: number): void {
    this.t = Math.max(0, this.t - dt * 2.2);
  }

  apply(g: CanvasRenderingContext2D, max = 14): void {
    if (this.t <= 0) return;
    const m = max * this.t * this.t;
    g.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
  }
}
