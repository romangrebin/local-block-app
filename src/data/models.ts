export type Community = {
  code: string;
  name: string;
  content: string;
  admins: string[];
};

export type User = {
  id: string;
  email: string;
  adminCommunityCode: string | null;
};

export type StoreData = {
  users: Record<string, User>;
  communities: Record<string, Community>;
};
