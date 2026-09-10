import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";

/**
 * Limites de requisição das rotas abertas.
 *
 * Duas ameaças diferentes justificam isto, e as duas são concretas:
 *
 * 1. **Força bruta.** A senha mínima tem 8 caracteres e não exige classes de
 *    caractere, então uma lista das mil senhas mais comuns encontra conta real
 *    se puder ser tentada sem obstáculo.
 * 2. **Negação de serviço pelo próprio custo do scrypt.** Cada tentativa de
 *    entrada custa dezenas de milissegundos de CPU e alguns megabytes, e o
 *    scrypt do Node roda no threadpool do libuv — o mesmo do resto do processo.
 *    Poucas dezenas de tentativas por segundo enfileiram o threadpool e derrubam
 *    até a calculadora pública, que é a porta de entrada do produto.
 *
 * A mensagem é a mesma que a interface exibe, em português e sem jargão.
 */

const RESPOSTA = {
  error: "too_many_requests",
  message: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
};

/** Base comum: janela de 15 minutos e cabeçalhos padronizados. */
function criar(limite: number, janelaMs = 15 * 60 * 1000): RateLimitRequestHandler {
  return rateLimit({
    windowMs: janelaMs,
    limit: limite,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: RESPOSTA,
  });
}

export type RateLimiters = {
  session: RateLimitRequestHandler;
  /** Segundo teto da entrada, contado por e-mail em vez de por endereço. */
  sessionByEmail: RateLimitRequestHandler;
  account: RateLimitRequestHandler;
  webhook: RateLimitRequestHandler;
  public: RateLimitRequestHandler;
  write: RateLimitRequestHandler;
  booking: RateLimitRequestHandler;
};

/**
 * Cria um conjunto por aplicação, e não no escopo do módulo.
 *
 * Contador em variável de módulo é estado global: duas aplicações no mesmo
 * processo — o caso da suíte, que monta uma por teste — dividiriam o mesmo teto
 * e um teste derrubaria o outro por um motivo que não aparece em lugar nenhum.
 */
export function createRateLimiters(): RateLimiters {
  return {
    session: sessionLimiter(),
    sessionByEmail: emailLimiter(),
    account: accountLimiter(),
    webhook: webhookLimiter(),
    public: publicLimiter(),
    write: writeLimiter(),
    booking: bookingLimiter(),
  };
}

/**
 * Entrada na conta, contada por endereço de rede.
 *
 * Pega a força bruta clássica — muitas senhas contra a mesma origem — e a
 * varredura de muitas contas com uma senha comum em cada.
 */
const sessionLimiter = () => criar(10);

/**
 * Entrada na conta, contada por e-mail.
 *
 * O teto por endereço sozinho não protege a conta: quem ataca de uma botnet, ou
 * simplesmente trocando de rede móvel, tem endereços de sobra e nunca esbarra
 * nele. Contar também por e-mail faz o custo do ataque acompanhar o alvo, e não
 * a origem.
 *
 * O teto é mais generoso que o por endereço porque aqui o falso positivo é
 * outro: quem erra a própria senha várias vezes é a dona da conta, e trancá-la
 * cedo demais transforma esquecimento em suporte — ainda mais sem recuperação
 * de senha por e-mail, que este produto não tem.
 */
const emailLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: RESPOSTA,
    /**
     * A chave é o e-mail tentado, normalizado como o cadastro normaliza.
     *
     * Corpo sem e-mail cai no endereço, para nunca ficar sem chave — e aí passa
     * por `ipKeyGenerator`, que agrupa o bloco /64 do IPv6. Usar `req.ip` cru
     * ali deixaria quem tem IPv6 burlar o teto trocando de endereço dentro da
     * própria faixa, que é coisa que um provedor entrega aos milhares.
     */
    keyGenerator: (req) => {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      if (typeof email === "string" && email.trim()) {
        return `email:${email.trim().toLowerCase()}`;
      }
      return `ip:${ipKeyGenerator(req.ip ?? "desconhecido")}`;
    },
  });

/** Cadastro e troca de senha: mesmo custo de CPU da entrada. */
const accountLimiter = () => criar(20);

/**
 * Webhooks de cobrança.
 *
 * Teto alto porque quem chama é o processador e uma reentrega legítima em massa
 * não pode ser barrada — mas existe, porque a rota grava uma linha no banco por
 * requisição.
 */
const webhookLimiter = () => criar(300, 60 * 1000);

/**
 * Calculadora pública e catálogos.
 *
 * Generoso de propósito: é a rota que o produto quer que as pessoas usem, e
 * várias profissionais podem sair do mesmo endereço de rede — de um salão, de
 * um curso ou de uma operadora móvel.
 */
const publicLimiter = () => criar(300);

/**
 * Escrita autenticada.
 *
 * Criar material, custo, serviço ou negócio passa por uma transação que segura
 * um bloqueio de linha até terminar — é o que impede a corrida no limite de
 * plano. O efeito colateral é que muitas criações simultâneas viram uma fila de
 * transações abertas, e transação aberta ocupa conexão do pool.
 *
 * O teto é generoso para o uso real, em que ninguém cadastra material aos
 * milhares, e existe para que uma conta sozinha não consiga esgotar o pool e
 * derrubar a API para as demais.
 */
const writeLimiter = () => criar(120);

/**
 * Agendamento pela agenda pública.
 *
 * Cria registro na agenda de outra pessoa sem exigir conta. O link secreto
 * impede que estranhos achem a página, mas não impede que quem recebeu o link
 * — ou quem o repassou — encha a agenda. Cinco por quinze minutos cobre a
 * cliente que erra e tenta de novo, e trava o resto.
 */
const bookingLimiter = () => criar(5);
