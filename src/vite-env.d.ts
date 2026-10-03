/// <reference types="vite/client" />

// Este paquete de fontsource no declara la variante "./*.css" en sus exports,
// así que el import tiene que ir sin extensión (ver src/fonts.ts) y TypeScript
// no puede resolverle un tipo por su cuenta.
declare module '@fontsource/big-shoulders-display/*';
