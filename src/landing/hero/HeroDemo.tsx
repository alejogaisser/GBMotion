import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import './demoFonts';
import { TextComposition } from '../../remotion/TextComposition';
import { createTextLayer } from '../../remotion/defaults';
import { applyTemplate, evenWordTiming, heroTemplateIds, resolveTemplate } from '../../presets/templates';
import { getCompositionDuration, getLayerDuration } from '../../utils/duration';
import type { BackgroundMode, TextLayer } from '../../types/motion';

export type HeroState = { text: string; template: string; background: string };

type Props = {
  getSnapshot: () => HeroState;
  subscribe: (listener: () => void) => () => void;
  onReady: () => void;
};

const DEFAULT_PHRASE = 'ASÍ SE VE TU FRASE';
const MAX_CHARS = 80;
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

const BACKGROUNDS: Record<string, BackgroundMode> = { dark: 'black', green: 'green', checker: 'checker' };

const buildLayer = (state: HeroState): TextLayer => {
  const text = state.text.trim().replace(/\s+/g, ' ').slice(0, MAX_CHARS) || DEFAULT_PHRASE;
  const id = heroTemplateIds.includes(state.template) ? state.template : heroTemplateIds[0];
  const template = resolveTemplate(id);
  const layer = applyTemplate(createTextLayer(text, 'hero-1'), template, { hold: 'template' });
  return { ...layer, wordTiming: evenWordTiming(text, getLayerDuration(layer), template.highlight) };
};

/**
 * Isla del hero: el mismo motor (TextComposition + duración compartida) que el editor.
 * No toca localStorage ni ninguna API: todo el estado vive en memoria.
 */
export default function HeroDemo({ getSnapshot, subscribe, onReady }: Props) {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const playerRef = useRef<PlayerRef>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const reduceQuery = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);
  const [reduced, setReduced] = useState(reduceQuery.matches);
  const [inView, setInView] = useState(true);
  const [globalPaused, setGlobalPaused] = useState(() => document.documentElement.hasAttribute('data-paused'));
  // null = comportamiento por defecto; 'play'/'pause' = decisión deliberada de la persona.
  const [choice, setChoice] = useState<'play' | 'pause' | null>(null);

  const layer = useMemo(() => buildLayer(state), [state]);
  const layers = useMemo(() => [layer], [layer]);
  const duration = getCompositionDuration(layers);
  const inputProps = useMemo(() => ({
    layers,
    background: BACKGROUNDS[state.background] ?? 'black',
    customBackground: '#121212',
  }), [layers, state.background]);

  // Frame de reposo: la frase completa y legible (después de la entrada, antes de la salida).
  const restFrame = Math.max(0, Math.min(duration - 1, Math.round(duration * 0.5)));

  const shouldPlay = inView && (choice === 'play' || (choice === null && !reduced && !globalPaused));
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  useEffect(() => {
    const onChange = () => setReduced(reduceQuery.matches);
    reduceQuery.addEventListener('change', onChange);
    return () => reduceQuery.removeEventListener('change', onChange);
  }, [reduceQuery]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const paused = root.hasAttribute('data-paused');
      setGlobalPaused(paused);
      if (paused) setChoice(null);
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-paused'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Cada cambio de frase/estilo: reinicia si está reproduciendo, o muestra el frame de reposo si no.
  useEffect(() => {
    playerRef.current?.seekTo(shouldPlayRef.current ? 0 : restFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
      if (reduced && choice !== 'play') player.seekTo(restFrame);
    }
  }, [shouldPlay, reduced, choice, restFrame]);

  // Atributos de estado para inspección y pruebas (no re-renderizan).
  useEffect(() => {
    const player = playerRef.current;
    const node = wrapRef.current;
    if (!player || !node) return;
    const onFrame = (event: { detail: { frame: number } }) => { node.dataset.frame = String(event.detail.frame); };
    const onPlay = () => { node.dataset.playing = 'true'; };
    const onPause = () => { node.dataset.playing = 'false'; };
    node.dataset.frame = String(player.getCurrentFrame());
    node.dataset.playing = String(player.isPlaying());
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    onReady();
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [onReady]);

  const toggle = useCallback(() => setChoice(shouldPlay ? 'pause' : 'play'), [shouldPlay]);

  return (
    <div ref={wrapRef} className="hero-player" data-frame="0" data-playing="false">
      <Player
        ref={playerRef}
        component={TextComposition}
        inputProps={inputProps}
        durationInFrames={duration}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        controls={false}
        loop
        autoPlay={!reduced}
        initialFrame={reduced ? restFrame : 0}
        initiallyMuted
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
      <button type="button" className="hero-playtoggle" onClick={toggle}>
        {shouldPlay ? 'Pausar vista previa' : 'Reproducir vista previa'}
      </button>
    </div>
  );
}
