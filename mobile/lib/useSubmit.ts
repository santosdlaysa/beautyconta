import { useCallback, useState } from 'react';
import { track } from './analytics';
import { ApiError } from './api';
import { message } from '../state/AppProvider';

/**
 * Ação que fala com o servidor, do ponto de vista da tela: ocupada ou livre,
 * com erro ou sem. Evita repetir o mesmo `try/catch` em cada botão.
 *
 * `limitReached` separa o 402 dos demais erros. Não é dado inválido: o plano é
 * que acabou, a mensagem já vem pronta do servidor e nada do que a usuária
 * cadastrou é descartado — inclusive o que ela acabou de digitar no formulário,
 * que continua na tela para ser salvo depois da assinatura.
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setLimitReached(false);
    try {
      await action();
      return true;
    } catch (failure) {
      // Todo 402 do aplicativo passa por aqui: é o lugar certo para o evento
      // `plan_limit_reached`, e só o nome do cadastro viaja com ele.
      const planLimit = failure instanceof ApiError && failure.isPlanLimit;
      if (failure instanceof ApiError && failure.isPlanLimit) {
        track('plan_limit_reached', { resource: failure.resource ?? 'desconhecido' });
      }
      setError(message(failure));
      setLimitReached(planLimit);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setLimitReached(false);
  }, []);

  return { busy, error, limitReached, setError, clear, run };
}

/** Texto digitado para número, aceitando vírgula como separador decimal. */
export const parseNumber = (value: string): number => Number(value.replace(/\./g, '').replace(',', '.')) || 0;

/** Reais digitados para centavos inteiros, que é o que a API recebe. */
export const parseCents = (value: string): number => Math.round(parseNumber(value) * 100);

export const formatMoney = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos do servidor para o texto que a usuária lê. */
export const formatCents = (cents: number): string => formatMoney(cents / 100);

/** Centavos para o texto editável de um campo, sem símbolo de moeda. */
export const centsToInput = (cents: number): string => (cents / 100).toFixed(2).replace('.', ',');

/** Percentual com no máximo uma casa, para não exibir "30,0%" o tempo todo. */
export const formatPercent = (value: number): string =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Data em `AAAA-MM-DD` para o texto que a usuária lê, sem deslocar o fuso. */
export const formatIsoDate = (value: string): string => {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
};

/**
 * `DD/MM/AAAA` digitado para o `AAAA-MM-DD` que a API aceita. Devolve `null`
 * quando a data não está completa, para o campo poder ficar vazio.
 */
export const parseIsoDate = (value: string): string | null => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
