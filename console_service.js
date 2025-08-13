import "dotenv/config";
import { AgentsClient, RunStreamEvent, MessageStreamEvent, DoneEvent, ErrorEvent } from "@azure/ai-agents";
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

/**
 * Print only the event name when DEBUG is enabled.
 * Usage: debugLog("event.name")
 */
function debugLog(eventName) {
  if (isDebug && eventName) {
    console.log("[debug]", eventName);
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
    debugLog("run.created");
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
    debugLog("message.created");
    const message = await client.messages.create(threadId, "user", content);
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
/**
 * Stream agent reply using REST API (STREAMING=api).
 */
async function streamAgentReplyViaRestApi(threadId) {
  debugLog("REST_API_STREAMING");
  try {
    // 1. Get an access token from Azure.
    //    - This is needed to securely talk to the REST API.
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

    // 2. Prepare the function to make web requests (fetch).
    const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

    // 3. Build the URL and data needed to start the agent run.
    //    - The URL tells Azure which project, thread, and version to use.
    //    - The payload includes the agent's ID and tells Azure to stream the reply.
    const runCreateEndpoint = `${projectEndpoint}/api/projects/${projectId}/threads/${threadId}/runs?api-version=2025-05-01`;
    const runCreatePayload = {
      // Ensure assistant_id is always a string
      assistant_id: String((agentId && typeof agentId === "object" && agentId.id) ? agentId.id : agentId),
      stream: true
    };

    // 4. Send a request to Azure to start the agent run and ask for a streamed reply.
    const runCreateResp = await fetchFn(runCreateEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify(runCreatePayload)
    });

    // 5. If the request failed, show an error and stop.
    if (!runCreateResp.ok) {
      let errorText = await runCreateResp.text();
      debugLog("REST API run creation error response body:", errorText);
      throw new Error(`Failed to create run: ${runCreateResp.status} ${runCreateResp.statusText}`);
    }

    // 6. Set up to read the streamed reply from Azure.
    //    - The reply comes in small pieces, like a live chat.
    debugLog("REST_API_STREAMING_RESPONSE");
    const reader = runCreateResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let replyStarted = false;

    // 7. Read each piece of the reply as it arrives.
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        debugLog("REST_API_STREAM_DECODED: " + decoder.decode(value, { stream: true }));
      }
      if (done) {
        debugLog("REST_API_STREAM_ENDED");
        break;
      }
      const decodedChunk = decoder.decode(value, { stream: true });
      buffer += decodedChunk;

      // 8. Split the reply into lines, as the server sends one event per line.
      let lines = buffer.split("\n");
      buffer = lines.pop(); // Save incomplete line for next chunk

      for (let line of lines) {
        line = line.trim();
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        // 9. If the server says "[DONE]", the reply is finished.
        if (data === "[DONE]") {
          if (replyStarted) process.stdout.write("\n");
          break;
        }
        try {
          // 10. Try to understand the event sent by the server.
          const event = JSON.parse(data);
          if (event && event.event) {
            debugLog(event.event);
            // 11. If the agent is calling a tool, print a message for the user.
            if (
              event.event === "thread.run.step.created" ||
              event.event === "thread.run.step.in_progress" ||
              event.event === "thread.run.step.completed"
            ) {
              console.log("Tool event handler triggered");
              // Try to extract tool name/type from payload if available
              let toolType = event.data?.step_details?.tool_name || event.data?.step_details?.type || "unknown tool";
              // Always print user-facing tool call messages, regardless of DEBUG mode
              if (event.event === "thread.run.step.created") {
                console.log(`\n[Tool call started: ${toolType}]`);
              } else if (event.event === "thread.run.step.in_progress") {
                console.log(`[Tool call in progress: ${toolType}]`);
              } else if (event.event === "thread.run.step.completed") {
                console.log(`[Tool call completed: ${toolType}]`);
              }
            }
          }
          // 12. When the agent starts replying, print "Agent reply:" once.
          if (event && event.delta && event.delta.role === "assistant") {
            if (!replyStarted) {
              process.stdout.write("Agent reply: ");
              replyStarted = true;
            }
          }
          // 13. Print each piece of the agent's reply as it arrives.
          if (event && event.delta) {
            debugLog("REST_API_STREAM_EVENT: " + JSON.stringify(event));
            // Handle streaming output for array content
            if (Array.isArray(event.delta.content)) {
              for (const item of event.delta.content) {
                if (
                  item &&
                  item.type === "text" &&
                  item.text &&
                  typeof item.text.value === "string"
                ) {
                  process.stdout.write(item.text.value);
                  replyStarted = true;
                }
              }
            } else if (typeof event.delta.content === "string") {
              process.stdout.write(event.delta.content);
              replyStarted = true;
            }
          }
        } catch {
          // Ignore JSON parse errors for non-data lines
        }
      }
    }
    // 14. If nothing was streamed, let the user know.
    if (!replyStarted) {
      console.log("No agent reply streamed.");
    }
  } catch (err) {
    debugLog("REST_API_STREAM_ERROR");
    logError("in REST API non-streaming", err);
  }
}

/**
 * Stream agent reply using SDK (STREAMING=sdk).
 */
async function streamAgentReplyViaSdk(threadId) {
  debugLog("SDK_STREAMING");
  try {
    // Create run and get stream directly, like the working example
    const assistantIdToUse = (agentId && typeof agentId === "object" && agentId.id) ? agentId.id : agentId;
    const streamEventMessages = await client.runs.create(threadId, assistantIdToUse).stream();
    
    let replyStarted = false;

    for await (const eventMessage of streamEventMessages) {
      switch (eventMessage.event) {
        case RunStreamEvent.ThreadRunCreated:
          debugLog(`ThreadRun status: ${eventMessage.data.status}`);
          break;
          
        case RunStreamEvent.ThreadRunStepCreated:
        case RunStreamEvent.ThreadRunStepInProgress:
        case RunStreamEvent.ThreadRunStepCompleted: {
          // Tool event handler
          let toolType = eventMessage.data?.step_details?.tool_name || 
                        eventMessage.data?.step_details?.type || "unknown tool";
          if (eventMessage.event === RunStreamEvent.ThreadRunStepCreated) {
            console.log(`\n[Tool call started: ${toolType}]`);
          } else if (eventMessage.event === RunStreamEvent.ThreadRunStepInProgress) {
            console.log(`[Tool call in progress: ${toolType}]`);
          } else if (eventMessage.event === RunStreamEvent.ThreadRunStepCompleted) {
            console.log(`[Tool call completed: ${toolType}]`);
          }
          break;
        }
        
        case MessageStreamEvent.ThreadMessageDelta: {
          const messageDelta = eventMessage.data;
          
          // Print "Agent reply:" once when we first get assistant content
          if (messageDelta.delta?.role === "assistant" && !replyStarted) {
            process.stdout.write("Agent reply: ");
            replyStarted = true;
          }
          
          // Handle the delta content like the working example
          if (messageDelta.delta && messageDelta.delta.content) {
            messageDelta.delta.content.forEach((contentPart) => {
              if (contentPart.type === "text") {
                const textContent = contentPart;
                const textValue = textContent.text?.value || "";
                if (textValue) {
                  process.stdout.write(textValue);
                  replyStarted = true;
                }
              }
            });
          }
          break;
        }
        
        case RunStreamEvent.ThreadRunCompleted:
          debugLog("Thread Run Completed");
          if (replyStarted) {
            process.stdout.write("\n");
          }
          break;
          
        case ErrorEvent.Error:
          console.error(`An error occurred. Data: ${eventMessage.data}`);
          break;
          
        case DoneEvent.Done:
          debugLog("Stream completed.");
          break;
          
        default:
          debugLog(eventMessage.event);
      }
    }
    
    if (!replyStarted) {
      console.log("No agent reply streamed.");
    }
  } catch (err) {
    logError("streaming agent reply via SDK", err);
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
    debugLog("runAgent");
    const streamingMode = (process.env.STREAMING || STREAMING_MODES.OFF).toLowerCase();

    if (streamingMode === STREAMING_MODES.API) {
      debugLog("runAgent: STREAMING=api path");
      // --- STREAMING=api: Stream agent reply using REST API ---
      await streamAgentReplyViaRestApi(threadId);

    } else if (streamingMode === STREAMING_MODES.SDK) {
      debugLog("runAgent: STREAMING=sdk path");
      // --- STREAMING=sdk: Stream agent reply using SDK ---
      await streamAgentReplyViaSdk(threadId);

    } else {
      debugLog("runAgent: STREAMING=off path");
      // --- STREAMING=off: Non-streaming mode (default) ---
      let run;
      try {
        // 2. Make sure the agent's ID is in the correct format.
        const safeAssistantId = (agentId && typeof agentId === "object" && agentId.id) ? agentId.id : agentId;
        run = await client.runs.create(threadId, { assistant_id: String(safeAssistantId) });
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
    // If anything goes wrong, show an error message.
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
