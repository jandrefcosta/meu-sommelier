export const FUSO_PADRAO = "America/Sao_Paulo";

export interface Relogio {
  agora(): Date;
}

export const relogioSistema: Relogio = { agora: () => new Date() };

export function relogioFixo(iso: string): Relogio {
  const instante = new Date(iso).getTime();
  return { agora: () => new Date(instante) };
}

export function anoEm(data: Date, fuso: string = FUSO_PADRAO): number {
  const ano = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
  }).format(data);
  return Number(ano);
}
