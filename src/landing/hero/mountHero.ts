import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import HeroDemo, { type HeroState } from './HeroDemo';

/**
 * Monta la isla interactiva del hero con el motor real (Remotion Player).
 * Se llama una sola vez y sólo tras una intención de uso (ver main.ts).
 * Lee el estado que main.ts ya maneja (input, chip de estilo, chip de fondo)
 * directamente del DOM, así hay una sola fuente de verdad.
 */
export type HeroInit = {
  frame: HTMLElement;
  input: HTMLInputElement;
  chips: HTMLElement;
  background: HTMLElement;
  reducedMotion: boolean;
};

let mounted = false;

export const mountHero = async (init: HeroInit): Promise<void> => {
  if (mounted) return;
  mounted = true;
  init.frame.dataset.islandState = 'pending';

  const read = (): HeroState => ({
    text: init.input.value,
    template: init.chips.querySelector<HTMLElement>('[aria-checked="true"]')?.dataset.template ?? 'amarillo-impacto',
    background: init.background.querySelector<HTMLElement>('[aria-checked="true"]')?.dataset.bg ?? 'dark',
  });

  let snapshot = read();
  const listeners = new Set<() => void>();
  const refresh = () => {
    const next = read();
    if (next.text === snapshot.text && next.template === snapshot.template && next.background === snapshot.background) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  init.input.addEventListener('input', refresh);
  const observer = new MutationObserver(refresh);
  observer.observe(init.chips, { attributes: true, attributeFilter: ['aria-checked'], subtree: true });
  observer.observe(init.background, { attributes: true, attributeFilter: ['aria-checked'], subtree: true });

  const host = document.createElement('div');
  host.className = 'frame-player';
  init.frame.append(host);

  createRoot(host).render(createElement(HeroDemo, {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    onReady: () => { init.frame.dataset.islandState = 'ready'; },
  }));
};
