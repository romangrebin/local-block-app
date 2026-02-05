import type { Community, CommunityAdmin, User } from "../models";
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

export type DataClient = {
  kind: "firebase" | "local";
  connect: () => void;
  onAuthStateChanged?: (callback: (userId: string | null) => void) => () => void;
  subscribeUser?: (userId: string, callback: (user: User | null) => void) => () => void;
  subscribeCommunity: (
    code: string,
    callback: (community: Community | null) => void
  ) => () => void;
  subscribeAdminLink: (
    userId: string,
    callback: (admin: CommunityAdmin | null) => void
  ) => () => void;
  subscribeCommunityAdmins: (
    code: string,
    callback: (admins: CommunityAdmin[]) => void
  ) => () => void;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  createCommunity: (
    input: CreateCommunityInput & { currentUserId: string }
  ) => Promise<CreateCommunityResult>;
  updateCommunity: (code: string, patch: Partial<Community>) => Promise<void>;
  deleteCommunity: (code: string, currentUserId?: string) => Promise<void>;
  addAdmin: (code: string, adminEmail: string) => Promise<AddAdminResult>;
};
