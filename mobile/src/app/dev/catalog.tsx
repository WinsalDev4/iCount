import { Redirect } from 'expo-router';

import { DesignCatalog } from '@/shared/ui/DesignCatalog';

/** Dev-only component gallery. In release builds the route just sends you home. */
export default function CatalogRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignCatalog />;
}
