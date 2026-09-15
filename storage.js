// Same shape as the storage API the component was written against,
// backed by localStorage. Throws on a missing key, like the original.
export const storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("not found");
    return { key, value };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};
