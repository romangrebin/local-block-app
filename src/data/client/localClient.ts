import type { Community, CommunityAdmin, StoreData, User } from "../models";
import type { CreateCommunityInput, SignInInput } from "../types";
import { DEFAULT_COMMUNITY_CONTENT, DEFAULT_COMMUNITY_NAME } from "../constants";
import { normalizeCode, normalizeEmail } from "../normalize";
import type { AddAdminResult, CreateCommunityResult, DataClient, SignInResult } from "./types";

type LocalClientDeps = {
  getStore: () => StoreData;
  updateStore: (updater: (prev: StoreData) => StoreData) => void;
};

export const createLocalClient = ({ getStore, updateStore }: LocalClientDeps): DataClient => ({
  kind: "local",
  connect: () => {},
  subscribeUser: (userId, callback) => {
    if (!userId) {
      callback(null);
      return () => {};
    }
    const user = getStore().users[userId] ?? null;
    callback(user);
    return () => {};
  },
  subscribeCommunity: (code, callback) => {
    const key = normalizeCode(code);
    if (!key) {
      callback(null);
      return () => {};
    }
    const community = getStore().communities[key] ?? null;
    callback(community);
    return () => {};
  },
  subscribeAdminLink: (userId, callback) => {
    if (!userId) {
      callback(null);
      return () => {};
    }
    const admin = getStore().communityAdmins[userId] ?? null;
    callback(admin);
    return () => {};
  },
  subscribeCommunityAdmins: (code, callback) => {
    const key = normalizeCode(code);
    if (!key) {
      callback([]);
      return () => {};
    }
    const admins = Object.values(getStore().communityAdmins).filter(
      (admin) => admin.communityCode === key
    );
    callback(admins);
    return () => {};
  },
  signIn: async (input: SignInInput): Promise<SignInResult> => {
    const email = normalizeEmail(input.email);
    if (!email) return { error: "Email is required." };
    if (!input.password) return { error: "Password is required." };

    updateStore((prev) => {
      const existing = prev.users[email];
      const nextUser: User = {
        id: email,
        email,
        adminCommunityCode: existing?.adminCommunityCode ?? null,
      };
      return {
        ...prev,
        users: {
          ...prev.users,
          [email]: nextUser,
        },
      };
    });

    return { userId: email };
  },
  signOut: async () => {},
  createCommunity: async (
    input: CreateCommunityInput & { currentUserId: string }
  ): Promise<CreateCommunityResult> => {
    const code = normalizeCode(input.code);
    if (!code) return { error: "Block code is required." };
    if (!input.currentUserId) return { error: "User not signed in." };

    let created = false;
    updateStore((prev) => {
      if (prev.communities[code]) return prev;
      const current = prev.users[input.currentUserId];
      if (!current) return prev;
      if (prev.communityAdmins[input.currentUserId]) return prev;
      created = true;

      const nextCommunity: Community = {
        code,
        name: input.name.trim() || DEFAULT_COMMUNITY_NAME,
        content: input.content?.trim() || DEFAULT_COMMUNITY_CONTENT,
      };

      const nextAdmin: CommunityAdmin = {
        userId: input.currentUserId,
        communityCode: code,
        email: current.email,
      };

      return {
        ...prev,
        communities: {
          ...prev.communities,
          [code]: nextCommunity,
        },
        communityAdmins: {
          ...prev.communityAdmins,
          [input.currentUserId]: nextAdmin,
        },
      };
    });

    return created ? { code } : { error: "Unable to create block." };
  },
  updateCommunity: async (code, patch) => {
    const key = normalizeCode(code);
    if (!key) return;
    updateStore((prev) => {
      const current = prev.communities[key];
      if (!current) return prev;
      return {
        ...prev,
        communities: {
          ...prev.communities,
          [key]: {
            ...current,
            ...patch,
          },
        },
      };
    });
  },
  deleteCommunity: async (code, _currentUserId) => {
    const key = normalizeCode(code);
    if (!key) return;
    updateStore((prev) => {
      if (!prev.communities[key]) return prev;
      const nextCommunities = { ...prev.communities };
      delete nextCommunities[key];

      const nextAdmins: Record<string, CommunityAdmin> = {};
      Object.entries(prev.communityAdmins).forEach(([id, admin]) => {
        if (admin.communityCode !== key) {
          nextAdmins[id] = admin;
        }
      });

      return {
        ...prev,
        communities: nextCommunities,
        communityAdmins: nextAdmins,
      };
    });
  },
  addAdmin: async (code, adminEmail): Promise<AddAdminResult> => {
    const key = normalizeCode(code);
    const adminId = normalizeEmail(adminEmail);
    if (!key || !adminId) return { ok: false, error: "Enter a valid email." };

    let result: AddAdminResult = { ok: true };
    updateStore((prev) => {
      const current = prev.communities[key];
      if (!current) {
        result = { ok: false, error: "Block not found." };
        return prev;
      }
      const existingAdmin = prev.communityAdmins[adminId];
      if (existingAdmin) {
        if (existingAdmin.communityCode !== key) {
          result = { ok: false, error: "That user already admins another block." };
        }
        return prev;
      }

      const existing = prev.users[adminId];
      const nextUser: User = existing ?? {
        id: adminId,
        email: adminId,
        adminCommunityCode: null,
      };

      const nextAdmin: CommunityAdmin = {
        userId: adminId,
        communityCode: key,
        email: nextUser.email,
      };

      return {
        ...prev,
        users: {
          ...prev.users,
          [adminId]: nextUser,
        },
        communityAdmins: {
          ...prev.communityAdmins,
          [adminId]: nextAdmin,
        },
      };
    });
    return result;
  },
});
