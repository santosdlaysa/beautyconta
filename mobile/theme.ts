/**
 * Paleta BeautyConta escolhida para todo o aplicativo.
 *
 * Os tons de texto seguem a regra de contraste do documento 10: nenhum par
 * entra no produto abaixo de 4,5. Por isso a escala de cinzas arroxeados é
 * medida contra `background`, e as cores de estado são medidas contra o fundo
 * suave em que aparecem, não contra o branco.
 */
export const colors = {
  lilac: '#e4c3e7',
  pink: '#a63d66',
  pinkHighlight: '#da5b8d',
  pinkGradient: '#f9d9e7',
  ink: '#37263e',
  accent: '#a63d66',
  muted: '#5f5165',
  background: '#fffbfd',
  softPink: '#fdf0f3',
  softLilac: '#f6edf7',
  border: '#efdfed',
  white: '#ffffff',
  /** Tons de apoio usados em status, gráficos e destaques. */
  ink2: '#514058',
  ink3: '#6b5b73',
  faded: '#736277',
  success: '#42745e',
  successSoft: '#e9f2ed',
  warning: '#8a6520',
  warningSoft: '#fbf1e0',
  danger: '#b23f5e',
  dangerSoft: '#fbe9ee',
  info: '#6b5590',
  infoSoft: '#f0ebfa',
  /** Traços e ícones sem texto: 3:1 basta, mas o cinza claro anterior não chegava lá. */
  outline: '#8b7d90',

  /**
   * Tons do cartão em gradiente.
   *
   * O fundo dele é rosa e lilás claros, então o texto precisa de uma família
   * própria — usar `ink` ali daria contraste demais e quebraria a leitura suave
   * que o cartão pede.
   */
  heroInk: '#462d59',
  heroLabel: '#5a3f61',
  heroCaption: '#694a73',
  heroHint: '#63456b',
  heroAction: '#654275',
  /** Véus brancos sobre o gradiente: botão, orbes e a arte de fundo. */
  heroVeil: 'rgba(255, 255, 255, 0.52)',
  heroVeilSoft: 'rgba(255, 255, 255, 0.2)',
  orbitLine: 'rgba(255, 255, 255, 0.38)',
  orbitBand: 'rgba(255, 255, 255, 0.13)',
  orbitCore: 'rgba(196, 154, 230, 0.29)',

  /** Marcadores e trilhos da agenda. */
  marker: '#dda3c0',
  markerPending: '#bba7da',
  trail: '#e8cfdf',
  track: '#f0e8ea',
  /** Fundo de ícone em estado vazio e véu atrás das folhas. */
  surfaceSoft: '#f0e5f2',
  veil: 'rgba(55, 38, 62, 0.33)',
} as const;

/** Medidas repetidas nas telas: mantêm o ritmo visual da Home. */
export const radius = { sm: 12, md: 16, lg: 19, xl: 23, pill: 28 } as const;
export const spacing = { xs: 6, sm: 9, md: 13, lg: 18, xl: 22 } as const;
