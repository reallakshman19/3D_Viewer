import { applyBakedRestraintGlyph } from './BakedRestraintGlyphCanvasAxisOverride.js';

export function enhanceSupportDirectionProxy(object, comp = {}, options = {}) {
  return applyBakedRestraintGlyph(object, comp, options);
}
