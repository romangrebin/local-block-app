import fs from "fs";
import path from "path";
import process from "process";

const root = process.cwd();

const readFile = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const firebaseJson = JSON.parse(readFile("firebase.json"));
const headers = firebaseJson?.hosting?.headers ?? [];
const allHeaders = headers.flatMap((entry) => entry.headers ?? []);

const getHeaderValue = (name) =>
  allHeaders.find((entry) => entry.key === name)?.value ?? "";

assert(getHeaderValue("X-Robots-Tag").includes("noindex"), "Missing X-Robots-Tag noindex header.");

const csp = getHeaderValue("Content-Security-Policy");
assert(Boolean(csp), "Missing Content-Security-Policy header.");
for (const requiredHost of [
  "https://content-firebaseappcheck.googleapis.com",
  "https://firebase.googleapis.com",
  "https://firestore.googleapis.com",
  "https://www.googletagmanager.com",
]) {
  assert(csp.includes(requiredHost), `CSP missing required host: ${requiredHost}`);
}

const robotsTxtPath = path.join(root, "public/robots.txt");
assert(fs.existsSync(robotsTxtPath), "Missing public/robots.txt.");
if (fs.existsSync(robotsTxtPath)) {
  const robots = readFile("public/robots.txt");
  assert(/Disallow:\s*\/\s*/.test(robots), "robots.txt should disallow crawling.");
}

const firestoreRules = readFile("firestore.rules");
assert(
  firestoreRules.includes("data.content.size() <= 10000"),
  "Firestore rules missing 10k content size guard."
);
assert(
  firestoreRules.includes("!request.resource.data.keys().hasAny([\"memberContent\"])"),
  "Firestore rules should block public memberContent writes."
);
assert(
  !firestoreRules.includes("\"memberContent\"\n      ]"),
  "Legacy memberContent key allowance still appears in community schema."
);

const workflowPath = ".github/workflows/deploy-hosting.yml";
assert(fs.existsSync(path.join(root, workflowPath)), "Missing deploy-hosting workflow.");
if (fs.existsSync(path.join(root, workflowPath))) {
  const workflow = readFile(workflowPath);
  assert(
    workflow.includes("VITE_FIREBASE_APPCHECK_SITE_KEY"),
    "Deploy workflow missing VITE_FIREBASE_APPCHECK_SITE_KEY."
  );
}

if (errors.length) {
  console.error("Security check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Security check passed.");
