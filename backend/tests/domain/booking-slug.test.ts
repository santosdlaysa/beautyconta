import { describe, expect, it } from "vitest";
import {
  assertValidSlug,
  nextAvailableSlug,
  slugify,
  suggestSlug,
} from "../../src/domain/scheduling/booking-slug";
import { DomainError } from "../../src/domain/shared";

describe("apelido da agenda pública", () => {
  it("transforma o nome do estúdio em endereço", () => {
    expect(slugify("Studio Marina Unhas")).toBe("studio-marina-unhas");
    expect(slugify("Ateliê da Ana")).toBe("atelie-da-ana");
    expect(slugify("Beleza & Cia.")).toBe("beleza-cia");
    expect(slugify("  espaço   bem   estar  ")).toBe("espaco-bem-estar");
  });

  it("tira acento, porque endereço com acento é copiado errado", () => {
    expect(slugify("Salão Glamour")).toBe("salao-glamour");
    expect(slugify("Unhas da Céu")).toBe("unhas-da-ceu");
  });

  it("recusa endereço que não serve, em vez de consertar calado", () => {
    // Consertar em silêncio faria ela mandar para a cliente um endereço
    // diferente do que viu na tela.
    for (const invalido of ["ab", "-studio", "studio-", "studio--marina", "Studio Marina"]) {
      expect(() => assertValidSlug(invalido)).toThrowError(DomainError);
    }
  });

  it("recusa nome reservado do próprio site", () => {
    for (const reservado of ["agendar", "admin", "planos", "beautyconta"]) {
      expect(() => assertValidSlug(reservado)).toThrowError(/reservado/i);
    }
  });

  it("aceita o que é válido", () => {
    for (const valido of ["studio-marina", "ana", "unhas123", "espaco-bem-estar"]) {
      expect(() => assertValidSlug(valido)).not.toThrow();
    }
  });
});

describe("endereço livre a partir do nome", () => {
  it("usa o nome quando ninguém o tomou", () => {
    expect(nextAvailableSlug("Studio Marina", () => false)).toBe("studio-marina");
  });

  it("acrescenta número quando dois estúdios têm o mesmo nome", () => {
    const tomados = new Set(["studio-marina"]);
    expect(nextAvailableSlug("Studio Marina", (slug) => tomados.has(slug))).toBe("studio-marina-2");

    tomados.add("studio-marina-2");
    expect(nextAvailableSlug("Studio Marina", (slug) => tomados.has(slug))).toBe("studio-marina-3");
  });

  it("nunca devolve um nome reservado", () => {
    // "Agendar" viraria a rota do próprio site.
    expect(nextAvailableSlug("Agendar", () => false)).toBe("agendar-2");
  });

  it("aguenta nome vazio ou impronunciável", () => {
    expect(nextAvailableSlug("", () => false)).toBe("agenda");
    expect(nextAvailableSlug("!!!", () => false)).toBe("agenda");
  });

  it("respeita o limite de tamanho mesmo com sufixo", () => {
    const longo = "a".repeat(80);
    const slug = nextAvailableSlug(longo, (candidato) => candidato === "a".repeat(40));

    expect(slug.length).toBeLessThanOrEqual(40);
    expect(() => assertValidSlug(slug)).not.toThrow();
  });
});

describe("sugestão para a profissional", () => {
  it("propõe o nome do negócio já no formato", () => {
    expect(suggestSlug("Studio Marina")).toBe("studio-marina");
  });

  it("não propõe nada quando não dá para aproveitar", () => {
    expect(suggestSlug(null)).toBeNull();
    expect(suggestSlug("ok")).toBeNull();
    expect(suggestSlug("Agendar")).toBeNull();
  });
});
