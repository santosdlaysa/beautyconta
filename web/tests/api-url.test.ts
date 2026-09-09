import { describe, expect, it } from "vitest";
import { INVALID_API_URL_MESSAGE, MISSING_API_URL_MESSAGE, resolveApiUrl } from "../src/config/api";

/**
 * Uma construção de produção sem `NEXT_PUBLIC_API_URL` publicaria a página de
 * agendamento chamando `localhost`: a cliente abre o link no celular e vê uma
 * tela que nunca carrega, sem nenhum sinal do lado de quem publicou. Este teste
 * é o que garante que a falha continua alta.
 */

describe("endereço da API", () => {
  it("cai na porta do backend em desenvolvimento", () => {
    expect(resolveApiUrl(undefined, "development")).toBe("http://localhost:3333");
    expect(resolveApiUrl("", "development")).toBe("http://localhost:3333");
    expect(resolveApiUrl("   ", "test")).toBe("http://localhost:3333");
  });

  it("falha quando a variável falta em produção", () => {
    expect(() => resolveApiUrl(undefined, "production")).toThrow(MISSING_API_URL_MESSAGE);
    expect(() => resolveApiUrl("  ", "production")).toThrow(MISSING_API_URL_MESSAGE);
  });

  it("falha quando o endereço não é absoluto, em qualquer ambiente", () => {
    expect(() => resolveApiUrl("api.beautyconta.com.br", "production")).toThrow(INVALID_API_URL_MESSAGE);
    expect(() => resolveApiUrl("/api", "development")).toThrow(INVALID_API_URL_MESSAGE);
    expect(() => resolveApiUrl("ftp://api.beautyconta.com.br", "production")).toThrow(INVALID_API_URL_MESSAGE);
  });

  it("remove a barra final para não duplicá-la nos caminhos montados", () => {
    expect(resolveApiUrl("https://api.beautyconta.com.br/", "production")).toBe("https://api.beautyconta.com.br");
    expect(resolveApiUrl("https://api.beautyconta.com.br", "production")).toBe("https://api.beautyconta.com.br");
  });
});
