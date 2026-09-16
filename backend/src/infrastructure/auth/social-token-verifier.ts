import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { UnauthenticatedError } from "../../application/errors";
import type { SocialLoginInput, SocialTokenVerifier } from "../../application/ports/social-auth";

export class OidcSocialTokenVerifier implements SocialTokenVerifier {
  constructor(
    private readonly audiences: { google: string[]; apple: string[] },
    private readonly keys: Record<"google" | "apple", JWTVerifyGetKey> = {
      google: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
      apple: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    },
  ) {}

  async verify(input: SocialLoginInput) {
    if (!this.audiences[input.provider].length) {
      throw Object.assign(new Error("Este login está temporariamente indisponível. Use seu e-mail e senha."), { code: "gateway_not_configured" });
    }
    try {
      const { payload } = await jwtVerify(input.idToken, this.keys[input.provider], {
        issuer: input.provider === "apple" ? "https://appleid.apple.com" : ["https://accounts.google.com", "accounts.google.com"],
        audience: this.audiences[input.provider],
        algorithms: ["RS256"],
        requiredClaims: ["sub", "exp", "iat"],
      });
      if (!payload.sub || (input.provider === "apple" && (!input.nonce || payload.nonce !== input.nonce))) throw new Error("Invalid identity");
      const verified = payload.email_verified === true || payload.email_verified === "true";
      if (payload.email && !verified) throw new Error("Unverified email");
      return {
        subject: payload.sub,
        email: verified && typeof payload.email === "string" ? payload.email : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
      };
    } catch {
      throw new UnauthenticatedError("Não foi possível validar o login. Tente entrar novamente.");
    }
  }
}
