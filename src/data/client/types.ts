import type { Community, CommunityMember, User } from "../models";
import type { CreateCommunityInput, SignInInput } from "../types";

export type SignInResult = {
  error?: string;
  userId?: string;
};

export type CreateCommunityResult = {
  code?: string;
  error?: string;
};

export type AddAdminResult = {
  ok: boolean;
  error?: string;
};

export type MembershipResult = {
  ok: boolean;
  error?: string;
};

export type DataClient = {
  kind: "firebase" | "local";
  connect: () => void;
  onAuthStateChanged?: (callback: (userId: string | null) => void) => () => void;
  subscribeUser?: (userId: string, callback: (user: User | null) => void) => () => void;
  subscribeCommunity: (
    code: string,
    callback: (community: Community | null) => void
  ) => () => void;
  subscribeCommunityMembers: (
    code: string,
    callback: (members: CommunityMember[]) => void
  ) => () => void;
  subscribeMembership: (
    code: string,
    userId: string,
    callback: (member: CommunityMember | null) => void
  ) => () => void;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  createCommunity: (
    input: CreateCommunityInput & { currentUserId: string }
  ) => Promise<CreateCommunityResult>;
  updateCommunity: (code: string, patch: Partial<Community>) => Promise<void>;
  deleteCommunity: (code: string, currentUserId?: string) => Promise<void>;
  addAdmin: (code: string, adminEmail: string) => Promise<AddAdminResult>;
  requestMembership: (
    code: string,
    currentUserId: string
  ) => Promise<MembershipResult>;
  approveMembership: (
    code: string,
    userId: string
  ) => Promise<MembershipResult>;
  denyMembership: (
    code: string,
    userId: string
  ) => Promise<MembershipResult>;
};
