import type { Community, CommunityMember, StoreData, User } from "../models";
import type { CreateCommunityInput, SignInInput } from "../types";
import {
  DEFAULT_COMMUNITY_CONTENT,
  DEFAULT_COMMUNITY_NAME,
  DEFAULT_MEMBER_CONTENT,
} from "../constants";
import { normalizeCode, normalizeEmail } from "../normalize";
import { membershipKey } from "../memberships";
import type {
  AddAdminResult,
  CreateCommunityResult,
  DataClient,
  MembershipResult,
  SignInResult,
} from "./types";

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
  subscribeMembership: (code, userId, callback) => {
    const key = normalizeCode(code);
    if (!key || !userId) {
      callback(null);
      return () => {};
    }
    const member = getStore().communityMembers[membershipKey(key, userId)] ?? null;
    callback(member);
    return () => {};
  },
  subscribeCommunityMembers: (code, callback) => {
    const key = normalizeCode(code);
    if (!key) {
      callback([]);
      return () => {};
    }
    const members = Object.values(getStore().communityMembers).filter(
      (member) => member.communityCode === key
    );
    callback(members);
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
        memberCommunityCode:
          existing?.memberCommunityCode ?? existing?.adminCommunityCode ?? null,
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
      if (current.memberCommunityCode) return prev;
      created = true;

      const nextCommunity: Community = {
        code,
        name: input.name.trim() || DEFAULT_COMMUNITY_NAME,
        content: input.content?.trim() || DEFAULT_COMMUNITY_CONTENT,
        memberContent: DEFAULT_MEMBER_CONTENT,
      };

      const nextMember: CommunityMember = {
        userId: input.currentUserId,
        communityCode: code,
        email: current.email,
        role: "admin",
        status: "active",
      };

      return {
        ...prev,
        communities: {
          ...prev.communities,
          [code]: nextCommunity,
        },
        communityMembers: {
          ...prev.communityMembers,
          [membershipKey(code, input.currentUserId)]: nextMember,
        },
        users: {
          ...prev.users,
          [input.currentUserId]: {
            ...current,
            memberCommunityCode: code,
          },
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

      const nextMembers = { ...prev.communityMembers };
      const nextUsers = { ...prev.users };
      Object.values(prev.communityMembers).forEach((member) => {
        if (member.communityCode !== key) return;
        delete nextMembers[membershipKey(member.communityCode, member.userId)];
        const user = nextUsers[member.userId];
        if (user?.memberCommunityCode === key) {
          nextUsers[member.userId] = {
            ...user,
            memberCommunityCode: null,
          };
        }
      });

      return {
        ...prev,
        communities: nextCommunities,
        communityMembers: nextMembers,
        users: nextUsers,
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
      const existingUser = prev.users[adminId];
      const memberCommunityCode =
        existingUser?.memberCommunityCode ?? existingUser?.adminCommunityCode ?? null;
      if (memberCommunityCode && memberCommunityCode !== key) {
        result = { ok: false, error: "That user already belongs to another block." };
        return prev;
      }

      const nextUser: User = existingUser ?? {
        id: adminId,
        email: adminId,
        memberCommunityCode: null,
      };

      const memberId = membershipKey(key, adminId);
      const existingMember = prev.communityMembers[memberId];
      const nextMember: CommunityMember = existingMember
        ? {
            ...existingMember,
            role: "admin",
            status: "active",
            email: nextUser.email,
          }
        : {
            userId: adminId,
            communityCode: key,
            email: nextUser.email,
            role: "admin",
            status: "active",
          };

      return {
        ...prev,
        users: {
          ...prev.users,
          [adminId]: {
            ...nextUser,
            memberCommunityCode: key,
          },
        },
        communityMembers: {
          ...prev.communityMembers,
          [memberId]: nextMember,
        },
      };
    });
    return result;
  },
  requestMembership: async (
    code: string,
    currentUserId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key) return { ok: false, error: "Community code is required." };
    if (!currentUserId) return { ok: false, error: "User not signed in." };

    let result: MembershipResult = { ok: true };
    updateStore((prev) => {
      const community = prev.communities[key];
      if (!community) {
        result = { ok: false, error: "Community not found." };
        return prev;
      }
      const user = prev.users[currentUserId];
      if (!user) {
        result = { ok: false, error: "User not found." };
        return prev;
      }
      if (user.memberCommunityCode && user.memberCommunityCode !== key) {
        result = { ok: false, error: "You already belong to another community." };
        return prev;
      }

      const memberId = membershipKey(key, currentUserId);
      const existingMember = prev.communityMembers[memberId];
      if (existingMember) {
        if (!user.memberCommunityCode) {
          return {
            ...prev,
            users: {
              ...prev.users,
              [currentUserId]: {
                ...user,
                memberCommunityCode: key,
              },
            },
          };
        }
        result = { ok: true };
        return prev;
      }

      const nextMember: CommunityMember = {
        userId: currentUserId,
        communityCode: key,
        email: user.email,
        role: "member",
        status: "pending",
      };

      return {
        ...prev,
        communityMembers: {
          ...prev.communityMembers,
          [memberId]: nextMember,
        },
        users: {
          ...prev.users,
          [currentUserId]: {
            ...user,
            memberCommunityCode: key,
          },
        },
      };
    });

    return result;
  },
  approveMembership: async (
    code: string,
    userId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key || !userId) return { ok: false, error: "Missing member." };

    let result: MembershipResult = { ok: true };
    updateStore((prev) => {
      const memberId = membershipKey(key, userId);
      const existing = prev.communityMembers[memberId];
      if (!existing) {
        result = { ok: false, error: "Membership not found." };
        return prev;
      }
      const user = prev.users[userId];
      return {
        ...prev,
        communityMembers: {
          ...prev.communityMembers,
          [memberId]: {
            ...existing,
            status: "active",
          },
        },
        users: user
          ? {
              ...prev.users,
              [userId]: {
                ...user,
                memberCommunityCode: key,
              },
            }
          : prev.users,
      };
    });
    return result;
  },
  denyMembership: async (
    code: string,
    userId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key || !userId) return { ok: false, error: "Missing member." };

    let result: MembershipResult = { ok: true };
    updateStore((prev) => {
      const memberId = membershipKey(key, userId);
      const existing = prev.communityMembers[memberId];
      if (!existing) {
        result = { ok: false, error: "Membership not found." };
        return prev;
      }
      const nextMembers = { ...prev.communityMembers };
      delete nextMembers[memberId];

      const nextUsers = { ...prev.users };
      const user = nextUsers[userId];
      if (user?.memberCommunityCode === key) {
        nextUsers[userId] = {
          ...user,
          memberCommunityCode: null,
        };
      }

      return {
        ...prev,
        communityMembers: nextMembers,
        users: nextUsers,
      };
    });
    return result;
  },
});
