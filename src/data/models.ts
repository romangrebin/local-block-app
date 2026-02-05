export type Community = {
  code: string;
  name: string;
  content: string;
};

export type User = {
  id: string;
  email: string;
  adminCommunityCode: string | null;
};

export type CommunityAdmin = {
  userId: string;
  communityCode: string;
  email: string;
};

export type StoreData = {
  users: Record<string, User>;
  communities: Record<string, Community>;
  communityAdmins: Record<string, CommunityAdmin>;
};
