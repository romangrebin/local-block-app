import seedData from "./db.json";
import { CommunityMember, StoreData, User } from "./models";
import { membershipKey } from "./memberships";

const STORAGE_KEY = "local-block-data";

const isBrowser = () => typeof window !== "undefined";

const ensureStoreShape = (data: Partial<StoreData> & { communityAdmins?: Record<string, any> }): StoreData => {
  const users = data.users ?? {};
  const communities = data.communities ?? {};
  const existingMembers = data.communityMembers ?? {};
  let communityMembers = existingMembers;

  if (!Object.keys(existingMembers).length) {
    const derivedMembers: StoreData["communityMembers"] = {};
    const legacyAdmins = data.communityAdmins ?? {};

    Object.values(legacyAdmins).forEach((admin: any) => {
      const member: CommunityMember = {
        userId: admin.userId,
        communityCode: admin.communityCode,
        email: admin.email,
        role: "admin",
        status: "active",
      };
      derivedMembers[membershipKey(admin.communityCode, admin.userId)] = member;
    });

    if (!Object.keys(derivedMembers).length) {
      Object.values(communities).forEach((community) => {
        const admins = (community as { admins?: string[] }).admins ?? [];
        admins.forEach((email) => {
          const member: CommunityMember = {
            userId: email,
            communityCode: community.code,
            email,
            role: "admin",
            status: "active",
          };
          derivedMembers[membershipKey(community.code, email)] = member;
        });
      });
    }

    communityMembers = derivedMembers;
  }

  const normalizedUsers: Record<string, User> = {};
  Object.entries(users).forEach(([id, user]) => {
    const memberCommunityCode =
      user.memberCommunityCode ?? user.adminCommunityCode ?? null;
    normalizedUsers[id] = {
      ...user,
      memberCommunityCode: memberCommunityCode ?? null,
    };
  });

  Object.values(communityMembers).forEach((member) => {
    const existing = normalizedUsers[member.userId];
    if (existing && !existing.memberCommunityCode) {
      normalizedUsers[member.userId] = {
        ...existing,
        memberCommunityCode: member.communityCode,
      };
    }
  });

  return {
    users: normalizedUsers,
    communities,
    communityMembers,
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
