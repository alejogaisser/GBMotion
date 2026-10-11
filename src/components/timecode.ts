const pad = (value: number, size = 2) => String(value).padStart(size, '0');

/** `HH:MM:SS:FF`. Los frames negativos cuentan como 0 (45 a 30 fps → `00:00:01:15`). */
export const formatTimecode = (frame: number, fps = 30): string => {
  const total = Math.max(0, Math.floor(frame));
  const frames = total % fps;
  const seconds = Math.floor(total / fps);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(frames)}`;
};

/** `MM:SS`, idéntico al reloj que usaban los nombres accesibles de los clips. */
export const formatClock = (frame: number, fps = 30): string => {
  const seconds = Math.max(0, frame) / fps;
  return `${pad(Math.floor(seconds / 60))}:${pad(Math.floor(seconds % 60))}`;
};
