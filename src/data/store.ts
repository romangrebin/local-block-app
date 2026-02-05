import seedData from "./db.json";
import { StoreData } from "./models";

const STORAGE_KEY = "local-block-data";

const isBrowser = () => typeof window !== "undefined";

const ensureStoreShape = (data: Partial<StoreData>): StoreData => {
  const users = data.users ?? {};
  const communities = data.communities ?? {};
  const existingAdmins = data.communityAdmins ?? {};
  let communityAdmins = existingAdmins;

  if (!Object.keys(existingAdmins).length) {
    const derivedAdmins: StoreData["communityAdmins"] = {};
    Object.values(users).forEach((user) => {
      if (user.adminCommunityCode) {
        derivedAdmins[user.id] = {
          userId: user.id,
          communityCode: user.adminCommunityCode,
          email: user.email,
        };
      }
    });

    if (!Object.keys(derivedAdmins).length) {
      Object.values(communities).forEach((community) => {
        const admins = (community as { admins?: string[] }).admins ?? [];
        admins.forEach((email) => {
          derivedAdmins[email] = {
            userId: email,
            communityCode: community.code,
            email,
          };
        });
      });
    }

    communityAdmins = derivedAdmins;
  }

  return {
    users,
    communities,
    communityAdmins,
  };
};

export const loadStore = (): StoreData => {
  if (!isBrowser()) {
    return ensureStoreShape(seedData as StoreData);
  }

  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return ensureStoreShape(JSON.parse(cached) as StoreData);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return ensureStoreShape(seedData as StoreData);
};

export const saveStore = (data: StoreData) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
};
