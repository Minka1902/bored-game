// Android: Vibration API. iOS Safari has none; toggling a hidden <input switch> fires a system haptic
// on iOS 17.4–26.4 (Apple closed this in 26.5), so on newer iPhones this is silently a no-op.
import type { Haptics } from './types';

const MIN_GAP_MS = 35;

export function createHaptics(): Haptics {
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  const canVibrate = typeof nav.vibrate === 'function';
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  let label: HTMLLabelElement | null = null;
  let last = 0;

  const iosTick = () => {
    if (!label) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none';
      label.appendChild(input);
      document.body.appendChild(label);
    }
    label.click();
  };

  const pulse = (ms: number) => {
    if (!h.enabled) return;
    const now = performance.now();
    if (now - last < MIN_GAP_MS) return;
    last = now;
    try {
      if (canVibrate) nav.vibrate!(ms);
      else if (isIOS) iosTick();
    } catch {
      // haptics are best effort
    }
  };

  const h: Haptics = {
    enabled: true,
    tap: () => pulse(8),
    bump: () => pulse(20),
    buzz: (ms = 45) => pulse(ms),
  };
  return h;
}
