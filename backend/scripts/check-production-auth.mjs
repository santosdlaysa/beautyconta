import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = 'https://beautyconta.onrender.com';
const account = { name: 'BeautyConta QA', email: `qa-${randomUUID()}@example.invalid`, password: randomUUID() };
let cleanupToken;
async function call(path, method, expected, body, token) {
  const response = await fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(120000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, expected, `${method} ${path}: HTTP ${response.status}`);
  console.log(`${method} ${path}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

try {
  const preflight = await fetch(`${base}/api/sessions`, {
    method: 'OPTIONS', signal: AbortSignal.timeout(120000),
    headers: { origin: 'https://beautyconta.vercel.app', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,authorization' },
  });
  assert.ok(preflight.ok);
  const corsOk = preflight.headers.get('access-control-allow-origin') === 'https://beautyconta.vercel.app';
  console.log(`HTTPS: OK / CORS: ${corsOk ? 'OK' : 'FALHOU'}`);
  if (!corsOk) process.exitCode = 1;
  cleanupToken = (await call('/api/users', 'POST', 201, account)).token;
  assert.ok(cleanupToken);
  await call('/api/users/me', 'GET', 200, undefined, cleanupToken);
  const session = await call('/api/sessions', 'POST', 201, account);
  assert.ok(session.token);
  await call('/api/sessions/current', 'DELETE', 204, undefined, session.token);
  await call('/api/users/me', 'GET', 401, undefined, session.token);
  const again = await call('/api/sessions', 'POST', 201, account);
  assert.ok(again.token);
  await call('/api/users/me', 'GET', 200, undefined, again.token);
  console.log('Cadastro, login, logout, novo login: OK (API; não valida interface iPad).');
} finally {
  if (cleanupToken) await call('/api/users/me', 'DELETE', 204, undefined, cleanupToken);
}
