import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { Community, CommunityAdmin, User } from "../models";
import type { CreateCommunityInput, SignInInput } from "../types";
import { DEFAULT_COMMUNITY_CONTENT, DEFAULT_COMMUNITY_NAME } from "../constants";
import { normalizeCode, normalizeEmail } from "../normalize";
import {
  connectEmulators,
  getFirebaseAuth,
  getFirebaseDb,
} from "../firebase";
import type { AddAdminResult, CreateCommunityResult, DataClient, SignInResult } from "./types";

const ensureUserDoc = async (userId: string, email: string) => {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      email,
      adminCommunityCode: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};

export const createFirebaseClient = (): DataClient => ({
  kind: "firebase",
  connect: () => {
    connectEmulators();
  },
  onAuthStateChanged: (callback) => {
    const auth = getFirebaseAuth();
    return onFirebaseAuthStateChanged(auth, (user) => {
      callback(user ? user.uid : null);
    });
  },
  subscribeUser: (userId, callback) => {
    const db = getFirebaseDb();
    const userRef = doc(db, "users", userId);
    return onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data() as Omit<User, "id">;
      callback({
        id: userId,
        email: data.email ?? "",
        adminCommunityCode: data.adminCommunityCode ?? null,
      });
    });
  },
  subscribeCommunity: (code, callback) => {
    const key = normalizeCode(code);
    if (!key) {
      callback(null);
      return () => {};
    }
    const db = getFirebaseDb();
    const ref = doc(db, "communities", key);
    return onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data() as Community;
      callback({
        code: data.code,
        name: data.name,
        content: data.content,
      });
    });
  },
  subscribeAdminLink: (userId, callback) => {
    const db = getFirebaseDb();
    const ref = doc(db, "communityAdmins", userId);
    return onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data() as CommunityAdmin;
      callback({
        userId,
        communityCode: data.communityCode,
        email: data.email,
      });
    });
  },
  subscribeCommunityAdmins: (code, callback) => {
    const key = normalizeCode(code);
    if (!key) {
      callback([]);
      return () => {};
    }
    const db = getFirebaseDb();
    const adminsQuery = query(
      collection(db, "communityAdmins"),
      where("communityCode", "==", key)
    );
    return onSnapshot(adminsQuery, (snapshot) => {
      const admins: CommunityAdmin[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CommunityAdmin;
        admins.push({
          userId: docSnap.id,
          communityCode: data.communityCode,
          email: data.email,
        });
      });
      callback(admins);
    });
  },
  signIn: async (input: SignInInput): Promise<SignInResult> => {
    const email = normalizeEmail(input.email);
    if (!email) return { error: "Email is required." };
    if (!input.password) return { error: "Password is required." };

    const auth = getFirebaseAuth();
    try {
      if (input.mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, input.password);
        await ensureUserDoc(result.user.uid, email);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, input.password);
        await ensureUserDoc(result.user.uid, email);
      }
      return {};
    } catch {
      return { error: "Unable to sign in. Double-check your credentials." };
    }
  },
  signOut: async () => {
    await firebaseSignOut(getFirebaseAuth());
  },
  createCommunity: async (
    input: CreateCommunityInput & { currentUserId: string }
  ): Promise<CreateCommunityResult> => {
    const code = normalizeCode(input.code);
    if (!code) return { error: "Community code is required." };
    if (!input.currentUserId) return { error: "User not signed in." };

    const db = getFirebaseDb();
    const communityRef = doc(db, "communities", code);
    const communitySnap = await getDoc(communityRef);
    if (communitySnap.exists()) return { error: "Community already exists." };

    const userRef = doc(db, "users", input.currentUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { error: "User not found." };
    const userData = userSnap.data() as User;
    const userEmail = userData.email ?? "";
    if (!userEmail) return { error: "User email missing." };
    const adminRef = doc(db, "communityAdmins", input.currentUserId);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) return { error: "User already admins a community." };

    const nextCommunity: Community = {
      code,
      name: input.name.trim() || DEFAULT_COMMUNITY_NAME,
      content: input.content?.trim() || DEFAULT_COMMUNITY_CONTENT,
    };

    await setDoc(communityRef, {
      ...nextCommunity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(adminRef, {
      userId: input.currentUserId,
      communityCode: code,
      email: userEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { code };
  },
  updateCommunity: async (code, patch) => {
    const key = normalizeCode(code);
    if (!key) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, "communities", key), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },
  deleteCommunity: async (code, currentUserId) => {
    const key = normalizeCode(code);
    if (!key) return;
    const db = getFirebaseDb();
    await deleteDoc(doc(db, "communities", key));
    const adminsQuery = query(
      collection(db, "communityAdmins"),
      where("communityCode", "==", key)
    );
    const adminsSnap = await getDocs(adminsQuery);
    const docs = adminsSnap.docs;
    const currentAdminDoc = currentUserId
      ? docs.find((docSnap) => docSnap.id === currentUserId)
      : undefined;
    const otherDocs = currentAdminDoc
      ? docs.filter((docSnap) => docSnap.id !== currentUserId)
      : docs;

    for (const docSnap of otherDocs) {
      await deleteDoc(docSnap.ref);
    }
    if (currentAdminDoc) {
      await deleteDoc(currentAdminDoc.ref);
    }
  },
  addAdmin: async (code, adminEmail): Promise<AddAdminResult> => {
    const key = normalizeCode(code);
    const adminId = normalizeEmail(adminEmail);
    if (!key || !adminId) return { ok: false, error: "Enter a valid email." };
    const db = getFirebaseDb();
    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", adminId)
    );
    const usersSnap = await getDocs(usersQuery);
    if (usersSnap.empty) {
      return { ok: false, error: "That email hasn't signed in yet." };
    }
    if (usersSnap.docs.length > 1) {
      return { ok: false, error: "Multiple users found for that email." };
    }

    const userDoc = usersSnap.docs[0];
    const userId = userDoc.id;
    const adminRef = doc(db, "communityAdmins", userId);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      const data = adminSnap.data() as CommunityAdmin;
      if (data.communityCode !== key) {
        return { ok: false, error: "That user already admins another community." };
      }
      return { ok: true };
    }

    await setDoc(adminRef, {
      userId,
      communityCode: key,
      email: adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  },
});
