export type AuthMode = "signin" | "signup";

export type SignInInput = {
  email: string;
  password: string;
  mode: AuthMode;
};

export type CreateCommunityInput = {
  code: string;
  name: string;
  content?: string;
};
