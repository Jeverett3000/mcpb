#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ERROR: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

const model = process.env.COPILOT_MODEL || "claude-opus-4-6";
const client = new Anthropic({ apiKey });

// Cached system prompt — kept stable so prompt caching is effective across calls
const SYSTEM_PROMPT = `You are an expert coding copilot. You help developers write better code by:
- Reviewing code for bugs, security vulnerabilities, and best practices
- Explaining complex code in clear, accessible language
- Generating clean, well-structured code from descriptions
- Fixing bugs and issues in existing code

Always be precise, specific, and actionable. Format code with proper markdown code blocks including the language identifier. When reviewing or fixing code, organize feedback by severity (critical, major, minor).`;

const server = new Server(
  { name: "copilot-node", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "review_code",
      description:
        "Review code for bugs, security vulnerabilities, performance issues, and best practices",
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code to review",
          },
          language: {
            type: "string",
            description:
              "Programming language (e.g. 'typescript', 'python', 'rust'). Inferred if omitted.",
          },
          focus: {
            type: "string",
            enum: ["all", "security", "performance", "readability", "bugs"],
            description:
              "Which aspect to focus on. Defaults to 'all' for a comprehensive review.",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "explain_code",
      description:
        "Explain what a piece of code does in plain English at varying levels of detail",
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code to explain",
          },
          language: {
            type: "string",
            description: "Programming language. Inferred if omitted.",
          },
          detail_level: {
            type: "string",
            enum: ["brief", "detailed", "line_by_line"],
            description:
              "'brief' for a one-paragraph summary, 'detailed' for full logic and data-flow walkthrough, 'line_by_line' for step-by-step annotation. Defaults to 'detailed'.",
          },
        },
        required: ["code"],
      },
    },
    {
      name: "generate_code",
      description:
        "Generate clean, production-ready code from a natural language description",
      inputSchema: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "What the code should do",
          },
          language: {
            type: "string",
            description: "Programming language to generate code in",
          },
          context: {
            type: "string",
            description:
              "Optional additional context: existing code, frameworks, libraries, or constraints",
          },
        },
        required: ["description", "language"],
      },
    },
    {
      name: "fix_code",
      description: "Diagnose and fix bugs or issues in existing code",
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The code containing the issue",
          },
          issue: {
            type: "string",
            description:
              "Description of the problem or the error message received",
          },
          language: {
            type: "string",
            description: "Programming language. Inferred if omitted.",
          },
        },
        required: ["code", "issue"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let userMessage;

    switch (name) {
      case "review_code": {
        const focus = args.focus ?? "all";
        const lang = args.language ?? "";
        const focusClause =
          focus === "all"
            ? "all aspects (bugs, security, performance, and readability)"
            : `${focus} specifically`;
        userMessage = `Review the following${lang ? ` ${lang}` : ""} code for ${focusClause}. Provide specific, actionable feedback organized by severity (critical → major → minor):\n\n\`\`\`${lang}\n${args.code}\n\`\`\``;
        break;
      }

      case "explain_code": {
        const detail = args.detail_level ?? "detailed";
        const lang = args.language ?? "";
        const detailClause = {
          brief: "a brief high-level summary (one short paragraph)",
          detailed:
            "a thorough explanation covering the overall purpose, key logic, and data flow",
          line_by_line: "a line-by-line walkthrough annotating what each part does",
        }[detail];
        userMessage = `Explain the following${lang ? ` ${lang}` : ""} code. Provide ${detailClause}:\n\n\`\`\`${lang}\n${args.code}\n\`\`\``;
        break;
      }

      case "generate_code": {
        const contextSection = args.context
          ? `\n\nAdditional context / constraints:\n${args.context}`
          : "";
        userMessage = `Generate ${args.language} code that does the following:\n\n${args.description}${contextSection}\n\nProvide complete, production-ready code with brief comments explaining key decisions.`;
        break;
      }

      case "fix_code": {
        const lang = args.language ?? "";
        userMessage = `Fix the following${lang ? ` ${lang}` : ""} code. The issue is: ${args.issue}\n\n\`\`\`${lang}\n${args.code}\n\`\`\`\n\nExplain the root cause, then show the corrected code with a summary of every change made.`;
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Stream to avoid HTTP timeouts on long completions; collect via finalMessage().
    // The system prompt is marked for caching so repeated calls share a warm prefix.
    const stream = client.messages.stream({
      model,
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const response = await stream.finalMessage();

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { content: [{ type: "text", text }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
console.error("AI Coding Copilot MCP server running...");
