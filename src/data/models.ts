export type Community = {
  code: string;
  name: string;
  content: string;
  memberContent?: string;
};

export type User = {
  id: string;
  email: string;
  memberCommunityCode: string | null;
  adminCommunityCode?: string | null;
};

export type CommunityRole = "member" | "admin";

export type CommunityMemberStatus = "pending" | "active";

export type CommunityMember = {
  userId: string;
  communityCode: string;
  email: string;
  role: CommunityRole;
  status: CommunityMemberStatus;
};

export type StoreData = {
  users: Record<string, User>;
  communities: Record<string, Community>;
  communityMembers: Record<string, CommunityMember>;
};
