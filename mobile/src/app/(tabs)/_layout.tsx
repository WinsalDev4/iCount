import { Tabs, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';

import { TabBar, type TabBarItem } from '@/shared/ui/TabBar';

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;

/** Route name → what the bar shows. The "+" button is not a tab: it opens the `add` modal. */
const tabs: readonly (TabBarItem & { route: string })[] = [
  { route: 'index', key: 'index', label: 'Inicio', icon: 'home' },
  { route: 'history', key: 'history', label: 'Historial', icon: 'list' },
  { route: 'plan', key: 'plan', label: 'Planificar', icon: 'target' },
  { route: 'household', key: 'household', label: 'Hogar', icon: 'users' },
];

/** Adapter: React Navigation tab state → the presentational `TabBar` from the design system. */
const renderTabBar: TabBarRenderer = ({ state, navigation }) => (
  <ConnectedTabBar state={state} navigation={navigation} />
);

function ConnectedTabBar({
  state,
  navigation,
}: Pick<Parameters<TabBarRenderer>[0], 'state' | 'navigation'>) {
  const router = useRouter();
  const activeKey = state.routes[state.index]?.name ?? 'index';

  const select = (key: string) => {
    const route = state.routes.find((r) => r.name === key);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.routes[state.index]?.key !== route.key && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <TabBar
      items={tabs}
      activeKey={activeKey}
      onSelect={select}
      onAdd={() => router.push('/add')}
    />
  );
}

export default function TabsLayout() {
  return <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }} />;
}
