import { describe, expect, it } from 'vitest';
import { createXmlCompareElementIndex } from '../xml-compare/XmlCompareElementIndex.js';
import { createXmlCompareMatchMap } from '../xml-compare/XmlCompareMatchMap.js';

describe('xml compare foundation', () => {
  it('indexes elements and creates an empty match map', () => {
    const index = createXmlCompareElementIndex([{ id: 'A', type: 'PIPE', points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] }]);
    const map = createXmlCompareMatchMap();
    expect(index.summary.elementCount).toBe(1);
    expect(map.summary.matchCount).toBe(0);
  });
});
