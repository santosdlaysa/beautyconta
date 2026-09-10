/**
 * Catálogos do documento 06.
 *
 * As listas vivem no código, e não em tabela, por três motivos declarados no
 * documento: o `slug` nunca é renomeado, o rótulo pode mudar sem migração e
 * nenhuma regra do motor depende de categoria. Servir a lista a partir daqui
 * torna a semente idempotente por construção, que é o critério do item B-02.
 *
 * Categoria personalizada da usuária é texto livre gravado no registro dela e
 * jamais aparece nestas listas.
 */

export const SEGMENTS = [
  { slug: "nails", label: "Unhas" },
  { slug: "lashes", label: "Cílios" },
  { slug: "brows", label: "Sobrancelhas" },
  { slug: "hair", label: "Cabelo" },
  { slug: "esthetics", label: "Estética" },
  { slug: "makeup", label: "Maquiagem" },
  { slug: "waxing", label: "Depilação" },
  { slug: "other", label: "Outro" },
] as const;

export type SegmentSlug = (typeof SEGMENTS)[number]["slug"];

export const WORK_MODELS = [
  { slug: "home", label: "Em casa" },
  { slug: "own_salon", label: "Salão próprio" },
  { slug: "rented_station", label: "Cabine ou espaço alugado" },
  { slug: "shared_space", label: "Espaço compartilhado" },
  { slug: "mobile", label: "Atendimento domiciliar" },
] as const;

export type WorkModelSlug = (typeof WORK_MODELS)[number]["slug"];

/**
 * Unidades da seção 4 do documento 06. `family` e `factor` existem para
 * converter compra e uso; `box` e `custom` não têm família porque dependem de
 * informação que só a usuária tem.
 */
export const UNITS = [
  { slug: "unit", label: "unidade", family: "count", factor: 1 },
  { slug: "pair", label: "par", family: "count", factor: 2 },
  { slug: "box", label: "caixa", family: null, factor: null },
  { slug: "g", label: "grama", family: "mass", factor: 1 },
  { slug: "kg", label: "quilograma", family: "mass", factor: 1000 },
  { slug: "ml", label: "mililitro", family: "volume", factor: 1 },
  { slug: "l", label: "litro", family: "volume", factor: 1000 },
  { slug: "cm", label: "centímetro", family: "length", factor: 1 },
  { slug: "m", label: "metro", family: "length", factor: 100 },
  { slug: "custom", label: "personalizada", family: null, factor: null },
] as const;

export type UnitSlug = (typeof UNITS)[number]["slug"];

/** Categorias de material da seção 5. `shared` vale para todos os segmentos. */
export const MATERIAL_CATEGORIES = [
  { slug: "disposables", label: "Descartáveis", segment: "shared", typicalUnit: "unit" },
  { slug: "hygiene", label: "Higiene e biossegurança", segment: "shared", typicalUnit: "unit" },
  { slug: "cotton", label: "Algodão e papel", segment: "shared", typicalUnit: "g" },
  { slug: "gloves", label: "Luvas e máscaras", segment: "shared", typicalUnit: "unit" },
  { slug: "packaging", label: "Embalagens e brindes", segment: "shared", typicalUnit: "unit" },
  { slug: "sanitizing", label: "Esterilização e limpeza", segment: "shared", typicalUnit: "ml" },
  { slug: "other", label: "Outros", segment: "shared", typicalUnit: "unit" },

  { slug: "gel", label: "Gel construtor", segment: "nails", typicalUnit: "g" },
  { slug: "polish", label: "Esmalte", segment: "nails", typicalUnit: "ml" },
  { slug: "fiber", label: "Fibra de vidro", segment: "nails", typicalUnit: "cm" },
  { slug: "tips", label: "Tips e moldes", segment: "nails", typicalUnit: "unit" },
  { slug: "glue", label: "Cola e resina", segment: "nails", typicalUnit: "g" },
  { slug: "primer", label: "Primer e desidratador", segment: "nails", typicalUnit: "ml" },
  { slug: "top_coat", label: "Top coat e base", segment: "nails", typicalUnit: "ml" },
  { slug: "remover", label: "Removedor e acetona", segment: "nails", typicalUnit: "ml" },
  { slug: "files", label: "Lixas e buffers", segment: "nails", typicalUnit: "unit" },
  { slug: "bits", label: "Brocas e pontas", segment: "nails", typicalUnit: "unit" },
  { slug: "decoration", label: "Decoração e pedrarias", segment: "nails", typicalUnit: "unit" },

  { slug: "lash_trays", label: "Fios e bandejas", segment: "lashes", typicalUnit: "unit" },
  { slug: "lash_glue", label: "Cola de cílios", segment: "lashes", typicalUnit: "ml" },
  { slug: "lash_care", label: "Primer, selante e removedor", segment: "lashes", typicalUnit: "ml" },
  { slug: "tint", label: "Henna e tintura", segment: "brows", typicalUnit: "g" },
  { slug: "wax", label: "Cera e pós-depilatório", segment: "waxing", typicalUnit: "g" },

  { slug: "color", label: "Coloração e oxidante", segment: "hair", typicalUnit: "g" },
  { slug: "treatment", label: "Tratamento e finalizador", segment: "hair", typicalUnit: "ml" },
  { slug: "shampoo", label: "Shampoo e condicionador", segment: "hair", typicalUnit: "ml" },
  { slug: "skincare", label: "Cosméticos e ativos", segment: "esthetics", typicalUnit: "ml" },
  { slug: "makeup_products", label: "Produtos de maquiagem", segment: "makeup", typicalUnit: "unit" },
] as const;

/**
 * Categorias de custo fixo da seção 6. `systemManaged` marca a linha que o
 * sistema calcula: aceitar lançamento manual dela criaria contagem dupla com o
 * cadastro de equipamentos do documento 07.
 */
export const FIXED_COST_CATEGORIES = [
  { slug: "rent", label: "Aluguel", systemManaged: false },
  { slug: "condo", label: "Condomínio", systemManaged: false },
  { slug: "electricity", label: "Energia", systemManaged: false },
  { slug: "water", label: "Água", systemManaged: false },
  { slug: "gas", label: "Gás", systemManaged: false },
  { slug: "internet", label: "Internet", systemManaged: false },
  { slug: "phone", label: "Telefone e celular", systemManaged: false },
  { slug: "software", label: "Sistemas e assinaturas", systemManaged: false },
  { slug: "accounting", label: "Contador", systemManaged: false },
  { slug: "taxes", label: "MEI e impostos fixos", systemManaged: false },
  { slug: "marketing", label: "Marketing e anúncios", systemManaged: false },
  { slug: "maintenance", label: "Manutenção e reparos", systemManaged: false },
  { slug: "cleaning", label: "Limpeza e conservação", systemManaged: false },
  { slug: "transport", label: "Transporte e combustível", systemManaged: false },
  { slug: "insurance", label: "Seguros", systemManaged: false },
  { slug: "training", label: "Cursos e capacitação", systemManaged: false },
  { slug: "equipment_reserve", label: "Reserva para equipamentos", systemManaged: true },
  { slug: "other", label: "Outros", systemManaged: false },
] as const;

/** Categorias de serviço da seção 7, agrupadas por segmento. */
export const SERVICE_CATEGORIES = [
  { slug: "extension", label: "Alongamento", segment: "nails" },
  { slug: "maintenance", label: "Manutenção", segment: "nails" },
  { slug: "polish_application", label: "Esmaltação", segment: "nails" },
  { slug: "manicure_pedicure", label: "Manicure e pedicure", segment: "nails" },
  { slug: "removal", label: "Remoção", segment: "nails" },
  { slug: "decoration", label: "Decoração", segment: "nails" },

  { slug: "classic_lashes", label: "Extensão fio a fio", segment: "lashes" },
  { slug: "volume_lashes", label: "Volume", segment: "lashes" },
  { slug: "lash_maintenance", label: "Manutenção", segment: "lashes" },
  { slug: "lash_removal", label: "Remoção", segment: "lashes" },
  { slug: "lash_lifting", label: "Lifting", segment: "lashes" },

  { slug: "brow_design", label: "Design", segment: "brows" },
  { slug: "henna", label: "Henna", segment: "brows" },
  { slug: "brow_tint", label: "Coloração", segment: "brows" },
  { slug: "lamination", label: "Laminação", segment: "brows" },

  { slug: "haircut", label: "Corte", segment: "hair" },
  { slug: "hair_color", label: "Coloração", segment: "hair" },
  { slug: "blowout", label: "Escova", segment: "hair" },
  { slug: "hair_treatment", label: "Tratamento", segment: "hair" },
  { slug: "updo", label: "Penteado", segment: "hair" },
  { slug: "straightening", label: "Progressiva", segment: "hair" },

  { slug: "deep_cleansing", label: "Limpeza de pele", segment: "esthetics" },
  { slug: "massage", label: "Massagem", segment: "esthetics" },
  { slug: "lymphatic_drainage", label: "Drenagem", segment: "esthetics" },
  { slug: "peeling", label: "Peeling", segment: "esthetics" },
  { slug: "body_treatment", label: "Corporal", segment: "esthetics" },

  { slug: "social_makeup", label: "Social", segment: "makeup" },
  { slug: "bridal_makeup", label: "Noiva", segment: "makeup" },
  { slug: "artistic_makeup", label: "Artística", segment: "makeup" },

  { slug: "facial_waxing", label: "Facial", segment: "waxing" },
  { slug: "body_waxing", label: "Corporal", segment: "waxing" },
  { slug: "male_waxing", label: "Masculina", segment: "waxing" },
] as const;

/** Tipos de equipamento da seção 8, usados pelo cadastro do documento 07. */
/**
 * Tipos de equipamento da seção 8 do documento 06.
 *
 * Com rótulo, como todos os outros catálogos: a lista existe para a interface
 * montar uma escolha, e `uv_lamp` não é o que se mostra a alguém. Antes só os
 * identificadores saíam, e cada interface traduzia por conta própria — o que
 * já tinha gerado uma cópia dos rótulos dentro do aplicativo.
 */
export const EQUIPMENT_TYPES = [
  { slug: "uv_lamp", label: "Cabine de luz" },
  { slug: "nail_drill", label: "Motor de unha" },
  { slug: "dust_collector", label: "Aspirador de pó de unha" },
  { slug: "autoclave", label: "Autoclave" },
  { slug: "sterilizer", label: "Esterilizador" },
  { slug: "bed", label: "Maca" },
  { slug: "chair", label: "Cadeira" },
  { slug: "stool", label: "Mocho" },
  { slug: "table", label: "Mesa" },
  { slug: "trolley", label: "Carrinho auxiliar" },
  { slug: "ring_light", label: "Ring light" },
  { slug: "lamp", label: "Luminária" },
  { slug: "hair_dryer", label: "Secador" },
  { slug: "flat_iron", label: "Chapinha" },
  { slug: "steamer", label: "Vaporizador" },
  { slug: "card_reader", label: "Maquininha de cartão" },
  { slug: "computer", label: "Computador" },
  { slug: "phone", label: "Celular" },
  { slug: "air_conditioner", label: "Ar-condicionado" },
  { slug: "cabinet", label: "Armário" },
  { slug: "other", label: "Outro" },
] as const;

export type EquipmentTypeSlug = (typeof EQUIPMENT_TYPES)[number]["slug"];

/** Categorias sugeridas para o segmento, com as transversais sempre visíveis. */
export function materialCategoriesFor(segment: SegmentSlug) {
  return MATERIAL_CATEGORIES.filter(
    (category) => category.segment === "shared" || category.segment === segment,
  );
}

export function serviceCategoriesFor(segment: SegmentSlug) {
  return SERVICE_CATEGORIES.filter((category) => category.segment === segment);
}

/** A linha de reserva é gerada pelo sistema e recusada no cadastro manual. */
export function isSystemManagedFixedCost(slug: string): boolean {
  return FIXED_COST_CATEGORIES.some(
    (category) => category.slug === slug && category.systemManaged,
  );
}
