import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  CancelSubscription,
  GetSubscriptionStatus,
  HandleBillingWebhook,
  StartSubscription,
} from "../../../application/use-cases/subscriptions";
import { serializeSubscription } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import { businessParamSchema, checkoutSchema, idParamSchema } from "../validators/schemas";

export class SubscriptionController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  /**
   * Estado da assinatura e limites em vigor.
   *
   * A resposta sai de `subscriptions`, nunca do processador nem do SDK da loja:
   * é a regra da seção 3 do documento 11. `managedIn` diz onde a assinatura é
   * gerenciada e cancelada, porque o BeautyConta não cancela compra da App
   * Store.
   */
  status = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);

    const view = await new GetSubscriptionStatus(this.access, this.deps.subscriptions).execute(
      userIdOf(req),
      businessId,
    );

    res.json({
      plan: view.plan,
      limits: view.limits,
      managedIn: view.managedIn,
      subscriptions: view.subscriptions.map(serializeSubscription),
    });
  };

  checkout = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(checkoutSchema, req.body);

    const session = await new StartSubscription(
      this.access,
      this.deps.subscriptions,
      this.deps.gateway,
      this.deps.plans.prices,
    ).execute(userIdOf(req), businessId, input);

    res.status(201).json(session);
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    await new CancelSubscription(
      this.access,
      this.deps.subscriptions,
      this.deps.gateway,
    ).execute(userIdOf(req), businessId, id);

    res.status(202).json({
      status: "requested",
      message: "Cancelamento solicitado. A confirmação chega pelo processador.",
    });
  };

  /**
   * Webhook de cobrança.
   *
   * Responde 200 em quase todos os caminhos, de propósito: processador que
   * recebe erro reenvia, e reenvio de evento já gravado não pode virar cobrança
   * dupla. O que separa os casos é o corpo da resposta, não o status.
   */
  webhook = async (req: Request, res: Response): Promise<void> => {
    const source = req.params.source === "revenuecat" ? "revenuecat" : "mercado-pago";
    const translator = this.deps.translators[source];

    const outcome = await new HandleBillingWebhook(
      this.deps.billingEvents,
      this.deps.subscriptions,
      this.deps.clock,
      this.deps.businesses,
      this.deps.notifier,
      this.deps.billingResolver,
    ).execute(translator, req.body, headersOf(req));

    if (outcome.status === "rejected") {
      // Assinatura inválida ou formato irreconhecível: aqui o 400 é correto,
      // porque reenviar o mesmo corpo não vai dar certo.
      res.status(400).json({ status: "rejected" });
      return;
    }

    res.status(200).json(outcome);
  };
}

function headersOf(req: Request): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return headers;
}
