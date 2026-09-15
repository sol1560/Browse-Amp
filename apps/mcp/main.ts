import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { actionSchema } from "../../packages/core/types.js";
import { BrowseClient } from "../../packages/sdk/index.js";

const client = new BrowseClient(
  process.env.BROWSE_URL || "http://127.0.0.1:3000",
  z.string().min(32).parse(process.env.BROWSE_TOKEN),
);
const server = new McpServer({ name: "browse-amp", version: "0.1.0" });
const result = async (fn: () => Promise<unknown>) => {
  try {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(await fn()) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: error instanceof Error ? error.message : "REQUEST_FAILED",
        },
      ],
    };
  }
};
server.registerTool(
  "sessions_list",
  { description: "列出当前 Agent 可访问的真实会话。" },
  () => result(() => client.list()),
);
server.registerTool(
  "session_create",
  {
    description: "创建独立浏览器。保存返回的会话 ID；不需要重复创建。",
    inputSchema: { name: z.string(), requestId: z.uuid() },
  },
  (args) => result(() => client.create(args.name, "browser", args.requestId)),
);
server.registerTool(
  "session_observe",
  {
    description: "读取页面元素；旧观察的元素编号可能失效。",
    inputSchema: { id: z.uuid() },
  },
  (args) => result(() => client.observe(args.id)),
);
server.registerTool(
  "session_control",
  {
    description: "续租自己的输入权；人工接管后不得夺回。",
    inputSchema: { id: z.uuid(), epoch: z.number().int() },
  },
  (args) => result(() => client.claim(args.id, args.epoch)),
);
server.registerTool(
  "session_act",
  {
    description: "执行单个动作；OUTCOME_UNKNOWN 时先观察，不能换 ID 自动重放。",
    inputSchema: {
      id: z.uuid(),
      epoch: z.number().int(),
      requestId: z.uuid(),
      action: actionSchema,
    },
  },
  (args) =>
    result(() => client.act(args.id, args.epoch, args.action, args.requestId)),
);
server.registerTool(
  "session_stop",
  {
    description: "关闭自己的会话并删除浏览器状态。",
    inputSchema: { id: z.uuid() },
  },
  (args) => result(() => client.stop(args.id)),
);
await server.connect(new StdioServerTransport());
