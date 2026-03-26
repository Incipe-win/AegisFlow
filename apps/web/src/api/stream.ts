import { apiBaseUrl, type ChatRequest } from "./client";

export type StreamEvent = {
  event: string;
  data: string;
};

export async function streamChat(
  body: ChatRequest,
  onEvent: (event: StreamEvent) => void,
) {
  const response = await fetch(`${apiBaseUrl}/api/v1/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new Error("流式问答请求失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const parsed = parseFrame(frame);
      if (parsed) {
        onEvent(parsed);
      }
    }
  }
}

function parseFrame(frame: string): StreamEvent | null {
  const lines = frame
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let event = "message";
  const dataParts: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trim());
    }
  }

  if (dataParts.length === 0) {
    return null;
  }

  const raw = dataParts.join("\n");
  try {
    const decoded = JSON.parse(raw);
    if (typeof decoded === "string") {
      return { event, data: decoded };
    }
    return { event, data: JSON.stringify(decoded) };
  } catch {
    return { event, data: raw };
  }
}

