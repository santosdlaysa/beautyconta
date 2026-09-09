/**
 * Conferência dos dados da cliente antes de chamar a API.
 *
 * Existe por um motivo concreto: o teto de requisição da rota de agendamento é
 * de cinco por quinze minutos. Gastar uma tentativa para descobrir que o nome
 * estava vazio é caro — quatro erros de digitação e a cliente fica de fora por
 * quinze minutos, sem entender por quê.
 *
 * A regra é nunca ser mais exigente do que a API precisa. A única exceção é o
 * telefone: a API aceita oito caracteres, mas telefone sem DDD não serve para
 * o que ele existe aqui, que é a profissional conseguir retomar contato.
 */

export type BookingFormField = "clientName" | "clientPhone";

export type BookingFormProblem = {
  field: BookingFormField;
  message: string;
};

export function firstInvalidField(input: {
  clientName: string;
  clientPhone: string;
}): BookingFormProblem | null {
  if (input.clientName.trim().length < 2) {
    return {
      field: "clientName",
      message: "Escreva seu nome para a profissional saber quem vai atender.",
    };
  }

  // Só os dígitos: a cliente escreve com parênteses, traço, espaço ou +55, e
  // nenhum desses formatos está errado.
  const digits = input.clientPhone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    return {
      field: "clientPhone",
      message: "Informe um telefone com DDD, como 95 99999-0000.",
    };
  }

  return null;
}
