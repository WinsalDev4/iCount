import { forwardRef, type ComponentProps } from 'react';
import { FlatList } from 'react-native';

/**
 * Jest stand-in for `@shopify/flash-list`.
 *
 * FlashList measures its own layout natively; under Jest there is no layout, so it would render
 * nothing. Its official `jestSetup.js` targets an export that FlashList 2.0.x no longer has, so
 * we map the same props onto a plain FlatList. Use it per test file:
 *
 *   jest.mock('@shopify/flash-list', () => jest.requireActual('@/shared/testing/flashListStub'));
 *
 * It renders every item (no virtualisation), which is what tests want.
 */
type FlashListLikeProps<T> = Omit<ComponentProps<typeof FlatList<T>>, 'initialNumToRender'>;

function FlashListStub<T>(props: FlashListLikeProps<T>, ref: React.Ref<FlatList<T>>) {
  return <FlatList ref={ref} {...props} initialNumToRender={1_000} />;
}

export const FlashList = forwardRef(FlashListStub) as <T>(
  props: FlashListLikeProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement;
