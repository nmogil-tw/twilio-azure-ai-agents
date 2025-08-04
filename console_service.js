import "dotenv/config";
import { AgentsClient, RunStreamEvent, MessageStreamEvent } from "@azure/ai-agents";
import { DefaultAzureCredential } from "@azure/identity";
import readline from "readline";

const projectEndpoint =
  process.env.PROJECT_ENDPOINT ||
  "https://nmogi-mctnmz7z-eastus2.services.ai.azure.com/api/projects/nmogi-mctnmz7z-eastus2-project";
const modelDeploymentName = process.env.MODEL_DEPLOYMENT_NAME || "gpt-4o";
const agentId = "asst_bqad9fStBVfNo6Z4numcosQT";
const client = new AgentsClient(projectEndpoint, new DefaultAzureCredential());

const isDebug = !!process.env.DEBUG;
function debugLog(...args) {
  if (isDebug) {
    console.log("[debug]", ...args);
  }
}

// Create a new thread for the conversation
async function createThread(metadata = {}) {
  try {
    const thread = await client.threads.create({ agentId, metadata });
    debugLog("Full thread object returned by client.threads.create:", thread);
    debugLog("Created thread:", thread.id);
    return thread.id;
  } catch (err) {
    console.error("Error creating thread:", err);
    throw err;
  }
}

// Add a user message to the thread
async function addMessage(threadId, content) {
  try {
    debugLog("addMessage called with threadId:", threadId, "length:", threadId.length);
    const message = await client.messages.create(threadId, "user", content);
    debugLog("Added message:", message.id);
    return message.id;
  } catch (err) {
    console.error("Error adding message:", err);
    throw err;
  }
}

// Poll for run completion in non-streaming mode
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
    console.error("Error polling run status:", err);
    throw err;
  }
}

// Print the last agent reply from the thread
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
    console.error("Error retrieving agent replies:", err);
  }
}

// Run the agent and handle streaming or non-streaming output
async function runAgent(threadId) {
  try {
    debugLog("runAgent called with threadId:", threadId, "length:", threadId.length);
    const run = await client.runs.create(threadId, agentId, { modelDeploymentName });
    debugLog("Run started:", run.id);

    const streaming = (process.env.STREAMING || "").toLowerCase() === "true";

    if (streaming) {
      debugLog("Streaming mode enabled (STREAMING=true)");
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
        console.error("Error streaming agent reply:", err);
      }
    } else {
      debugLog("Non-streaming mode enabled (STREAMING not set or false)");
      const status = await pollRunCompletion(threadId, run.id);
      console.log("Run status:", status.status);
      if (status.status === "completed") {
        await printLastAgentReply(threadId);
      } else {
        console.log("Run failed.");
      }
    }
  } catch (err) {
    console.error("Error running agent:", err);
  }
}

// Main interactive loop
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let threadId;
  let metadata = {};

  // Helper to ask a question and return a Promise
  function askQuestion(query) {
    return new Promise((resolve) => rl.question(query, resolve));
  }

  try {
    // New CLI flow: ask if user wants to create a new thread
    let answer = await askQuestion("Do you want to create a new thread? (y/n) ");
    answer = answer.trim().toLowerCase();
    if (answer === "y") {
      // Prompt for metadata BEFORE thread creation
      let metaAnswer = await askQuestion("Do you want to add metadata to the new thread? (y/n) ");
      metaAnswer = metaAnswer.trim().toLowerCase();
      if (metaAnswer === "y") {
        console.log('Enter metadata as key=value, one per line. Enter an empty line to finish.');
        while (true) {
          let pair = await askQuestion("> ");
          pair = pair.trim();
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
      threadId = await askQuestion("Enter the thread ID to use: ");
      threadId = threadId.trim();
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
      await addMessage(threadId, line);
      await runAgent(threadId);
    } catch {
      // Errors already logged in respective functions
    }
    rl.prompt();
  });
}

main().catch(console.error);
