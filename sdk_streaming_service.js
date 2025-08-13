/**
 * Azure AI Agent Service - SDK Streaming Version
 * Provides an interactive CLI for sending messages to an Azure AI Agent using SDK streaming.
 * This is a simplified version focused on SDK streaming implementation.
 */

import "dotenv/config";
import { AgentsClient, RunStreamEvent, MessageStreamEvent, DoneEvent, ErrorEvent } from "@azure/ai-agents";
import { DefaultAzureCredential } from "@azure/identity";
import readline from "readline";

// =======================
// Constants & Environment
// =======================

const DEFAULT_PROJECT_ENDPOINT = "https://nmogi-mctnmz7z-eastus2.services.ai.azure.com";
const DEFAULT_PROJECT_ID = "nmogi-mctnmz7z-eastus2-project";

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
 * Print debug messages when DEBUG is enabled.
 */
function debugLog(message) {
  if (isDebug && message) {
    console.log("[debug]", message);
  }
}

// ===================
// Utility Functions
// ===================

/**
 * Promisified readline question.
 */
function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Standard error logger.
 */
function logError(context, err) {
  console.error(`Error ${context}:`, err);
}

// ==========================
// Thread & Message Functions
// ==========================

/**
 * Create a new conversation thread.
 */
async function createThread(metadata = {}) {
  try {
    const thread = await client.threads.create({ agentId, metadata });
    debugLog("Thread created");
    return thread.id;
  } catch (err) {
    logError("creating thread", err);
    throw err;
  }
}

/**
 * Add a user message to a thread.
 */
async function addMessageToThread(threadId, content) {
  try {
    debugLog("Message created");
    const message = await client.messages.create(threadId, "user", content);
    return message.id;
  } catch (err) {
    logError("adding message", err);
    throw err;
  }
}

// ==========================
// SDK Streaming Implementation
// ==========================

/**
 * Stream agent reply using SDK - mirrors the working example.
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
// Agent Run Function
// ==========================

/**
 * Run the agent using SDK streaming.
 */
async function runAgent(threadId) {
  try {
    debugLog("Running agent with SDK streaming");
    await streamAgentReplyViaSdk(threadId);
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
  console.log("Azure AI Agent Service - SDK Streaming Version");
  console.log("==============================================");
  
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
            console.log("Invalid format. Use key=value");
            continue;
          }
          const key = pair.slice(0, eqIdx).trim();
          const value = pair.slice(eqIdx + 1).trim();
          if (!key) {
            console.log("Key cannot be empty");
            continue;
          }
          metadata[key] = value;
        }
      }
      threadId = await createThread(metadata);
      console.log(`Created new thread: ${threadId}`);
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
  } catch (err) {
    logError("thread setup", err);
    rl.close();
    return;
  }

  // Main message loop
  console.log("\nReady! Type your messages (or 'exit' to quit):");
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
    } catch (err) {
      logError("processing message", err);
    }
    
    rl.prompt();
  });
}

// ==========
// Entrypoint
// ==========

main().catch(console.error);
