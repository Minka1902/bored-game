import { esc } from './html';

export type ShopState = 'buy' | 'owned' | 'equipped' | 'max';

export interface ShopItem {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
  /** shown and checked against the balance while state is 'buy' */
  price?: number;
  state: ShopState;
  /** filled pips under the label, e.g. upgrade ranks */
  rank?: [number, number];
}

export interface ShopSection {
  title: string;
  items: ShopItem[];
}

export interface ShopView {
  title: string;
  subtitle?: string;
  balance: number;
  currency?: string;
  sections: ShopSection[];
  cta: string;
}

export interface Shop {
  update(v: ShopView): void;
  close(): void;
}

const pips = ([n, max]: [number, number]) => `<span class="shop-pips">${'●'.repeat(n)}${'○'.repeat(Math.max(0, max - n))}</span>`;

function action(it: ShopItem, v: ShopView): string {
  const cur = v.currency ?? '';
  if (it.state === 'buy') return `<button class="btn shop-act" data-id="${esc(it.id)}" ${(it.price ?? 0) > v.balance ? 'disabled' : ''}>${cur}${it.price ?? 0}</button>`;
  if (it.state === 'owned') return `<button class="btn shop-act" data-id="${esc(it.id)}">Use</button>`;
  return `<span class="shop-tag">${it.state === 'equipped' ? '✓ In use' : 'MAX'}</span>`;
}

const row = (it: ShopItem, v: ShopView) => `
  <div class="shop-item${it.state === 'equipped' ? ' is-on' : ''}">
    <span class="shop-icon" aria-hidden="true">${it.icon ?? ''}</span>
    <span class="shop-text"><b>${esc(it.label)}</b>${it.rank ? pips(it.rank) : ''}${it.desc ? `<small>${esc(it.desc)}</small>` : ''}</span>
    ${action(it, v)}
  </div>`;

/** Full-stage store card: sections of items with buy / use buttons and one call-to-action. Re-render it with update(). */
export function showShop(root: HTMLElement, view: ShopView, on: { pick(id: string): void; done(): void }): Shop {
  const wrap = document.createElement('div');
  wrap.className = 'gameover in armed shop';
  const card = document.createElement('div');
  card.className = 'go-card shop-card';
  card.setAttribute('role', 'dialog');
  wrap.appendChild(card);

  const render = (v: ShopView) => {
    const top = card.querySelector('.shop-list')?.scrollTop ?? 0;
    const was = (document.activeElement as HTMLElement | null)?.dataset.id;
    card.setAttribute('aria-label', v.title);
    card.innerHTML = `
      <div class="go-title">${esc(v.title)}</div>
      ${v.subtitle ? `<div class="shop-sub">${esc(v.subtitle)}</div>` : ''}
      <div class="shop-balance">${esc(v.currency ?? '')}${v.balance}</div>
      <div class="shop-list">${v.sections.map((s) => `<h3>${esc(s.title)}</h3>${s.items.map((it) => row(it, v)).join('')}`).join('')}</div>
      <button class="btn btn-primary shop-cta" data-act="done">${esc(v.cta)}</button>`;
    card.querySelector('.shop-list')!.scrollTop = top;
    const again = [...card.querySelectorAll<HTMLButtonElement>('.shop-act')].find((b) => b.dataset.id === was && !b.disabled);
    (again ?? card.querySelector<HTMLButtonElement>('.shop-cta')!).focus({ preventScroll: true });
  };

  card.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!t || t.disabled) return;
    if (t.dataset.act === 'done') on.done();
    else if (t.dataset.id) on.pick(t.dataset.id);
  });
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());

  root.appendChild(wrap);
  render(view);
  return { update: render, close: () => wrap.remove() };
}
