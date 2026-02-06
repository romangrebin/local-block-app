import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Community, StoreData } from "../data/models";
import { normalizeCode, nameFromEmail } from "../data/normalize";
import { CreateCommunityInput, SignInInput } from "../data/types";
import { loadStore, saveStore } from "../data/store";
import {
  isFirebaseConfigured,
  isFirebaseEnabled,
} from "../data/firebase";
import { createFirebaseClient, createLocalClient } from "../data/client";

type AppState = {
  signedIn: boolean;
  userName: string;
  adminCommunityCode: string | null;
  communities: Record<string, Community>;
  firebaseEnabled: boolean;
  subscribeCommunity: (code: string) => () => void;
  isCommunityLoaded: (code: string) => boolean;
  signIn: (input: SignInInput) => Promise<string | null>;
  signOut: () => Promise<void>;
  createCommunity: (input: CreateCommunityInput) => Promise<string | null>;
  updateCommunity: (code: string, patch: Partial<Community>) => Promise<void>;
  deleteCommunity: (code: string) => Promise<void>;
  addAdmin: (code: string, admin: string) => Promise<string | null>;
  getCommunityAdmins: (code: string) => string[];
  getCommunityContent: (code: string) => string;
  getCommunity: (code: string) => Community | null;
  isAdminFor: (code: string) => boolean;
};

const AppStateContext = createContext<AppState | null>(null);

const emptyStore: StoreData = {
  users: {},
  communities: {},
  communityAdmins: {},
};

type CommunityStatus = "idle" | "loading" | "loaded" | "missing";

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const firebaseEnabled = isFirebaseEnabled() && isFirebaseConfigured();
  const [store, setStore] = useState<StoreData>(() =>
    firebaseEnabled ? emptyStore : loadStore()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [communityStatus, setCommunityStatus] = useState<Record<string, CommunityStatus>>({});

  const currentUser = currentUserId ? store.users[currentUserId] : null;
  const communities = store.communities;
  const communityAdmins = store.communityAdmins;
  const signedIn = firebaseEnabled ? Boolean(currentUserId) : Boolean(currentUserId && currentUser);
  const userName = currentUser?.email ? nameFromEmail(currentUser.email) : "Neighbor";
  const adminCommunityCode = currentUserId
    ? communityAdmins[currentUserId]?.communityCode ?? null
    : null;

  const updateStore = useCallback(
    (updater: (prev: StoreData) => StoreData) => {
      setStore((prev) => {
        const next = updater(prev);
        if (!firebaseEnabled && next !== prev) {
          saveStore(next);
        }
        return next;
      });
    },
    [firebaseEnabled]
  );

  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const getStore = useCallback(() => storeRef.current, []);

  const dataClient = useMemo(
    () =>
      firebaseEnabled
        ? createFirebaseClient()
        : createLocalClient({ getStore, updateStore }),
    [firebaseEnabled, getStore, updateStore]
  );

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
    if (dataClient.kind !== "firebase" || !dataClient.subscribeUser) return;
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
    if (!currentUserId || !dataClient.subscribeAdminLink) return;
    return dataClient.subscribeAdminLink(currentUserId, (adminLink) => {
      updateStore((prev) => {
        const nextAdmins = { ...prev.communityAdmins };
        if (adminLink) {
          nextAdmins[currentUserId] = adminLink;
        } else {
          delete nextAdmins[currentUserId];
        }
        return {
          ...prev,
          communityAdmins: nextAdmins,
        };
      });
    });
  }, [currentUserId, dataClient, updateStore]);

  const subscribeCommunity = useCallback(
    (code: string) => {
      const key = normalizeCode(code);
      if (!key) return () => {};
      setCommunityStatus((prev) => ({ ...prev, [key]: "loading" }));

      const unsubscribeCommunity = dataClient.subscribeCommunity(key, (community) => {
        if (dataClient.kind === "firebase") {
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
        }
        setCommunityStatus((prev) => ({
          ...prev,
          [key]: community ? "loaded" : "missing",
        }));
      });

      const shouldLoadAdmins =
        dataClient.kind === "local" || adminCommunityCode === key;
      const unsubscribeAdmins = shouldLoadAdmins
        ? dataClient.subscribeCommunityAdmins(key, (admins) => {
            updateStore((prev) => {
              const nextAdmins = { ...prev.communityAdmins };
              Object.values(nextAdmins).forEach((admin) => {
                if (admin.communityCode === key) {
                  delete nextAdmins[admin.userId];
                }
              });
              admins.forEach((admin) => {
                nextAdmins[admin.userId] = admin;
              });
              return {
                ...prev,
                communityAdmins: nextAdmins,
              };
            });
          })
        : () => {};

      return () => {
        unsubscribeCommunity();
        unsubscribeAdmins();
      };
    },
    [adminCommunityCode, dataClient, updateStore]
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
    if (dataClient.kind === "local") {
      setCurrentUserId(null);
    }
  };

  const createCommunity = async (input: CreateCommunityInput) => {
    if (!currentUserId) return null;
    if (adminCommunityCode) return null;
    const result = await dataClient.createCommunity({
      ...input,
      currentUserId,
    });
    return result.code ?? null;
  };

  const updateCommunity = async (code: string, patch: Partial<Community>) => {
    await dataClient.updateCommunity(code, patch);
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
    return Object.values(communityAdmins)
      .filter((admin) => admin.communityCode === key)
      .map((admin) => admin.email)
      .sort();
  };

  const getCommunityContent = (code: string) => {
    const key = normalizeCode(code);
    return (
      communities[key]?.content ||
      "No block content yet. Ask a block admin to add resources."
    );
  };

  const getCommunity = (code: string) => {
    const key = normalizeCode(code);
    return communities[key] ?? null;
  };

  const isAdminFor = (code: string) => {
    const key = normalizeCode(code);
    return key === adminCommunityCode;
  };

  return (
    <AppStateContext.Provider
      value={{
        signedIn,
        userName,
        adminCommunityCode,
        communities,
        firebaseEnabled,
        subscribeCommunity,
        isCommunityLoaded,
        signIn,
        signOut,
        createCommunity,
        updateCommunity,
        deleteCommunity,
        addAdmin,
        getCommunityAdmins,
        getCommunityContent,
        getCommunity,
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
