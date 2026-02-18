import fs from "fs";
import path from "path";
import process from "process";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DEFAULT_MEMBER_CONTENT =
  "### Member-only updates\n\nShare private notes for verified neighbors here.";

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

const seedPath =
  process.env.SEED_PATH || path.join(process.cwd(), "src/data/db.json");

if (!fs.existsSync(seedPath)) {
  console.error(`Seed JSON not found at ${seedPath}.`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const communities = seed.communities ?? {};
const communityValues = Object.values(communities);

if (!communityValues.length) {
  console.log("No communities found in seed file.");
  process.exit(0);
}

const batch = db.batch();
communityValues.forEach((community) => {
  if (!community?.code) return;
  const ref = db.collection("communities").doc(community.code);
  batch.set(
    ref,
    {
      code: community.code,
      name: community.name,
      content: community.content,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    ref.collection("private").doc("memberContent"),
    {
      content: community.memberContent ?? DEFAULT_MEMBER_CONTENT,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});

await batch.commit();
console.log(`Seeded ${communityValues.length} communities.`);

const auth = getAuth();
const memberLinks = seed.communityMembers ?? seed.communityAdmins ?? {};
const memberValues = Object.values(memberLinks);

if (!memberValues.length) {
  console.log("No community member links found in seed file.");
  process.exit(0);
}

let seededMembers = 0;
for (const member of memberValues) {
  const email = member?.email ?? member?.userId;
  const communityCode = member?.communityCode;
  if (!email || !communityCode) continue;
  try {
    const userRecord = await auth.getUserByEmail(email);
    const memberRef = db
      .collection("communities")
      .doc(communityCode)
      .collection("members")
      .doc(userRecord.uid);
    await memberRef.set(
      {
        userId: userRecord.uid,
        communityCode,
        email: userRecord.email ?? email,
        role: member?.role ?? "admin",
        status: member?.status ?? "active",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(
        {
          email: userRecord.email ?? email,
          memberCommunityCode: communityCode,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    seededMembers += 1;
  } catch (error) {
    console.log(`Skipping member ${email} (user not found).`);
  }
}

console.log(`Seeded ${seededMembers} community members.`);
