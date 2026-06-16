import { applyBakedRestraintGlyph } from './BakedRestraintGlyphSpringCoilOnly.js';

export function enhanceSupportDirectionProxy(object, comp = {}, options = {}) {
  return applyBakedRestraintGlyph(object, comp, options);
}
