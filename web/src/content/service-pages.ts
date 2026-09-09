import type { CalculatorPreset } from "@/components/calculator";

/**
 * Páginas por intenção de busca do item C-04, uma para cada busca listada na
 * seção 7 do documento 05.
 *
 * O conteúdo mora aqui, e não dentro dos componentes, para que a regra de
 * comunicação do documento seja auditável em um arquivo só: nenhum texto
 * promete resultado financeiro e nenhum cita preço praticado por outra
 * profissional. Os números dos exemplos são custos de entrada — o que a
 * profissional gasta —, nunca referência de quanto cobrar.
 */

export type ExampleLine = {
  label: string;
  value: string;
  /** Por que este número entra na conta; é o que a página tem de didático. */
  note: string;
};

export type ServicePage = {
  slug: string;
  /** Repete a busca da profissional, como pede a mensagem padrão de aquisição. */
  heading: string;
  metaTitle: string;
  metaDescription: string;
  segment: string;
  intro: string;
  /** Frase curta da imagem de compartilhamento, gerada em `opengraph-image`. */
  shareLine: string;
  example: {
    title: string;
    summary: string;
    lines: ExampleLine[];
  };
  commonCosts: { name: string; detail: string }[];
  faq: { question: string; answer: string }[];
  preset: CalculatorPreset;
  related: string[];
};

const ESTIMATE_NOTE =
  "Os números do exemplo são só um ponto de partida. Troque cada um pelos seus na calculadora: o resultado depende inteiramente do que você informar.";

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "quanto-cobrar-alongamento-de-unha",
    heading: "Quanto cobrar por alongamento de unha?",
    metaTitle: "Quanto cobrar por alongamento de unha | Calculadora grátis",
    metaDescription:
      "Calcule o preço do alongamento de unha considerando material, tempo de trabalho, aluguel, energia e outros custos. Grátis e sem cadastro.",
    segment: "Unhas",
    shareLine: "Material, tempo e custos fixos na mesma conta.",
    intro:
      "O alongamento é um dos serviços mais demorados da cabine, e é por isso que ele costuma ser o mais difícil de precificar: o material aparece na nota, mas as três horas de cadeira e a parte do aluguel que aquele atendimento consome não aparecem em lugar nenhum. A calculadora abaixo coloca os três na mesma conta.",
    example: {
      title: "Exemplo de alongamento em gel com molde",
      summary:
        "Uma profissional que atende em cabine alugada, faz o alongamento em duas horas e meia e trabalha cerca de 150 horas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 34,50", note: "Gel, primer, molde, lixas, algodão e descartáveis, contando só a fração usada em uma cliente." },
        { label: "Tempo de cadeira", value: "2 h 30", note: "Do preparo à finalização, incluindo o tempo de curar cada camada." },
        { label: "Valor da sua hora", value: "R$ 32,00", note: "Quanto a profissional decidiu que vale a própria hora de trabalho — é a retirada dela, não o lucro do negócio." },
        { label: "Custos fixos do mês", value: "R$ 1.200,00", note: "Aluguel da cabine, energia, internet, cursos e o que mais é pago exista atendimento ou não." },
        { label: "Horas produtivas no mês", value: "150 h", note: "Só as horas realmente atendendo. É esse número que divide o custo fixo entre os atendimentos." },
      ],
    },
    commonCosts: [
      { name: "Gel construtor e base", detail: "Divida o preço do pote pela quantidade que rende para chegar ao custo de uma cliente." },
      { name: "Moldes, tips e cola", detail: "Compre em quantidade e calcule por unidade usada, não por embalagem." },
      { name: "Lixas, buffers e brocas", detail: "Duram vários atendimentos; estime quantos e divida o preço por esse número." },
      { name: "Descartáveis e biossegurança", detail: "Luvas, máscara, lixa descartável, álcool e o que for jogado fora depois de cada cliente." },
      { name: "Energia da cabine de LED", detail: "Entra nos custos fixos do mês, junto da conta de luz." },
      { name: "Depreciação dos equipamentos", detail: "Cabine, motor e mesa se desgastam; reserve um valor mensal para repor." },
    ],
    faq: [
      { question: "O alongamento e a manutenção devem ter o mesmo preço?", answer: "Não. A manutenção costuma gastar menos material e menos tempo de cadeira, então a conta muda. Calcule os dois separadamente, cada um com o próprio material e a própria duração." },
      { question: "Preciso contar o tempo de secagem?", answer: "Sim, se você fica na cabine durante esse tempo. O que ocupa a sua agenda entra na duração do atendimento, mesmo que você não esteja com a mão na cliente." },
      { question: "Como calculo o custo de um pote de gel que dura meses?", answer: "Divida o preço do pote pela quantidade de atendimentos que ele rende. Se um pote de R$ 90 rende 24 alongamentos, o custo por cliente é R$ 3,75, mais a perda." },
      { question: "E se o meu preço calculado ficar acima do que eu cobro hoje?", answer: "O resultado mostra o que o serviço custa para você e a margem que você pediu. A decisão de ajustar, e em que ritmo, continua sendo sua — a calculadora não decide isso." },
    ],
    preset: {
      serviceLabel: "Alongamento de unha em gel",
      materialCost: 34.5,
      hours: 2,
      minutes: 30,
      hourlyRate: 32,
      monthlyFixedCosts: 1200,
      monthlyProductiveHours: 150,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-unha-em-gel", "quanto-cobrar-fibra-de-vidro", "calculadora-de-preco-de-manicure"],
  },
  {
    slug: "calculadora-de-preco-de-manicure",
    heading: "Calculadora de preço de manicure",
    metaTitle: "Calculadora de preço de manicure | Grátis e sem cadastro",
    metaDescription:
      "Descubra quanto cobrar pela manicure considerando esmalte, descartáveis, tempo de atendimento e custos fixos. Calcule grátis, sem cadastro.",
    segment: "Unhas",
    shareLine: "O serviço mais rápido também precisa cobrir o custo fixo.",
    intro:
      "A manicure é rápida e o material por cliente é baixo, o que engana: como o atendimento é curto, muita gente esquece de somar a parte do aluguel e da energia que ele consome. Em serviços de tíquete pequeno, é justamente esse pedaço que decide se sobra alguma coisa no fim do mês.",
    example: {
      title: "Exemplo de manicure tradicional",
      summary:
        "Uma profissional que atende em casa, faz mãos em cinquenta minutos e trabalha cerca de 160 horas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 6,80", note: "Esmalte, base, removedor, algodão, lixa e palito, contando só a fração usada." },
        { label: "Tempo de atendimento", value: "50 min", note: "Do preparo da cutícula à última demão, incluindo a organização entre uma cliente e outra." },
        { label: "Valor da sua hora", value: "R$ 28,00", note: "A remuneração do seu trabalho, separada do lucro do negócio." },
        { label: "Custos fixos do mês", value: "R$ 900,00", note: "Parte da conta de luz e água, internet, produtos de limpeza e reposição de ferramentas." },
        { label: "Horas produtivas no mês", value: "160 h", note: "Só o tempo em atendimento, sem contar deslocamento, divulgação e agenda vazia." },
      ],
    },
    commonCosts: [
      { name: "Esmaltes, base e extra brilho", detail: "Um vidro rende muitos atendimentos; divida o preço pelo número de clientes que ele atende." },
      { name: "Algodão, palito e lixa", detail: "Descartáveis que somam pouco por cliente e muito no mês." },
      { name: "Esterilização e biossegurança", detail: "Autoclave, envelopes, álcool e luvas entram no custo do atendimento." },
      { name: "Alicate e ferramentas", detail: "Têm vida útil; reserve um valor mensal para afiar e repor." },
      { name: "Água, luz e produtos de limpeza", detail: "Entram nos custos fixos do mês, mesmo quando você atende em casa." },
      { name: "Deslocamento, se atende a domicílio", detail: "Combustível ou transporte de cada visita é custo direto do atendimento." },
    ],
    faq: [
      { question: "Vale a pena cobrar mãos e pés como combo?", answer: "O combo só faz sentido quando você conhece o custo de cada um separado. Calcule mãos, calcule pés, some e então decida se quer oferecer alguma condição no conjunto." },
      { question: "Como incluir o tempo de esterilização?", answer: "Se a esterilização acontece entre atendimentos e ocupa a sua agenda, some esses minutos à duração. Se acontece em lote no fim do dia, ela entra como custo fixo do mês." },
      { question: "Atendo em casa, tenho custo fixo?", answer: "Sim. A parte da luz, da água, da internet e dos produtos de limpeza que o seu trabalho consome é custo fixo, mesmo sem aluguel de sala." },
      { question: "O que fazer quando o preço calculado parece alto para um serviço rápido?", answer: "Revise as horas produtivas: quanto menos horas atendendo no mês, maior o pedaço do custo fixo que cai em cada cliente. Esse número costuma ser o que mais muda o resultado." },
    ],
    preset: {
      serviceLabel: "Manicure tradicional",
      materialCost: 6.8,
      hours: 0,
      minutes: 50,
      hourlyRate: 28,
      monthlyFixedCosts: 900,
      monthlyProductiveHours: 160,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-alongamento-de-unha", "quanto-cobrar-unha-em-gel", "quanto-cobrar-fibra-de-vidro"],
  },
  {
    slug: "quanto-cobrar-unha-em-gel",
    heading: "Quanto cobrar por unha em gel?",
    metaTitle: "Quanto cobrar por unha em gel | Calculadora grátis",
    metaDescription:
      "Calcule o preço da unha em gel com material, tempo de cabine, custos fixos e a margem que você quiser. Grátis, sem cadastro.",
    segment: "Unhas",
    shareLine: "Do pote de gel ao custo de uma cliente.",
    intro:
      "Na unha em gel, quase todo o material vem de potes e frascos que duram semanas. O erro mais comum é olhar o preço da compra e não o custo por atendimento. Aqui a conta começa por essa divisão e termina no preço que cobre custo, seu trabalho e a margem que você definir.",
    example: {
      title: "Exemplo de aplicação em gel na unha natural",
      summary:
        "Uma profissional que trabalha em salão próprio, faz a aplicação em duas horas e mantém cerca de 150 horas produtivas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 28,90", note: "Base, gel de cor, top coat, primer, lixas e descartáveis, na fração usada por cliente." },
        { label: "Tempo de cadeira", value: "2 h", note: "Preparo, aplicação, curas e finalização." },
        { label: "Valor da sua hora", value: "R$ 32,00", note: "O que remunera o seu trabalho; o lucro do negócio vem depois, na margem." },
        { label: "Custos fixos do mês", value: "R$ 1.200,00", note: "Aluguel, energia, internet, software e reposição de equipamento." },
        { label: "Horas produtivas no mês", value: "150 h", note: "Horas em atendimento, que é o que divide o custo fixo." },
      ],
    },
    commonCosts: [
      { name: "Gel de cor, base e top coat", detail: "Estime quantas clientes cada frasco atende e divida o preço por esse número." },
      { name: "Primer, desidratador e removedor", detail: "Rendem muitos atendimentos, mas não são de graça: entram por fração." },
      { name: "Lixas, brocas e buffers", detail: "Custo por atendimento é o preço dividido pela vida útil em número de clientes." },
      { name: "Cabine de LED e motor", detail: "Reserve um valor por mês para repor o equipamento quando ele acabar." },
      { name: "Descartáveis e esterilização", detail: "Luvas, máscara, envelopes e álcool a cada cliente." },
      { name: "Perda de material", detail: "O que resseca, entorna ou vence também foi pago; some uma porcentagem de perda." },
    ],
    faq: [
      { question: "Devo cobrar a mesma coisa da aplicação e da manutenção?", answer: "Calcule separado. A manutenção normalmente usa menos gel e menos tempo, então o custo é outro e o preço também." },
      { question: "Como estimo a perda de material?", answer: "Olhe quanto você joga fora em um mês em relação ao que usa. Uma perda de 5% a 10% costuma ser suficiente para não subestimar o custo." },
      { question: "A decoração entra no preço?", answer: "Se ela consome material e tempo, entra. O caminho mais simples é calcular o serviço base e tratar a decoração como um adicional, com o próprio material e a própria duração." },
      { question: "Meu preço deve mudar quando eu troco de marca de gel?", answer: "O custo muda, então o resultado muda. Refaça o cálculo com o novo custo de material antes de decidir se o preço acompanha." },
    ],
    preset: {
      serviceLabel: "Unha em gel",
      materialCost: 28.9,
      hours: 2,
      minutes: 0,
      hourlyRate: 32,
      monthlyFixedCosts: 1200,
      monthlyProductiveHours: 150,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-alongamento-de-unha", "quanto-cobrar-fibra-de-vidro", "calculadora-de-preco-de-manicure"],
  },
  {
    slug: "quanto-cobrar-fibra-de-vidro",
    heading: "Quanto cobrar por fibra de vidro?",
    metaTitle: "Quanto cobrar por fibra de vidro | Calculadora grátis",
    metaDescription:
      "Calcule o preço do alongamento em fibra de vidro somando material, tempo de trabalho e custos fixos. Calculadora grátis, sem cadastro.",
    segment: "Unhas",
    shareLine: "Técnica demorada pede conta de tempo bem feita.",
    intro:
      "A fibra de vidro é uma técnica de execução longa e material específico. Quando o preço é definido no olho, o que costuma ficar de fora é o tempo: cada meia hora a mais de cadeira é uma cliente a menos no dia. A calculadora trata a sua hora como custo, que é o que ela é.",
    example: {
      title: "Exemplo de alongamento em fibra de vidro",
      summary:
        "Uma profissional que atende em espaço compartilhado, leva duas horas e cinquenta minutos por cliente e mantém cerca de 150 horas produtivas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 41,00", note: "Fibra, resina, ativador, moldes, lixas e descartáveis usados em uma cliente." },
        { label: "Tempo de cadeira", value: "2 h 50", note: "Preparo, montagem da fibra, banho de resina, lixamento e finalização." },
        { label: "Valor da sua hora", value: "R$ 35,00", note: "A remuneração de quem executa a técnica, separada do lucro do negócio." },
        { label: "Custos fixos do mês", value: "R$ 1.300,00", note: "Aluguel do espaço, energia, internet e reserva para repor equipamento." },
        { label: "Horas produtivas no mês", value: "150 h", note: "Só as horas atendendo, que é o que divide o custo fixo." },
      ],
    },
    commonCosts: [
      { name: "Fibra de vidro em rolo", detail: "Meça quantos centímetros você usa por cliente e divida o preço do rolo por isso." },
      { name: "Resina e ativador", detail: "Frascos pequenos e de uso rápido; calcule por fração e conte a perda." },
      { name: "Moldes e tips", detail: "Custo por unidade usada, não por pacote comprado." },
      { name: "Lixas, brocas e buffers", detail: "A técnica desgasta bastante; considere a vida útil real." },
      { name: "Descartáveis e biossegurança", detail: "Luvas, máscara e álcool a cada atendimento." },
      { name: "Aspirador de pó de unha", detail: "Equipamento com desgaste; reserve um valor mensal para reposição." },
    ],
    faq: [
      { question: "A fibra deve custar mais que o gel?", answer: "Depende inteiramente do seu material e da sua duração. Calcule as duas técnicas com os seus números e compare os resultados; não existe regra fixa entre elas." },
      { question: "Como calcular o custo da fibra vendida em rolo?", answer: "Divida o preço do rolo pelo comprimento total e multiplique pelo que você usa em uma cliente. Some uma porcentagem de perda para o que sobra e é descartado." },
      { question: "Refazer uma unha quebrada entra na conta?", answer: "Se o reparo é cortesia, ele é custo de material e tempo que precisa estar previsto no preço do serviço. Se é cobrado, calcule como serviço próprio." },
      { question: "Preciso mudar o preço quando fico mais rápida?", answer: "O custo cai quando a duração cai. Refaça o cálculo e veja o resultado; a decisão de repassar isso ao preço ou manter a diferença como margem é sua." },
    ],
    preset: {
      serviceLabel: "Alongamento em fibra de vidro",
      materialCost: 41,
      hours: 2,
      minutes: 50,
      hourlyRate: 35,
      monthlyFixedCosts: 1300,
      monthlyProductiveHours: 150,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-alongamento-de-unha", "quanto-cobrar-unha-em-gel", "calculadora-de-preco-de-manicure"],
  },
  {
    slug: "quanto-cobrar-extensao-de-cilios",
    heading: "Quanto cobrar por extensão de cílios?",
    metaTitle: "Quanto cobrar por extensão de cílios | Calculadora grátis",
    metaDescription:
      "Calcule o preço da extensão de cílios com o custo real das bandejas, da cola, do seu tempo e dos custos fixos. Grátis, sem cadastro.",
    segment: "Cílios",
    shareLine: "Bandeja, cola e tempo de maca na mesma conta.",
    intro:
      "Na extensão de cílios, a maior parte do custo é tempo. A bandeja rende muitas aplicações e a cola vence rápido, então a conta precisa de duas coisas que ninguém faz de cabeça: o custo por fio realmente usado e a fração dos custos fixos que aquelas duas horas de maca consomem.",
    example: {
      title: "Exemplo de aplicação fio a fio clássico",
      summary:
        "Uma profissional que atende em sala alugada, aplica em duas horas e mantém cerca de 140 horas produtivas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 22,40", note: "Fios da bandeja, cola, primer, fita micropore, pads e descartáveis, na fração usada." },
        { label: "Tempo de maca", value: "2 h", note: "Higienização, isolamento, aplicação e finalização." },
        { label: "Valor da sua hora", value: "R$ 34,00", note: "A remuneração do seu trabalho de precisão, separada do lucro do negócio." },
        { label: "Custos fixos do mês", value: "R$ 1.100,00", note: "Aluguel da sala, energia, ar-condicionado, internet e reposição de maca e iluminação." },
        { label: "Horas produtivas no mês", value: "140 h", note: "Horas efetivamente em atendimento." },
      ],
    },
    commonCosts: [
      { name: "Bandeja de fios", detail: "Estime quantas aplicações uma bandeja rende e divida o preço por esse número." },
      { name: "Cola", detail: "Vence poucas semanas depois de aberta; conte o que é descartado como perda." },
      { name: "Primer, removedor e selante", detail: "Frascos de longa duração que entram por fração." },
      { name: "Pads, micropore e descartáveis", detail: "Uso por cliente, direto no custo do atendimento." },
      { name: "Pinças e iluminação", detail: "Ferramentas com vida útil; reserve valor mensal para repor." },
      { name: "Climatização da sala", detail: "Umidade e temperatura controladas custam energia; entra nos custos fixos." },
    ],
    faq: [
      { question: "A manutenção deve custar menos que a aplicação?", answer: "Ela costuma usar menos fios e menos tempo, então o custo é menor. Mas isso precisa sair da conta, não do costume: calcule a manutenção com a duração e o material dela." },
      { question: "Como conto a cola que vence antes de acabar?", answer: "Como perda. Se você descarta cerca de um terço de cada frasco, o custo por atendimento é o da cola efetivamente disponível, não o do frasco inteiro." },
      { question: "Preciso cobrar a retirada separadamente?", answer: "Se ela ocupa a sua agenda e consome removedor e descartáveis, é um serviço com custo próprio. Calcule à parte e decida se cobra ou se inclui." },
      { question: "O tempo de higienização entra na duração?", answer: "Sim. Todo minuto em que a maca está ocupada é minuto que não recebe outra cliente." },
    ],
    preset: {
      serviceLabel: "Extensão de cílios fio a fio",
      materialCost: 22.4,
      hours: 2,
      minutes: 0,
      hourlyRate: 34,
      monthlyFixedCosts: 1100,
      monthlyProductiveHours: 140,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-volume-brasileiro", "quanto-cobrar-procedimento-estetico", "calculadora-de-preco-para-cabeleireiro"],
  },
  {
    slug: "quanto-cobrar-volume-brasileiro",
    heading: "Quanto cobrar por volume brasileiro?",
    metaTitle: "Quanto cobrar por volume brasileiro | Calculadora grátis",
    metaDescription:
      "Calcule o preço do volume brasileiro considerando fios, cola, tempo de aplicação e custos fixos do seu espaço. Grátis, sem cadastro.",
    segment: "Cílios",
    shareLine: "Mais fios e mais tempo mudam a conta.",
    intro:
      "O volume brasileiro consome mais fios e mais tempo de maca que o clássico, e as duas coisas precisam aparecer no preço. A calculadora separa o que é material, o que é a sua hora e o que é estrutura, para você ver de onde vem cada real do resultado.",
    example: {
      title: "Exemplo de aplicação em volume brasileiro",
      summary:
        "Uma profissional que atende em sala alugada, aplica em duas horas e vinte minutos e mantém cerca de 140 horas produtivas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 27,60", note: "Fios em maior quantidade, cola, primer, pads, micropore e descartáveis." },
        { label: "Tempo de maca", value: "2 h 20", note: "Higienização, isolamento, montagem dos leques e finalização." },
        { label: "Valor da sua hora", value: "R$ 36,00", note: "A remuneração de uma técnica que exige mais treino e mais atenção." },
        { label: "Custos fixos do mês", value: "R$ 1.100,00", note: "Aluguel, energia, climatização, internet e reposição de equipamento." },
        { label: "Horas produtivas no mês", value: "140 h", note: "Horas em atendimento, que dividem o custo fixo." },
      ],
    },
    commonCosts: [
      { name: "Fios de volume", detail: "O consumo por cliente é maior que no clássico; recalcule o rendimento da bandeja." },
      { name: "Cola de secagem rápida", detail: "Vence depois de aberta; conte o descarte como perda." },
      { name: "Pinças de volume", detail: "Ferramenta específica com vida útil própria; reserve valor para repor." },
      { name: "Pads, micropore e primer", detail: "Consumo por atendimento, direto no custo." },
      { name: "Climatização e iluminação", detail: "Custos fixos do espaço, rateados pelas horas produtivas." },
      { name: "Treinamento e reciclagem", detail: "Cursos são custo fixo do mês em que você os paga; diluí-los ajuda a não esquecer deles." },
    ],
    faq: [
      { question: "O volume precisa custar mais que o fio a fio clássico?", answer: "Ele costuma consumir mais material e mais tempo, e isso aparece no cálculo. Compare os dois resultados usando os seus números, em vez de aplicar uma diferença fixa." },
      { question: "Como calculo o rendimento da bandeja no volume?", answer: "Conte quantas aplicações você faz com uma bandeja na prática do volume, que é menos que no clássico, e divida o preço por esse número." },
      { question: "Vale a pena oferecer volume se demoro mais?", answer: "A calculadora mostra o custo e a margem de cada técnica com os seus números. A escolha do que oferecer e em que proporção continua sendo uma decisão sua." },
      { question: "Como incluir o curso que fiz para aprender a técnica?", answer: "Cursos entram nos custos fixos do mês em que foram pagos, ou como um valor mensal reservado para formação. O importante é que não fiquem invisíveis." },
    ],
    preset: {
      serviceLabel: "Volume brasileiro",
      materialCost: 27.6,
      hours: 2,
      minutes: 20,
      hourlyRate: 36,
      monthlyFixedCosts: 1100,
      monthlyProductiveHours: 140,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-extensao-de-cilios", "quanto-cobrar-procedimento-estetico", "quanto-cobrar-alongamento-de-unha"],
  },
  {
    slug: "calculadora-de-preco-para-cabeleireiro",
    heading: "Calculadora de preço para cabeleireiro",
    metaTitle: "Calculadora de preço para cabeleireiro | Grátis e sem cadastro",
    metaDescription:
      "Calcule o preço de corte, escova e química somando produto, tempo de cadeira e custos fixos do salão. Grátis, sem cadastro.",
    segment: "Cabelo",
    shareLine: "Produto, cadeira e estrutura em um número só.",
    intro:
      "No cabelo, o material varia muito de uma cliente para outra: comprimento, espessura e técnica mudam o consumo de produto e o tempo de cadeira. Por isso a conta funciona melhor por serviço, com o seu consumo médio, do que por tabela decorada.",
    example: {
      title: "Exemplo de corte com escova",
      summary:
        "Uma profissional que atende em salão próprio, leva uma hora e vinte por cliente e mantém cerca de 160 horas produtivas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 12,30", note: "Shampoo, condicionador, protetor térmico, finalizador e descartáveis, na fração usada." },
        { label: "Tempo de cadeira", value: "1 h 20", note: "Lavagem, corte, escova e finalização." },
        { label: "Valor da sua hora", value: "R$ 30,00", note: "A remuneração do seu trabalho, separada do lucro do salão." },
        { label: "Custos fixos do mês", value: "R$ 1.500,00", note: "Aluguel, energia, água, internet, produtos de limpeza e reposição de secador e prancha." },
        { label: "Horas produtivas no mês", value: "160 h", note: "Só as horas com cliente na cadeira." },
      ],
    },
    commonCosts: [
      { name: "Shampoo, condicionador e máscara", detail: "Divida o preço do litro pelo consumo médio por cliente." },
      { name: "Coloração, pó e oxidante", detail: "Pese o que você usa; a diferença entre cabelos curtos e longos é grande." },
      { name: "Protetor térmico e finalizadores", detail: "Frascos duram muito, mas o custo por cliente existe." },
      { name: "Toalhas, capas e descartáveis", detail: "Lavagem de toalhas também é custo, de água, energia e sabão." },
      { name: "Secador, prancha e tesouras", detail: "Equipamento com desgaste; reserve um valor mensal para repor." },
      { name: "Água e energia do lavatório", detail: "Entram nos custos fixos do mês do salão." },
    ],
    faq: [
      { question: "Como cobrar quando o consumo muda com o comprimento do cabelo?", answer: "Calcule uma versão do serviço para cada faixa de comprimento, mudando só o custo de material e a duração. São cálculos diferentes porque são custos diferentes." },
      { question: "A química deve ser calculada junto com o corte?", answer: "Não. Cada serviço tem material e duração próprios. Calcule separadamente e some quando a cliente levar os dois." },
      { question: "Como conto o tempo de pausa da coloração?", answer: "Se você fica no salão sem poder atender outra pessoa, é tempo produtivo do atendimento. Se consegue atender outra cliente nesse intervalo, não conte duas vezes." },
      { question: "Assistente e comissão entram na conta?", answer: "Se você paga alguém por atendimento, isso é custo direto do serviço. Use o campo de outros custos ou some ao material antes de calcular." },
    ],
    preset: {
      serviceLabel: "Corte com escova",
      materialCost: 12.3,
      hours: 1,
      minutes: 20,
      hourlyRate: 30,
      monthlyFixedCosts: 1500,
      monthlyProductiveHours: 160,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["quanto-cobrar-procedimento-estetico", "quanto-cobrar-extensao-de-cilios", "calculadora-de-preco-de-manicure"],
  },
  {
    slug: "quanto-cobrar-procedimento-estetico",
    heading: "Quanto cobrar por procedimento estético?",
    metaTitle: "Quanto cobrar por procedimento estético | Calculadora grátis",
    metaDescription:
      "Calcule o preço do procedimento estético somando produto, aparelho, tempo de maca e custos fixos da sala. Grátis, sem cadastro.",
    segment: "Estética",
    shareLine: "Aparelho também se desgasta, e isso é custo.",
    intro:
      "Em estética, boa parte do custo está no que não se vê na nota: o aparelho que vai precisar de manutenção, a sala climatizada e o protocolo que ocupa a maca por uma hora e meia. A calculadora coloca material, tempo e estrutura lado a lado para você enxergar o custo real de cada sessão.",
    example: {
      title: "Exemplo de limpeza de pele profunda",
      summary:
        "Uma profissional que atende em sala alugada, faz o protocolo em uma hora e meia e mantém cerca de 130 horas produtivas por mês.",
      lines: [
        { label: "Material do atendimento", value: "R$ 19,80", note: "Higienizante, esfoliante, ativos, máscara, algodão e descartáveis usados na sessão." },
        { label: "Tempo de maca", value: "1 h 30", note: "Avaliação, higienização, extração, máscara e finalização." },
        { label: "Valor da sua hora", value: "R$ 38,00", note: "A remuneração do seu trabalho técnico, separada do lucro do negócio." },
        { label: "Custos fixos do mês", value: "R$ 1.600,00", note: "Aluguel, energia, água, internet, manutenção de aparelhos e descarte de resíduos." },
        { label: "Horas produtivas no mês", value: "130 h", note: "Horas com cliente na maca, que dividem o custo fixo." },
      ],
    },
    commonCosts: [
      { name: "Ativos e cosméticos profissionais", detail: "Frascos de alto valor; calcule o custo por sessão a partir do rendimento real." },
      { name: "Descartáveis e biossegurança", detail: "Luvas, toucas, lençóis, agulhas e algodão a cada atendimento." },
      { name: "Manutenção de aparelhos", detail: "Calibração e reposição de peças; reserve um valor mensal." },
      { name: "Descarte de resíduos", detail: "Coleta de perfurocortantes e resíduos de saúde é custo fixo recorrente." },
      { name: "Vapor de ozônio, alta frequência e afins", detail: "Consomem energia e têm desgaste; entram no custo fixo e na reserva de reposição." },
      { name: "Registro profissional e formação", detail: "Anuidades e reciclagem entram como custo fixo do mês." },
    ],
    faq: [
      { question: "Como precificar um protocolo com várias sessões?", answer: "Calcule uma sessão com o material e a duração dela e multiplique pelo número de sessões. Se o material muda entre as sessões, calcule cada uma." },
      { question: "O desgaste do aparelho entra onde?", answer: "Nos custos fixos do mês, como uma reserva para manutenção e reposição. Assim ele é rateado entre todos os atendimentos, que é como o desgaste acontece." },
      { question: "Devo cobrar a avaliação inicial?", answer: "Ela ocupa a sua agenda e por isso tem custo. Calcule a avaliação como um serviço próprio e depois decida se cobra ou se inclui no protocolo." },
      { question: "E os pacotes com desconto?", answer: "Calcule primeiro o preço de uma sessão. Só assim você sabe quanta margem cada condição de pacote consome antes de oferecê-la." },
    ],
    preset: {
      serviceLabel: "Limpeza de pele profunda",
      materialCost: 19.8,
      hours: 1,
      minutes: 30,
      hourlyRate: 38,
      monthlyFixedCosts: 1600,
      monthlyProductiveHours: 130,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
      currentPrice: 0,
    },
    related: ["calculadora-de-preco-para-cabeleireiro", "quanto-cobrar-extensao-de-cilios", "quanto-cobrar-volume-brasileiro"],
  },
];

export const EXAMPLE_DISCLAIMER = ESTIMATE_NOTE;

export const findServicePage = (slug: string): ServicePage | undefined =>
  SERVICE_PAGES.find((page) => page.slug === slug);
