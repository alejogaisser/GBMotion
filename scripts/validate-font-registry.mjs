import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  closestFontWeight,
  fontRegistry,
  supportsItalic,
} from '../src/typography/fontRegistry.ts';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontEntrypoint = readFileSync(resolve(projectRoot, 'src/fonts.ts'), 'utf8');
const requiredFonts = [
  'inter', 'roboto', 'montserrat', 'bebas-neue', 'anton', 'oswald', 'poppins', 'raleway', 'playfair-display',
  'inter-tight', 'archivo-black', 'league-spartan', 'space-grotesk', 'manrope', 'sora', 'dm-sans',
  'bricolage-grotesque', 'instrument-serif', 'cormorant-garamond',
];

assert.equal(new Set(fontRegistry.map((item) => item.id)).size, fontRegistry.length, 'Font IDs must be unique');
assert.equal(new Set(fontRegistry.map((item) => item.family)).size, fontRegistry.length, 'Font families must be unique');

for (const requiredId of requiredFonts) {
  assert(fontRegistry.some((item) => item.id === requiredId), `Missing required font: ${requiredId}`);
}

for (const definition of fontRegistry) {
  assert(definition.availableStyles.includes('normal'), `${definition.id} must include normal style`);
  assert(definition.availableWeights.includes(definition.defaultWeight), `${definition.id} default weight is not available`);
  assert.deepEqual([...definition.availableWeights].sort((a, b) => a - b), definition.availableWeights, `${definition.id} weights must be sorted`);

  for (const weight of definition.availableWeights) {
    for (const style of definition.availableStyles) {
      if (definition.source === 'local:fontsource') {
        const directory = resolve(projectRoot, 'src/typography/assets', definition.id);
        assert(fontEntrypoint.includes(`import './typography/assets/${definition.id}/index.css';`));
        assert(existsSync(resolve(directory, `${definition.id}-latin-${weight}-${style}.woff2`)));
        assert(existsSync(resolve(directory, 'LICENSE')));
        continue;
      }
      const suffix = style === 'italic' ? '-italic' : '';
      const relativeCssPath = `@fontsource/${definition.id}/latin-${weight}${suffix}.css`;
      // Unos pocos paquetes de fontsource no declaran "./*.css" en su mapa de
      // exports y sólo resuelven sin extensión, así que el import es válido de
      // las dos formas. El archivo en disco siempre termina en .css.
      const importedWithCss = fontEntrypoint.includes(`import '${relativeCssPath}';`);
      const importedWithoutCss = fontEntrypoint.includes(`import '${relativeCssPath.slice(0, -4)}';`);
      assert(importedWithCss || importedWithoutCss, `Missing shared import: ${relativeCssPath}`);
      assert(existsSync(resolve(projectRoot, 'node_modules', relativeCssPath)), `Missing packaged font file: ${relativeCssPath}`);
    }
  }
}

const archivoBlack = fontRegistry.find((item) => item.id === 'archivo-black');
const instrumentSerif = fontRegistry.find((item) => item.id === 'instrument-serif');
assert(archivoBlack && instrumentSerif);
assert.equal(closestFontWeight(archivoBlack, 900), 400, 'Unsupported Archivo Black weight must clamp to 400');
assert.equal(supportsItalic(archivoBlack), false, 'Archivo Black must not synthesize italic');
assert.equal(supportsItalic(instrumentSerif), true, 'Instrument Serif italic must remain available');

console.log(`FONT_REGISTRY_OK families=${fontRegistry.length} sample="¿Ñandú, pingüino? ¡Sí! 🚀"`);
