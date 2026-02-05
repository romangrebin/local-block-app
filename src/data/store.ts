import seedData from "./db.json";
import { StoreData } from "./models";

const STORAGE_KEY = "local-block-data";

const isBrowser = () => typeof window !== "undefined";

export const loadStore = (): StoreData => {
  if (!isBrowser()) {
    return seedData as StoreData;
  }

  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as StoreData;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return seedData as StoreData;
};

export const saveStore = (data: StoreData) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
};
