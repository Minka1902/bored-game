import { applySettings, loadSettings, type Deps, type Settings } from './deps';

/** Bottom sheet with the sound and vibration switches. Returns a promise that settles when it closes. */
export function openSettings(d: Deps): Promise<void> {
  return new Promise((resolve) => {
    const s = loadSettings(d.store);
    const sheet = document.createElement('div');
    sheet.className = 'sheet-wrap';
    sheet.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Settings">
        <h2>Settings</h2>
        <label class="switch-row"><span>Sound</span><input type="checkbox" data-key="sound" ${s.sound ? 'checked' : ''}></label>
        <label class="switch-row"><span>Vibration</span><input type="checkbox" data-key="haptics" ${s.haptics ? 'checked' : ''}></label>
        <p class="sheet-note">Vibration works on Android. iPhones only buzz on older iOS versions.</p>
        <button class="btn btn-primary" data-act="close">Done</button>
      </div>`;
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      sheet.remove();
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        close();
      }
    };
    sheet.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const next: Settings = { ...loadSettings(d.store), [input.dataset.key as keyof Settings]: input.checked };
      applySettings(d, next);
      d.sfx.play('click');
      d.haptics.tap();
    });
    sheet.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === sheet || t.closest('[data-act="close"]')) close();
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(sheet);
    sheet.querySelector<HTMLButtonElement>('[data-act="close"]')!.focus();
  });
}
