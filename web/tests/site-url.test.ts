import { describe, expect, it } from "vitest";
import { INVALID_SITE_URL_MESSAGE, MISSING_SITE_URL_MESSAGE, resolveSiteUrl } from "../src/config/site";

/**
 * Uma construção de produção sem `NEXT_PUBLIC_SITE_URL` publicaria canônica e
 * imagem de compartilhamento apontando para `localhost`, sem nenhum aviso. Este
 * teste é o que garante que a falha continua alta.
 */

describe("endereço público do site", () => {
  it("cai no localhost em desenvolvimento", () => {
    expect(resolveSiteUrl(undefined, "development")).toBe("http://localhost:3000");
    expect(resolveSiteUrl("", "development")).toBe("http://localhost:3000");
    expect(resolveSiteUrl("   ", "test")).toBe("http://localhost:3000");
  });

  it("falha quando a variável falta em produção", () => {
    expect(() => resolveSiteUrl(undefined, "production")).toThrow(MISSING_SITE_URL_MESSAGE);
    expect(() => resolveSiteUrl("  ", "production")).toThrow(MISSING_SITE_URL_MESSAGE);
  });

  it("falha quando o endereço não é absoluto, em qualquer ambiente", () => {
    expect(() => resolveSiteUrl("beautyconta.com.br", "production")).toThrow(INVALID_SITE_URL_MESSAGE);
    expect(() => resolveSiteUrl("/inicio", "development")).toThrow(INVALID_SITE_URL_MESSAGE);
    expect(() => resolveSiteUrl("ftp://beautyconta.com.br", "production")).toThrow(INVALID_SITE_URL_MESSAGE);
  });

  it("remove a barra final para não duplicá-la nas URLs montadas", () => {
    expect(resolveSiteUrl("https://beautyconta.com.br/", "production")).toBe("https://beautyconta.com.br");
    expect(resolveSiteUrl("https://beautyconta.com.br", "production")).toBe("https://beautyconta.com.br");
  });
});
