import { randomBytes, scrypt as scryptCallback, type ScryptOptions, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DomainError } from "../shared/domain-error";

/**
 * Senha da usuária.
 *
 * O ADR-0003 decidiu delegar credenciais a um provedor gerenciado e o item D-01
 * ficou bloqueado por essa escolha. A dona do produto pediu para destravar o
 * aplicativo guardando a senha aqui mesmo, então este arquivo existe **contra**
 * o ADR e precisa ser revisto quando o provedor for escolhido: nesse dia, a
 * migração lê `users.password_hash`, cria a identidade no provedor e apaga a
 * coluna.
 *
 * Enquanto isso, o mínimo defensável: scrypt com sal por senha, parâmetros
 * gravados junto do hash — para poder endurecê-los sem invalidar o que já
 * existe — e comparação em tempo constante. Sem dependência nova: `scrypt` vem
 * do próprio Node, e trocar por Argon2 depois é trocar este arquivo.
 */

/**
 * `promisify` resolve para a sobrecarga sem opções; o cast devolve a que
 * aceita os parâmetros de custo, que é a única forma de usá-los aqui.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** Custo atual. Gravado no hash, então aumentar não invalida senha antiga. */
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

/**
 * Sal fixo do hash descartável. Não protege segredo nenhum — existe só para
 * que a derivação aconteça e o tempo de resposta não denuncie a ausência da
 * conta. Fixo de propósito: gerar sal aleatório aqui seria trabalho sem uso.
 */
const DECOY_SALT = Buffer.alloc(SALT_LENGTH, 0);

/** Recusa a senha fraca antes de gastar CPU derivando hash dela. */
export function assertUsablePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`, "password");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new DomainError("A senha é longa demais.", "password");
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertUsablePassword(password);
  const salt = randomBytes(SALT_LENGTH);
  const derived = await derive(password, salt);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("base64"), derived.toString("base64")].join("$");
}

/**
 * Confere a senha contra o hash gravado.
 *
 * Devolve `false` para hash em formato desconhecido em vez de lançar: um
 * registro legado ilegível é senha que não confere, não erro de servidor.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // Sem hash gravado, confere contra um descartável em vez de sair na hora.
  // Sair aqui custava 0,0005 ms contra 33 ms do caminho normal, e essa
  // diferença respondia sozinha "esta pessoa tem conta?" para quem cronometrasse
  // a resposta — mesmo com a negativa sendo idêntica nos dois casos.
  if (!stored) {
    await derive(password, DECOY_SALT);
    return false;
  }
  const [algorithm, cost, blockSize, parallelization, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
    keyLength: expected.length,
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function derive(
  password: string,
  salt: Buffer,
  options?: { cost: number; blockSize: number; parallelization: number; keyLength: number },
): Promise<Buffer> {
  const cost = options?.cost ?? COST;
  const blockSize = options?.blockSize ?? BLOCK_SIZE;
  const parallelization = options?.parallelization ?? PARALLELIZATION;
  const keyLength = options?.keyLength ?? KEY_LENGTH;

  // `maxmem` acompanha o custo: o padrão do Node (32 MB) recusa parâmetros
  // maiores, e a fórmula é a recomendada na própria documentação.
  const maxmem = 128 * cost * blockSize * 2;

  return scrypt(password.normalize("NFKC"), salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem,
  });
}
