import type { QueryClient, QueryKey, UseMutationOptions } from '@tanstack/react-query';

/** How one family of cached queries changes when the mutation is applied. */
export interface OptimisticUpdate<TVariables> {
  /** Prefix: every cached query starting with it is updated (e.g. all filtered lists). */
  readonly queryKey: QueryKey;
  /** Returns the new cached data; never mutate `current`. `undefined` leaves it as is. */
  readonly update: (current: unknown, variables: TVariables) => unknown;
}

export interface OptimisticMutationConfig<TData, TVariables> {
  readonly queryClient: QueryClient;
  readonly mutationFn: (variables: TVariables) => Promise<TData>;
  readonly updates: readonly OptimisticUpdate<TVariables>[];
  /** Refetched when the mutation settles (success or error). Defaults to the updated keys. */
  readonly invalidate?: readonly QueryKey[];
}

/** What was in the cache before applying the change, to roll back on error. */
export type OptimisticSnapshot = readonly (readonly [QueryKey, unknown])[];

/**
 * Builds `useMutation` options that show the change instantly (ADR-0014):
 * 1. onMutate: cancel in-flight fetches, snapshot the affected queries, apply `update`.
 * 2. onError: restore the snapshot (the row disappears / the old value comes back).
 * 3. onSettled: invalidate, so the server's truth replaces the optimistic guess.
 *
 * Kotlin analogy: update the StateFlow before calling the API and revert in `catch`.
 *
 * @example
 * const create = useMutation(
 *   optimisticMutation({
 *     queryClient,
 *     mutationFn: (input: NewTransaction) => repository.create(input),
 *     updates: [{
 *       queryKey: queryKeys.transactions.lists(householdId),
 *       update: (page, input) => prependToPage(page, toOptimisticTransaction(input)),
 *     }],
 *     invalidate: [queryKeys.transactions.all(householdId)],
 *   }),
 * );
 */
export function optimisticMutation<TData, TVariables>(
  config: OptimisticMutationConfig<TData, TVariables>,
): UseMutationOptions<TData, Error, TVariables, OptimisticSnapshot> {
  const { queryClient, updates } = config;

  return {
    mutationFn: config.mutationFn,
    // Writes are never retried automatically (see core/query/queryClient.ts).
    retry: false,

    async onMutate(variables) {
      await Promise.all(updates.map(({ queryKey }) => queryClient.cancelQueries({ queryKey })));
      const snapshot = updates.flatMap(({ queryKey }) => queryClient.getQueriesData({ queryKey }));
      for (const { queryKey, update } of updates) {
        queryClient.setQueriesData({ queryKey }, (current: unknown) => update(current, variables));
      }
      return snapshot;
    },

    onError(_error, _variables, snapshot) {
      for (const [queryKey, data] of snapshot ?? []) queryClient.setQueryData(queryKey, data);
    },

    async onSettled() {
      const keys = config.invalidate ?? updates.map(({ queryKey }) => queryKey);
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  };
}

/** Helper for list-shaped caches `{ items, nextCursor }`: puts an item at the top. */
export function prependToPage<T>(current: unknown, item: T): unknown {
  if (!isPage<T>(current)) return current;
  return { ...current, items: [item, ...current.items] };
}

/** Helper for list-shaped caches: removes the items that match. */
export function removeFromPage<T>(current: unknown, matches: (item: T) => boolean): unknown {
  if (!isPage<T>(current)) return current;
  return { ...current, items: current.items.filter((item) => !matches(item)) };
}

function isPage<T>(value: unknown): value is { items: readonly T[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items)
  );
}
