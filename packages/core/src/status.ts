export const STATUS_CONSUMO = [
  "passou",
  "abrir_logo",
  "no_ponto",
  "aguardar",
] as const;
export type StatusConsumo = (typeof STATUS_CONSUMO)[number];

export interface JanelaConsumo {
  abrirDe: number;
  guardaAte: number;
}

export function statusConsumo(
  item: JanelaConsumo,
  anoAtual: number,
): StatusConsumo {
  if (anoAtual > item.guardaAte) return "passou";
  if (anoAtual === item.guardaAte) return "abrir_logo";
  if (anoAtual < item.abrirDe) return "aguardar";
  return "no_ponto";
}
