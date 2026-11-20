import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('prefixes formula-leading characters', () => {
    for (const c of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx']) expect(csvCell(c)).toBe(`"'${c}"`);
  });
  it('leaves normal text alone and escapes quotes', () => {
    expect(csvCell('lunch "x"')).toBe('"lunch ""x"""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell('a=b')).toBe('"a=b"');
  });
  it('joins rows', () => expect(toCsv([['a', '=b'], ['c', 'd']])).toBe('"a","\'=b"\n"c","d"'));
});
