import { DomainError } from "../shared/domain-error";

/**
 * Apelido da agenda pública: `beautyconta.com.br/agendar/studio-marina`.
 *
 * **Este endereço é público e adivinhável, por decisão de produto.** Ele é
 * bonito de falar e de mandar por mensagem, e esse é o ponto — mas significa
 * que a agenda não tem sigilo nenhum: quem tentar `/agendar/studio-da-ana`
 * chega lá. As defesas do agendamento são outras (teto de requisição,
 * antecedência mínima, horizonte de datas), e não o segredo do endereço.
 */

const MIN_LENGTH = 3;
const MAX_LENGTH = 40;

/**
 * Nomes que não podem virar apelido.
 *
 * Ou porque são rotas do próprio site, ou porque quem os visse no endereço
 * pensaria estar falando com o BeautyConta, e não com uma profissional.
 */
const RESERVED = new Set([
  "agendar",
  "admin",
  "administrador",
  "api",
  "app",
  "ajuda",
  "beautyconta",
  "blog",
  "calculadora",
  "checkout",
  "conta",
  "contato",
  "entrar",
  "login",
  "planos",
  "precos",
  "sair",
  "suporte",
  "termos",
  "privacidade",
  "www",
]);

/**
 * Transforma um nome livre no formato do endereço.
 *
 * "Studio Marina Unhas" vira "studio-marina-unhas". Acento sai, porque endereço
 * com acento é copiado errado e digitado pior; espaço e pontuação viram hífen.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Confere o apelido escolhido.
 *
 * Recusa em vez de consertar em silêncio: se a pessoa digitou "Studio Marina" e
 * o endereço virasse outra coisa sem ela ver, ela mandaria para a cliente o
 * endereço que acha que é o seu.
 */
export function assertValidSlug(slug: string, field = "slug"): void {
  if (slug.length < MIN_LENGTH) {
    throw new DomainError(`O endereço precisa ter ao menos ${MIN_LENGTH} letras.`, field);
  }
  if (slug.length > MAX_LENGTH) {
    throw new DomainError(`O endereço pode ter no máximo ${MAX_LENGTH} letras.`, field);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new DomainError(
      "Use apenas letras sem acento, números e hífen — como studio-marina.",
      field,
    );
  }
  if (RESERVED.has(slug)) {
    throw new DomainError("Esse endereço é reservado. Escolha outro, por favor.", field);
  }
}

/**
 * Primeiro apelido livre a partir de uma base.
 *
 * Dois estúdios com o mesmo nome existem, e o segundo não pode ficar sem
 * endereço: `studio-marina`, `studio-marina-2`, `studio-marina-3`. O sufixo é o
 * menor que resolve, e não um código aleatório — quem escolheu o nome ainda
 * reconhece o endereço.
 */
export function nextAvailableSlug(base: string, taken: (slug: string) => boolean): string {
  const raiz = slugify(base) || "agenda";

  if (raiz.length >= MIN_LENGTH && !RESERVED.has(raiz) && !taken(raiz)) return raiz;

  for (let sufixo = 2; sufixo < 1000; sufixo += 1) {
    const corte = Math.max(MIN_LENGTH, MAX_LENGTH - String(sufixo).length - 1);
    const candidato = `${raiz.slice(0, corte).replace(/-+$/, "")}-${sufixo}`;
    if (!RESERVED.has(candidato) && !taken(candidato)) return candidato;
  }

  throw new DomainError("Não conseguimos criar um endereço. Escolha um nome diferente.", "slug");
}

/** Sugestão a partir do nome do negócio, para ela não começar do zero. */
export function suggestSlug(businessName: string | null): string | null {
  if (!businessName) return null;

  const sugestao = slugify(businessName);
  if (sugestao.length < MIN_LENGTH || RESERVED.has(sugestao)) return null;

  return sugestao;
}
