export interface InteractionOptions {
  prompt: string;
  agentName?: string;
  environmentId?: string;
  previousInteractionId?: string;
  stream?: boolean;
  inlineSources?: Array<{
    type: string;
    content: string;
    target: string;
  }>;
  signal?: AbortSignal;
}

export interface AgentEvent {
  type:
    | "thinking"
    | "text"
    | "tool_call"
    | "tool_result"
    | "complete"
    | "error"
    | "done";
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  result?: string;
  interaction?: Record<string, unknown>;
  message?: string;
}

export const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export async function createInteraction(
  opts: InteractionOptions
): Promise<Response> {
  const agentName = opts.agentName ?? "antigravity-preview-05-2026";

  const payload: Record<string, unknown> = {
    agent: agentName,
    input: [
      {
        type: "text",
        text: opts.prompt,
      },
    ],
    stream: true,
  };

  if (opts.environmentId) {
    payload.environment = { env_id: opts.environmentId };
  } else {
    const envConfig: Record<string, unknown> = {
      type: "remote",
      sources: opts.inlineSources ?? [],
      network: {
        allowlist: [
          {
            domain: "generativelanguage.googleapis.com",
            transform: { "x-goog-api-key": process.env.GEMINI_API_KEY },
          },
          { domain: "*" },
        ],
      },
    };
    payload.environment = envConfig;
  }

  if (opts.previousInteractionId) {
    payload.previous_interaction_id = opts.previousInteractionId;
  }

  const response = await fetch(`${API_BASE_URL}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
      "x-server-timeout": "600",
      "Api-Revision": "2026-05-20",
      "x-goog-api-client": "applet-ai-radio/1.0.0",
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });

  return response;
}

export async function* streamInteraction(
  response: Response
): AsyncGenerator<AgentEvent> {
  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", message: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.slice(6);
        if (dataStr === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const data = JSON.parse(dataStr);
          const event = parseAgentEvent(data);
          if (event) yield event;
        } catch {
          continue;
        }
      }
    }
  } catch (err: any) {
    yield { type: "error", message: `Stream read exception: ${err.message}` };
  } finally {
    reader.releaseLock();
  }
}

function parseAgentEvent(
  event: Record<string, unknown>
): AgentEvent | null {
  const eventType = event.event_type as string | undefined;

  if (eventType === "step.delta") {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) return null;

    const resultVal = delta.result !== undefined ? delta.result : delta.response;
    if (resultVal !== undefined && resultVal !== null) {
      let resultStr = typeof resultVal === "object" ? JSON.stringify(resultVal) : String(resultVal);
      return {
        type: "tool_result",
        name: delta.name as string | undefined,
        result: resultStr,
      };
    }

    const argumentsObj = (delta.arguments as Record<string, unknown> | undefined) || 
                         ((delta.call as any)?.arguments as Record<string, unknown> | undefined);
    const callName = (delta.name as string | undefined) || 
                     ((delta.call as any)?.name as string | undefined) || 
                     (delta.type === "code_execution_call" ? "code_execution_call" : undefined);

    if (callName || argumentsObj) {
      return {
        type: "tool_call",
        name: callName || "code_execution_call",
        arguments: argumentsObj ?? {},
      };
    }

    let extractedText = "";
    let isThinking = false;

    if (
      delta.type === "thought_summary" || 
      delta.type === "thinking" || 
      delta.type === "thought" || 
      delta.type === "thought_delta"
    ) {
      isThinking = true;
    }

    if (typeof delta.text === "string") {
      extractedText = delta.text;
    } else if (typeof delta.thought === "string") {
      extractedText = delta.thought;
      isThinking = true;
    } else if (typeof delta.summary === "string" && isThinking) {
      extractedText = delta.summary;
    }

    const content = delta.content;
    if (content !== undefined && content !== null) {
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === "object") {
            const partObj = part as Record<string, unknown>;
            if (partObj.type === "thought") {
              isThinking = true;
              if (typeof partObj.text === "string") extractedText += partObj.text;
              else if (typeof partObj.thought === "string") extractedText += partObj.thought;
            } else if (typeof partObj.text === "string") {
              extractedText += partObj.text;
            } else if (typeof partObj.thought === "string") {
              extractedText += partObj.thought;
              isThinking = true;
            }
          } else if (typeof part === "string") {
            extractedText += part;
          }
        }
      } else if (typeof content === "string") {
        extractedText = content;
      }
    }

    if (extractedText) {
      return {
        type: isThinking ? "thinking" : "text",
        text: extractedText,
      };
    }
  }

  if (eventType === "interaction.completed") {
    return {
      type: "complete",
      interaction: (event.interaction as Record<string, unknown>) ?? {},
    };
  }

  return null;
}
