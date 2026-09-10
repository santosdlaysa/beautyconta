import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, PUT, DELETE } from "../src/app/api/admin/[...path]/route";
import { adminApi, AdminAuthError, clearSecret, loadSecret, saveSecret, hasSecret, subscribeToSecret } from "../src/infrastructure/admin/gateway";

vi.mock("@/config/api", () => ({ API_URL: "https://api.exemplo.test" }));
afterEach(() => {
  clearSecret();
  vi.unstubAllGlobals();
});

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("transporte administrativo pela origem do site", () => {
  it("encaminha overview e sua credencial sem repassar cookies do site ou guardar resposta em cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ users: { total: 4 } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://site.exemplo.test/api/admin/overview", {
      headers: { "x-admin-secret": "segredo-de-teste", cookie: "sessao-do-site=privada" },
    }), context(["overview"]));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.exemplo.test/api/admin/overview");
    expect(init.headers.get("x-admin-secret")).toBe("segredo-de-teste");
    expect(init.headers.has("cookie")).toBe(false);
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ users: { total: 4 } });
  });

  it("mantém o 401 da API e não acrescenta credenciais ausentes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: "Acesso restrito." }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("https://site.exemplo.test/api/admin/overview"), context(["overview"]));
    expect(response.status).toBe(401);
    expect(fetchMock.mock.calls[0][1].headers.has("x-admin-secret")).toBe(false);
  });

  it("preserva corpo da edição, filtros e resposta vazia de exclusão", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({ priceCents: 1490 });
    await PUT(new Request("https://site.exemplo.test/api/admin/plans", { method: "PUT", body }), context(["plans"]));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", body });
    const deleted = await DELETE(new Request("https://site.exemplo.test/api/admin/plans/PREMIUM/MONTHLY", { method: "DELETE" }), context(["plans", "PREMIUM", "MONTHLY"]));
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    await GET(new Request("https://site.exemplo.test/api/admin/users?search=Ana&limit=10"), context(["users"]));
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.exemplo.test/api/admin/users?search=Ana&limit=10");
  });

  it("devolve erro legível quando o servidor não responde", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const response = await GET(new Request("https://site.exemplo.test/api/admin/overview"), context(["overview"]));
    expect(response.status).toBe(502);
    expect((await response.json()).message).toContain("Tente novamente");
  });

  it("recusa caminhos fora do namespace administrativo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("https://site.exemplo.test/api/admin/overview"), context(["..", "users"]));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("validação antes de abrir o painel", () => {
  it("continua usando o segredo validado quando o navegador recusa a gravação", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => "segredo-antigo",
      setItem: () => { throw new Error("Armazenamento bloqueado"); },
      removeItem: () => { throw new Error("Armazenamento bloqueado"); },
    });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const valid = new Headers(init.headers).get("x-admin-secret") === "segredo-validado";
      return Response.json(valid ? { users: { total: 4 } } : { message: "Acesso restrito." }, { status: valid ? 200 : 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await adminApi.verifySecret("segredo-validado");
    saveSecret("segredo-validado");
    await expect(adminApi.overview()).resolves.toEqual({ users: { total: 4 } });
    expect(hasSecret()).toBe(true);
    expect(fetchMock.mock.calls[1][1].cache).toBe("no-store");

    clearSecret();
    expect(loadSecret()).toBeNull();
    expect(hasSecret()).toBe(false);
    await expect(adminApi.overview()).rejects.toBeInstanceOf(AdminAuthError);
  });

  it("mantém a sessão quando tanto leitura quanto gravação do armazenamento falham", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("Armazenamento bloqueado"); },
      setItem: () => { throw new Error("Armazenamento bloqueado"); },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ users: { total: 4 } })));
    await adminApi.verifySecret("segredo-validado");
    saveSecret("segredo-validado");
    expect(loadSecret()).toBe("segredo-validado");
    expect(hasSecret()).toBe(true);
  });

  it("valida pela própria origem sem publicar uma sessão antes da confirmação", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: "Acesso restrito." }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const changed = vi.fn();
    const unsubscribe = subscribeToSecret(changed);
    try {
      await expect(adminApi.verifySecret("segredo-invalido")).rejects.toBeInstanceOf(AdminAuthError);
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/overview", expect.objectContaining({
        headers: expect.objectContaining({ "x-admin-secret": "segredo-invalido" }),
      }));
      expect(hasSecret()).toBe(false);
      expect(changed).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
