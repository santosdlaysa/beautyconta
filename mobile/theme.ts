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
} as const;

/** Medidas repetidas nas telas: mantêm o ritmo visual da Home. */
export const radius = { sm: 12, md: 16, lg: 19, xl: 23, pill: 28 } as const;
export const spacing = { xs: 6, sm: 9, md: 13, lg: 18, xl: 22 } as const;
