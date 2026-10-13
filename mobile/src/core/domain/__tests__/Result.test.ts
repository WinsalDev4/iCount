import { err, mapResult, ok, type Result } from '../Result';

describe('Result', () => {
  it('narrows on the ok discriminant', () => {
    const results: Result<number, string>[] = [ok(2), err('boom')];

    const described = results.map((result) => (result.ok ? `value ${result.value}` : result.error));

    expect(described).toEqual(['value 2', 'boom']);
  });

  it('maps only successful values', () => {
    expect(mapResult(ok(2), (n) => n * 10)).toEqual(ok(20));
    expect(mapResult(err('boom') as Result<number, string>, (n) => n * 10)).toEqual(err('boom'));
  });
});
