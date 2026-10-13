import { createMMKV } from 'react-native-mmkv';

import { createMmkvStorage } from '../mmkvStorage';

const mockValues = new Map<string, string>();
const mockInstance = {
  getString: jest.fn((key: string) => mockValues.get(key)),
  set: jest.fn((key: string, value: string) => void mockValues.set(key, value)),
  remove: jest.fn((key: string) => mockValues.delete(key)),
};

jest.mock('react-native-mmkv', () => ({ createMMKV: jest.fn(() => mockInstance) }));

describe('createMmkvStorage', () => {
  it('creates the MMKV instance lazily, on first use', () => {
    const storage = createMmkvStorage('test');
    expect(createMMKV).not.toHaveBeenCalled();

    storage.setItem('k', 'v');

    expect(createMMKV).toHaveBeenCalledWith({ id: 'test' });
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
    expect(createMMKV).toHaveBeenCalledTimes(1);
  });
});
