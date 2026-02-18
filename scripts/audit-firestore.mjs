import fs from "fs";
import path from "path";
import process from "process";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DEFAULT_COMMUNITY_NAME = "New Block";
const DEFAULT_COMMUNITY_CONTENT =
  "## New Block\n\nAdd links, event info, and organizers here.";

const args = new Set(process.argv.slice(2));
const shouldFix = args.has("--fix");
const shouldPrune = args.has("--prune");
const verbose = args.has("--verbose");

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.join(process.cwd(), ".secrets/firebase-service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error(
    `Service account JSON not found. Expected at ${serviceAccountPath}.\n` +
      "Set FIREBASE_SERVICE_ACCOUNT or place the file in .secrets/"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const allowedCommunityFields = new Set([
  "code",
  "name",
  "content",
  "createdBy",
  "createdAt",
  "updatedAt",
]);
const deprecatedCommunityFields = new Set([
  "memberContent",
  "admins",
  "adminEmails",
  "communityAdmins",
  "communityMembers",
  "contactEmail",
]);

const allowedMemberFields = new Set([
  "userId",
  "communityCode",
  "email",
  "role",
  "status",
  "createdAt",
  "updatedAt",
]);
const deprecatedMemberFields = new Set(["isAdmin", "state"]);

const allowedUserFields = new Set([
  "email",
  "memberCommunityCode",
  "pendingCommunityCode",
  "createdAt",
  "updatedAt",
]);
const deprecatedUserFields = new Set(["adminCommunityCode"]);

const issues = [];
const updateQueue = new Map();

const logIssue = (issue) => {
  issues.push(issue);
  if (verbose) {
    console.log(`[${issue.type}] ${issue.path} - ${issue.message}`);
  }
};

const queueUpdate = (ref, data) => {
  const existing = updateQueue.get(ref.path) ?? { ref, data: {} };
  updateQueue.set(ref.path, {
    ref,
    data: { ...existing.data, ...data, updatedAt: FieldValue.serverTimestamp() },
  });
};

const queueDeleteField = (ref, field) => {
  const existing = updateQueue.get(ref.path) ?? { ref, data: {} };
  updateQueue.set(ref.path, {
    ref,
    data: {
      ...existing.data,
      [field]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  });
};

const batchCommit = async (updates) => {
  let applied = 0;
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach(({ ref, data }) => {
      batch.set(ref, data, { merge: true });
    });
    await batch.commit();
    applied += chunk.length;
  }
  return applied;
};

const normalizeCommunityCode = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const communitiesSnap = await db.collection("communities").get();
const usersSnap = await db.collection("users").get();
const membersSnap = await db.collectionGroup("members").get();

const communities = new Map();
communitiesSnap.forEach((doc) => {
  communities.set(doc.id, { id: doc.id, data: doc.data() });
});

const users = new Map();
usersSnap.forEach((doc) => {
  users.set(doc.id, { id: doc.id, data: doc.data() });
});

const membersByCommunity = new Map();
const membershipsByUser = new Map();
membersSnap.forEach((doc) => {
  const data = doc.data();
  const communityId = doc.ref.parent.parent?.id ?? null;
  const member = {
    id: doc.id,
    path: doc.ref.path,
    communityId,
    data,
  };
  if (communityId) {
    const list = membersByCommunity.get(communityId) ?? [];
    list.push(member);
    membersByCommunity.set(communityId, list);
  }
  const userId = data.userId ?? doc.id;
  if (userId) {
    const list = membershipsByUser.get(userId) ?? [];
    list.push(member);
    membershipsByUser.set(userId, list);
  }
});

// Community checks
communities.forEach(({ id, data }) => {
  const path = `communities/${id}`;
  const communityRef = db.collection("communities").doc(id);
  const code = normalizeCommunityCode(data.code);

  if (!code || code !== id) {
    logIssue({
      type: "community.code",
      path,
      message: `Expected code "${id}", found "${data.code ?? "missing"}".`,
      fix: true,
    });
    if (shouldFix) queueUpdate(communityRef, { code: id });
  }

  if (typeof data.name !== "string" || !data.name.trim()) {
    logIssue({
      type: "community.name",
      path,
      message: "Missing or invalid name.",
      fix: true,
    });
    if (shouldFix) queueUpdate(communityRef, { name: DEFAULT_COMMUNITY_NAME });
  }

  if (typeof data.content !== "string" || !data.content.trim()) {
    logIssue({
      type: "community.content",
      path,
      message: "Missing or invalid content.",
      fix: true,
    });
    if (shouldFix) queueUpdate(communityRef, { content: DEFAULT_COMMUNITY_CONTENT });
  }

  if (data.createdBy == null) {
    const members = membersByCommunity.get(id) ?? [];
    const admins = members
      .filter((member) => member.data.role === "admin" && member.data.status === "active")
      .sort((a, b) => {
        const aTime = a.data.createdAt?.toMillis?.() ?? 0;
        const bTime = b.data.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
    const candidate = admins[0]?.data.userId ?? admins[0]?.id ?? null;
    logIssue({
      type: "community.createdBy",
      path,
      message: "Missing createdBy.",
      fix: Boolean(candidate),
    });
    if (shouldFix && candidate) {
      queueUpdate(communityRef, { createdBy: candidate });
    }
  }

  Object.keys(data).forEach((field) => {
    if (allowedCommunityFields.has(field)) return;
    const isDeprecated = deprecatedCommunityFields.has(field);
    logIssue({
      type: isDeprecated ? "community.deprecatedField" : "community.extraField",
      path,
      message: `Unexpected field "${field}".`,
      fix: shouldPrune && isDeprecated,
    });
    if (shouldFix && shouldPrune && isDeprecated) {
      queueDeleteField(communityRef, field);
    }
  });
});

// Member checks
for (const doc of membersSnap.docs) {
  const data = doc.data();
  const communityId = doc.ref.parent.parent?.id ?? null;
  const path = doc.ref.path;
  const memberRef = doc.ref;
  const userId = data.userId ?? null;

  if (!communityId) {
    logIssue({
      type: "member.orphan",
      path,
      message: "Member doc missing community parent.",
      fix: false,
    });
    continue;
  }

  if (!userId || userId !== doc.id) {
    logIssue({
      type: "member.userId",
      path,
      message: `Expected userId "${doc.id}", found "${data.userId ?? "missing"}".`,
      fix: true,
    });
    if (shouldFix) queueUpdate(memberRef, { userId: doc.id });
  }

  const communityCode = normalizeCommunityCode(data.communityCode);
  if (!communityCode || communityCode !== communityId) {
    logIssue({
      type: "member.communityCode",
      path,
      message: `Expected communityCode "${communityId}", found "${data.communityCode ?? "missing"}".`,
      fix: true,
    });
    if (shouldFix) queueUpdate(memberRef, { communityCode: communityId });
  }

  if (typeof data.email !== "string" || !data.email.trim()) {
    logIssue({
      type: "member.email",
      path,
      message: "Missing or invalid email.",
      fix: false,
    });
    if (shouldFix && doc.id) {
      try {
        const userRecord = await auth.getUser(doc.id);
        if (userRecord.email) {
          queueUpdate(memberRef, { email: userRecord.email });
        }
      } catch {
        // ignore
      }
    }
  }

  if (data.role !== "admin" && data.role !== "member") {
    logIssue({
      type: "member.role",
      path,
      message: `Invalid role "${data.role ?? "missing"}".`,
      fix: false,
    });
  }

  if (data.status !== "active" && data.status !== "pending") {
    logIssue({
      type: "member.status",
      path,
      message: `Invalid status "${data.status ?? "missing"}".`,
      fix: false,
    });
  }

  if (data.status === "pending" && data.role !== "member") {
    logIssue({
      type: "member.pendingRole",
      path,
      message: "Pending members must have role=member.",
      fix: true,
    });
    if (shouldFix) queueUpdate(memberRef, { role: "member" });
  }

  if (data.role === "admin" && data.status === "pending") {
    logIssue({
      type: "member.adminPending",
      path,
      message: "Admin members must be active.",
      fix: true,
    });
    if (shouldFix) queueUpdate(memberRef, { status: "active" });
  }

  Object.keys(data).forEach((field) => {
    if (allowedMemberFields.has(field)) return;
    const isDeprecated = deprecatedMemberFields.has(field);
    logIssue({
      type: isDeprecated ? "member.deprecatedField" : "member.extraField",
      path,
      message: `Unexpected field "${field}".`,
      fix: shouldPrune && isDeprecated,
    });
    if (shouldFix && shouldPrune && isDeprecated) {
      queueDeleteField(memberRef, field);
    }
  });
}

// User checks
users.forEach(({ id, data }) => {
  const path = `users/${id}`;
  const userRef = db.collection("users").doc(id);
  const memberCommunityCode = normalizeCommunityCode(data.memberCommunityCode ?? null);
  const pendingCommunityCode = normalizeCommunityCode(data.pendingCommunityCode ?? null);

  if (typeof data.email !== "string" || !data.email.trim()) {
    logIssue({
      type: "user.email",
      path,
      message: "Missing or invalid email.",
      fix: false,
    });
  }

  const memberships = membershipsByUser.get(id) ?? [];
  const activeMemberships = memberships.filter(
    (member) => member.data.status === "active"
  );
  const pendingMemberships = memberships.filter(
    (member) => member.data.status === "pending"
  );

  if (memberCommunityCode && pendingCommunityCode) {
    logIssue({
      type: "user.memberPendingConflict",
      path,
      message: `Both memberCommunityCode (${memberCommunityCode}) and pendingCommunityCode (${pendingCommunityCode}) are set.`,
      fix: activeMemberships.length === 1,
    });
    if (shouldFix && activeMemberships.length === 1) {
      queueUpdate(userRef, { pendingCommunityCode: null });
    }
  }

  if (activeMemberships.length > 1) {
    logIssue({
      type: "user.multiActive",
      path,
      message: `User has ${activeMemberships.length} active memberships.`,
      fix: false,
    });
  }

  if (pendingMemberships.length > 1) {
    logIssue({
      type: "user.multiPending",
      path,
      message: `User has ${pendingMemberships.length} pending memberships.`,
      fix: false,
    });
  }

  if (activeMemberships.length === 1) {
    const activeCommunity = activeMemberships[0].communityId;
    if (activeCommunity && memberCommunityCode !== activeCommunity) {
      logIssue({
        type: "user.memberMismatch",
        path,
        message: `memberCommunityCode is "${memberCommunityCode ?? "missing"}" but active membership is "${activeCommunity}".`,
        fix: true,
      });
      if (shouldFix) queueUpdate(userRef, { memberCommunityCode: activeCommunity });
    }
  }

  if (pendingMemberships.length === 1) {
    const pendingCommunity = pendingMemberships[0].communityId;
    if (pendingCommunity && pendingCommunityCode !== pendingCommunity) {
      logIssue({
        type: "user.pendingMismatch",
        path,
        message: `pendingCommunityCode is "${pendingCommunityCode ?? "missing"}" but pending membership is "${pendingCommunity}".`,
        fix: true,
      });
      if (shouldFix) queueUpdate(userRef, { pendingCommunityCode: pendingCommunity });
    }
  }

  if (memberCommunityCode && !activeMemberships.some((m) => m.communityId === memberCommunityCode)) {
    logIssue({
      type: "user.memberStale",
      path,
      message: `memberCommunityCode is "${memberCommunityCode}" but no matching active membership exists.`,
      fix: true,
    });
    if (shouldFix) queueUpdate(userRef, { memberCommunityCode: null });
  }

  if (
    pendingCommunityCode &&
    !pendingMemberships.some((m) => m.communityId === pendingCommunityCode)
  ) {
    logIssue({
      type: "user.pendingStale",
      path,
      message: `pendingCommunityCode is "${pendingCommunityCode}" but no matching pending membership exists.`,
      fix: true,
    });
    if (shouldFix) queueUpdate(userRef, { pendingCommunityCode: null });
  }

  Object.keys(data).forEach((field) => {
    if (allowedUserFields.has(field)) return;
    const isDeprecated = deprecatedUserFields.has(field);
    logIssue({
      type: isDeprecated ? "user.deprecatedField" : "user.extraField",
      path,
      message: `Unexpected field "${field}".`,
      fix: shouldPrune && isDeprecated,
    });
    if (shouldFix && shouldPrune && isDeprecated) {
      queueDeleteField(userRef, field);
    }
  });
});

const issueCounts = issues.reduce((acc, issue) => {
  acc[issue.type] = (acc[issue.type] ?? 0) + 1;
  return acc;
}, {});

console.log("Firestore audit summary");
console.log(`- Communities: ${communities.size}`);
console.log(`- Members: ${membersSnap.size}`);
console.log(`- Users: ${users.size}`);
console.log(`- Issues: ${issues.length}`);
Object.entries(issueCounts).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`);
});

if (!verbose && issues.length) {
  console.log("\nRun with --verbose to print each issue.");
}

if (shouldFix) {
  const updates = Array.from(updateQueue.values());
  if (!updates.length) {
    console.log("\nNo fixes to apply.");
  } else {
    const applied = await batchCommit(updates);
    console.log(`\nApplied ${applied} updates.`);
  }
} else if (issues.some((issue) => issue.fix)) {
  console.log("\nRun with --fix to apply safe repairs.");
  if (issues.some((issue) => issue.type.includes("deprecatedField"))) {
    console.log("Add --prune to remove deprecated fields.");
  }
}
