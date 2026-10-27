export * from './types';
export * from './expr';
export * from './units';
export * from './parser';
export * from './geometry';
export * from './catalog';
export * from './rules';
export * from './bom';
export * from './variants';
export * from './overrides';
export * from './load';
export * from './share';
export * from './validateRules';
export * from './footer';

/** Key for "Save as my version": exact canonical callout + variant. */
export function myVersionKey(canonical: string, variantKey: string): string {
  return `${canonical}#${variantKey}`;
}
