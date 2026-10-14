import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { endSession, sessionQueryKey } from '../session';

describe('endSession', () => {
  it('tells the mounted observers at once and forgets every other query', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    queryClient.setQueryData(sessionQueryKey, { user: { email: 'ana@icount.app' } });
    queryClient.setQueryData(['transactions', 'h1'], ['Luz']);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    // What the access gate does: observe the session without re-rendering for any other reason.
    const gate = await renderHook(
      () => useQuery({ queryKey: sessionQueryKey, queryFn: () => null, staleTime: Infinity }).data,
      { wrapper },
    );
    expect(gate.result.current).not.toBeNull();

    await act(async () => endSession(queryClient));

    await waitFor(() => expect(gate.result.current).toBeNull());
    expect(queryClient.getQueryData(['transactions', 'h1'])).toBeUndefined();
  });
});
