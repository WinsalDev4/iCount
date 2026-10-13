import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import { createContainer, type Container } from './container';

const DependenciesContext = createContext<Container | null>(null);

export function DependenciesProvider({
  children,
  container,
}: PropsWithChildren<{ container?: Container }>) {
  const [value] = useState(() => container ?? createContainer());
  return <DependenciesContext.Provider value={value}>{children}</DependenciesContext.Provider>;
}

export function useDependencies(): Container {
  const container = useContext(DependenciesContext);
  if (!container) throw new Error('useDependencies must be used inside <DependenciesProvider>');
  return container;
}
