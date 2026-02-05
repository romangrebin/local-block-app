import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  setDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { Community, StoreData, User } from "../data/models";
import { loadStore, saveStore } from "../data/store";
import {
  connectEmulators,
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseConfigured,
  isFirebaseEnabled,
} from "../data/firebase";

const normalizeCode = (code: string) => code.trim().toLowerCase();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const nameFromEmail = (email: string) => email.split("@")[0] || "Neighbor";

export type AuthMode = "signin" | "signup";

export type SignInInput = {
  email: string;
  password: string;
  mode: AuthMode;
};

type AppState = {
  signedIn: boolean;
  userName: string;
  adminCommunityCode: string | null;
  communities: Record<string, Community>;
  communitiesLoaded: boolean;
  firebaseEnabled: boolean;
  signIn: (input: SignInInput) => Promise<string | null>;
  signOut: () => Promise<void>;
  createCommunity: (input: { code: string; name: string; content?: string }) => Promise<string | null>;
  updateCommunity: (code: string, patch: Partial<Community>) => Promise<void>;
  deleteCommunity: (code: string) => Promise<void>;
  addAdmin: (code: string, admin: string) => Promise<void>;
  getCommunityContent: (code: string) => string;
  getCommunity: (code: string) => Community | null;
  isAdminFor: (code: string) => boolean;
};

const AppStateContext = createContext<AppState | null>(null);

const emptyStore: StoreData = {
  users: {},
  communities: {},
};

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const firebaseEnabled = isFirebaseEnabled() && isFirebaseConfigured();
  const [store, setStore] = useState<StoreData>(() =>
    firebaseEnabled ? emptyStore : loadStore()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [communitiesLoaded, setCommunitiesLoaded] = useState(!firebaseEnabled);

  const currentUser = currentUserId ? store.users[currentUserId] : null;
  const communities = store.communities;
  const signedIn = firebaseEnabled ? Boolean(currentUserId) : Boolean(currentUserId && currentUser);
  const userName = currentUser?.email ? nameFromEmail(currentUser.email) : "Neighbor";
  const firebaseAdminCode =
    firebaseEnabled && currentUser?.email
      ? Object.values(communities).find((community) =>
          community.admins.includes(currentUser.email)
        )?.code ?? null
      : null;
  const adminCommunityCode = firebaseAdminCode ?? currentUser?.adminCommunityCode ?? null;

  const updateStore = (updater: (prev: StoreData) => StoreData) => {
    setStore((prev) => {
      const next = updater(prev);
      if (!firebaseEnabled && next !== prev) {
        saveStore(next);
      }
      return next;
    });
  };

  const ensureUserDoc = async (userId: string, email: string) => {
    const db = getFirebaseDb();
    const userRef = doc(db, "users", userId);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  useEffect(() => {
    if (!firebaseEnabled) return;
    connectEmulators();

    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    const unsubscribeCommunities = onSnapshot(collection(db, "communities"), (snapshot) => {
      const nextCommunities: Record<string, Community> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Community;
        if (!data?.code) return;
        nextCommunities[data.code] = {
          code: data.code,
          name: data.name,
          content: data.content,
          admins: data.admins ?? [],
        };
      });
      updateStore((prev) => ({
        ...prev,
        communities: nextCommunities,
      }));
      setCommunitiesLoaded(true);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
      } else {
        setCurrentUserId(null);
      }
    });

    return () => {
      unsubscribeCommunities();
      unsubscribeAuth();
    };
  }, [firebaseEnabled]);

  useEffect(() => {
    if (!firebaseEnabled || !currentUserId) return;
    const db = getFirebaseDb();
    const userRef = doc(db, "users", currentUserId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as Omit<User, "id">;
      updateStore((prev) => ({
        ...prev,
        users: {
          ...prev.users,
          [currentUserId]: {
            id: currentUserId,
            email: data.email ?? "",
            adminCommunityCode: data.adminCommunityCode ?? null,
          },
        },
      }));
    });

    return () => unsubscribe();
  }, [firebaseEnabled, currentUserId]);

  const signIn = async (input: SignInInput) => {
    const email = normalizeEmail(input.email);
    if (!email) return "Email is required.";
    if (!input.password) return "Password is required.";

    if (!firebaseEnabled) {
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
      setCurrentUserId(email);
      return null;
    }

    const auth = getFirebaseAuth();
    try {
      if (input.mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, input.password);
        await ensureUserDoc(result.user.uid, email);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, input.password);
        await ensureUserDoc(result.user.uid, email);
      }
      return null;
    } catch (error) {
      return "Unable to sign in. Double-check your credentials.";
    }
  };

  const signOut = async () => {
    if (!firebaseEnabled) {
      setCurrentUserId(null);
      return;
    }
    await firebaseSignOut(getFirebaseAuth());
  };

  const createCommunity = async (input: { code: string; name: string; content?: string }) => {
    const code = normalizeCode(input.code);
    if (!code || !currentUserId) return null;

    if (!firebaseEnabled) {
      if (store.communities[code]) return null;
      const current = store.users[currentUserId];
      if (!current || current.adminCommunityCode) return null;
      let created = false;

      updateStore((prev) => {
        if (prev.communities[code]) return prev;
        const current = prev.users[currentUserId];
        if (!current || current.adminCommunityCode) return prev;
        created = true;

        const nextCommunity: Community = {
          code,
          name: input.name.trim() || "New Community",
          content:
            input.content?.trim() ||
            "## New Community\n\nAdd links, event info, and organizers here.",
          admins: [current.email],
        };

        const nextUser: User = {
          ...current,
          adminCommunityCode: code,
        };

        return {
          ...prev,
          communities: {
            ...prev.communities,
            [code]: nextCommunity,
          },
          users: {
            ...prev.users,
            [currentUserId]: nextUser,
          },
        };
      });

      return created ? code : null;
    }

    const db = getFirebaseDb();
    const communityRef = doc(db, "communities", code);
    const communitySnap = await getDoc(communityRef);
    if (communitySnap.exists()) return null;

    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const userData = userSnap.data() as User;
    const userEmail = userData.email ?? "";
    if (!userEmail) return null;

    const existingAdminQuery = query(
      collection(db, "communities"),
      where("admins", "array-contains", userEmail)
    );
    const existingAdminSnapshot = await getDocs(existingAdminQuery);
    if (!existingAdminSnapshot.empty) return null;

    const nextCommunity: Community = {
      code,
      name: input.name.trim() || "New Community",
      content:
        input.content?.trim() ||
        "## New Community\n\nAdd links, event info, and organizers here.",
      admins: [userEmail],
    };

    await setDoc(communityRef, {
      ...nextCommunity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return code;
  };

  const updateCommunity = async (code: string, patch: Partial<Community>) => {
    const key = normalizeCode(code);
    if (!firebaseEnabled) {
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
      return;
    }

    const db = getFirebaseDb();
    await updateDoc(doc(db, "communities", key), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteCommunity = async (code: string) => {
    const key = normalizeCode(code);
    if (!firebaseEnabled) {
      updateStore((prev) => {
        if (!prev.communities[key]) return prev;
        const nextCommunities = { ...prev.communities };
        delete nextCommunities[key];

        const nextUsers: Record<string, User> = {};
        Object.entries(prev.users).forEach(([id, user]) => {
          if (user.adminCommunityCode === key) {
            nextUsers[id] = { ...user, adminCommunityCode: null };
          } else {
            nextUsers[id] = user;
          }
        });

        return {
          ...prev,
          communities: nextCommunities,
          users: nextUsers,
        };
      });
      return;
    }

    const db = getFirebaseDb();
    await deleteDoc(doc(db, "communities", key));
  };

  const addAdmin = async (code: string, admin: string) => {
    const key = normalizeCode(code);
    const adminId = normalizeEmail(admin);
    if (!adminId) return;

    if (!firebaseEnabled) {
      updateStore((prev) => {
        const current = prev.communities[key];
        if (!current) return prev;
        if (current.admins.includes(adminId)) return prev;

        const existing = prev.users[adminId];
        if (existing?.adminCommunityCode && existing.adminCommunityCode !== key) {
          return prev;
        }

        const nextUser: User = existing ?? {
          id: adminId,
          email: adminId,
          adminCommunityCode: null,
        };

        const updatedUser = {
          ...nextUser,
          adminCommunityCode: nextUser.adminCommunityCode ?? key,
        };

        return {
          ...prev,
          communities: {
            ...prev.communities,
            [key]: {
              ...current,
              admins: [...current.admins, adminId],
            },
          },
          users: {
            ...prev.users,
            [adminId]: updatedUser,
          },
        };
      });
      return;
    }

    const db = getFirebaseDb();
    const existingAdminQuery = query(
      collection(db, "communities"),
      where("admins", "array-contains", adminId)
    );
    const existingAdminSnapshot = await getDocs(existingAdminQuery);
    if (!existingAdminSnapshot.empty) {
      const alreadyAdminElsewhere = existingAdminSnapshot.docs.some(
        (docSnap) => docSnap.id !== key
      );
      if (alreadyAdminElsewhere) return;
    }

    await updateDoc(doc(db, "communities", key), {
      admins: arrayUnion(adminId),
      updatedAt: serverTimestamp(),
    });
  };

  const getCommunityContent = (code: string) => {
    const key = normalizeCode(code);
    return (
      communities[key]?.content ||
      "No community content yet. Ask a neighbor to add resources."
    );
  };

  const getCommunity = (code: string) => {
    const key = normalizeCode(code);
    return communities[key] ?? null;
  };

  const isAdminFor = (code: string) => normalizeCode(code) === adminCommunityCode;

  const value = useMemo<AppState>(
    () => ({
      signedIn,
      userName,
      adminCommunityCode,
      communities,
      communitiesLoaded,
      firebaseEnabled,
      signIn,
      signOut,
      createCommunity,
      updateCommunity,
      deleteCommunity,
      addAdmin,
      getCommunityContent,
      getCommunity,
      isAdminFor,
    }),
    [
      signedIn,
      userName,
      adminCommunityCode,
      communities,
      communitiesLoaded,
      firebaseEnabled,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};

export const toCommunitySlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
