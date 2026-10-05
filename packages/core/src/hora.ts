import { z } from "zod";

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTOS_NO_DIA = 24 * 60;

export const HoraSchema = z.string().regex(HORA, "use o formato HH:MM");

export function horaDeAbrir(
  horaRefeicao: string,
  decantarMax: number | null,
): string | null {
  const partes = HORA.exec(horaRefeicao);
  if (!partes) throw new RangeError(`hora inválida: ${horaRefeicao}`);
  if (decantarMax === null) return null;

  const total = Number(partes[1]) * 60 + Number(partes[2]) - decantarMax;
  const ajustado = ((total % MINUTOS_NO_DIA) + MINUTOS_NO_DIA) % MINUTOS_NO_DIA;
  const horas = String(Math.floor(ajustado / 60)).padStart(2, "0");
  const minutos = String(ajustado % 60).padStart(2, "0");
  return `${horas}:${minutos}`;
}
