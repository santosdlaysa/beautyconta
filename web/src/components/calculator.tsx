"use client";

import { useEffect, useId, useRef, useState } from "react";
import { trackEvent } from "@/config/analytics";
import { DomainError } from "@/domain/shared/domain-error";
import { calculatePrice, type PricingResult } from "@/domain/pricing/calculate-price";
import { AlertIcon, ArrowIcon, CalculatorIcon, ChartIcon, ClockIcon, SpinnerIcon } from "./icons";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type CalculatorPreset = {
  serviceLabel: string;
  materialCost: number;
  hours: number;
  minutes: number;
  hourlyRate: number;
  monthlyFixedCosts: number;
  monthlyProductiveHours: number;
  /** Item C-01: cartão, Pix ou marketplace. Zero quando o recebimento é em dinheiro. */
  salesFeePercent: number;
  desiredMarginPercent: number;
  /** Zero significa "não informado": nenhuma página sugere quanto a profissional cobra hoje. */
  currentPrice: number;
};

type Values = CalculatorPreset & { service: string };

const DEFAULT_PRESET: CalculatorPreset = {
  serviceLabel: "Alongamento em gel",
  materialCost: 32.5,
  hours: 2,
  minutes: 30,
  hourlyRate: 30,
  monthlyFixedCosts: 1200,
  monthlyProductiveHours: 150,
  salesFeePercent: 0,
  desiredMarginPercent: 30,
  currentPrice: 140,
};

const SERVICE_OPTIONS = [
  "Alongamento em gel",
  "Manutenção de alongamento",
  "Esmaltação em gel",
  "Extensão de cílios",
  "Escova",
  "Procedimento estético",
];

/**
 * Estados exigidos pelo item C-06. `loading` existe mesmo o cálculo sendo local:
 * a conta roda no quadro seguinte ao clique, para que o aparelho mais fraco
 * pinte a resposta ao toque antes de calcular, e para que a região de resultado
 * anuncie a mudança em vez de trocar o número sem aviso.
 */
type Status = "empty" | "loading" | "error" | "success";

/** Onde a calculadora está montada. É categórico, então pode ir em evento. */
export type CalculatorOrigin = "home" | "pagina-de-servico";

/**
 * Item C-05: a duração vai como faixa, nunca como número, conforme o exemplo de
 * distribuição do ADR-0006.
 */
function durationBand(minutes: number): string {
  if (minutes <= 60) return "0-60";
  if (minutes <= 120) return "61-120";
  if (minutes <= 240) return "121-240";
  return "241 ou mais";
}

/**
 * Cada campo do motor que pode reprovar aponta para o campo da tela que a
 * usuária precisa corrigir. Sem isso o erro do domínio chega genérico e ela não
 * sabe onde mexer, que é o que o item A-02 quis evitar.
 */
const FIELD_OF: Record<string, keyof Values> = {
  materialCost: "materialCost",
  durationMinutes: "hours",
  hourlyRate: "hourlyRate",
  monthlyFixedCosts: "monthlyFixedCosts",
  monthlyProductiveHours: "monthlyProductiveHours",
  salesFeePercent: "salesFeePercent",
  desiredMarginPercent: "desiredMarginPercent",
  currentPrice: "currentPrice",
};

function NumberField({ id, label, hint, value, onChange, prefix, suffix, step = 1, min = 0, max, invalid, describedBy }: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const hintId = `${id}-ajuda`;
  const described = [hint ? hintId : null, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap ${invalid ? "is-invalid" : ""}`}>
        {prefix && <span className="input-affix" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={described}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <span className="input-affix suffix" aria-hidden="true">{suffix}</span>}
      </div>
      {hint && <small id={hintId} className="field-hint">{hint}</small>}
    </div>
  );
}

export function PricingCalculator({ preset = DEFAULT_PRESET, title = "Quanto você deveria cobrar?", description = "Preencha com os números do seu negócio. Você não precisa criar uma conta.", origin = "home" }: {
  preset?: CalculatorPreset;
  title?: string;
  description?: string;
  origin?: CalculatorOrigin;
}) {
  const id = useId();
  const field = (name: string) => `${id}-${name}`;

  const [values, setValues] = useState<Values>({ ...preset, service: preset.serviceLabel });
  const [status, setStatus] = useState<Status>("empty");
  const [result, setResult] = useState<PricingResult | null>(null);
  const [failure, setFailure] = useState<{ message: string; field?: keyof Values } | null>(null);
  const [simulatedPrice, setSimulatedPrice] = useState<number | null>(null);
  /** Sem isso, sair e voltar ao campo do simulador repetiria o mesmo evento. */
  const simulationReported = useRef(false);

  // `calculator_viewed` mede a boca do funil da seção 8 do documento 05: quem
  // chegou à calculadora, não quem chegou ao site.
  useEffect(() => {
    trackEvent("calculator_viewed", { origem: origin });
  }, [origin]);

  const options = SERVICE_OPTIONS.includes(preset.serviceLabel)
    ? SERVICE_OPTIONS
    : [preset.serviceLabel, ...SERVICE_OPTIONS];

  const run = (submitted: Values) => {
    try {
      setResult(calculatePrice({
        materialCost: submitted.materialCost,
        durationMinutes: submitted.hours * 60 + submitted.minutes,
        hourlyRate: submitted.hourlyRate,
        monthlyFixedCosts: submitted.monthlyFixedCosts,
        monthlyProductiveHours: submitted.monthlyProductiveHours,
        salesFeePercent: submitted.salesFeePercent,
        desiredMarginPercent: submitted.desiredMarginPercent,
        currentPrice: submitted.currentPrice > 0 ? submitted.currentPrice : undefined,
      }));
      setFailure(null);
      setStatus("success");
      // A ocorrência, nunca o número: preço, custo e margem ficam de fora por
      // regra do ADR-0006, e a camada de emissão os removeria de qualquer jeito.
      trackEvent("calculation_completed", {
        origem: origin,
        faixaDeDuracao: durationBand(submitted.hours * 60 + submitted.minutes),
        informouQuantoCobraHoje: submitted.currentPrice > 0,
        descontaMaquininha: submitted.salesFeePercent > 0,
      });
    } catch (error) {
      const guilty = error instanceof DomainError && error.field ? FIELD_OF[error.field] : undefined;
      setFailure({
        message: error instanceof Error ? error.message : "Não foi possível calcular com esses números.",
        field: guilty,
      });
      setResult(null);
      setStatus("error");
      // Levar o foco ao campo culpado é o que permite corrigir sem usar o mouse.
      if (guilty) document.getElementById(field(guilty))?.focus();
    }
  };

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setStatus("empty");
    setResult(null);
    setFailure(null);
    setSimulatedPrice(null);
  };

  const fee = values.salesFeePercent / 100;
  const price = simulatedPrice ?? result?.suggestedPrice ?? 0;
  // Item C-02: o lucro do simulador desconta a taxa sobre a venda. Com taxa
  // zero o resultado é o mesmo de antes, preço menos custo.
  const simulatedProfit = result ? price - result.totalCost - price * fee : 0;
  const simulatedMargin = price > 0 ? (simulatedProfit / price) * 100 : 0;
  const invalidField = failure?.field;
  const errorId = `${id}-erro`;

  return (
    <div className="calculator-shell" id="calculadora">
      <div className="calculator-heading">
        <span className="eyebrow"><CalculatorIcon /> Calculadora gratuita</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="calculator-grid">
        <form
          className="calculator-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setSimulatedPrice(null);
            simulationReported.current = false;
            setStatus("loading");
            trackEvent("calculation_started", { origem: origin });
            // O motor roda no quadro seguinte para que o aparelho mais fraco
            // pinte a resposta ao toque antes de calcular.
            requestAnimationFrame(() => run({ ...values }));
          }}
        >
          <div className="step-title"><span aria-hidden="true">1</span><div><strong>Sobre o serviço</strong><small>Comece pelo que você oferece</small></div></div>

          <div className="field full">
            <label htmlFor={field("service")}>Qual serviço vamos calcular?</label>
            <select id={field("service")} value={values.service} onChange={(event) => update("service", event.target.value)}>
              {options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>

          <div className="two-cols">
            <NumberField
              id={field("materialCost")}
              label="Custo dos materiais"
              hint="Só a fração usada em uma cliente."
              value={values.materialCost}
              onChange={(value) => update("materialCost", value)}
              prefix="R$"
              step={0.01}
              invalid={invalidField === "materialCost"}
              describedBy={invalidField === "materialCost" ? errorId : undefined}
            />
            <fieldset className="field time-field">
              <legend>Tempo do atendimento</legend>
              <div className="time-fields">
                <div className="time-input">
                  <label htmlFor={field("hours")}>Horas</label>
                  <div className={`input-wrap ${invalidField === "hours" ? "is-invalid" : ""}`}>
                    <input
                      id={field("hours")}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="24"
                      value={values.hours}
                      aria-invalid={invalidField === "hours" || undefined}
                      aria-describedby={invalidField === "hours" ? errorId : undefined}
                      onChange={(event) => update("hours", Number(event.target.value))}
                    />
                    <span className="input-affix suffix" aria-hidden="true">h</span>
                  </div>
                </div>
                <div className="time-input">
                  <label htmlFor={field("minutes")}>Minutos</label>
                  <div className="input-wrap">
                    <input
                      id={field("minutes")}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="59"
                      value={values.minutes}
                      onChange={(event) => update("minutes", Number(event.target.value))}
                    />
                    <span className="input-affix suffix" aria-hidden="true">min</span>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          <div className="divider" />
          <div className="step-title"><span aria-hidden="true">2</span><div><strong>Seu trabalho e estrutura</strong><small>Para a conta refletir sua realidade</small></div></div>

          <div className="two-cols">
            <NumberField
              id={field("hourlyRate")}
              label="Quanto vale sua hora?"
              hint="É a sua retirada, não o lucro do negócio."
              value={values.hourlyRate}
              onChange={(value) => update("hourlyRate", value)}
              prefix="R$"
              step={0.01}
              invalid={invalidField === "hourlyRate"}
              describedBy={invalidField === "hourlyRate" ? errorId : undefined}
            />
            <NumberField
              id={field("monthlyFixedCosts")}
              label="Custos fixos por mês"
              hint="Aluguel, energia, internet e o que você paga tendo cliente ou não."
              value={values.monthlyFixedCosts}
              onChange={(value) => update("monthlyFixedCosts", value)}
              prefix="R$"
              step={0.01}
              invalid={invalidField === "monthlyFixedCosts"}
              describedBy={invalidField === "monthlyFixedCosts" ? errorId : undefined}
            />
            <NumberField
              id={field("monthlyProductiveHours")}
              label="Horas produtivas por mês"
              hint="Só as horas atendendo. É o que divide o custo fixo."
              value={values.monthlyProductiveHours}
              onChange={(value) => update("monthlyProductiveHours", value)}
              suffix="horas"
              max={744}
              invalid={invalidField === "monthlyProductiveHours"}
              describedBy={invalidField === "monthlyProductiveHours" ? errorId : undefined}
            />
            <NumberField
              id={field("salesFeePercent")}
              label="Taxa sobre a venda (opcional)"
              hint="Cartão, Pix ou marketplace. Deixe zero se você recebe em dinheiro."
              value={values.salesFeePercent}
              onChange={(value) => update("salesFeePercent", value)}
              suffix="%"
              step={0.01}
              max={99}
              invalid={invalidField === "salesFeePercent"}
              describedBy={invalidField === "salesFeePercent" ? errorId : undefined}
            />
          </div>

          <div className="single-col">
            <NumberField
              id={field("currentPrice")}
              label="Preço que você cobra hoje (opcional)"
              hint="Informe para comparar com o resultado. Zero significa não informado."
              value={values.currentPrice}
              onChange={(value) => update("currentPrice", value)}
              prefix="R$"
              step={0.01}
              invalid={invalidField === "currentPrice"}
              describedBy={invalidField === "currentPrice" ? errorId : undefined}
            />
          </div>

          <div className="margin-field">
            <div>
              <label htmlFor={field("margin")}>Margem de lucro desejada</label>
              <strong aria-hidden="true">{values.desiredMarginPercent}%</strong>
            </div>
            <input
              id={field("margin")}
              type="range"
              min="0"
              max="70"
              step="1"
              value={values.desiredMarginPercent}
              aria-valuetext={`${values.desiredMarginPercent} por cento`}
              onChange={(event) => update("desiredMarginPercent", Number(event.target.value))}
            />
            <div className="range-labels" aria-hidden="true"><span>0%</span><span>70%</span></div>
          </div>

          {status === "error" && failure && (
            <p className="form-error" id={errorId} role="alert">
              <AlertIcon /> {failure.message}
            </p>
          )}

          <button className="primary-button wide" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <>Calculando <SpinnerIcon className="spinning" /></> : <>Calcular meu preço <ArrowIcon /></>}
          </button>
          <p className="form-note">Seus dados ficam somente neste dispositivo.</p>
        </form>

        <aside
          className={`result-card ${status === "success" ? "is-calculated" : ""}`}
          aria-live="polite"
          aria-busy={status === "loading"}
        >
          <div className="result-top">
            <span className="result-label">Preço recomendado</span>
            <h3>{status === "success" && result ? money.format(result.suggestedPrice) : "R$ —"}</h3>
            <p>
              {status === "success" && "Estimativa para " + values.service.toLowerCase() + "."}
              {status === "loading" && "Calculando com os números que você informou…"}
              {status === "error" && "Corrija o campo destacado ao lado para ver o resultado."}
              {status === "empty" && "Preencha os dados ao lado para ver seu resultado."}
            </p>
          </div>

          {status === "success" && result ? (
            <>
              <div className="result-breakdown">
                <div><span>Materiais</span><strong>{money.format(result.materialCost)}</strong></div>
                <div><span>Mão de obra</span><strong>{money.format(result.laborCost)}</strong></div>
                <div><span>Custos fixos rateados</span><strong>{money.format(result.allocatedFixedCost)}</strong></div>
                {values.salesFeePercent > 0 && (
                  <div><span>Taxa sobre a venda ({percent.format(values.salesFeePercent)}%)</span><strong>{money.format(result.suggestedPrice * fee)}</strong></div>
                )}
                <div className="total"><span>Seu custo total</span><strong>{money.format(result.totalCost)}</strong></div>
                <div><span>Preço mínimo, sem margem</span><strong>{money.format(result.minimumPrice)}</strong></div>
              </div>

              <div className="profit-highlight">
                <ChartIcon />
                <div>
                  <span>Lucro estimado por atendimento</span>
                  <strong>{money.format(result.expectedProfit)} <small>({percent.format(result.expectedMarginPercent)}%)</small></strong>
                </div>
              </div>

              {result.currentProfit !== undefined && (
                <div className={`current-alert ${result.currentProfit < 0 ? "danger" : ""}`}>
                  {result.currentProfit < 0 ? <AlertIcon /> : <ClockIcon />}
                  <p>
                    {result.currentProfit < 0 ? "Atenção: hoje, cobrando " : "Hoje, cobrando "}
                    <strong>{money.format(values.currentPrice)}</strong>
                    {result.currentProfit < 0 ? ", o atendimento fecha em " : ", sobra "}
                    <strong>{money.format(result.currentProfit)}</strong>
                    {result.currentMarginPercent !== undefined && ` (${percent.format(result.currentMarginPercent)}%)`}.
                  </p>
                </div>
              )}

              <div className="simulator">
                <div className="simulator-input">
                  <label htmlFor={field("simulated")}>E se eu cobrar outro valor?</label>
                  <div className="input-wrap dark">
                    <span className="input-affix" aria-hidden="true">R$</span>
                    <input
                      id={field("simulated")}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      placeholder={String(result.suggestedPrice)}
                      onChange={(event) => setSimulatedPrice(event.target.value ? Number(event.target.value) : null)}
                      onBlur={(event) => {
                        // No `blur`, e não a cada tecla: um evento por
                        // simulação, e nenhum valor digitado sai daqui.
                        if (!event.target.value || simulationReported.current) return;
                        simulationReported.current = true;
                        trackEvent("price_simulated", { origem: origin });
                      }}
                    />
                  </div>
                </div>
                <div><span>Lucro</span><strong>{money.format(simulatedProfit)}</strong></div>
                <div><span>Margem</span><strong>{percent.format(simulatedMargin)}%</strong></div>
              </div>

              <small className="result-disclaimer">
                Estimativa baseada nos dados informados, não é garantia de faturamento nem de lucro. Revise seus custos regularmente.
              </small>
            </>
          ) : (
            <div className="empty-result">
              <div className="empty-orbit">{status === "loading" ? <SpinnerIcon className="spinning" /> : <CalculatorIcon />}</div>
              <ul>
                <li>Custo real do serviço</li>
                <li>Lucro por atendimento</li>
                <li>Comparação com seu preço atual</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
