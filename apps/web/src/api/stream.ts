import { apiBaseUrl, type ChatRunRequest } from "./client";

export type StreamFrame = {
  event: string;
  data: string;
};

export async function streamChatRun(
  body: ChatRunRequest,
  onFrame: (frame: StreamFrame) => void,
) {
  const response = await fetch(`${apiBaseUrl}/api/v2/runs/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new Error("流式聊天失败");
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
        onFrame(parsed);
      }
    }
  }
}

function parseFrame(frame: string): StreamFrame | null {
  const lines = frame
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return null;
  }
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
  return {
    event,
    data: dataParts.join("\n"),
  };
}
