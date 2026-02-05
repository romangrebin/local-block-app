export const normalizeCode = (code: string) => code.trim().toLowerCase();

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const nameFromEmail = (email: string) => email.split("@")[0] || "Neighbor";

export const toCommunitySlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
