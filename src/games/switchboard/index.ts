// A desk of tactile controls built from DOM elements: toggles, keycaps, sliders, a dial, a click-pen and a big red button.
import type { GameFactory } from '../../core/types';

const CSS = `
.sb{position:absolute;inset:0;overflow:auto;padding:86px 14px 24px;background:#1d1238;touch-action:none}
.sb-panel{width:min(440px,100%);margin:0 auto;display:grid;gap:12px}
.sb-card{background:#2a1b4f;border-radius:22px;padding:14px;box-shadow:0 4px 0 #120a24}
.sb-toggles{display:flex;justify-content:space-between;gap:8px}
.tog{position:relative;width:62px;height:34px;border:0;border-radius:17px;background:#120a24;transition:background .12s}
.tog::after{content:'';position:absolute;left:4px;top:4px;width:26px;height:26px;border-radius:50%;background:#fff6e9;box-shadow:0 2px 0 rgba(0,0,0,.3);transition:transform .14s cubic-bezier(.3,1.5,.6,1)}
.tog[aria-pressed=true]{background:var(--on)}
.tog[aria-pressed=true]::after{transform:translateX(28px)}
.sb-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.key{aspect-ratio:1.25;border:0;border-radius:14px;background:var(--k);color:#241544;font-weight:900;font-size:1.3rem;box-shadow:0 7px 0 var(--kd),inset 0 -3px 0 rgba(0,0,0,.12);transform:translateY(0);transition:transform 40ms,box-shadow 40ms}
.key.down{transform:translateY(6px);box-shadow:0 1px 0 var(--kd),inset 0 -2px 0 rgba(0,0,0,.12)}
.sl{position:relative;height:40px;margin:4px 6px;touch-action:none}
.sl::before{content:'';position:absolute;left:0;right:0;top:17px;height:6px;border-radius:3px;background:#120a24}
.sl-fill{position:absolute;left:0;top:17px;height:6px;border-radius:3px;background:var(--on)}
.sl-thumb{position:absolute;top:4px;width:32px;height:32px;margin-left:-16px;border-radius:10px;background:#fff6e9;box-shadow:0 3px 0 rgba(0,0,0,.35)}
.sb-bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:center;justify-items:center}
.dial{position:relative;width:86px;height:86px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#4c3a80,#241544);box-shadow:0 5px 0 #120a24;touch-action:none}
.dial::after{content:'';position:absolute;left:50%;top:8px;width:6px;height:20px;margin-left:-3px;border-radius:3px;background:#ffd23f}
.pen{position:relative;width:34px;height:110px;border:0;background:none;padding:0}
.pen-plunger{position:absolute;left:9px;top:0;width:16px;height:30px;border-radius:6px 6px 3px 3px;background:#fff6e9;transition:transform 50ms}
.pen-body{position:absolute;left:3px;top:22px;width:28px;height:86px;border-radius:10px 10px 14px 14px;background:#22d3ee;box-shadow:inset -6px 0 0 rgba(0,0,0,.15)}
.pen.on .pen-plunger{transform:translateY(12px)}
.big{width:92px;height:92px;border:0;border-radius:50%;background:#9f1239;padding:0 0 9px}
.big span{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8fa3,#ff4d6d 45%,#e11d48);transform:translateY(-9px);transition:transform 50ms}
.big.down span{transform:translateY(-1px)}
.sb-light{width:18px;height:18px;border-radius:50%;background:#3a2868;margin:0 auto 6px;transition:background .2s,box-shadow .2s}
.sb-light.on{background:#ffd23f;box-shadow:0 0 18px #ffd23f}
`;

const KEYS = [
  ['Q', '#fff6e9', '#c4b5fd'], ['W', '#fff6e9', '#c4b5fd'], ['E', '#fff6e9', '#c4b5fd'],
  ['😐', '#ffe14d', '#b98a00'], ['💤', '#7dd3fc', '#2b7bb0'], ['↵', '#ff7a45', '#b4461c'],
];
const TOGGLE_COLORS = ['#34d399', '#ffd23f', '#f472b6', '#22d3ee'];

const game: GameFactory = (ctx) => {
  const style = document.createElement('style');
  style.textContent = CSS;
  const wrap = document.createElement('div');
  wrap.className = 'sb';
  wrap.innerHTML = `<div class="sb-panel">
    <div class="sb-card sb-toggles">${TOGGLE_COLORS.map((c) => `<button class="tog" style="--on:${c}" aria-pressed="false" aria-label="Toggle"></button>`).join('')}</div>
    <div class="sb-card sb-keys">${KEYS.map(([k, c, d]) => `<button class="key" style="--k:${c};--kd:${d}">${k}</button>`).join('')}</div>
    <div class="sb-card">
      <div class="sl" data-v="0.3" style="--on:#a855f7"><div class="sl-fill"></div><div class="sl-thumb"></div></div>
      <div class="sl" data-v="0.7" style="--on:#ff7a45"><div class="sl-fill"></div><div class="sl-thumb"></div></div>
    </div>
    <div class="sb-card sb-bottom">
      <div class="dial" aria-label="Dial"></div>
      <button class="pen" aria-label="Click pen"><span class="pen-plunger"></span><span class="pen-body"></span></button>
      <div><div class="sb-light"></div><button class="big" aria-label="Big red button"><span></span></button></div>
    </div>
  </div>`;
  ctx.root.append(style, wrap);

  let clicks = ctx.store.get('clicks', 0);
  const count = () => {
    clicks++;
    ctx.hud.set(clicks.toLocaleString('en-US'));
    if (clicks % 10 === 0) ctx.store.set('clicks', clicks);
  };
  ctx.hud.set(clicks.toLocaleString('en-US'));
  ctx.hud.sub('clicks');
  ctx.hint('Flip, press, slide, twist');

  const paintSlider = (sl: HTMLElement) => {
    const v = Number(sl.dataset.v);
    sl.querySelector<HTMLElement>('.sl-fill')!.style.width = `${v * 100}%`;
    sl.querySelector<HTMLElement>('.sl-thumb')!.style.left = `${v * 100}%`;
  };
  wrap.querySelectorAll<HTMLElement>('.sl').forEach(paintSlider);

  const light = wrap.querySelector<HTMLElement>('.sb-light')!;
  const dial = wrap.querySelector<HTMLElement>('.dial')!;
  let dialAngle = 0;
  let drag: { kind: 'slider' | 'dial'; el: HTMLElement; last: number; id: number } | null = null;
  let lightTimer = 0;

  const onDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    const tog = t.closest<HTMLElement>('.tog');
    const key = t.closest<HTMLElement>('.key');
    const pen = t.closest<HTMLElement>('.pen');
    const big = t.closest<HTMLElement>('.big');
    const sl = t.closest<HTMLElement>('.sl');
    const dl = t.closest<HTMLElement>('.dial');
    if (tog) {
      const on = tog.getAttribute('aria-pressed') !== 'true';
      tog.setAttribute('aria-pressed', String(on));
      ctx.sfx.play('click', on ? 1.1 : 0.85);
      ctx.haptics.tap();
      count();
    } else if (key) {
      key.classList.add('down');
      ctx.sfx.play('click', 0.7 + Math.random() * 0.15);
      ctx.sfx.play('thud', 2.2, 0.25);
      ctx.haptics.tap();
      count();
    } else if (pen) {
      const on = pen.classList.toggle('on');
      ctx.sfx.play('click', on ? 1.35 : 1.15);
      ctx.haptics.tap();
      count();
    } else if (big) {
      big.classList.add('down');
      light.classList.add('on');
      ctx.sfx.play('thud', 0.8);
      ctx.sfx.play('blip', 0.5, 0.6);
      ctx.haptics.bump();
      clearTimeout(lightTimer);
      lightTimer = window.setTimeout(() => light.classList.remove('on'), 500);
      count();
    } else if (sl || dl) {
      const el = (sl ?? dl)!;
      drag = { kind: sl ? 'slider' : 'dial', el, last: sl ? Number(sl.dataset.v) : dialAngle, id: e.pointerId };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // synthetic events cannot be captured
      }
      onMove(e);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = drag.el.getBoundingClientRect();
    if (drag.kind === 'slider') {
      const v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const before = Math.round(Number(drag.el.dataset.v) * 10);
      drag.el.dataset.v = String(v);
      paintSlider(drag.el);
      if (Math.round(v * 10) !== before) {
        ctx.sfx.play('tick', 0.7 + v * 0.8);
        ctx.haptics.tap();
        count();
      }
    } else {
      const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      if (e.type === 'pointerdown') drag.last = a;
      let d = a - drag.last;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      const before = Math.floor(dialAngle / 15);
      dialAngle += d;
      drag.last = a;
      dial.style.transform = `rotate(${dialAngle}deg)`;
      if (Math.floor(dialAngle / 15) !== before) {
        ctx.sfx.play('tick', 1 + ((dialAngle % 360) + 360) / 720);
        ctx.haptics.tap();
        count();
      }
    }
  };

  const onUp = (e: PointerEvent) => {
    wrap.querySelectorAll('.key.down, .big.down').forEach((k) => k.classList.remove('down'));
    if ((e.target as HTMLElement).closest('.key')) ctx.sfx.play('tick', 0.9, 0.6);
    if (drag && e.pointerId === drag.id) drag = null;
  };

  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', onUp);

  return {
    pause() {},
    resume() {},
    destroy() {
      clearTimeout(lightTimer);
      ctx.store.set('clicks', clicks);
      wrap.remove();
      style.remove();
    },
  };
};

export default game;
