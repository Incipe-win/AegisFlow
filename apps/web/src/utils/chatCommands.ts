// 聊天命令系统
// 支持的命令和功能

export interface ChatCommand {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  handler: (args: string[], context: CommandContext) => Promise<CommandResult> | CommandResult;
}

export interface CommandContext {
  sessionId: string | null;
  messages: any[];
  setActivePanel: (panel: "knowledge" | "tools" | "ops" | null) => void;
  sendMessage: (content: string) => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  startNewSession: (title?: string) => Promise<string>;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  action?: "open_panel" | "send_message" | "upload_files" | "new_session";
  data?: any;
}

// 命令列表
const commands: ChatCommand[] = [
  {
    name: "help",
    description: "显示所有可用命令",
    usage: "/help [command]",
    aliases: ["h", "?"],
    handler: async (args, context) => {
      if (args.length > 0) {
        const commandName = args[0];
        const command = commands.find(cmd =>
          cmd.name === commandName || cmd.aliases?.includes(commandName)
        );

        if (command) {
          return {
            success: true,
            message: `命令: ${command.name}\n描述: ${command.description}\n用法: ${command.usage}\n别名: ${command.aliases?.join(", ") || "无"}`,
          };
        } else {
          return {
            success: false,
            message: `未知命令: ${commandName}。使用 /help 查看所有命令。`,
          };
        }
      }

      const commandList = commands.map(cmd =>
        `/${cmd.name} - ${cmd.description}`
      ).join("\n");

      return {
        success: true,
        message: `可用命令:\n${commandList}\n\n使用 /help <命令名> 查看详细帮助。`,
      };
    },
  },
  {
    name: "upload",
    description: "上传文件到知识库",
    usage: "/upload [文件...]",
    aliases: ["u"],
    handler: async (args, context) => {
      return {
        success: true,
        message: "打开知识库面板上传文件",
        action: "open_panel",
        data: { panel: "knowledge" },
      };
    },
  },
  {
    name: "tools",
    description: "查看可用MCP工具",
    usage: "/tools [搜索词]",
    aliases: ["t"],
    handler: async (args, context) => {
      const searchQuery = args.join(" ");
      return {
        success: true,
        message: searchQuery ? `搜索工具: ${searchQuery}` : "打开工具目录面板",
        action: "open_panel",
        data: { panel: "tools", searchQuery },
      };
    },
  },
  {
    name: "ops",
    description: "执行运维分析",
    usage: "/ops [查询]",
    aliases: ["o", "operation"],
    handler: async (args, context) => {
      const query = args.join(" ");
      if (query) {
        return {
          success: true,
          message: `执行运维分析: ${query}`,
          action: "send_message",
          data: { content: query },
        };
      } else {
        return {
          success: true,
          message: "打开运维分析面板",
          action: "open_panel",
          data: { panel: "ops" },
        };
      }
    },
  },
  {
    name: "clear",
    description: "清空当前会话或创建新会话",
    usage: "/clear [标题]",
    aliases: ["c", "new"],
    handler: async (args, context) => {
      const title = args.join(" ") || `对话 ${new Date().toLocaleString("zh-CN")}`;
      return {
        success: true,
        message: `创建新会话: ${title}`,
        action: "new_session",
        data: { title },
      };
    },
  },
  {
    name: "call",
    description: "调用MCP工具",
    usage: "/call <工具名> [参数JSON]",
    aliases: ["exec", "run"],
    handler: async (args, context) => {
      if (args.length === 0) {
        return {
          success: false,
          message: "用法: /call <工具名> [参数JSON]\n例如: /call prometheus_query '{\"query\": \"cpu_usage\"}'",
        };
      }

      const toolName = args[0];
      let params = {};

      if (args.length > 1) {
        try {
          const jsonStr = args.slice(1).join(" ");
          params = JSON.parse(jsonStr);
        } catch (err) {
          return {
            success: false,
            message: `参数解析失败: ${err instanceof Error ? err.message : "无效的JSON格式"}`,
          };
        }
      }

      return {
        success: true,
        message: `调用工具: ${toolName}`,
        action: "send_message",
        data: { content: `/call ${toolName} ${JSON.stringify(params)}` },
      };
    },
  },
  {
    name: "search",
    description: "在知识库中搜索",
    usage: "/search <查询>",
    aliases: ["s", "find"],
    handler: async (args, context) => {
      if (args.length === 0) {
        return {
          success: false,
          message: "用法: /search <查询>\n例如: /search 如何配置Prometheus",
        };
      }

      const query = args.join(" ");
      return {
        success: true,
        message: `搜索知识库: ${query}`,
        action: "send_message",
        data: { content: query },
      };
    },
  },
  {
    name: "settings",
    description: "打开设置面板（暂未实现）",
    usage: "/settings",
    aliases: ["config"],
    handler: async (args, context) => {
      return {
        success: true,
        message: "设置功能开发中",
      };
    },
  },
];

// 命令解析器
export function parseCommand(input: string): {
  command: string;
  args: string[];
  rawInput: string;
} | null {
  const trimmed = input.trim();

  // 检查是否是命令（以/开头）
  if (!trimmed.startsWith("/")) {
    return null;
  }

  // 移除开头的/并分割参数
  const withoutSlash = trimmed.substring(1).trim();
  if (withoutSlash.length === 0) {
    return null;
  }

  // 分割命令和参数
  const parts = withoutSlash.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  return {
    command,
    args,
    rawInput: trimmed,
  };
}

// 查找命令
export function findCommand(commandName: string): ChatCommand | undefined {
  return commands.find(cmd =>
    cmd.name === commandName || cmd.aliases?.includes(commandName)
  );
}

// 执行命令
export async function executeCommand(
  commandName: string,
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const command = findCommand(commandName);

  if (!command) {
    return {
      success: false,
      message: `未知命令: ${commandName}。使用 /help 查看所有命令。`,
    };
  }

  try {
    const result = await command.handler(args, context);
    return result;
  } catch (error) {
    return {
      success: false,
      message: `执行命令时出错: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

// 自动补全建议
export function getCommandSuggestions(partialInput: string): string[] {
  const trimmed = partialInput.trim();

  // 如果没有输入或不是以/开头，返回空数组
  if (!trimmed.startsWith("/")) {
    return [];
  }

  const withoutSlash = trimmed.substring(1).toLowerCase();

  // 如果还没有输入命令名，返回所有命令
  if (withoutSlash.length === 0) {
    return commands.map(cmd => `/${cmd.name}`);
  }

  // 查找匹配的命令
  const suggestions = commands
    .filter(cmd =>
      cmd.name.startsWith(withoutSlash) ||
      cmd.aliases?.some(alias => alias.startsWith(withoutSlash))
    )
    .map(cmd => `/${cmd.name}`);

  return suggestions;
}

// 导出命令列表
export { commands };