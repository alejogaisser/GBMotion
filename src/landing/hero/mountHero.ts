/**
 * Monta la isla interactiva del hero. Por ahora es un stub: todavía no importa
 * Remotion. HeroDemo.tsx (F2-L) lo reemplazará cargando la isla con import().
 * Se llama una sola vez y sólo tras una intención de uso (ver main.ts).
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
};
