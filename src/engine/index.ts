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

export const FOOTER = 'Material estimate only — build per Layher instructions, site rules and your competent person.';

/** Key for "Save as my version": exact canonical callout + variant. */
export function myVersionKey(canonical: string, variantKey: string): string {
  return `${canonical}#${variantKey}`;
}
