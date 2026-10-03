export type FontCategory = 'sans' | 'display' | 'condensed' | 'serif' | 'editorial' | 'script' | 'mono';
export type FontStyle = 'normal' | 'italic';

export type FontDefinition = {
  id: string;
  family: string;
  displayName: string;
  category: FontCategory;
  availableWeights: readonly number[];
  availableStyles: readonly FontStyle[];
  defaultWeight: number;
  variableFont: boolean;
  source: string;
};

const font = (
  id: string,
  family: string,
  category: FontCategory,
  availableWeights: readonly number[],
  availableStyles: readonly FontStyle[],
  defaultWeight: number,
): FontDefinition => ({
  id,
  family,
  displayName: family,
  category,
  availableWeights,
  availableStyles,
  defaultWeight,
  variableFont: false,
  source: `@fontsource/${id}@5.3.0`,
});

const regularItalic = ['normal', 'italic'] as const;
const regularOnly = ['normal'] as const;
const weights400to900 = [400, 500, 600, 700, 800, 900] as const;

export const fontRegistry: readonly FontDefinition[] = [
  font('inter', 'Inter', 'sans', weights400to900, regularItalic, 700),
  font('roboto', 'Roboto', 'sans', [400, 500, 700, 900], regularItalic, 700),
  font('montserrat', 'Montserrat', 'display', weights400to900, regularItalic, 700),
  font('bebas-neue', 'Bebas Neue', 'condensed', [400], regularOnly, 400),
  font('anton', 'Anton', 'display', [400], regularOnly, 400),
  font('oswald', 'Oswald', 'condensed', [400, 500, 600, 700], regularOnly, 600),
  font('poppins', 'Poppins', 'sans', weights400to900, regularItalic, 700),
  font('raleway', 'Raleway', 'display', weights400to900, regularItalic, 700),
  font('playfair-display', 'Playfair Display', 'editorial', weights400to900, regularItalic, 700),
  font('lato', 'Lato', 'sans', [400, 700, 900], regularItalic, 700),
  font('merriweather', 'Merriweather', 'serif', [400, 700, 900], regularItalic, 700),
  font('inter-tight', 'Inter Tight', 'condensed', weights400to900, regularItalic, 700),
  font('archivo-black', 'Archivo Black', 'display', [400], regularOnly, 400),
  font('league-spartan', 'League Spartan', 'display', weights400to900, regularOnly, 700),
  font('space-grotesk', 'Space Grotesk', 'sans', [400, 500, 600, 700], regularOnly, 600),
  font('manrope', 'Manrope', 'sans', [400, 500, 600, 700, 800], regularOnly, 700),
  font('sora', 'Sora', 'sans', [400, 500, 600, 700, 800], regularOnly, 700),
  font('dm-sans', 'DM Sans', 'sans', weights400to900, regularItalic, 700),
  font('bricolage-grotesque', 'Bricolage Grotesque', 'display', [400, 500, 600, 700, 800], regularOnly, 700),
  font('instrument-serif', 'Instrument Serif', 'editorial', [400], regularItalic, 400),
  font('cormorant-garamond', 'Cormorant Garamond', 'serif', [400, 500, 600, 700], regularItalic, 600),

  /* --- Sumadas para tener manuscritas, mono/tech y display pesadas --- */
  font('bungee', 'Bungee', 'display', [400], regularOnly, 400),
  font('alfa-slab-one', 'Alfa Slab One', 'display', [400], regularOnly, 400),
  font('titan-one', 'Titan One', 'display', [400], regularOnly, 400),
  font('luckiest-guy', 'Luckiest Guy', 'display', [400], regularOnly, 400),
  font('shrikhand', 'Shrikhand', 'display', [400], regularOnly, 400),
  font('passion-one', 'Passion One', 'display', [400, 700, 900], regularOnly, 700),
  font('big-shoulders-display', 'Big Shoulders Display', 'condensed', [400, 600, 700, 800, 900], regularOnly, 700),
  font('fjalla-one', 'Fjalla One', 'condensed', [400], regularOnly, 400),
  font('abril-fatface', 'Abril Fatface', 'editorial', [400], regularOnly, 400),
  font('dm-serif-display', 'DM Serif Display', 'editorial', [400], regularItalic, 400),
  font('bodoni-moda', 'Bodoni Moda', 'editorial', [400, 700, 900], regularItalic, 700),
  font('lora', 'Lora', 'serif', [400, 700], regularItalic, 700),
  font('caveat', 'Caveat', 'script', [400, 700], regularOnly, 700),
  font('permanent-marker', 'Permanent Marker', 'script', [400], regularOnly, 400),
  font('pacifico', 'Pacifico', 'script', [400], regularOnly, 400),
  font('dancing-script', 'Dancing Script', 'script', [400, 700], regularOnly, 700),
  font('kalam', 'Kalam', 'script', [400, 700], regularOnly, 700),
  font('jetbrains-mono', 'JetBrains Mono', 'mono', [400, 700, 800], regularItalic, 700),
  font('space-mono', 'Space Mono', 'mono', [400, 700], regularItalic, 700),
  font('chakra-petch', 'Chakra Petch', 'mono', [400, 600, 700], regularOnly, 700),
  font('orbitron', 'Orbitron', 'mono', [400, 700, 900], regularOnly, 700),
  font('figtree', 'Figtree', 'sans', [400, 700, 900], regularItalic, 700),
  font('outfit', 'Outfit', 'sans', [400, 700, 900], regularOnly, 700),
  font('plus-jakarta-sans', 'Plus Jakarta Sans', 'sans', [400, 700, 800], regularItalic, 700),
  font('rubik', 'Rubik', 'sans', [400, 700, 900], regularItalic, 700),
  font('archivo', 'Archivo', 'sans', [400, 700, 900], regularItalic, 700),
  { ...font('barlow-condensed', 'Barlow Condensed', 'condensed', [400, 600, 700, 900], regularItalic, 700), source: 'local:fontsource' },
  { ...font('fraunces', 'Fraunces', 'editorial', [400, 700, 900], regularItalic, 700), source: 'local:fontsource' },
  { ...font('syne', 'Syne', 'display', [400, 600, 700, 800], regularOnly, 700), source: 'local:fontsource' },
  { ...font('shadows-into-light', 'Shadows Into Light', 'script', [400], regularOnly, 400), source: 'local:fontsource' },

];

export const fontCategoryLabels: Record<FontCategory, string> = {
  sans: 'Sans',
  display: 'Display',
  condensed: 'Condensadas',
  serif: 'Serif',
  editorial: 'Editoriales',
  script: 'Manuscritas',
  mono: 'Mono y tech',
};

export const fontById = (id: string) => fontRegistry.find((item) => item.id === id) ?? fontRegistry[0];

export const fontFromFamily = (fontFamily: string) => {
  const primaryFamily = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return fontRegistry.find((item) => item.family === primaryFamily) ?? fontRegistry[0];
};

export const fontStack = (definition: FontDefinition) => {
  const fallback = definition.category === 'serif' || definition.category === 'editorial'
    ? 'Georgia, serif'
    : definition.category === 'script'
      ? '"Segoe Script", cursive'
      : definition.category === 'mono'
        ? 'Consolas, monospace'
        : 'Arial, sans-serif';
  return `"${definition.family}", ${fallback}`;
};

export const closestFontWeight = (definition: FontDefinition, requested: number) => definition.availableWeights.reduce(
  (closest, weight) => Math.abs(weight - requested) < Math.abs(closest - requested) ? weight : closest,
  definition.defaultWeight,
);

export const supportsItalic = (definition: FontDefinition) => definition.availableStyles.includes('italic');
