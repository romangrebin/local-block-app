import { normalizeCode } from "./normalize";

export const membershipKey = (communityCode: string, userId: string) =>
  `${normalizeCode(communityCode)}::${userId}`;
