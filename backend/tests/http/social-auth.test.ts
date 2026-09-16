import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { createApp } from "../../src/app";
import { OidcSocialTokenVerifier } from "../../src/infrastructure/auth/social-token-verifier";
import { createTestDependencies } from "../support/in-memory";

let privateKey: KeyLike;
let verifier: OidcSocialTokenVerifier;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: "test", alg: "RS256" }] });
  verifier = new OidcSocialTokenVerifier({ google: ["google-client"], apple: ["com.beautyconta.app"] }, { google: jwks, apple: jwks });
});
const nonce = "random-nonce-for-this-login";
async function token(provider = "google", overrides: Record<string, unknown> = {}, key = privateKey) {
  return new SignJWT({
    sub: "person-1", email: "marina@example.com", email_verified: true, name: "Marina",
    iss: provider === "apple" ? "https://appleid.apple.com" : "https://accounts.google.com",
    aud: provider === "apple" ? "com.beautyconta.app" : "google-client",
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    ...(provider === "apple" ? { nonce } : {}), ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: "test" }).sign(key);
}
function setup() {
  const deps = createTestDependencies();
  deps.socialTokens = verifier;
  return { deps, app: createApp(deps) };
}

describe("social authentication", () => {
  it.each(["google", "apple"])("creates a %s account and a usable session; subsequent logins keep the user", async provider => {
    const { app } = setup();
    const first = await request(app).post("/api/sessions/social").send({ provider, nonce, idToken: await token(provider) });
    expect(first.status).toBe(201);
    expect(first.body.user.name).toBe("Marina");
    const me = await request(app).get("/api/users/me").set("Authorization", `Bearer ${first.body.token}`);
    expect(me.status).toBe(200);
    // Apple may omit profile fields after the first consent. Subject stays authoritative.
    const second = await request(app).post("/api/sessions/social").send({ provider, nonce, idToken: await token(provider, { email: undefined, name: undefined }) });
    expect(second.status).toBe(201);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(JSON.stringify(first.body)).not.toContain("passwordHash");
  });

  it.each([
    { aud: "another-app" }, { iss: "https://attacker.example" }, { exp: 1 },
    { email_verified: false }, { sub: "" }, { exp: undefined },
  ])("rejects invalid claims: %j", async overrides => {
    const { app, deps } = setup();
    const response = await request(app).post("/api/sessions/social").send({ provider: "google", idToken: await token("google", overrides) });
    expect(response.status).toBe(401);
    expect(deps.users.items.size).toBe(0);
  });

  it("rejects forged signatures", async () => {
    const { app } = setup();
    const attacker = await generateKeyPair("RS256");
    const response = await request(app).post("/api/sessions/social").send({ provider: "google", idToken: await token("google", {}, attacker.privateKey) });
    expect(response.status).toBe(401);
  });

  it.each([undefined, "different-nonce-value"])("rejects missing/mismatched Apple nonce", async suppliedNonce => {
    const { app } = setup();
    const response = await request(app).post("/api/sessions/social").send({ provider: "apple", nonce: suppliedNonce, idToken: await token("apple") });
    expect(response.status).toBe(401);
  });

  it("requires the existing password before linking and preserves the existing account", async () => {
    const { app, deps } = setup();
    const original = await request(app).post("/api/users").send({ name: "Original", email: "marina@example.com", password: "correct-password" });
    const input = { provider: "google", idToken: await token() };
    expect((await request(app).post("/api/sessions/social").send(input)).status).toBe(409);
    expect((await request(app).post("/api/sessions/social").send({ ...input, existingPassword: "wrong" })).status).toBe(401);
    expect(deps.users.identities.size).toBe(0);
    const linked = await request(app).post("/api/sessions/social").send({ ...input, existingPassword: "correct-password" });
    expect(linked.status).toBe(201);
    expect(linked.body.user.id).toBe(original.body.user.id);
    expect(deps.users.items.size).toBe(1);
    expect((await request(app).post("/api/sessions/social").send(input)).status).toBe(201);
  });

  it("rejects deleted users and does not accept client-supplied email", async () => {
    const { app, deps } = setup();
    const input = { provider: "google", idToken: await token() };
    const first = await request(app).post("/api/sessions/social").send(input);
    deps.users.items.get(first.body.user.id)!.deletedAt = new Date();
    expect((await request(app).post("/api/sessions/social").send(input)).status).toBe(401);
    const missingEmail = await request(app).post("/api/sessions/social").send({
      provider: "google", email: "injected@example.com", idToken: await token("google", { sub: "new", email: undefined }),
    });
    expect(missingEmail.status).toBe(401);
  });

  it("fails closed without configured audiences and rejects Facebook", async () => {
    const { app, deps } = setup();
    deps.socialTokens = new OidcSocialTokenVerifier({ google: [], apple: [] });
    expect((await request(app).post("/api/sessions/social").send({ provider: "google", idToken: "anything" })).status).toBe(503);
    expect((await request(app).post("/api/sessions/social").send({ provider: "facebook", idToken: "anything" })).status).toBe(422);
  });
});
