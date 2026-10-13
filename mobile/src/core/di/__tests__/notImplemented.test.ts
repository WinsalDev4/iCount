import { notImplemented } from '../notImplemented';

interface Greeter {
  greet(name: string): Promise<string>;
}

describe('notImplemented', () => {
  it('can be created and awaited without failing', async () => {
    const greeter = notImplemented<Greeter>('greeter');

    await expect(Promise.resolve(greeter)).resolves.toBe(greeter);
  });

  it('rejects any method call with the port and method name', async () => {
    const greeter = notImplemented<Greeter>('greeter');

    await expect(greeter.greet('Ana')).rejects.toThrow('greeter.greet() is not implemented yet');
  });
});
