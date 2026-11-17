import { formatRelativeTime } from '../model/time';

const at = (s: number) => formatRelativeTime(0, s * 1000);

describe('formatRelativeTime', () => {
  it('uses floor-rounded compact units at the boundaries', () => {
    expect(at(59)).toBe('now');
    expect(at(60)).toBe('1m');
    expect(at(3599)).toBe('59m');
    expect(at(3600)).toBe('1h');
    expect(at(86399)).toBe('23h');
    expect(at(86400)).toBe('1d');
    expect(at(86400 * 3 + 5000)).toBe('3d');
  });
});
