import { describe, expect, it } from 'vitest';
import { createXmlCompareElementIndex } from '../xml-compare/XmlCompareElementIndex.js';
import { createXmlCompareMatchMap } from '../xml-compare/XmlCompareMatchMap.js';

describe('xml compare foundation import contract', () => {
  it('loads XML compare foundation modules', () => {
    expect(createXmlCompareElementIndex([]).summary.elementCount).toBe(0);
    expect(createXmlCompareMatchMap().summary.matchCount).toBe(0);
  });
});
