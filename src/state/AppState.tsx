import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Community, CommunityMember, StoreData } from "../data/models";
import { normalizeCode, nameFromEmail } from "../data/normalize";
import { CreateCommunityInput, SignInInput } from "../data/types";
import { DEFAULT_MEMBER_CONTENT } from "../data/constants";
import { membershipKey } from "../data/memberships";
import { createFirebaseClient } from "../data/client";

type AppState = {
  signedIn: boolean;
  userName: string;
  adminCommunityCode: string | null;
  memberCommunityCode: string | null;
  pendingCommunityCode: string | null;
  communities: Record<string, Community>;
  subscribeCommunity: (code: string) => () => void;
  isCommunityLoaded: (code: string) => boolean;
  signIn: (input: SignInInput) => Promise<string | null>;
  signOut: () => Promise<void>;
  createCommunity: (
    input: CreateCommunityInput
  ) => Promise<{ code?: string; error?: string }>;
  updateCommunity: (code: string, patch: Partial<Community>) => Promise<void>;
  updateMemberContent: (code: string, content: string) => Promise<void>;
  deleteCommunity: (code: string) => Promise<void>;
  addAdmin: (code: string, admin: string) => Promise<string | null>;
  getCommunityAdmins: (code: string) => string[];
  getAdminContactEmail: (code: string) => string | null;
  subscribeAdminContact: (code: string, adminId?: string | null) => () => void;
  getPendingMembers: (code: string) => CommunityMember[];
  getActiveMembers: (code: string) => CommunityMember[];
  getCommunityContent: (code: string) => string;
  getMemberContent: (code: string) => string;
  getCommunity: (code: string) => Community | null;
  getMembershipFor: (code: string) => CommunityMember | null;
  requestMembership: (code: string) => Promise<string | null>;
  approveMembership: (code: string, userId: string) => Promise<string | null>;
  denyMembership: (code: string, userId: string) => Promise<string | null>;
  isMemberFor: (code: string) => boolean;
  isAdminFor: (code: string) => boolean;
};

const AppStateContext = createContext<AppState | null>(null);

const emptyStore: StoreData = {
  users: {},
  communities: {},
  communityMembers: {},
};

type CommunityStatus = "idle" | "loading" | "loaded" | "missing";

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreData>(emptyStore);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [communityStatus, setCommunityStatus] = useState<Record<string, CommunityStatus>>({});
  const [adminContacts, setAdminContacts] = useState<Record<string, string>>({});
  const [memberContentByCommunity, setMemberContentByCommunity] = useState<
    Record<string, string>
  >({});

  const currentUser = currentUserId ? store.users[currentUserId] : null;
  const communities = store.communities;
  const communityMembers = store.communityMembers;
  const signedIn = Boolean(currentUserId);
  const userName = currentUser?.email ? nameFromEmail(currentUser.email) : "Neighbor";
  const memberCommunityCode = currentUser?.memberCommunityCode ?? null;
  const pendingCommunityCode = currentUser?.pendingCommunityCode ?? null;
  const adminCommunityCode = useMemo(() => {
    if (!currentUserId) return null;
    const adminMembership = Object.values(communityMembers).find(
      (member) =>
        member.userId === currentUserId &&
        member.role === "admin" &&
        member.status === "active"
    );
    return adminMembership?.communityCode ?? null;
  }, [communityMembers, currentUserId]);

  const updateStore = useCallback(
    (updater: (prev: StoreData) => StoreData) => {
      setStore((prev) => updater(prev));
    },
    []
  );

  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const dataClient = useMemo(() => createFirebaseClient(), []);

  useEffect(() => {
    dataClient.connect();
    if (!dataClient.onAuthStateChanged) return;
    const unsubscribe = dataClient.onAuthStateChanged((userId) => {
      setCurrentUserId(userId);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [dataClient]);

  useEffect(() => {
    if (!currentUserId) return;
    if (!dataClient.subscribeUser) return;
    return dataClient.subscribeUser(currentUserId, (user) => {
      if (!user) return;
      updateStore((prev) => ({
        ...prev,
        users: {
          ...prev.users,
          [currentUserId]: user,
        },
      }));
    });
  }, [currentUserId, dataClient, updateStore]);

  useEffect(() => {
    if (!currentUserId || !memberCommunityCode) return;
    if (!dataClient.subscribeMembership) return;
    return dataClient.subscribeMembership(
      memberCommunityCode,
      currentUserId,
      (member) => {
        updateStore((prev) => {
          const nextMembers = { ...prev.communityMembers };
          const key = membershipKey(memberCommunityCode, currentUserId);
          if (member) {
            nextMembers[key] = member;
          } else {
            delete nextMembers[key];
          }
          return {
            ...prev,
            communityMembers: nextMembers,
          };
        });
      }
    );
  }, [currentUserId, dataClient, memberCommunityCode, updateStore]);

  const subscribeCommunity = useCallback(
    (code: string) => {
      const key = normalizeCode(code);
      if (!key) return () => {};
      setCommunityStatus((prev) => ({ ...prev, [key]: "loading" }));
      let unsubscribeMemberContent = () => {};
      let memberContentSubscribed = false;

      const clearMemberContent = () => {
        setMemberContentByCommunity((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      };

      const stopMemberContentSubscription = () => {
        if (!memberContentSubscribed) return;
        unsubscribeMemberContent();
        unsubscribeMemberContent = () => {};
        memberContentSubscribed = false;
        clearMemberContent();
      };

      const startMemberContentSubscription = () => {
        if (memberContentSubscribed) return;
        if (!currentUserId) return;
        memberContentSubscribed = true;
        unsubscribeMemberContent = dataClient.subscribeCommunityMemberContent(
          key,
          currentUserId,
          (content) => {
            setMemberContentByCommunity((prev) => {
              if (!content) {
                if (!(key in prev)) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
              }
              if (prev[key] === content) return prev;
              return {
                ...prev,
                [key]: content,
              };
            });
          }
        );
      };

      const unsubscribeCommunity = dataClient.subscribeCommunity(key, (community) => {
        updateStore((prev) => {
          const nextCommunities = { ...prev.communities };
          if (community) {
            nextCommunities[key] = community;
          } else {
            delete nextCommunities[key];
          }
          return {
            ...prev,
            communities: nextCommunities,
          };
        });
        setCommunityStatus((prev) => ({
          ...prev,
          [key]: community ? "loaded" : "missing",
        }));
      });

      const unsubscribeMembership = currentUserId
        ? dataClient.subscribeMembership(key, currentUserId, (member) => {
            updateStore((prev) => {
              const nextMembers = { ...prev.communityMembers };
              const id = membershipKey(key, currentUserId);
              if (member) {
                nextMembers[id] = member;
              } else {
                delete nextMembers[id];
              }
              return {
                ...prev,
                communityMembers: nextMembers,
              };
            });
            if (member?.status === "active") {
              startMemberContentSubscription();
            } else {
              stopMemberContentSubscription();
            }
          })
        : () => {
            clearMemberContent();
          };

      const shouldLoadMembers = adminCommunityCode === key;
      const unsubscribeMembers = shouldLoadMembers
        ? dataClient.subscribeCommunityMembers(key, (members) => {
            updateStore((prev) => {
              const nextMembers = { ...prev.communityMembers };
              Object.values(nextMembers).forEach((member) => {
                if (member.communityCode === key) {
                  delete nextMembers[membershipKey(member.communityCode, member.userId)];
                }
              });
              members.forEach((member) => {
                nextMembers[membershipKey(member.communityCode, member.userId)] = member;
              });
              return {
                ...prev,
                communityMembers: nextMembers,
              };
            });
          })
        : () => {};

      return () => {
        unsubscribeCommunity();
        unsubscribeMembership();
        unsubscribeMembers();
        stopMemberContentSubscription();
      };
    },
    [adminCommunityCode, currentUserId, dataClient, updateStore]
  );

  const isCommunityLoaded = useCallback(
    (code: string) => {
      const key = normalizeCode(code);
      if (!key) return false;
      const status = communityStatus[key];
      return status === "loaded" || status === "missing";
    },
    [communityStatus]
  );

  const signIn = async (input: SignInInput) => {
    const result = await dataClient.signIn(input);
    if (result.error) return result.error;
    if (result.userId) {
      setCurrentUserId(result.userId);
    }
    return null;
  };

  const signOut = async () => {
    await dataClient.signOut();
  };

  const createCommunity = async (input: CreateCommunityInput) => {
    if (!currentUserId) return { error: "User not signed in." };
    if (memberCommunityCode || pendingCommunityCode) {
      return { error: "You already belong to a block." };
    }
    const result = await dataClient.createCommunity({
      ...input,
      currentUserId,
    });
    return result;
  };

  const updateCommunity = async (code: string, patch: Partial<Community>) => {
    await dataClient.updateCommunity(code, patch);
  };

  const updateMemberContent = async (code: string, content: string) => {
    await dataClient.updateCommunityMemberContent(code, content);
  };

  const deleteCommunity = async (code: string) => {
    await dataClient.deleteCommunity(code, currentUserId ?? undefined);
  };

  const addAdmin = async (code: string, admin: string) => {
    const result = await dataClient.addAdmin(code, admin);
    return result.ok ? null : result.error ?? "Unable to add admin.";
  };

  const getCommunityAdmins = (code: string) => {
    const key = normalizeCode(code);
    if (!key) return [];
    return Object.values(communityMembers)
      .filter(
        (member) =>
          member.communityCode === key &&
          member.role === "admin" &&
          member.status === "active"
      )
      .map((member) => member.email)
      .sort();
  };

  const getAdminContactEmail = useCallback(
    (code: string) => {
      const key = normalizeCode(code);
      if (!key) return null;
      return adminContacts[key] ?? null;
    },
    [adminContacts]
  );

  const subscribeAdminContact = useCallback(
    (code: string, adminId?: string | null) => {
      const key = normalizeCode(code);
      if (!key || !adminId) return () => {};
      if (!dataClient.subscribeMembership) return () => {};
      return dataClient.subscribeMembership(key, adminId, (member) => {
        setAdminContacts((prev) => {
          if (!member || member.role !== "admin" || member.status !== "active") {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          }
          if (prev[key] === member.email) return prev;
          return {
            ...prev,
            [key]: member.email,
          };
        });
      });
    },
    [dataClient]
  );

  const getPendingMembers = (code: string) => {
    const key = normalizeCode(code);
    if (!key) return [];
    return Object.values(communityMembers)
      .filter(
        (member) => member.communityCode === key && member.status === "pending"
      )
      .sort((a, b) => a.email.localeCompare(b.email));
  };

  const getActiveMembers = (code: string) => {
    const key = normalizeCode(code);
    if (!key) return [];
    return Object.values(communityMembers)
      .filter(
        (member) => member.communityCode === key && member.status === "active"
      )
      .sort((a, b) => a.email.localeCompare(b.email));
  };

  const getCommunityContent = (code: string) => {
    const key = normalizeCode(code);
    return (
      communities[key]?.content ||
      "No block content yet. Ask a block admin to add resources."
    );
  };

  const getMemberContent = (code: string) => {
    const key = normalizeCode(code);
    return memberContentByCommunity[key] || DEFAULT_MEMBER_CONTENT;
  };

  const getCommunity = (code: string) => {
    const key = normalizeCode(code);
    return communities[key] ?? null;
  };

  const getMembershipFor = (code: string) => {
    const key = normalizeCode(code);
    if (!key || !currentUserId) return null;
    return communityMembers[membershipKey(key, currentUserId)] ?? null;
  };

  const requestMembership = async (code: string) => {
    if (!currentUserId) return "User not signed in.";
    const result = await dataClient.requestMembership(code, currentUserId);
    return result.ok ? null : result.error ?? "Unable to request membership.";
  };

  const approveMembership = async (code: string, userId: string) => {
    const result = await dataClient.approveMembership(code, userId);
    return result.ok ? null : result.error ?? "Unable to approve member.";
  };

  const denyMembership = async (code: string, userId: string) => {
    const result = await dataClient.denyMembership(code, userId);
    return result.ok ? null : result.error ?? "Unable to deny member.";
  };

  const isMemberFor = (code: string) => {
    const membership = getMembershipFor(code);
    return Boolean(membership && membership.status === "active");
  };

  const isAdminFor = (code: string) => {
    const membership = getMembershipFor(code);
    return Boolean(
      membership && membership.status === "active" && membership.role === "admin"
    );
  };

  return (
    <AppStateContext.Provider
      value={{
        signedIn,
        userName,
        adminCommunityCode,
        memberCommunityCode,
        pendingCommunityCode,
        communities,
        subscribeCommunity,
        isCommunityLoaded,
        signIn,
        signOut,
        createCommunity,
        updateCommunity,
        updateMemberContent,
        deleteCommunity,
        addAdmin,
        getCommunityAdmins,
        getAdminContactEmail,
        subscribeAdminContact,
        getPendingMembers,
        getActiveMembers,
        getCommunityContent,
        getMemberContent,
        getCommunity,
        getMembershipFor,
        requestMembership,
        approveMembership,
        denyMembership,
        isMemberFor,
        isAdminFor,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};
