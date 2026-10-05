import { HttpResponse } from "msw";

export const URL_ANTHROPIC = "https://api.anthropic.com/v1/messages";

export const blocoTexto = (text: string) => ({ type: "text", text });

export function mensagemAnthropic(
  conteudo: unknown[],
  extras: Record<string, unknown> = {},
) {
  return {
    id: "msg_teste",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    stop_reason: "end_turn",
    stop_sequence: null,
    content: conteudo,
    usage: { input_tokens: 100, output_tokens: 20 },
    ...extras,
  };
}

export function erroAnthropic(status: number) {
  return HttpResponse.json(
    {
      type: "error",
      error: {
        type: status === 429 ? "rate_limit_error" : "api_error",
        message: "falha simulada",
      },
    },
    { status, headers: { "retry-after-ms": "10" } },
  );
}
