/** Decode locally; retain only a small peak envelope, never the audio buffer. */
export const readWaveform = async (file: File): Promise<number[]> => {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const samples = buffer.getChannelData(0);
    const count = Math.min(1600, samples.length);
    const stride = Math.max(1, Math.floor(samples.length / count));
    const peaks = Array.from({ length: count }, (_, i) => {
      let peak = 0;
      for (let j = i * stride; j < Math.min(samples.length, (i + 1) * stride); j += 8) peak = Math.max(peak, Math.abs(samples[j]));
      return peak;
    });
    const maximum = Math.max(0.01, ...peaks);
    return peaks.map((p) => p / maximum);
  } finally { await context.close(); }
};
