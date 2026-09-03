import { parsePositiveIntParam } from './parse-route-param';

describe('parsePositiveIntParam', () => {
  it('accepts positive integers', () => {
    expect(parsePositiveIntParam('1')).toBe(1);
    expect(parsePositiveIntParam('42')).toBe(42);
  });

  it('rejects invalid values', () => {
    expect(parsePositiveIntParam(null)).toBeNull();
    expect(parsePositiveIntParam(undefined)).toBeNull();
    expect(parsePositiveIntParam('')).toBeNull();
    expect(parsePositiveIntParam('abc')).toBeNull();
    expect(parsePositiveIntParam('0')).toBeNull();
    expect(parsePositiveIntParam('-3')).toBeNull();
    expect(parsePositiveIntParam('3.5')).toBeNull();
  });
});
