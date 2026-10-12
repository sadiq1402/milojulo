// Stands in for AsyncStorage in tests: plain functions, so resetMocks leaves it working.
const items = new Map<string, string>();

export default {
  getItem: async (key: string) => items.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    items.set(key, value);
  },
  removeItem: async (key: string) => {
    items.delete(key);
  },
  clear: async () => items.clear(),
};
