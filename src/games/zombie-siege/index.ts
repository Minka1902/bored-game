import { canvasGame } from '../../core/canvas-game';
import { text } from '../../core/draw';
import { Particles } from '../../core/fx/particles';
import { keyDir } from '../../core/input';
import { angleDiff, clamp, lerp, roundRect, TAU } from '../../core/math';
import { mulberry32 } from '../../core/rand';
import { createJoystick } from '../../core/ui/joystick';
import { showShop, type Shop, type ShopView } from '../../core/ui/shop';
import type { GameFactory } from '../../core/types';
import { buy, equip, hpScale, NEW_LOADOUT, perks, rank, UPGRADES, upgradePrice, wave, weapon, WEAPONS, zombieCount, ZOMBIES, type Loadout, type Perks, type Spawn, type Weapon, type ZombieKind } from './logic';

const PLAYER_R = 16;
const INTRO = 1.6;
const CLEAR = 1.4;
const HURT_BUZZ = 0.3;
const GROUND = '#26331f';
const LOOKS: Record<ZombieKind, { shirt: string; skin: string }> = {
  walker: { shirt: '#4f6d8a', skin: '#86b36b' },
  runner: { shirt: '#8a6d3b', skin: '#a3c46e' },
  brute: { shirt: '#4a3b5c', skin: '#5f8a48' },
};

interface Zombie {
  kind: ZombieKind;
  x: number;
  y: number;
  hp: number;
  max: number;
  r: number;
  speed: number;
  dmg: number;
  coins: number;
  hitT: number;
  step: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  left: number;
  pierce: number;
  splash: number;
  hit: Set<Zombie>;
}

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  v: number;
}

function drawZombie(g: CanvasRenderingContext2D, z: Zombie, ang: number) {
  const look = LOOKS[z.kind];
  const r = z.r;
  g.save();
  g.translate(z.x, z.y);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(2, 4, r, r * 0.8, 0, 0, TAU);
  g.fill();
  g.rotate(ang);
  const swing = Math.sin(z.step) * r * 0.15;
  g.fillStyle = look.skin;
  g.fillRect(r * 0.2, -r * 0.85 + swing, r * 1.1, r * 0.32);
  g.fillRect(r * 0.2, r * 0.53 - swing, r * 1.1, r * 0.32);
  g.fillStyle = z.hitT > 0 ? '#ffffff' : look.shirt;
  g.beginPath();
  g.ellipse(0, 0, r * 0.75, r, 0, 0, TAU);
  g.fill();
  g.fillStyle = z.hitT > 0 ? '#ffffff' : look.skin;
  g.beginPath();
  g.arc(r * 0.15, 0, r * 0.55, 0, TAU);
  g.fill();
  g.fillStyle = '#ff2e2e';
  g.beginPath();
  g.arc(r * 0.45, -r * 0.2, r * 0.1, 0, TAU);
  g.arc(r * 0.45, r * 0.2, r * 0.1, 0, TAU);
  g.fill();
  g.restore();
  if (z.hp >= z.max) return;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(z.x - r, z.y - r - 9, r * 2, 4);
  g.fillStyle = '#ff4d6d';
  g.fillRect(z.x - r, z.y - r - 9, r * 2 * Math.max(0, z.hp / z.max), 4);
}

function drawHero(g: CanvasRenderingContext2D, x: number, y: number, aim: number, gun: Weapon, flash: number, hurt: number) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(2, 4, PLAYER_R, PLAYER_R * 0.8, 0, 0, TAU);
  g.fill();
  g.rotate(aim);
  const len = gun.id === 'rifle' || gun.id === 'rocket' ? 26 : gun.id === 'pistol' ? 16 : 21;
  g.fillStyle = '#2b2b33';
  g.fillRect(PLAYER_R * 0.3, -3, len, gun.id === 'rocket' || gun.id === 'minigun' ? 8 : 6);
  if (flash > 0) {
    g.fillStyle = '#ffe14d';
    g.beginPath();
    g.moveTo(PLAYER_R * 0.3 + len, -6);
    g.lineTo(PLAYER_R * 0.3 + len + 14, 0);
    g.lineTo(PLAYER_R * 0.3 + len, 6);
    g.fill();
  }
  g.fillStyle = '#f2c79d';
  g.beginPath();
  g.arc(PLAYER_R * 0.55, PLAYER_R * 0.55, 4, 0, TAU);
  g.fill();
  g.fillStyle = hurt > 0 ? '#ff4d6d' : '#3b82f6';
  g.beginPath();
  g.ellipse(0, 0, PLAYER_R * 0.7, PLAYER_R, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#5a3a22';
  g.beginPath();
  g.arc(0, 0, PLAYER_R * 0.55, 0, TAU);
  g.fill();
  g.restore();
}

const game: GameFactory = (ctx) =>
  canvasGame(ctx, (s) => {
    let level = ctx.store.get('level', 1);
    let loadout: Loadout = { ...NEW_LOADOUT, ...ctx.store.get<Partial<Loadout>>('loadout', {}) };
    let P: Perks = perks(loadout);
    let gun: Weapon = weapon(loadout.weapon);
    let px = 0;
    let py = 0;
    let hp = 0;
    let aim = 0;
    let hurt = 0;
    let buzzT = 0;
    let flash = 0;
    let cool = 0;
    let clock = 0;
    let modeT = 0;
    let mode: 'intro' | 'play' | 'clear' | 'shop' | 'dead' = 'intro';
    let spawns: Spawn[] = [];
    let zombies: Zombie[] = [];
    let bullets: Bullet[] = [];
    let coins: Coin[] = [];
    let shop: Shop | null = null;
    let shown = '';
    let decor: [number, number, number][] = [];
    const keys = new Set<string>();
    const stick = createJoystick({ radius: 52 });
    const fx = new Particles();
    fx.gravity = 0;
    fx.drag = 4;

    const save = () => ctx.store.set('loadout', loadout);

    const shopView = (): ShopView => ({
      title: `Level ${level - 1} cleared!`,
      subtitle: 'Gear up for the next horde',
      balance: loadout.coins,
      currency: '💰 ',
      cta: `Start level ${level} · ${zombieCount(level)} zombies`,
      sections: [
        {
          title: 'Weapons',
          items: WEAPONS.map((w) => ({
            id: w.id,
            label: w.name,
            icon: w.icon,
            desc: `${w.dmg}${w.pellets > 1 ? `×${w.pellets}` : ''} dmg · ${w.rate}/s${w.splash ? ' · explodes' : w.pierce ? ' · pierces' : ''}`,
            price: w.price,
            state: loadout.weapon === w.id ? 'equipped' : loadout.owned.includes(w.id) ? 'owned' : 'buy',
          })),
        },
        {
          title: 'Upgrades',
          items: UPGRADES.map((u) => {
            const r = rank(loadout, u.id);
            return { id: u.id, label: u.name, icon: u.icon, desc: u.desc, price: upgradePrice(u, r), rank: [r, u.max] as [number, number], state: r >= u.max ? 'max' : 'buy' };
          }),
        },
      ],
    });

    const startLevel = () => {
      P = perks(loadout);
      gun = weapon(loadout.weapon);
      px = s.w / 2;
      py = s.h / 2;
      hp = P.hp;
      hurt = 0;
      cool = 0;
      clock = 0;
      modeT = 0;
      spawns = wave(level, Math.random);
      zombies = [];
      bullets = [];
      coins = [];
      stick.reset();
      mode = 'intro';
      ctx.sfx.play('whoosh', 0.7);
    };

    const openShop = () => {
      mode = 'shop';
      stick.reset();
      shop = showShop(ctx.root, shopView(), {
        pick(id) {
          const next = loadout.owned.includes(id) ? equip(loadout, id) : buy(loadout, id);
          if (!next) {
            ctx.sfx.play('click', 0.6);
            return;
          }
          ctx.sfx.play(next.coins < loadout.coins ? 'score' : 'click');
          ctx.haptics.tap();
          loadout = next;
          save();
          shop?.update(shopView());
        },
        done() {
          shop?.close();
          shop = null;
          ctx.sfx.play('blip');
          startLevel();
        },
      });
    };

    const spawn = (kind: ZombieKind) => {
      const z = ZOMBIES[kind];
      const side = Math.floor(Math.random() * 4);
      const t = Math.random();
      const m = z.r + 20;
      const x = side === 0 ? -m : side === 1 ? s.w + m : t * s.w;
      const y = side === 2 ? -m : side === 3 ? s.h + m : t * s.h;
      const hpMax = z.hp * hpScale(level);
      zombies.push({ kind, x, y, hp: hpMax, max: hpMax, r: z.r, speed: z.speed * (1 + level * 0.02) * (0.85 + Math.random() * 0.3), dmg: z.dmg, coins: z.coins, hitT: 0, step: Math.random() * TAU });
    };

    const kill = (z: Zombie) => {
      fx.burst(z.x, z.y, 14, ['#7a0f1a', '#a3122a', '#4a6b3a'], { speed: 160, life: 0.6, size: 5 });
      ctx.sfx.play('pop', 0.55 + Math.random() * 0.2, 0.4);
      const drops = Math.min(3, z.coins);
      for (let k = 0; k < drops; k++) {
        const a = Math.random() * TAU;
        coins.push({ x: z.x, y: z.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, v: Math.ceil(z.coins / drops) });
      }
    };

    const hurtZombie = (z: Zombie, dmg: number) => {
      z.hp -= dmg;
      z.hitT = 0.08;
    };

    const explode = (x: number, y: number, r: number, dmg: number) => {
      fx.burst(x, y, 30, ['#ffe14d', '#ff7a45', '#ff4d6d', '#555555'], { speed: 260, life: 0.5, size: 6 });
      ctx.sfx.play('thud', 0.7);
      ctx.sfx.play('hit', 0.6, 0.6);
      ctx.haptics.bump();
      for (const z of zombies) {
        const d = Math.hypot(z.x - x, z.y - y);
        if (d < r + z.r) hurtZombie(z, dmg * (1 - (d / (r + z.r)) * 0.5));
      }
    };

    const fire = (target: Zombie) => {
      const want = Math.atan2(target.y - py, target.x - px);
      if (Math.abs(angleDiff(aim, want)) > 0.35) return;
      cool = 1 / (gun.rate * P.rate);
      flash = 0.05;
      for (let k = 0; k < gun.pellets; k++) {
        const a = aim + (Math.random() - 0.5) * gun.spread;
        bullets.push({ x: px + Math.cos(aim) * 24, y: py + Math.sin(aim) * 24, vx: Math.cos(a) * gun.speed, vy: Math.sin(a) * gun.speed, dmg: gun.dmg * P.dmg, left: gun.range, pierce: gun.pierce, splash: gun.splash, hit: new Set() });
      }
      if (gun.splash) ctx.sfx.play('whoosh', 0.8, 0.5);
      else ctx.sfx.play(gun.pellets > 1 ? 'thud' : 'snare', gun.rate > 8 ? 1.6 : 1.1, gun.rate > 8 ? 0.15 : 0.3);
    };

    const updatePlay = (dt: number) => {
      clock += dt;
      while (spawns.length && spawns[0].at <= clock) spawn(spawns.shift()!.kind);
      const kd = keys.size ? [(keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0), (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0)] : [0, 0];
      const kl = Math.hypot(kd[0], kd[1]) || 1;
      const mx = stick.active ? stick.x : kd[0] / kl;
      const my = stick.active ? stick.y : kd[1] / kl;
      px = clamp(px + mx * P.speed * dt, PLAYER_R, s.w - PLAYER_R);
      py = clamp(py + my * P.speed * dt, PLAYER_R, s.h - PLAYER_R);
      let target: Zombie | null = null;
      let best = gun.range;
      for (const z of zombies) {
        const d = Math.hypot(z.x - px, z.y - py) - z.r;
        if (d < best && z.x > -z.r && z.y > -z.r && z.x < s.w + z.r && z.y < s.h + z.r) {
          best = d;
          target = z;
        }
      }
      if (target) {
        const want = Math.atan2(target.y - py, target.x - px);
        aim += angleDiff(aim, want) * Math.min(1, dt * 18);
      } else if (mx || my) aim += angleDiff(aim, Math.atan2(my, mx)) * Math.min(1, dt * 10);
      cool -= dt;
      if (target && cool <= 0) fire(target);
      for (const z of zombies) {
        const a = Math.atan2(py - z.y, px - z.x);
        z.x += Math.cos(a) * z.speed * dt;
        z.y += Math.sin(a) * z.speed * dt;
        z.step += dt * z.speed * 0.15;
        z.hitT -= dt;
        if (Math.hypot(px - z.x, py - z.y) < z.r + PLAYER_R) {
          hp -= z.dmg * P.armor * dt;
          hurt = 0.15;
        }
      }
      for (let i = 0; i < zombies.length; i++) {
        for (let j = i + 1; j < zombies.length; j++) {
          const a = zombies[i];
          const b = zombies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const o = a.r + b.r - d;
          if (o <= 0) continue;
          a.x -= (dx / d) * o * 0.5;
          a.y -= (dy / d) * o * 0.5;
          b.x += (dx / d) * o * 0.5;
          b.y += (dy / d) * o * 0.5;
        }
      }
      bullets = bullets.filter((b) => {
        const step = Math.hypot(b.vx, b.vy) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.left -= step;
        for (const z of zombies) {
          if (b.hit.has(z) || Math.hypot(z.x - b.x, z.y - b.y) > z.r + 3) continue;
          if (b.splash) {
            explode(b.x, b.y, b.splash, b.dmg);
            return false;
          }
          hurtZombie(z, b.dmg);
          b.hit.add(z);
          fx.burst(b.x, b.y, 3, '#a3122a', { speed: 90, life: 0.25, size: 3 });
          if (b.pierce-- <= 0) return false;
        }
        if (b.left > 0) return true;
        if (b.splash) explode(b.x, b.y, b.splash, b.dmg);
        return false;
      });
      zombies = zombies.filter((z) => {
        if (z.hp > 0) return true;
        kill(z);
        return false;
      });
      hurt -= dt;
      buzzT -= dt;
      if (hurt > 0 && buzzT <= 0) {
        buzzT = HURT_BUZZ;
        ctx.haptics.buzz(20);
        ctx.sfx.play('hit', 0.5, 0.3);
      }
      if (hp <= 0) {
        mode = 'dead';
        stick.reset();
        save();
        ctx.sfx.play('fail');
        ctx.haptics.buzz(200);
        ctx.gameOver({ score: level - 1, text: `Overrun on level ${level}`, retry: startLevel });
      } else if (!spawns.length && !zombies.length) {
        mode = 'clear';
        modeT = 0;
        ctx.submitScore(level);
        ctx.sfx.play('win');
        ctx.haptics.bump();
      }
    };

    const updateCoins = (dt: number) => {
      const reach = mode === 'clear' ? Infinity : P.magnet;
      coins = coins.filter((c) => {
        const d = Math.hypot(px - c.x, py - c.y);
        if (d < reach) {
          const k = Math.max(260, 900 - d * 2);
          c.vx = ((px - c.x) / d) * k;
          c.vy = ((py - c.y) / d) * k;
        } else {
          c.vx *= Math.exp(-4 * dt);
          c.vy *= Math.exp(-4 * dt);
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (d > PLAYER_R + 4) return true;
        loadout.coins += c.v;
        ctx.sfx.play('blip', 1.8, 0.2);
        return false;
      });
    };

    const updateHud = () => {
      const left = spawns.length + zombies.length;
      const line = `${level}|${left}|${loadout.coins}`;
      if (line === shown) return;
      shown = line;
      ctx.hud.set(`Level ${level}`);
      ctx.hud.sub(`🧟 ${left}  ·  💰 ${loadout.coins}`);
    };

    const layoutDecor = () => {
      const r = mulberry32(11);
      decor = Array.from({ length: Math.round((s.w * s.h) / 9000) }, () => [r() * s.w, r() * s.h, r()]);
    };

    layoutDecor();
    if (level > 1) openShop();
    else startLevel();
    ctx.hint('Drag to move · your gun aims and fires by itself');

    return {
      pointer: {
        down(p) {
          if (mode === 'play' || mode === 'intro') stick.down(p);
        },
        move: stick.move,
        up: stick.up,
      },
      key(e) {
        const d = keyDir(e);
        if (!d) return;
        e.preventDefault();
        keys.add(d);
      },
      keyUp(e) {
        const d = keyDir(e);
        if (d) keys.delete(d);
      },
      resize() {
        layoutDecor();
        px = clamp(px, PLAYER_R, s.w - PLAYER_R);
        py = clamp(py, PLAYER_R, s.h - PLAYER_R);
      },
      update(dt) {
        fx.update(dt);
        flash -= dt;
        modeT += dt;
        if (mode === 'intro' && modeT > INTRO) mode = 'play';
        if (mode === 'intro' || mode === 'play') updatePlay(dt);
        if (mode !== 'shop') updateCoins(dt);
        if (mode === 'clear' && modeT > CLEAR && !coins.length) {
          level++;
          ctx.store.set('level', level);
          save();
          openShop();
        }
        updateHud();
      },
      render(g) {
        g.fillStyle = GROUND;
        g.fillRect(0, 0, s.w, s.h);
        for (const [x, y, k] of decor) {
          if (k < 0.12) {
            g.fillStyle = '#5c6470';
            g.beginPath();
            roundRect(g, x - 9, y - 12, 18, 22, 8);
            g.fill();
            g.fillStyle = '#3f454f';
            g.fillRect(x - 6, y - 3, 12, 2);
            g.fillRect(x - 1, y - 8, 2, 12);
          } else {
            g.strokeStyle = k < 0.6 ? '#33452a' : '#1d2818';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x - 4, y + 3);
            g.lineTo(x - 2, y - 3);
            g.moveTo(x, y + 3);
            g.lineTo(x + 1, y - 5);
            g.moveTo(x + 4, y + 3);
            g.lineTo(x + 5, y - 2);
            g.stroke();
          }
        }
        for (const c of coins) {
          g.fillStyle = '#b98a00';
          g.beginPath();
          g.arc(c.x, c.y + 1.5, 6, 0, TAU);
          g.fill();
          g.fillStyle = '#ffd23f';
          g.beginPath();
          g.arc(c.x, c.y, 6, 0, TAU);
          g.fill();
          g.fillStyle = '#fff3a0';
          g.fillRect(c.x - 1.5, c.y - 3.5, 3, 7);
        }
        for (const z of zombies) drawZombie(g, z, Math.atan2(py - z.y, px - z.x));
        g.lineCap = 'round';
        for (const b of bullets) {
          const sp = Math.hypot(b.vx, b.vy);
          g.strokeStyle = b.splash ? '#ff7a45' : '#ffe14d';
          g.lineWidth = b.splash ? 6 : 3;
          g.beginPath();
          g.moveTo(b.x, b.y);
          g.lineTo(b.x - (b.vx / sp) * (b.splash ? 16 : 10), b.y - (b.vy / sp) * (b.splash ? 16 : 10));
          g.stroke();
        }
        if (mode !== 'shop') drawHero(g, px, py, aim, gun, flash, hurt);
        fx.draw(g);
        if (mode !== 'shop') {
          const w = Math.min(220, s.w - 40);
          const x = (s.w - w) / 2;
          const y = s.h - 26;
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.beginPath();
          roundRect(g, x - 3, y - 3, w + 6, 16, 8);
          g.fill();
          g.fillStyle = hp / P.hp > 0.3 ? '#34d399' : '#ff4d6d';
          g.beginPath();
          roundRect(g, x, y, w * clamp(hp / P.hp, 0, 1), 10, 5);
          g.fill();
          text(g, `${Math.max(0, Math.ceil(hp))} / ${P.hp}`, s.w / 2, y - 12, 12, '#ffffff');
        }
        stick.draw(g);
        if (mode === 'intro') {
          const a = clamp(Math.min(modeT * 3, (INTRO - modeT) * 3), 0, 1);
          g.globalAlpha = a;
          text(g, `Level ${level}`, s.w / 2, s.h * 0.4, 44, '#ff4d6d');
          text(g, `${spawns.length + zombies.length} zombies incoming`, s.w / 2, s.h * 0.4 + 40, 18, '#ffffff');
          g.globalAlpha = 1;
        }
        if (mode === 'clear') text(g, 'Wave cleared!', s.w / 2, s.h * 0.4, 38, '#ffd23f');
        if (hurt > 0) {
          g.fillStyle = `rgba(255,0,40,${lerp(0, 0.18, hurt / 0.15)})`;
          g.fillRect(0, 0, s.w, s.h);
        }
      },
      destroy() {
        shop?.close();
      },
    };
  });

export default game;
