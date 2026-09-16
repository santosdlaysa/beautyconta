import { ConflictError, UnauthenticatedError } from "../errors";
import type { Dependencies } from "../ports/dependencies";
import type { SocialLoginInput } from "../ports/social-auth";
import { verifyPassword } from "../../domain/auth/password";
import { normalizeEmail } from "./accounts";

export class SocialLogin {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: SocialLoginInput) {
    const identity = await this.deps.socialTokens.verify(input);
    const key = { provider: input.provider, subject: identity.subject };
    const linked = await this.deps.users.findBySocialIdentity(key);
    if (linked) {
      if (linked.deletedAt) throw new UnauthenticatedError();
      return linked;
    }
    if (!identity.email) throw new UnauthenticatedError("Autorize o compartilhamento do e-mail para criar sua conta.");
    const email = normalizeEmail(identity.email);
    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      if (!input.existingPassword) throw new ConflictError("Já existe uma conta com este e-mail. Confirme sua senha para vincular este login.");
      const credentials = await this.deps.users.findCredentialsByEmail(email);
      if (existing.deletedAt || !await verifyPassword(input.existingPassword, credentials?.passwordHash ?? null)) {
        throw new UnauthenticatedError("A senha da conta não confere.");
      }
      await this.deps.users.linkSocialIdentity(existing.id, key);
      return existing;
    }
    const user = await this.deps.users.createSocial({
      ...key, email,
      name: (identity.name || input.name || "Profissional").trim().slice(0, 120) || "Profissional",
    });
    await this.deps.notifier.notify({ kind: "new_user", name: user.name, email: user.email });
    return user;
  }
}
