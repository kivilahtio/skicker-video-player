/**
 * Global program type definitions, use sparingly.
 * Prefer to import dependencies on a per-module-basis so a complete dependency graph can be created.
 *
 * This is simply meant to allow extra-typescript files to be imported when bundling dependencies with webpack
 */

/**
 * Special importable file types webpack uses to load into javascript objects
 */

declare module '*.mp4' {
  const content: object;
  export default content;
}
declare module '*.csv' {
  const content: object;
  export default content;
}
declare module '*.json' {
  const content: object;
  export default content;
}
declare module '*.txt' {
  const content: object;
  export default content;
}
declare module '*.xml' {
  const content: object;
  export default content;
}
declare module '*.yaml' {
  const content: object;
  export default content;
}
/*
declare module 'deepmerge' {
  export default function merge(x: object, y:object, options?:object): void;
}
*/
