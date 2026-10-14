import { MutationObserver, QueryClient } from '@tanstack/react-query';

import { optimisticMutation, prependToPage, removeFromPage } from '../optimistic';
import { queryKeys } from '../queryKeys';

interface Row {
  id: string;
  description: string;
}

const household = 'home';
const page = (...items: Row[]) => ({ items, nextCursor: null });

function setup(mutationFn: (row: Row) => Promise<Row>) {
  // gcTime Infinity: no garbage-collection timers left running after the test.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  // Two filtered lists of the same household: both must show the new row.
  queryClient.setQueryData(
    queryKeys.transactions.list(household),
    page({ id: '1', description: 'Pan' }),
  );
  queryClient.setQueryData(
    queryKeys.transactions.list(household, { type: 'expense' }),
    page({ id: '1', description: 'Pan' }),
  );
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

  const observer = new MutationObserver(
    queryClient,
    optimisticMutation({
      queryClient,
      mutationFn,
      updates: [
        {
          queryKey: queryKeys.transactions.lists(household),
          update: (current, row: Row) => prependToPage(current, row),
        },
      ],
      invalidate: [queryKeys.transactions.all(household)],
    }),
  );
  const descriptions = (filters?: Record<string, unknown>) =>
    queryClient
      .getQueryData<{ items: Row[] }>(queryKeys.transactions.list(household, filters))
      ?.items.map((row) => row.description);

  return { queryClient, observer, invalidate, descriptions };
}

describe('optimisticMutation', () => {
  it('shows the change before the server answers, in every matching list', async () => {
    let resolve!: (row: Row) => void;
    const { observer, descriptions } = setup(() => new Promise<Row>((done) => (resolve = done)));

    const pending = observer.mutate({ id: '2', description: 'Luz' });
    await Promise.resolve();
    await new Promise((done) => setTimeout(done, 0));

    expect(descriptions()).toEqual(['Luz', 'Pan']);
    expect(descriptions({ type: 'expense' })).toEqual(['Luz', 'Pan']);
    resolve({ id: '2', description: 'Luz' });
    await pending;
  });

  it('rolls back when the server fails, and refetches the truth', async () => {
    const { observer, descriptions, invalidate } = setup(async () => {
      throw new Error('offline');
    });

    await expect(observer.mutate({ id: '2', description: 'Luz' })).rejects.toThrow('offline');

    expect(descriptions()).toEqual(['Pan']);
    expect(descriptions({ type: 'expense' })).toEqual(['Pan']);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions', household] });
  });

  it('keeps the change and invalidates on success', async () => {
    const { observer, descriptions, invalidate } = setup(async (row) => row);

    await observer.mutate({ id: '2', description: 'Luz' });

    expect(descriptions()).toEqual(['Luz', 'Pan']);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('page helpers', () => {
  it('prepend and remove without touching other shapes', () => {
    const current = page({ id: '1', description: 'Pan' });

    expect(prependToPage(current, { id: '0', description: 'Café' })).toEqual(
      page({ id: '0', description: 'Café' }, { id: '1', description: 'Pan' }),
    );
    expect(removeFromPage<Row>(current, (row) => row.id === '1')).toEqual(page());
    expect(prependToPage(undefined, { id: '0' })).toBeUndefined();
    expect(prependToPage({ total: 3 }, { id: '0' })).toEqual({ total: 3 });
  });
});
