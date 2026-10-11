import './fonts';
import './landing.css';

/**
 * Landing de GB Motion. TS plano, sin framework y sin librerías de animación.
 * - Nunca importa Remotion ni el editor: la isla del hero se carga con import()
 *   sólo tras una intención de uso (foco, tipeo, chip o clic en «Probá tu frase»).
 * - Nunca lee ni escribe localStorage/IndexedDB y nunca llama a /api/*.
 */

const root = document.documentElement;
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const $ = <T extends HTMLElement>(selector: string, scope: ParentNode = document) => scope.querySelector<T>(selector);
const $$ = <T extends HTMLElement>(selector: string, scope: ParentNode = document) => Array.from(scope.querySelectorAll<T>(selector));

const isReduced = () => reduceQuery.matches;
const isPaused = () => root.hasAttribute('data-paused');
const canMove = () => !isReduced() && !isPaused();

/* ---------------------------------------------------------------- menú móvil */
const nav = $('#nav');
const menuBtn = $<HTMLButtonElement>('#menu-btn');
const setMenu = (open: boolean) => {
  if (!nav || !menuBtn) return;
  nav.toggleAttribute('data-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
};
menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
$('#nav-links')?.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuBtn?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuBtn.focus();
  }
});

/* ------------------------------------------------------------------ pausa global */
const pauseBtn = $<HTMLButtonElement>('#pause');
let tickerTimer = 0;
const setPaused = (paused: boolean) => {
  root.toggleAttribute('data-paused', paused);
  if (pauseBtn) {
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = (paused ? pauseBtn.dataset.labelOff : pauseBtn.dataset.labelOn) ?? pauseBtn.textContent;
  }
  if (paused) {
    // Las animaciones CSS las frena la regla html[data-paused]; las WAAPI se terminan.
    document.getAnimations().forEach((animation) => {
      if (!('animationName' in animation) && !('transitionProperty' in animation)) animation.finish();
    });
  }
  syncTicker();
};
pauseBtn?.addEventListener('click', () => setPaused(!isPaused()));
reduceQuery.addEventListener('change', () => syncTicker());

/* ------------------------------------------------------- playhead de la página */
const sections = $$('main > section[id]');
const stops = $$<HTMLAnchorElement>('.ph-stops a');
const stopFor = new Map(stops.map((link) => [link.getAttribute('href')?.slice(1) ?? '', link]));

const currentObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    stops.forEach((link) => link.removeAttribute('aria-current'));
    stopFor.get(entry.target.id)?.setAttribute('aria-current', 'true');
  }
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((section) => currentObserver.observe(section));

const hasScrollTimeline = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()');
const timeline = $('#timeline');
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
let frameQueued = false;
const updateProgress = () => {
  frameQueued = false;
  if (isReduced()) return;
  if (!hasScrollTimeline) {
    const max = root.scrollHeight - window.innerHeight;
    root.style.setProperty('--p', String(max > 0 ? clamp01(window.scrollY / max) : 0));
    if (timeline) {
      const rect = timeline.getBoundingClientRect();
      timeline.style.setProperty('--tp', String(clamp01((window.innerHeight * 0.8 - rect.top) / (rect.height + window.innerHeight * 0.4))));
    }
  }
  const verde = $('#verde');
  if (verde && !verde.classList.contains('keyed') && !hasScrollTimeline) {
    const rect = verde.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.6 && rect.bottom > 0) verde.classList.add('keyed');
  }
};
if (!hasScrollTimeline) {
  window.addEventListener('scroll', () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(updateProgress);
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
}
updateProgress();

/* ----------------------------------------------------------------- reveals WAAPI */
const reveals = $$('.rv');
const popFrames: Keyframe[] = [
  { opacity: 0, transform: 'translateY(14px) scale(.96)' },
  { opacity: 1, transform: 'translateY(-2px) scale(1.015)', offset: 0.6 },
  { opacity: 1, transform: 'none' },
];
const revealNow = (el: HTMLElement, delay: number) => {
  el.style.removeProperty('opacity');
  if (!canMove()) return;
  el.animate(popFrames, { duration: 340, delay, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
};
if (!isReduced() && 'IntersectionObserver' in window) {
  for (const el of reveals) {
    if (el.getBoundingClientRect().top > window.innerHeight) el.style.opacity = '0';
  }
  const revealObserver = new IntersectionObserver((entries) => {
    let batch = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      revealObserver.unobserve(el);
      revealNow(el, el.parentElement?.hasAttribute('data-stagger') ? batch++ * 70 : 0);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach((el) => revealObserver.observe(el));
}

/* ------------------------------------------------------------------- contadores */
const counters = $$('.num[data-count]');
const countTo = (el: HTMLElement) => {
  const target = Number(el.dataset.count);
  if (!canMove() || !Number.isFinite(target) || target === 0) {
    el.textContent = String(target);
    return;
  }
  const start = performance.now();
  const duration = 900;
  const step = (now: number) => {
    if (!canMove()) { el.textContent = String(target); return; }
    const t = clamp01((now - start) / duration);
    el.textContent = String(Math.round(target * t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
if (!isReduced() && 'IntersectionObserver' in window) {
  const counterObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      counterObserver.unobserve(entry.target);
      countTo(entry.target as HTMLElement);
    }
  }, { threshold: 0.6 });
  for (const el of counters) {
    if (Number(el.dataset.count) > 0) el.textContent = '0';
    counterObserver.observe(el);
  }
}

/* ------------------------------------------------------------- hero: demo estática */
const input = $<HTMLInputElement>('#frase');
const frame = $('#hero-demo');
const look = $('#hero-look');
const phraseEl = $('#hero-phrase');
const counterEl = $('#frase-count');
const limitEl = $('#frase-limite');
const chipsEl = $('#chips');
const fondosEl = $('#fondos');
const DEFAULT_PHRASE = 'ASÍ SE VE TU FRASE';

let words: HTMLElement[] = [];
let activeIndex = -1;

const renderPhrase = (text: string) => {
  if (!phraseEl) return;
  const parts = text.split(/\s+/).filter(Boolean);
  phraseEl.replaceChildren();
  words = parts.map((word, index) => {
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = word;
    phraseEl.append(span);
    if (index < parts.length - 1) phraseEl.append(' ');
    return span;
  });
  activeIndex = -1;
  paintTicker();
};

const paintTicker = () => {
  words.forEach((word, index) => {
    word.classList.toggle('on', index === activeIndex);
    word.classList.toggle('said', index < activeIndex);
  });
};

const syncTicker = () => {
  window.clearInterval(tickerTimer);
  tickerTimer = 0;
  if (!look) return;
  // Con la isla activa la vista estática queda oculta: no hace falta animarla.
  if (frame?.dataset.islandState === 'ready') { look.removeAttribute('data-live'); return; }
  if (canMove()) {
    look.setAttribute('data-live', '');
    tickerTimer = window.setInterval(() => {
      if (frame?.dataset.islandState === 'ready') { syncTicker(); return; }
      // Una vuelta de palabras y dos pasos de pausa antes de repetir.
      activeIndex = activeIndex >= words.length + 1 ? 0 : activeIndex + 1;
      paintTicker();
    }, 620);
  } else {
    look.removeAttribute('data-live');
    activeIndex = -1;
    paintTicker();
  }
};

const currentPhrase = () => (input?.value.trim() ? input.value.trim() : DEFAULT_PHRASE);

const updateFromInput = () => {
  const text = currentPhrase();
  renderPhrase(text);
  frame?.setAttribute('aria-label', text);
  const length = input?.value.length ?? 0;
  if (counterEl) counterEl.textContent = `${length}/80`;
  if (limitEl) limitEl.hidden = length < 80;
};

const setTemplate = (id: string) => {
  look?.setAttribute('data-template', id);
  const chips = $$<HTMLButtonElement>('.chip', chipsEl ?? document);
  let found = false;
  for (const chip of chips) {
    const on = chip.dataset.template === id;
    if (on) found = true;
    chip.setAttribute('aria-checked', String(on));
    chip.tabIndex = on ? 0 : -1;
  }
  if (!found && chips[0]) chips[0].tabIndex = 0;
  return chips.find((chip) => chip.dataset.template === id) ?? null;
};

const setBackground = (id: string) => {
  frame?.setAttribute('data-bg', id);
  for (const chip of $$<HTMLButtonElement>('.chip', fondosEl ?? document)) {
    const on = chip.dataset.bg === id;
    chip.setAttribute('aria-checked', String(on));
    chip.tabIndex = on ? 0 : -1;
  }
};

/** Radiogroup con flechas (roving tabindex). */
const wireRadioGroup = (group: HTMLElement | null, apply: (chip: HTMLButtonElement) => void) => {
  if (!group) return;
  group.addEventListener('click', (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (chip) apply(chip);
  });
  group.addEventListener('keydown', (event) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const chips = $$<HTMLButtonElement>('.chip', group);
    const index = Math.max(0, chips.findIndex((chip) => chip === document.activeElement));
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % chips.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + chips.length) % chips.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = chips.length - 1;
    event.preventDefault();
    chips[next].focus();
    apply(chips[next]);
  });
};

/* ---- montaje diferido de la isla: sólo tras intención de uso ---- */
let heroPromise: Promise<void> | null = null;
const wakeHero = () => {
  if (heroPromise || !frame || !input || !chipsEl || !fondosEl) return;
  const loading = $('#hero-loading');
  if (loading) loading.hidden = false;
  heroPromise = import('./hero/mountHero')
    .then((module) => module.mountHero({ frame, input, chips: chipsEl, background: fondosEl, reducedMotion: isReduced() }))
    .catch(() => { heroPromise = null; })
    .finally(() => { if (loading) loading.hidden = true; });
};

input?.addEventListener('input', () => { updateFromInput(); wakeHero(); });
input?.addEventListener('focus', wakeHero);
$('#probar')?.addEventListener('click', () => { window.setTimeout(() => input?.focus({ preventScroll: true }), 0); wakeHero(); });
for (const link of $$('a[data-focus-frase]')) {
  link.addEventListener('click', () => {
    window.setTimeout(() => input?.focus({ preventScroll: true }), 0);
  });
}
wireRadioGroup(chipsEl, (chip) => { if (chip.dataset.template) setTemplate(chip.dataset.template); wakeHero(); });
wireRadioGroup(fondosEl, (chip) => { if (chip.dataset.bg) setBackground(chip.dataset.bg); wakeHero(); });

/* «Abrir en el editor»: arma /editor/#demo=… (la frase viaja sólo en el fragmento).
   handoff.ts arrastra el registro de fuentes y presets, así que se importa recién en el clic.
   Sin JS (o si algo falla) el enlace sigue siendo /editor/. */
const handoffLink = $<HTMLAnchorElement>('#handoff');
handoffLink?.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const fallback = handoffLink.getAttribute('href') || '/editor/';
  const templateId = chipsEl?.querySelector<HTMLElement>('[aria-checked="true"]')?.dataset.template ?? 'amarillo-impacto';
  const raw = input?.value ?? '';
  import('../utils/handoff')
    .then(({ cleanPhrase, encodeHandoff, payloadFromTemplateId }) => {
      const phrase = cleanPhrase(raw).slice(0, 80).trim();
      const encoded = encodeHandoff({ style: payloadFromTemplateId(templateId), ...(phrase ? { phrase } : {}) });
      return `/editor/#demo=${encoded}`;
    })
    .catch(() => fallback)
    .then((url) => { window.location.assign(url); });
});

/* Tarjetas de «Estilos»: eligen la plantilla en el hero y vuelven a él. */
for (const card of $$<HTMLButtonElement>('.card[data-template]')) {
  card.addEventListener('click', () => {
    const id = card.dataset.template;
    if (!id) return;
    const chip = setTemplate(id);
    $('#hero')?.scrollIntoView({ behavior: isReduced() ? 'auto' : 'smooth', block: 'start' });
    (chip ?? input)?.focus({ preventScroll: true });
    wakeHero();
  });
}

updateFromInput();
syncTicker();
