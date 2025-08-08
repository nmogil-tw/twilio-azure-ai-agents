import "dotenv/config";
import { AgentsClient, RunStreamEvent, MessageStreamEvent } from "@azure/ai-agents";
import { DefaultAzureCredential } from "@azure/identity";
import readline from "readline";

/**
 * Console-based Azure AI Agent Service
 * Provides an interactive CLI for sending messages to an Azure AI Agent and receiving responses.
 * Supports streaming and non-streaming modes via SDK or REST API.
 */

// =======================
// Constants & Environment
// =======================

const DEFAULT_PROJECT_ENDPOINT = "https://nmogi-mctnmz7z-eastus2.services.ai.azure.com";
const DEFAULT_PROJECT_ID = "nmogi-mctnmz7z-eastus2-project";

const STREAMING_MODES = {
  OFF: "off",
  SDK: "sdk",
  API: "api",
};

const projectEndpoint = process.env.PROJECT_ENDPOINT || DEFAULT_PROJECT_ENDPOINT;
const projectId = process.env.PROJECT_ID || DEFAULT_PROJECT_ID;
let agentId = process.env.AGENT_ID;

const client = new AgentsClient(
  `${projectEndpoint}/api/projects/${projectId}`,
  new DefaultAzureCredential()
);

const isDebug = !!process.env.DEBUG;

// ==============
// Debug Logging
// ==============

function debugLog(...args) {
  if (isDebug) {
    console.log("[debug]", ...args);
  }
}

// ===================
// Utility Functions
// ===================

/**
 * Promisified readline question.
 * @param {readline.Interface} rl
 * @param {string} query
 * @returns {Promise<string>}
 */
function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Standard error logger.
 * @param {string} context
 * @param {Error} err
 */
function logError(context, err) {
  console.error(`Error ${context}:`, err);
}

// ==========================
// Thread & Message Functions
// ==========================

/**
 * Create a new conversation thread.
 * @param {object} metadata
 * @returns {Promise<string>} threadId
 */
async function createThread(metadata = {}) {
  try {
    const thread = await client.threads.create({ agentId, metadata });
    debugLog("Full thread object returned by client.threads.create:", thread);
    debugLog("Created thread:", thread.id);
    return thread.id;
  } catch (err) {
    logError("creating thread", err);
    throw err;
  }
}

/**
 * Add a user message to a thread.
 * @param {string} threadId
 * @param {string} content
 * @returns {Promise<string>} messageId
 */
async function addMessageToThread(threadId, content) {
  try {
    debugLog("addMessageToThread called with threadId:", threadId, "length:", threadId.length);
    const message = await client.messages.create(threadId, "user", content);
    debugLog("Added message:", message.id);
    return message.id;
  } catch (err) {
    logError("adding message", err);
    throw err;
  }
}

/**
 * Poll for run completion in non-streaming mode.
 * @param {string} threadId
 * @param {string} runId
 * @returns {Promise<object>} run status
 */
async function pollRunCompletion(threadId, runId) {
  let status;
  try {
    do {
      await new Promise((r) => setTimeout(r, 2000));
      status = await client.runs.get(threadId, runId);
      process.stdout.write(".");
    } while (status.status !== "completed" && status.status !== "failed");
    process.stdout.write("\n");
    return status;
  } catch (err) {
    logError("polling run status", err);
    throw err;
  }
}

/**
 * Print the last agent reply from a thread.
 * @param {string} threadId
 */
async function printLastAgentReply(threadId) {
  try {
    const messages = [];
    for await (const msg of client.messages.list(threadId)) {
      messages.push(msg);
    }
    const agentReplies = messages.filter((msg) => msg.role === "assistant");
    if (agentReplies.length === 0) {
      console.log("No agent replies found.");
    } else {
      const lastAgentReply = agentReplies[agentReplies.length - 1];
      console.log("Agent reply:", lastAgentReply.content);
    }
  } catch (err) {
    logError("retrieving agent replies", err);
  }
}

// ==========================
// Streaming Output Handlers
// ==========================

/**
 * Stream agent reply using REST API (STREAMING=api).
 * @param {string} threadId
 * @returns {Promise<void>}
 */
async function streamAgentReplyViaRestApi(threadId) {
  debugLog("Streaming mode: REST API (STREAMING=api)");
  try {
    const credential = new DefaultAzureCredential();
    let accessToken;
    try {
      const tokenResponse = await credential.getToken("https://ai.azure.com/.default");
      accessToken = tokenResponse?.token;
    } catch (tokenErr) {
      throw new Error("Failed to obtain Azure access token for REST API: " + tokenErr.message);
    }
    if (!accessToken) {
      throw new Error("Azure access token is required for REST API (STREAMING=api).");
    }
    const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

    const runCreateEndpoint = `${projectEndpoint}/api/projects/${projectId}/threads/${threadId}/runs?api-version=2025-05-01`;
    const runCreatePayload = {
      assistant_id: agentId,
      stream: true
    };
    debugLog("REST API run creation endpoint:", runCreateEndpoint);
    debugLog("REST API run creation payload:", JSON.stringify(runCreatePayload));
    debugLog("REST API agentId:", agentId);

    const runCreateResp = await fetchFn(runCreateEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify(runCreatePayload)
    });

    if (!runCreateResp.ok) {
      let errorText = await runCreateResp.text();
      debugLog("REST API run creation error response body:", errorText);
      throw new Error(`Failed to create run: ${runCreateResp.status} ${runCreateResp.statusText}`);
    }

    debugLog("Streaming response from REST API...");
    const reader = runCreateResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let replyStarted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines (SSE format)
      let lines = buffer.split("\n");
      buffer = lines.pop(); // Save incomplete line for next chunk

      for (let line of lines) {
        line = line.trim();
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          if (replyStarted) process.stdout.write("\n");
          break;
        }
        try {
          const event = JSON.parse(data);
          if (event && event.delta && event.delta.role === "assistant") {
            if (!replyStarted) {
              process.stdout.write("Agent reply: ");
              replyStarted = true;
            }
          }
          if (event && event.delta && typeof event.delta.content === "string") {
            process.stdout.write(event.delta.content);
            replyStarted = true;
          }
        } catch {
          // Ignore JSON parse errors for non-data lines
        }
      }
    }
    if (!replyStarted) {
      console.log("No agent reply streamed.");
    }
  } catch (err) {
    logError("in REST API non-streaming", err);
  }
}

/**
 * Stream agent reply using SDK (STREAMING=sdk).
 * @param {object} run
 * @returns {Promise<void>}
 */
async function streamAgentReplyViaSdk(run) {
  debugLog("Streaming mode: SDK streaming (STREAMING=sdk)");
  try {
    const streamEventMessages = await run.stream();
    let replyStarted = false;
    let currentMessageId = null;
    let currentMessageContent = "";
    for await (const event of streamEventMessages) {
      if (
        event.eventType === MessageStreamEvent.Delta &&
        event.data?.delta?.role === "assistant"
      ) {
        const messageId = event.data.message_id || event.data.delta.message_id;
        if (messageId && messageId !== currentMessageId) {
          currentMessageId = messageId;
          currentMessageContent = "";
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write("Agent reply: ");
          replyStarted = true;
        }
        if (event.data.delta.content) {
          currentMessageContent += event.data.delta.content;
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write("Agent reply: " + currentMessageContent);
          replyStarted = true;
        }
      }
    }
    if (replyStarted) {
      process.stdout.write("\n");
    } else {
      console.log("No agent reply streamed.");
    }
  } catch (err) {
    logError("streaming agent reply", err);
  }
}

// ==========================
// Agent Run Dispatcher
// ==========================

/**
 * Run the agent and handle streaming or non-streaming output.
 * @param {string} threadId
 * @returns {Promise<void>}
 */
async function runAgent(threadId) {
  try {
    debugLog("runAgent called with threadId:", threadId, "length:", threadId.length);
    const streamingMode = (process.env.STREAMING || STREAMING_MODES.OFF).toLowerCase();

    if (streamingMode === STREAMING_MODES.API) {
      await streamAgentReplyViaRestApi(threadId);
    } else if (streamingMode === STREAMING_MODES.SDK) {
      // For SDK streaming, we must first create a run
      let run;
      try {
        run = await client.runs.create(threadId, { assistant_id: agentId });
      } catch (err) {
        logError("creating run for SDK streaming", err);
        return;
      }
      await streamAgentReplyViaSdk(run);
    } else {
      debugLog("Non-streaming mode enabled (STREAMING=off or unset)");
      // For non-streaming, create run and poll for completion
      let run;
      try {
        run = await client.runs.create(threadId, { assistant_id: agentId });
      } catch (err) {
        logError("creating run for non-streaming", err);
        return;
      }
      const status = await pollRunCompletion(threadId, run.id);
      console.log("Run status:", status.status);
      if (status.status === "completed") {
        await printLastAgentReply(threadId);
      } else {
        console.log("Run failed.");
      }
    }
  } catch (err) {
    logError("running agent", err);
  }
}

// ==========================
// Interactive CLI Main Loop
// ==========================

/**
 * Main interactive CLI loop.
 */
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let threadId;
  let metadata = {};

  // Prompt for agentId if not set in env
  if (!agentId) {
    agentId = (await askQuestion(rl, "Enter the AGENT_ID to use: ")).trim();
    if (!agentId) {
      console.error("No AGENT_ID provided. Exiting.");
      rl.close();
      return;
    }
  }

  // Thread selection/creation flow
  try {
    let answer = (await askQuestion(rl, "Do you want to create a new thread? (y/n) ")).trim().toLowerCase();
    if (answer === "y") {
      // Prompt for metadata BEFORE thread creation
      let metaAnswer = (await askQuestion(rl, "Do you want to add metadata to the new thread? (y/n) ")).trim().toLowerCase();
      if (metaAnswer === "y") {
        console.log('Enter metadata as key=value, one per line. Enter an empty line to finish.');
        while (true) {
          let pair = (await askQuestion(rl, "> ")).trim();
          if (pair === "") break;
          const eqIdx = pair.indexOf("=");
          if (eqIdx === -1) {
            console.log("Invalid format. Please enter as key=value.");
            continue;
          }
          const key = pair.slice(0, eqIdx).trim();
          const value = pair.slice(eqIdx + 1).trim();
          if (!key) {
            console.log("Key cannot be empty.");
            continue;
          }
          metadata[key] = value;
        }
      }
      threadId = await createThread(metadata);
    } else if (answer === "n") {
      threadId = (await askQuestion(rl, "Enter the thread ID to use: ")).trim();
      if (!threadId) {
        console.error("No thread ID provided. Exiting.");
        rl.close();
        return;
      }
    } else {
      console.error('Invalid input. Please enter "y" or "n". Exiting.');
      rl.close();
      return;
    }
  } catch {
    rl.close();
    return;
  }

  // Main message loop
  rl.setPrompt("You: ");
  rl.prompt();
  rl.on("line", async (line) => {
    if (line.trim().toLowerCase() === "exit") {
      rl.close();
      return;
    }
    if (line.trim() === "") {
      rl.prompt();
      return;
    }
    try {
      await addMessageToThread(threadId, line);
      await runAgent(threadId);
    } catch {
      // Errors already logged in respective functions
    }
    rl.prompt();
  });
}

// ==========
// Entrypoint
// ==========

main().catch(console.error);
