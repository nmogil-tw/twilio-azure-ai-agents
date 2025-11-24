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

const projectEndpoint = process.env.PROJECT_ENDPOINT;
const projectId = process.env.PROJECT_ID;
let agentId = process.env.AGENT_ID;

if (!projectEndpoint || !projectId) {
  console.error("Error: PROJECT_ENDPOINT and PROJECT_ID environment variables are required.");
  console.error("Please set them in your .env file.");
  process.exit(1);
}

const client = new AgentsClient(
  `${projectEndpoint}/api/projects/${projectId}`,
  new DefaultAzureCredential()
);

const isDebug = !!process.env.DEBUG;

// ==============
// Debug Logging
// ==============

function debugLog(message) {
  if (isDebug && message) {
    console.log("[debug]", message);
  }
}

// ===================
// Utility Functions
// ===================

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function logError(context, err) {
  console.error(`Error ${context}:`, err);
}

// ==========================
// Thread & Message Functions
// ==========================

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

async function streamAgentReplyViaSdk(threadId) {
  debugLog("SDK_STREAMING");
  try {
    const assistantIdToUse = (agentId && typeof agentId === "object" && agentId.id) ? agentId.id : agentId;
    const streamEventMessages = await client.runs.create(threadId, assistantIdToUse).stream();
    
    let replyStarted = false;
    let isThinking = false;

    for await (const eventMessage of streamEventMessages) {
      switch (eventMessage.event) {
        case RunStreamEvent.ThreadRunCreated:
          debugLog(`ThreadRun status: ${eventMessage.data.status}`);
          break;

        case RunStreamEvent.ThreadRunQueued:
          console.log("🔄 Agent request queued...");
          break;
          
        case RunStreamEvent.ThreadRunInProgress:
          if (!isThinking) {
            process.stdout.write("🤔 Agent is thinking");
            isThinking = true;
          } else {
            process.stdout.write(".");
          }
          break;

        case RunStreamEvent.ThreadRunRequiresAction:
          console.log("\n⚡ Agent needs to call external functions...");
          const requiredActions = eventMessage.data.required_action?.submit_tool_outputs?.tool_calls;
          if (requiredActions) {
            requiredActions.forEach(action => {
              console.log(`  📞 Calling: ${action.function?.name || 'unknown function'}`);
            });
          }
          break;

        case RunStreamEvent.ThreadRunCancelling:
          console.log("\n⚠️  Agent run is being cancelled...");
          break;
          
        case RunStreamEvent.ThreadRunCancelled:
          console.log("\n❌ Agent run was cancelled");
          return;
          
        case RunStreamEvent.ThreadRunExpired:
          console.log("\n⏰ Agent run expired");
          return;
          
        case RunStreamEvent.ThreadRunFailed:
          console.log("\n💥 Agent run failed");
          if (eventMessage.data.last_error) {
            console.log(`   Error: ${eventMessage.data.last_error.message}`);
          }
          return;

        case RunStreamEvent.ThreadRunStepCreated: {
          const stepType = eventMessage.data?.step_details?.type;
          if (stepType === 'tool_calls') {
            const toolCalls = eventMessage.data.step_details?.tool_calls || [];
            toolCalls.forEach(call => {
              if (call.type === 'function') {
                console.log(`\n🔧 Starting: ${call.function?.name || 'function'}`);
                if (isDebug && call.function?.arguments) {
                  console.log(`   Args: ${call.function.arguments}`);
                }
              } else if (call.type === 'code_interpreter') {
                console.log(`\n💻 Running code interpreter...`);
              } else if (call.type === 'file_search') {
                console.log(`\n🔍 Searching files...`);
              }
            });
          } else if (stepType === 'message_creation') {
            if (isThinking) {
              console.log("\n📝 Composing response...");
              isThinking = false;
            }
          }
          break;
        }

        case RunStreamEvent.ThreadRunStepInProgress: {
          const progressStep = eventMessage.data?.step_details;
          if (progressStep?.type === 'tool_calls') {
            process.stdout.write("⏳");
          }
          break;
        }
          
        case RunStreamEvent.ThreadRunStepCompleted: {
          const completedStep = eventMessage.data?.step_details;
          if (completedStep?.type === 'tool_calls') {
            console.log(" ✅");
            completedStep.tool_calls?.forEach(call => {
              if (isDebug && call.function?.output) {
                console.log(`   Output: ${call.function.output.substring(0, 100)}...`);
              }
            });
          }
          break;
        }

        case MessageStreamEvent.ThreadMessageCreated:
          if (eventMessage.data.role === 'assistant') {
            if (isThinking) {
              console.log(); // New line after thinking dots
              isThinking = false;
            }
          }
          break;

        case MessageStreamEvent.ThreadMessageInProgress:
          if (!replyStarted && eventMessage.data.role === 'assistant') {
            process.stdout.write("Agent reply: ");
            replyStarted = true;
          }
          break;

        case MessageStreamEvent.ThreadMessageCompleted:
          debugLog("Message completed");
          break;

        case MessageStreamEvent.ThreadMessageAttachmentDelta:
          console.log("\n📎 Processing attachment...");
          break;
        
        case MessageStreamEvent.ThreadMessageDelta: {
          const messageDelta = eventMessage.data;

          if (messageDelta.delta?.role === "assistant" && !replyStarted) {
            if (isThinking) {
              console.log(); // New line after thinking
              isThinking = false;
            }
            process.stdout.write("Agent reply: ");
            replyStarted = true;
          }

          if (messageDelta.delta && messageDelta.delta.content) {
            messageDelta.delta.content.forEach((contentPart) => {
              if (contentPart.type === "text") {
                const textContent = contentPart;
                const textValue = textContent.text?.value || "";
                if (textValue) {
                  process.stdout.write(textValue);
                  replyStarted = true;
                }
              } else if (contentPart.type === "image_file") {
                console.log(`\n🖼️  [Image: ${contentPart.image_file?.file_id}]`);
              } else if (contentPart.type === "image_url") {
                console.log(`\n🌐 [Image URL: ${contentPart.image_url?.url}]`);
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
          if (isThinking) {
            console.log(" Done!");
            isThinking = false;
          }
          break;

        case ErrorEvent.Error:
          console.error(`\n❌ Error occurred: ${eventMessage.data}`);
          break;
          
        case DoneEvent.Done:
          debugLog("Stream completed.");
          break;
          
        default:
          debugLog(`Unhandled event: ${eventMessage.event}`);
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

async function main() {
  console.log("Azure AI Agent Service - SDK Streaming Version");
  console.log("==============================================");
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let threadId;
  let metadata = {};

  if (!agentId) {
    agentId = (await askQuestion(rl, "Enter the AGENT_ID to use: ")).trim();
    if (!agentId) {
      console.error("No AGENT_ID provided. Exiting.");
      rl.close();
      return;
    }
  }

  try {
    let answer = (await askQuestion(rl, "Do you want to create a new thread? (y/n) ")).trim().toLowerCase();
    if (answer === "y") {
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
