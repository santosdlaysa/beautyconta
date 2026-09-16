export type SocialProvider = "google" | "apple";
export type SocialLoginInput = {
  provider: SocialProvider;
  idToken: string;
  nonce?: string;
  name?: string;
  existingPassword?: string;
};
export type SocialIdentity = { subject: string; email?: string; name?: string };
export interface SocialTokenVerifier {
  verify(input: SocialLoginInput): Promise<SocialIdentity>;
}
