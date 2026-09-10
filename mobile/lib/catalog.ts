/**
 * Espelho local dos catálogos do documento 06.
 *
 * A API os publica em `/api/catalog`, mas os formulários precisam deles antes
 * de qualquer ida à rede — inclusive offline. São listas curtas e estáveis; o
 * que muda com frequência é a categoria personalizada, e essa a usuária digita.
 */

export type Option = { slug: string; label: string };

/** Segmentos da seção 2 do documento 06, na ordem em que o servidor os aceita. */
export const SEGMENTS: Option[] = [
  { slug: 'nails', label: 'Unhas' },
  { slug: 'lashes', label: 'Cílios' },
  { slug: 'brows', label: 'Sobrancelhas' },
  { slug: 'hair', label: 'Cabelo' },
  { slug: 'esthetics', label: 'Estética' },
  { slug: 'makeup', label: 'Maquiagem' },
  { slug: 'waxing', label: 'Depilação' },
  { slug: 'other', label: 'Outro' },
];

export const WORK_MODELS: Option[] = [
  { slug: 'home', label: 'Em casa' },
  { slug: 'own_salon', label: 'Salão próprio' },
  { slug: 'rented_station', label: 'Cabine ou espaço alugado' },
  { slug: 'shared_space', label: 'Espaço compartilhado' },
  { slug: 'mobile', label: 'Atendimento domiciliar' },
];

export const SERVICE_CATEGORIES: Option[] = [
  { slug: 'extension', label: 'Alongamento' },
  { slug: 'maintenance', label: 'Manutenção' },
  { slug: 'polish_application', label: 'Esmaltação' },
  { slug: 'manicure_pedicure', label: 'Manicure e pedicure' },
  { slug: 'removal', label: 'Remoção' },
  { slug: 'decoration', label: 'Decoração' },
  { slug: 'other', label: 'Outro' },
];

/**
 * Categorias de material.
 *
 * Servem para achar o item na lista do estoque, e só. Não entram em nenhuma
 * conta: o preço sai do custo por atendimento, não da gaveta onde o material
 * está guardado. Por isso são poucas, nomeadas como a profissional fala, e
 * nunca são perguntadas no meio de um cadastro — `guessMaterialCategory`
 * escolhe pelo nome e a usuária corrige no estoque se quiser.
 */
export const MATERIAL_CATEGORIES: Option[] = [
  { slug: 'gel', label: 'Géis, resinas e acrílicos' },
  { slug: 'polish', label: 'Esmaltes e finalização' },
  { slug: 'prep', label: 'Preparação e colas' },
  { slug: 'disposables', label: 'Descartáveis' },
  { slug: 'hygiene', label: 'Higiene e biossegurança' },
  { slug: 'tools', label: 'Ferramentas e aparelhos' },
  { slug: 'other', label: 'Outro' },
];

/** Categorias que saíram da lista mas ainda existem em material cadastrado. */
const LEGACY_MATERIAL_CATEGORIES: Option[] = [
  { slug: 'gloves', label: 'Luvas e máscaras' },
  { slug: 'cotton', label: 'Algodão e papel' },
];

/** Palavras que aparecem no nome e dizem a que gaveta o material pertence. */
const MATERIAL_HINTS: { slug: string; words: string[] }[] = [
  // A ordem importa: a primeira regra que casar decide. As mais específicas vêm
  // antes das genéricas — "broca de lixadeira" é ferramenta, não lixa, e
  // "esmalte em gel" é esmalte, não gel.
  { slug: 'tools', words: ['alicate', 'pinça', 'pinca', 'broca', 'cabine', 'lixadeira', 'motor', 'pincel', 'cortador', 'lâmpada', 'lampada', 'aparelho'] },
  { slug: 'prep', words: ['primer', 'bond', 'cola', 'dehydrator', 'desidrat', 'removedor', 'acetona', 'prep'] },
  { slug: 'polish', words: ['esmalte', 'top coat', 'topcoat', 'base coat', 'verniz', 'brilho', 'glitter', 'encapsul'] },
  { slug: 'gel', words: ['gel', 'resina', 'acrigel', 'acrilico', 'acrílico', 'polygel', 'fibra', 'monomer', 'monômero'] },
  { slug: 'hygiene', words: ['álcool', 'alcool', 'luva', 'máscara', 'mascara', 'touca', 'sabon', 'desinfet', 'esteriliz', 'autoclave', 'higien'] },
  { slug: 'disposables', words: ['lixa', 'palito', 'buffer', 'espátula', 'espatula', 'papel', 'toalha', 'algodão', 'algodao', 'lenço', 'lenco', 'descartáv', 'descartav', 'rolo', 'formin', 'molde'] },
];

/**
 * Categoria provável a partir do nome digitado.
 *
 * Erra? Erra — e errar aqui não custa nada: nenhum cálculo depende disso, e a
 * correção é um toque na tela de estoque. O que se ganha é não interromper
 * quem está montando o preço de um serviço para perguntar uma taxonomia.
 */
export function guessMaterialCategory(name: string): string {
  const text = name.trim().toLowerCase();
  if (!text) return 'other';

  const found = MATERIAL_HINTS.find((hint) => hint.words.some((word) => text.includes(word)));
  return found?.slug ?? 'other';
}

export const FIXED_COST_CATEGORIES: Option[] = [
  { slug: 'rent', label: 'Aluguel' },
  { slug: 'electricity', label: 'Energia' },
  { slug: 'water', label: 'Água' },
  { slug: 'internet', label: 'Internet' },
  { slug: 'phone', label: 'Telefone' },
  { slug: 'software', label: 'Sistemas' },
  { slug: 'taxes', label: 'MEI e impostos' },
  { slug: 'marketing', label: 'Marketing' },
  { slug: 'other', label: 'Outro' },
];

/*
 * Tipos de equipamento não moram aqui.
 *
 * `GET /api/catalog/equipment-types` passou a devolver o rótulo em português
 * junto do identificador, e no documento 07 o rótulo deixou de ser enfeite: ele
 * **é** o nome do equipamento que a profissional cadastra. Duas listas de nomes
 * viveriam divergindo, e a divergência apareceria no cadastro dela. Quem busca
 * a lista é `listEquipmentTypes`, em `lib/resources.ts`.
 */

export const UNITS: Option[] = [
  { slug: 'unit', label: 'unidade' },
  { slug: 'pair', label: 'par' },
  { slug: 'box', label: 'caixa' },
  { slug: 'g', label: 'grama' },
  { slug: 'kg', label: 'quilo' },
  { slug: 'ml', label: 'mililitro' },
  { slug: 'l', label: 'litro' },
  { slug: 'cm', label: 'centímetro' },
  { slug: 'm', label: 'metro' },
];

export const labelOf = (options: Option[], slug: string): string =>
  options.find((option) => option.slug === slug)?.label ??
  LEGACY_MATERIAL_CATEGORIES.find((option) => option.slug === slug)?.label ??
  slug;

export const slugOf = (options: Option[], label: string): string =>
  options.find((option) => option.label === label)?.slug ?? options[0].slug;
