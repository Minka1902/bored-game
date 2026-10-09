import { describe, it, expect } from 'vitest';
import { initSnake, step, placeFood } from '../../src/games/snake/logic';

describe('snake logic', () => {
  it('starts heading right with a 3-cell body', () => {
    const s = initSnake(10, 10);
    expect(s.dir).toBe('right');
    expect(s.body.length).toBe(3);
    expect(s.dead).toBe(false);
  });

  it('moves forward one cell', () => {
    const s = initSnake(10, 10);
    const n = step(s, 'right');
    expect(n.body[0]).toEqual({ x: s.body[0].x + 1, y: s.body[0].y });
    expect(n.body.length).toBe(s.body.length);
  });

  it('cannot reverse into itself', () => {
    const s = initSnake(10, 10);
    expect(step(s, 'left').body[0]).toEqual({ x: s.body[0].x + 1, y: s.body[0].y });
  });

  it('turns', () => {
    const s = initSnake(10, 10);
    const n = step(s, 'up');
    expect(n.body[0]).toEqual({ x: s.body[0].x, y: s.body[0].y - 1 });
    expect(n.dir).toBe('up');
  });

  it('grows on food and clears it', () => {
    const s = initSnake(10, 10);
    s.food = { x: s.body[0].x + 1, y: s.body[0].y };
    const n = step(s, 'right');
    expect(n.body.length).toBe(s.body.length + 1);
    expect(n.ate).toBe(true);
    expect(n.food).toBeNull();
  });

  it('dies on the wall', () => {
    let s = initSnake(5, 5);
    for (let i = 0; i < 6; i++) s = step(s, 'right');
    expect(s.dead).toBe(true);
  });

  it('dies on itself', () => {
    let s = initSnake(10, 10);
    s.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }];
    s.dir = 'right';
    s = step(s, 'down');
    expect(s.dead).toBe(true);
  });

  it('may move into the cell the tail is leaving', () => {
    let s = initSnake(10, 10);
    s.body = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    s.dir = 'left';
    s = step(s, 'down');
    expect(s.dead).toBe(false);
  });

  it('food never spawns on the snake', () => {
    const s = initSnake(4, 4);
    for (let i = 0; i < 50; i++) {
      const f = placeFood(s, Math.random)!;
      expect(s.body.some((b) => b.x === f.x && b.y === f.y)).toBe(false);
    }
  });

  it('placeFood returns null on a full board', () => {
    const s = initSnake(2, 1);
    s.body = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    expect(placeFood(s, Math.random)).toBeNull();
  });
});
