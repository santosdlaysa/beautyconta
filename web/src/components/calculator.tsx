"use client";

import { useMemo, useState } from "react";
import { calculatePrice } from "@/domain/pricing/calculate-price";
import { ArrowIcon, CalculatorIcon, ChartIcon, ClockIcon } from "./icons";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Values = {
  service: string;
  materialCost: number;
  hours: number;
  minutes: number;
  hourlyRate: number;
  monthlyFixedCosts: number;
  monthlyProductiveHours: number;
  desiredMarginPercent: number;
  currentPrice: number;
};

const initial: Values = {
  service: "Alongamento em gel",
  materialCost: 32.5,
  hours: 2,
  minutes: 30,
  hourlyRate: 30,
  monthlyFixedCosts: 1200,
  monthlyProductiveHours: 150,
  desiredMarginPercent: 30,
  currentPrice: 140,
};

function NumberField({ label, value, onChange, prefix, suffix, step = 1 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {prefix && <span className="input-affix">{prefix}</span>}
        <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <span className="input-affix suffix">{suffix}</span>}
      </div>
    </label>
  );
}

export function PricingCalculator() {
  const [values, setValues] = useState(initial);
  const [calculated, setCalculated] = useState(false);
  const [simulatedPrice, setSimulatedPrice] = useState<number | null>(null);

  const result = useMemo(() => calculatePrice({
    materialCost: values.materialCost,
    durationMinutes: values.hours * 60 + values.minutes,
    hourlyRate: values.hourlyRate,
    monthlyFixedCosts: values.monthlyFixedCosts,
    monthlyProductiveHours: values.monthlyProductiveHours,
    salesFeePercent: 0,
    desiredMarginPercent: values.desiredMarginPercent,
    currentPrice: values.currentPrice,
  }), [values]);

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setCalculated(false);
    setSimulatedPrice(null);
  };

  const effectivePrice = simulatedPrice ?? result.suggestedPrice;
  const effectiveProfit = effectivePrice - result.totalCost;
  const effectiveMargin = effectivePrice > 0 ? (effectiveProfit / effectivePrice) * 100 : 0;

  return (
    <div className="calculator-shell" id="calculadora">
      <div className="calculator-heading">
        <span className="eyebrow"><CalculatorIcon /> Calculadora gratuita</span>
        <h2>Quanto você deveria cobrar?</h2>
        <p>Preencha com os números do seu negócio. Você não precisa criar uma conta.</p>
      </div>

      <div className="calculator-grid">
        <form className="calculator-form" onSubmit={(event) => { event.preventDefault(); setCalculated(true); }}>
          <div className="step-title"><span>1</span><div><strong>Sobre o serviço</strong><small>Comece pelo que você oferece</small></div></div>
          <label className="field full">
            <span>Qual serviço vamos calcular?</span>
            <select value={values.service} onChange={(event) => update("service", event.target.value)}>
              <option>Alongamento em gel</option>
              <option>Manutenção de alongamento</option>
              <option>Esmaltação em gel</option>
              <option>Extensão de cílios</option>
              <option>Escova</option>
              <option>Procedimento estético</option>
            </select>
          </label>

          <div className="two-cols">
            <NumberField label="Custo dos materiais" value={values.materialCost} onChange={(value) => update("materialCost", value)} prefix="R$" step={0.01} />
            <div className="field">
              <span>Tempo do atendimento</span>
              <div className="time-fields">
                <div className="input-wrap"><input aria-label="Horas" type="number" min="0" value={values.hours} onChange={(event) => update("hours", Number(event.target.value))} /><span className="input-affix suffix">h</span></div>
                <div className="input-wrap"><input aria-label="Minutos" type="number" min="0" max="59" value={values.minutes} onChange={(event) => update("minutes", Number(event.target.value))} /><span className="input-affix suffix">min</span></div>
              </div>
            </div>
          </div>

          <div className="divider" />
          <div className="step-title"><span>2</span><div><strong>Seu trabalho e estrutura</strong><small>Para a conta refletir sua realidade</small></div></div>
          <div className="two-cols">
            <NumberField label="Quanto vale sua hora?" value={values.hourlyRate} onChange={(value) => update("hourlyRate", value)} prefix="R$" step={0.01} />
            <NumberField label="Custos fixos por mês" value={values.monthlyFixedCosts} onChange={(value) => update("monthlyFixedCosts", value)} prefix="R$" step={0.01} />
            <NumberField label="Horas produtivas por mês" value={values.monthlyProductiveHours} onChange={(value) => update("monthlyProductiveHours", value)} suffix="horas" />
            <NumberField label="Preço que cobra hoje" value={values.currentPrice} onChange={(value) => update("currentPrice", value)} prefix="R$" step={0.01} />
          </div>

          <label className="margin-field">
            <div><span>Margem de lucro desejada</span><strong>{values.desiredMarginPercent}%</strong></div>
            <input type="range" min="0" max="70" step="1" value={values.desiredMarginPercent} onChange={(event) => update("desiredMarginPercent", Number(event.target.value))} />
            <div className="range-labels"><span>0%</span><span>70%</span></div>
          </label>

          <button className="primary-button wide" type="submit">Calcular meu preço <ArrowIcon /></button>
          <p className="form-note">Seus dados ficam somente neste dispositivo.</p>
        </form>

        <aside className={`result-card ${calculated ? "is-calculated" : ""}`} aria-live="polite">
          <div className="result-top">
            <span className="result-label">Preço recomendado</span>
            <h3>{calculated ? money.format(result.suggestedPrice) : "R$ —"}</h3>
            <p>{calculated ? values.service : "Preencha os dados ao lado para ver seu resultado."}</p>
          </div>

          {calculated ? (
            <>
              <div className="result-breakdown">
                <div><span>Materiais</span><strong>{money.format(result.materialCost)}</strong></div>
                <div><span>Mão de obra</span><strong>{money.format(result.laborCost)}</strong></div>
                <div><span>Custos fixos rateados</span><strong>{money.format(result.allocatedFixedCost)}</strong></div>
                <div className="total"><span>Seu custo total</span><strong>{money.format(result.totalCost)}</strong></div>
              </div>

              <div className="profit-highlight">
                <ChartIcon />
                <div><span>Lucro estimado por atendimento</span><strong>{money.format(result.expectedProfit)} <small>({result.expectedMarginPercent}%)</small></strong></div>
              </div>

              {result.currentProfit !== undefined && (
                <div className={`current-alert ${result.currentProfit < 0 ? "danger" : ""}`}>
                  <ClockIcon />
                  <p>Hoje, cobrando <strong>{money.format(values.currentPrice)}</strong>, sobra <strong>{money.format(result.currentProfit)}</strong> ({result.currentMarginPercent}%).</p>
                </div>
              )}

              <div className="simulator">
                <label>
                  <span>E se eu cobrar outro valor?</span>
                  <div className="input-wrap dark"><span className="input-affix">R$</span><input type="number" min="0" step="1" placeholder={String(result.suggestedPrice)} onChange={(event) => setSimulatedPrice(event.target.value ? Number(event.target.value) : null)} /></div>
                </label>
                <div><span>Lucro</span><strong>{money.format(effectiveProfit)}</strong></div>
                <div><span>Margem</span><strong>{effectiveMargin.toFixed(1)}%</strong></div>
              </div>

              <button className="secondary-button wide" type="button">Salvar e criar minha tabela</button>
              <small className="result-disclaimer">Estimativa baseada nos dados informados. Revise seus custos regularmente.</small>
            </>
          ) : (
            <div className="empty-result">
              <div className="empty-orbit"><CalculatorIcon /></div>
              <ul><li>Custo real do serviço</li><li>Lucro por atendimento</li><li>Comparação com seu preço atual</li></ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
