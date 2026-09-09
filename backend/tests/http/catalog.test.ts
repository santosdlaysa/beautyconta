import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDependencies } from "../support/in-memory";

const app = createApp(createTestDependencies());

describe("catálogos", () => {
  it("são públicos: a interface precisa das listas antes do cadastro", async () => {
    const { status, body } = await request(app).get("/api/catalog");

    expect(status).toBe(200);
    expect(body.segments).toHaveLength(8);
    expect(body.units.map((unit: { slug: string }) => unit.slug)).toContain("ml");
    expect(body.fixedCostCategories).toContainEqual(
      expect.objectContaining({ slug: "equipment_reserve", systemManaged: true }),
    );
  });

  it("prioriza as categorias do segmento, mantendo as transversais", async () => {
    const { body } = await request(app).get("/api/catalog/material-categories?segment=nails");
    const slugs = body.items.map((item: { slug: string }) => item.slug);

    expect(slugs).toContain("gel");
    expect(slugs).toContain("disposables");
    expect(slugs).not.toContain("lash_glue");
  });

  it("devolve a lista completa quando o segmento é desconhecido", async () => {
    const { status, body } = await request(app).get("/api/catalog/service-categories?segment=xyz");

    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThan(20);
  });
});
