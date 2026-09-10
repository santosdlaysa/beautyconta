import { describe, expect, it } from "vitest";
import { SendDailyReport, startOfDayInBrasilia } from "../../src/application/use-cases/admin-report";
import { RegisterUser } from "../../src/application/use-cases/accounts";
import { TelegramNotifier } from "../../src/infrastructure/notifications/telegram-notifier";
import { createTestDependencies } from "../support/in-memory";

describe("avisos administrativos", () => {
  it("avisa o cadastro de uma nova usuária", async () => {
    const deps = createTestDependencies();

    await new RegisterUser(deps.users, deps.notifier).execute({
      name: "  Marina Alves  ",
      email: "Marina@Exemplo.com ",
      password: "senha-bem-comprida-1",
    });

    expect(deps.notifier.ofKind("new_user")).toEqual([
      // Nome aparado e e-mail normalizado: o aviso mostra o que foi gravado,
      // e não o que veio digitado no formulário.
      { kind: "new_user", name: "Marina Alves", email: "marina@exemplo.com" },
    ]);
  });

  it("não avisa quando o cadastro é recusado por e-mail repetido", async () => {
    const deps = createTestDependencies();
    const input = {
      name: "Marina",
      email: "marina@exemplo.com",
      password: "senha-bem-comprida-1",
    };

    await new RegisterUser(deps.users, deps.notifier).execute(input);
    await expect(new RegisterUser(deps.users, deps.notifier).execute(input)).rejects.toThrow();

    // Só o primeiro: alarme por cadastro que não aconteceu é pior que silêncio.
    expect(deps.notifier.ofKind("new_user")).toHaveLength(1);
  });

  it("manda o relatório diário com as contagens do dia", async () => {
    const deps = createTestDependencies();
    deps.metrics.snapshot_ = {
      totalUsers: 42,
      newUsersToday: 3,
      totalBusinesses: 40,
      appointmentsToday: 7,
      activeSubscriptions: 5,
    };

    await new SendDailyReport(deps.metrics, deps.notifier, deps.clock).execute();

    expect(deps.notifier.ofKind("daily_report")).toEqual([
      { kind: "daily_report", metrics: deps.metrics.snapshot_ },
    ]);
  });

  it("corta o dia pela meia-noite de Brasília, e não pela do servidor", async () => {
    const deps = createTestDependencies();
    // 02:30 UTC de 10/09 ainda é 23:30 de 09/09 em Brasília. Um corte feito no
    // fuso do servidor jogaria fora o dia inteiro de trabalho da usuária.
    deps.clock.now = () => new Date("2026-09-10T02:30:00Z");

    await new SendDailyReport(deps.metrics, deps.notifier, deps.clock).execute();

    expect(deps.metrics.lastSince?.toISOString()).toBe("2026-09-09T03:00:00.000Z");
  });
});

describe("startOfDayInBrasilia", () => {
  it("devolve a meia-noite de Brasília em UTC", () => {
    // Meio-dia UTC = 09h em Brasília; o dia começou às 03:00 UTC.
    expect(startOfDayInBrasilia(new Date("2026-09-09T12:00:00Z")).toISOString()).toBe(
      "2026-09-09T03:00:00.000Z",
    );
  });

  it("não adianta o dia para quem usa o sistema à noite", () => {
    expect(startOfDayInBrasilia(new Date("2026-09-09T23:59:00Z")).toISOString()).toBe(
      "2026-09-09T03:00:00.000Z",
    );
  });
});

describe("TelegramNotifier", () => {
  it("não deixa a falha do Telegram subir para quem disparou o aviso", async () => {
    const notifier = new TelegramNotifier("token", "chat", () => {
      throw new Error("rede fora");
    });

    // Sem rejeição: o cadastro que disparou isto já aconteceu.
    await expect(
      notifier.notify({ kind: "new_user", name: "Marina", email: "marina@exemplo.com" }),
    ).resolves.toBeUndefined();
  });

  it("engole resposta de erro da API sem derrubar o fluxo", async () => {
    const notifier = new TelegramNotifier("token", "chat", () =>
      Promise.resolve(new Response("nope", { status: 429 })),
    );

    await expect(
      notifier.notify({ kind: "new_user", name: "Marina", email: "marina@exemplo.com" }),
    ).resolves.toBeUndefined();
  });

  it("envia texto puro, para que nome com < ou & não quebre a mensagem", async () => {
    let body: Record<string, unknown> = {};
    const notifier = new TelegramNotifier("token", "chat", (_url, init) => {
      body = JSON.parse(String(init?.body));
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await notifier.notify({ kind: "new_user", name: "Ateliê <B&B>", email: "b@exemplo.com" });

    expect(body.parse_mode).toBeUndefined();
    expect(String(body.text)).toContain("Ateliê <B&B>");
  });
});
