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
  writeBatch,
  where,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification as sendFirebaseEmailVerification,
  sendPasswordResetEmail as sendFirebasePasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as updateFirebasePassword,
} from "firebase/auth";
import type { Community, CommunityMember, User } from "../models";
import type { CreateCommunityInput, SignInInput } from "../types";
import {
  DEFAULT_COMMUNITY_CONTENT,
  DEFAULT_COMMUNITY_NAME,
  DEFAULT_MEMBER_CONTENT,
} from "../constants";
import { normalizeCode, normalizeEmail } from "../normalize";
import {
  connectEmulators,
  getFirebaseAuth,
  getFirebaseDb,
} from "../firebase";
import {
  checkRateLimit,
  formatRetryAfter,
  recordRateLimitEvent,
} from "../../security/rateLimit";
import type {
  AddAdminResult,
  AuthUser,
  CreateCommunityResult,
  DataClient,
  MembershipResult,
  SignInResult,
} from "./types";

const ensureUserDoc = async (userId: string, email: string) => {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      email,
      memberCommunityCode: null,
      pendingCommunityCode: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};

const getAuthEmail = () => {
  const auth = getFirebaseAuth();
  return auth.currentUser?.email ?? "";
};

const getAuthUserSnapshot = (): AuthUser | null => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return {
    userId: user.uid,
    email: user.email ?? "",
    emailVerified: user.emailVerified,
  };
};

const ensureAuthToken = async () => {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) return;
  try {
    await auth.currentUser.getIdToken(true);
  } catch {
    // Ignore token refresh errors; request will fail if auth is invalid.
  }
};

const memberContentRefFor = (communityCode: string) =>
  doc(getFirebaseDb(), "communities", communityCode, "private", "memberContent");

const getAuthActionSettings = () => {
  const configuredUrl = import.meta.env.VITE_FIREBASE_AUTH_ACTION_URL?.trim();
  const url =
    configuredUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/` : "");
  if (!url) return undefined;
  return {
    url,
    handleCodeInApp: false,
  };
};

const AUTH_WINDOW_MS = 10 * 60 * 1000;
const CREATE_COMMUNITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const REQUEST_MEMBERSHIP_WINDOW_MS = 60 * 60 * 1000;

export const createFirebaseClient = (): DataClient => ({
  kind: "firebase",
  connect: () => {
    connectEmulators();
  },
  onAuthStateChanged: (callback) => {
    const auth = getFirebaseAuth();
    return onFirebaseAuthStateChanged(auth, (user) => {
      callback(
        user
          ? {
              userId: user.uid,
              email: user.email ?? "",
              emailVerified: user.emailVerified,
            }
          : null
      );
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
        memberCommunityCode: data.memberCommunityCode ?? null,
        pendingCommunityCode: data.pendingCommunityCode ?? null,
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
        createdBy: data.createdBy,
      });
    });
  },
  subscribeMembership: (code, userId, callback) => {
    const key = normalizeCode(code);
    if (!key || !userId) {
      callback(null);
      return () => {};
    }
    const db = getFirebaseDb();
    const ref = doc(db, "communities", key, "members", userId);
    return onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data() as CommunityMember;
      callback({
        userId,
        communityCode: data.communityCode ?? key,
        email: data.email,
        role: data.role,
        status: data.status,
      });
    });
  },
  subscribeCommunityMembers: (code, callback) => {
    const key = normalizeCode(code);
    if (!key) {
      callback([]);
      return () => {};
    }
    const db = getFirebaseDb();
    const membersRef = collection(db, "communities", key, "members");
    return onSnapshot(membersRef, (snapshot) => {
      const members: CommunityMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CommunityMember;
        members.push({
          userId: docSnap.id,
          communityCode: data.communityCode ?? key,
          email: data.email,
          role: data.role,
          status: data.status,
        });
      });
      callback(members);
    });
  },
  subscribeCommunityMemberContent: (code, userId, callback) => {
    const key = normalizeCode(code);
    if (!key || !userId) {
      callback(null);
      return () => {};
    }
    const ref = memberContentRefFor(key);
    return onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }
        const raw = snapshot.data() as { content?: unknown };
        callback(typeof raw.content === "string" ? raw.content : null);
      },
      () => {
        callback(null);
      }
    );
  },
  signIn: async (input: SignInInput): Promise<SignInResult> => {
    const email = normalizeEmail(input.email);
    if (!email) return { error: "Email is required." };
    if (!input.password) return { error: "Password is required." };
    const signInRateKey = `auth:${input.mode}:${email}`;
    const signInRate = checkRateLimit(signInRateKey, 10, AUTH_WINDOW_MS);
    if (signInRate.blocked) {
      return {
        error: `Too many auth attempts. Try again in ${formatRetryAfter(signInRate.retryAfterMs)}.`,
      };
    }
    recordRateLimitEvent(signInRateKey, AUTH_WINDOW_MS);

    const auth = getFirebaseAuth();
    try {
      if (input.mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, input.password);
        await ensureUserDoc(result.user.uid, email);
        try {
          await sendFirebaseEmailVerification(result.user, getAuthActionSettings());
        } catch {
          // Verification email can be retried later from account settings.
        }
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
  requestPasswordReset: async (rawEmail) => {
    const auth = getFirebaseAuth();
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return { ok: false, error: "Enter a valid email first." };
    }
    try {
      await sendFirebasePasswordResetEmail(auth, email, getAuthActionSettings());
      return { ok: true };
    } catch (error) {
      const code = (error as { code?: string })?.code ?? "";
      if (code.includes("invalid-email")) {
        return { ok: false, error: "Enter a valid email first." };
      }
      // Keep response generic to avoid account enumeration.
      return { ok: true };
    }
  },
  sendVerificationEmail: async () => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "User not signed in." };
    try {
      await sendFirebaseEmailVerification(user, getAuthActionSettings());
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to send verification email right now." };
    }
  },
  refreshAuthUser: async () => {
    const auth = getFirebaseAuth();
    if (!auth.currentUser) return null;
    try {
      await auth.currentUser.reload();
    } catch {
      // Ignore reload failures and return current snapshot.
    }
    return getAuthUserSnapshot();
  },
  updatePassword: async (currentPassword, nextPassword) => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return { ok: false, error: "User not signed in." };
    const email = user.email ?? "";
    if (!email) return { ok: false, error: "User email missing." };
    if (!currentPassword || !nextPassword) {
      return { ok: false, error: "Both current and new passwords are required." };
    }
    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updateFirebasePassword(user, nextPassword);
      return { ok: true };
    } catch {
      return { ok: false, error: "Unable to update password. Check your current password." };
    }
  },
  createCommunity: async (
    input: CreateCommunityInput & { currentUserId: string }
  ): Promise<CreateCommunityResult> => {
    const code = normalizeCode(input.code);
    if (!code) return { error: "Block code is required." };
    if (!input.currentUserId) return { error: "User not signed in." };
    const createRateKey = `create-community:${input.currentUserId}`;
    const createRate = checkRateLimit(createRateKey, 3, CREATE_COMMUNITY_WINDOW_MS);
    if (createRate.blocked) {
      return {
        error: `Too many block creation attempts. Try again in ${formatRetryAfter(createRate.retryAfterMs)}.`,
      };
    }
    recordRateLimitEvent(createRateKey, CREATE_COMMUNITY_WINDOW_MS);

    await ensureAuthToken();
    const db = getFirebaseDb();
    const communityRef = doc(db, "communities", code);
    const communitySnap = await getDoc(communityRef);
    if (communitySnap.exists()) return { error: "Block already exists." };

    const userRef = doc(db, "users", input.currentUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { error: "User not found." };
    const userData = userSnap.data() as User;
    const authEmail = getAuthEmail();
    const userEmail = userData.email ?? "";
    const memberEmail = authEmail || userEmail;
    if (!userEmail) return { error: "User email missing." };
    if (!memberEmail) return { error: "Auth email missing." };
    const userCommunityCode =
      userData.memberCommunityCode ?? userData.pendingCommunityCode ?? null;
    if (userCommunityCode) {
      return { error: "User already belongs to a block." };
    }

    const nextCommunity: Community = {
      code,
      name: input.name.trim() || DEFAULT_COMMUNITY_NAME,
      content: input.content?.trim() || DEFAULT_COMMUNITY_CONTENT,
      createdBy: input.currentUserId,
    };

    try {
      await setDoc(communityRef, {
        ...nextCommunity,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to create community document", error);
      return { error: "Unable to create the block document." };
    }

    try {
      await setDoc(doc(db, "communities", code, "members", input.currentUserId), {
        userId: input.currentUserId,
        communityCode: code,
        email: memberEmail,
        role: "admin",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to create admin membership", {
        error,
        authEmail,
        userEmail,
      });
      return { error: "Unable to create the admin membership record." };
    }

    try {
      await setDoc(memberContentRefFor(code), {
        content: DEFAULT_MEMBER_CONTENT,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to initialize member-only content", {
        error,
        communityCode: code,
      });
      return { error: "Unable to initialize the member-only content." };
    }

    try {
      await updateDoc(userRef, {
        memberCommunityCode: code,
        pendingCommunityCode: null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update user membership", error);
      return { error: "Unable to update the user membership." };
    }

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
  updateCommunityMemberContent: async (code, content) => {
    const key = normalizeCode(code);
    if (!key) return;
    await setDoc(
      memberContentRefFor(key),
      {
        content,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
  deleteCommunity: async (code, currentUserId) => {
    const key = normalizeCode(code);
    if (!key) return;
    const db = getFirebaseDb();
    const membersRef = collection(db, "communities", key, "members");
    const membersSnap = await getDocs(membersRef);
    const adminId = currentUserId ?? "";
    const adminDoc = adminId
      ? membersSnap.docs.find((docSnap) => docSnap.id === adminId) ?? null
      : null;
    const deleteMemberAndClearUser = async (docSnap: typeof membersSnap.docs[number]) => {
      const data = docSnap.data() as CommunityMember;
      const userId = data.userId ?? docSnap.id;
      await deleteDoc(docSnap.ref);
      if (userId) {
        try {
          await updateDoc(doc(db, "users", userId), {
            memberCommunityCode: null,
            pendingCommunityCode: null,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error("Failed to clear user membership during delete", {
            error,
            userId,
            communityCode: key,
          });
        }
      }
    };

    for (const docSnap of membersSnap.docs) {
      if (adminId && docSnap.id === adminId) continue;
      await deleteMemberAndClearUser(docSnap);
    }

    if (adminId) {
      try {
        await updateDoc(doc(db, "users", adminId), {
          memberCommunityCode: null,
          pendingCommunityCode: null,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Failed to clear admin membership during delete", {
          error,
          userId: adminId,
          communityCode: key,
        });
      }
    }

    const communityRef = doc(db, "communities", key);
    try {
      await deleteDoc(communityRef);
    } catch (error) {
      console.error("Failed to delete community document", {
        error,
        communityCode: key,
      });
      return;
    }

    try {
      await deleteDoc(memberContentRefFor(key));
    } catch (error) {
      console.error("Failed to delete member-only content document", {
        error,
        communityCode: key,
      });
    }

    if (adminDoc) {
      try {
        await deleteDoc(adminDoc.ref);
      } catch (error) {
        console.error("Failed to delete admin membership document", {
          error,
          userId: adminId,
          communityCode: key,
        });
      }
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
    const userData = userDoc.data() as User;
    const userCommunityCode =
      userData.memberCommunityCode ?? userData.pendingCommunityCode ?? null;
    if (userCommunityCode && userCommunityCode !== key) {
      return { ok: false, error: "That user already belongs to another block." };
    }

    const memberRef = doc(db, "communities", key, "members", userId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const data = memberSnap.data() as CommunityMember;
      if (data.role === "admin" && data.status === "active") {
        return { ok: true };
      }
      await updateDoc(memberRef, {
        role: "admin",
        status: "active",
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(memberRef, {
        userId,
        communityCode: key,
        email: adminId,
        role: "admin",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (!userData.memberCommunityCode || userData.pendingCommunityCode === key) {
      await updateDoc(doc(db, "users", userId), {
        memberCommunityCode: key,
        pendingCommunityCode: null,
        updatedAt: serverTimestamp(),
      });
    }

    return { ok: true };
  },
  requestMembership: async (
    code: string,
    currentUserId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key) return { ok: false, error: "Community code is required." };
    if (!currentUserId) return { ok: false, error: "User not signed in." };
    const membershipRateKey = `request-membership:${currentUserId}:${key}`;
    const membershipRate = checkRateLimit(
      membershipRateKey,
      5,
      REQUEST_MEMBERSHIP_WINDOW_MS
    );
    if (membershipRate.blocked) {
      return {
        ok: false,
        error: `Too many membership requests. Try again in ${formatRetryAfter(membershipRate.retryAfterMs)}.`,
      };
    }
    recordRateLimitEvent(membershipRateKey, REQUEST_MEMBERSHIP_WINDOW_MS);

    await ensureAuthToken();
    const db = getFirebaseDb();
    const communitySnap = await getDoc(doc(db, "communities", key));
    if (!communitySnap.exists()) {
      return { ok: false, error: "Community not found." };
    }
    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { ok: false, error: "User not found." };
    const userData = userSnap.data() as User;
    const authEmail = getAuthEmail();
    const userEmail = userData.email ?? "";
    const memberEmail = authEmail || userEmail;
    if (!userEmail) return { ok: false, error: "User email missing." };
    if (!memberEmail) return { ok: false, error: "Auth email missing." };

    const userCommunityCode =
      userData.memberCommunityCode ?? userData.pendingCommunityCode ?? null;
    if (userCommunityCode && userCommunityCode !== key) {
      return { ok: false, error: "You already belong to another community." };
    }

    const memberRef = doc(db, "communities", key, "members", currentUserId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const existing = memberSnap.data() as CommunityMember;
      if (existing.status === "active") {
        return {
          ok: false,
          error:
            "You already have an active membership for this block. Ask an admin to resync your account.",
        };
      }
      if (existing.status === "pending") {
        return {
          ok: false,
          error: "Your request is already pending review.",
        };
      }
    } else {
      try {
        await setDoc(memberRef, {
          userId: currentUserId,
          communityCode: key,
          email: memberEmail,
          role: "member",
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Failed to create pending membership", {
          error,
          authEmail,
          userEmail,
          debug: {
            currentUserId,
            communityId: key,
            memberRef: memberRef.path,
            userCommunityCode,
            memberCommunityCode: userData.memberCommunityCode ?? null,
            pendingCommunityCode: userData.pendingCommunityCode ?? null,
            communityExists: communitySnap.exists(),
          },
        });
        return { ok: false, error: "Unable to create the membership request." };
      }
    }

    if (!userData.memberCommunityCode && userData.pendingCommunityCode !== key) {
      try {
        await updateDoc(userRef, {
          pendingCommunityCode: key,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Failed to update pending community code", error);
        return { ok: false, error: "Unable to update the pending request." };
      }
    }

    return { ok: true };
  },
  leaveCommunity: async (
    code: string,
    currentUserId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key) return { ok: false, error: "Community code is required." };
    if (!currentUserId) return { ok: false, error: "User not signed in." };

    await ensureAuthToken();
    const db = getFirebaseDb();
    const memberRef = doc(db, "communities", key, "members", currentUserId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      return { ok: false, error: "Membership not found." };
    }

    const userRef = doc(db, "users", currentUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { ok: false, error: "User not found." };
    }

    const batch = writeBatch(db);
    batch.delete(memberRef);
    batch.update(userRef, {
      memberCommunityCode: null,
      pendingCommunityCode: null,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      return { ok: true };
    } catch (error) {
      console.error("Failed to leave community", {
        error,
        communityCode: key,
        userId: currentUserId,
      });
      return { ok: false, error: "Unable to leave the block right now." };
    }
  },
  approveMembership: async (
    code: string,
    userId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key || !userId) return { ok: false, error: "Missing member." };
    const db = getFirebaseDb();
    const memberRef = doc(db, "communities", key, "members", userId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      return { ok: false, error: "Membership not found." };
    }
    await updateDoc(memberRef, {
      status: "active",
      updatedAt: serverTimestamp(),
    });
    try {
      await updateDoc(doc(db, "users", userId), {
        memberCommunityCode: key,
        pendingCommunityCode: null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update approved user membership", {
        error,
        userId,
        communityCode: key,
      });
      return { ok: false, error: "Unable to update the member status." };
    }
    return { ok: true };
  },
  denyMembership: async (
    code: string,
    userId: string
  ): Promise<MembershipResult> => {
    const key = normalizeCode(code);
    if (!key || !userId) return { ok: false, error: "Missing member." };
    const db = getFirebaseDb();
    const memberRef = doc(db, "communities", key, "members", userId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      return { ok: false, error: "Membership not found." };
    }
    const memberData = memberSnap.data() as CommunityMember;
    await deleteDoc(memberRef);
    const userPatch: Partial<User> = {
      updatedAt: serverTimestamp(),
    };
    if (memberData.status === "active") {
      userPatch.memberCommunityCode = null;
    } else {
      userPatch.pendingCommunityCode = null;
    }
    try {
      await updateDoc(doc(db, "users", userId), userPatch);
    } catch (error) {
      console.error("Failed to clear user membership", {
        error,
        userId,
        communityCode: key,
        status: memberData.status,
      });
      return { ok: false, error: "Unable to update the member record." };
    }
    return { ok: true };
  },
});
