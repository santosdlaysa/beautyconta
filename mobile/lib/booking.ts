/**
 * Agenda pública: endereço do link, expediente e telefone da cliente.
 *
 * Este arquivo não importa nada do React Native, pelo mesmo motivo de
 * `analytics.ts`: são conversões cheias de canto escuro — minuto para relógio,
 * telefone para link, faixa que encosta na outra — e assim o teste roda em Node
 * puro, sem simulador.
 */

import type { BusinessHour } from './resources';

/**
 * Base do site que hospeda a página de agendamento.
 *
 * É o endereço que a cliente abre no navegador, não o da API: os dois só
 * coincidem por acaso em desenvolvimento. Sem a variável vale o domínio de
 * produção, que é o certo para o aplicativo publicado — quem roda local aponta
 * para a própria máquina no `.env`.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://beautyconta.com.br').replace(/\/+$/, '');

/** Endereço que a profissional compartilha; `/agendar/:token` é rota do site. */
export const bookingUrl = (bookingToken: string): string => `${SITE_URL}/agendar/${bookingToken}`;

export const WEEKDAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/** Segunda a sexta: o conjunto que a profissional copia de uma vez. */
export const WORKING_WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** Uma faixa do expediente, em minutos desde a meia-noite — como a API grava. */
export type WorkRange = { weekday: number; startMinute: number; endMinute: number };

const MINUTES_IN_DAY = 24 * 60;
const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * `HH:MM` digitado para minutos desde a meia-noite.
 *
 * `24:00` passa porque é o fim de um expediente que vai até o fim do dia, e a
 * API aceita esse limite; `24:30` não existe e volta `null`.
 */
export function parseMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59) return null;

  const total = hour * 60 + minute;
  return total > MINUTES_IN_DAY ? null : total;
}

/** Minutos do servidor para o relógio que a usuária lê. */
export const formatMinutes = (minute: number): string => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

/**
 * Leitura da API para o formato da tela.
 *
 * A rota devolve `"09:00"` e recebe `540`. A assimetria é do servidor e morre
 * aqui: da tela para dentro existe um formato só, o minuto.
 *
 * Faixa que o servidor mandar fora do relógio é descartada em vez de virar
 * `NaN` — expediente estranho é melhor que tela quebrada.
 */
export function rangesFromApi(items: readonly BusinessHour[]): WorkRange[] {
  const ranges: WorkRange[] = [];

  for (const item of items) {
    const startMinute = parseMinutes(item.start);
    const endMinute = parseMinutes(item.end);
    if (startMinute === null || endMinute === null) continue;
    ranges.push({ weekday: item.weekday, startMinute, endMinute });
  }

  return sortRanges(ranges);
}

/** Ordem de leitura: domingo primeiro, e dentro do dia da manhã para a noite. */
export const sortRanges = (ranges: readonly WorkRange[]): WorkRange[] =>
  [...ranges].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);

export const rangesOfDay = (ranges: readonly WorkRange[], weekday: number): WorkRange[] =>
  sortRanges(ranges.filter((range) => range.weekday === weekday));

/**
 * Sugestão para a próxima faixa do dia.
 *
 * Manhã e tarde com almoço no meio é o expediente normal, não a exceção: a
 * primeira faixa nasce 09:00–12:00 e a segunda 13:00–18:00, para que o caso
 * comum saia com dois toques.
 */
export function suggestRange(existing: readonly WorkRange[]): { startMinute: number; endMinute: number } {
  if (existing.length === 0) return { startMinute: 9 * 60, endMinute: 12 * 60 };

  const last = sortRanges(existing)[existing.length - 1] as WorkRange;
  const startMinute = Math.min(last.endMinute + 60, MINUTES_IN_DAY - 60);
  return { startMinute, endMinute: Math.min(startMinute + 5 * 60, MINUTES_IN_DAY) };
}

/**
 * O que impede a semana de ser salva, dito antes de gastar uma requisição.
 *
 * O servidor recusa as mesmas duas coisas com 422; repetir a conferência aqui é
 * o que faz a mensagem aparecer enquanto a usuária ainda olha para o horário
 * que acabou de digitar.
 */
export function validateWeek(ranges: readonly WorkRange[]): string | null {
  for (const range of ranges) {
    if (range.endMinute <= range.startMinute) {
      return `${WEEKDAYS[range.weekday]}: o fim precisa ser depois do início.`;
    }
  }

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const day = rangesOfDay(ranges, weekday);

    for (let index = 1; index < day.length; index += 1) {
      const previous = day[index - 1] as WorkRange;
      const current = day[index] as WorkRange;
      if (current.startMinute < previous.endMinute) {
        return `${WEEKDAYS[weekday]}: dois horários se sobrepõem. Ajuste o início e o fim.`;
      }
    }
  }

  return null;
}

/** Só os dígitos: é o que discador e WhatsApp entendem sem ambiguidade. */
export const phoneDigits = (phone: string): string => phone.replace(/\D/g, '');

/** Telefone da cliente escrito como se lê no Brasil. */
export function formatPhone(phone: string): string {
  const digits = phoneDigits(phone);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  // Número curto ou de fora do país: vale o que a cliente escreveu.
  return phone.trim();
}

/** Ligação. `null` quando o que veio não chega a ser um telefone. */
export function telUrl(phone: string): string | null {
  const digits = phoneDigits(phone);
  return digits.length >= 8 ? `tel:${digits}` : null;
}

/**
 * Conversa no WhatsApp.
 *
 * O `wa.me` exige o código do país e a cliente digita sem ele. Dez ou onze
 * dígitos é telefone brasileiro com DDD e recebe o 55; acima disso o número já
 * veio com país e passa como está.
 */
export function whatsappUrl(phone: string): string | null {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}
