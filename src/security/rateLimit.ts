type RateLimitResult = {
  blocked: boolean;
  retryAfterMs: number;
};

const PREFIX = "lb_rate_limit";
const memoryStore = new Map<string, number[]>();

const getStorageKey = (key: string) => `${PREFIX}:${key}`;

const nowMs = () => Date.now();

const getTimestamps = (key: string): number[] => {
  const storageKey = getStorageKey(key);
  if (typeof window === "undefined") return memoryStore.get(storageKey) ?? [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value) => Number.isFinite(value));
  } catch {
    return memoryStore.get(storageKey) ?? [];
  }
};

const setTimestamps = (key: string, values: number[]) => {
  const storageKey = getStorageKey(key);
  if (typeof window === "undefined") {
    memoryStore.set(storageKey, values);
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    memoryStore.set(storageKey, values);
  }
};

export const checkRateLimit = (
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult => {
  const now = nowMs();
  const threshold = now - windowMs;
  const recent = getTimestamps(key).filter((value) => value >= threshold);
  if (recent.length < maxAttempts) {
    return { blocked: false, retryAfterMs: 0 };
  }
  const oldest = recent[0];
  return {
    blocked: true,
    retryAfterMs: Math.max(0, oldest + windowMs - now),
  };
};

export const recordRateLimitEvent = (
  key: string,
  windowMs: number
) => {
  const now = nowMs();
  const threshold = now - windowMs;
  const recent = getTimestamps(key).filter((value) => value >= threshold);
  recent.push(now);
  setTimestamps(key, recent);
};

export const formatRetryAfter = (ms: number) => {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
};

