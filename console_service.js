import "dotenv/config";
import { AgentsClient, RunStreamEvent, MessageStreamEvent, ErrorEvent, DoneEvent } from "@azure/ai-agents";
import { DefaultAzureCredential } from "@azure/identity";
import readline from "readline";

const projectEndpoint = process.env["PROJECT_ENDPOINT"] || "https://nmogi-mctnmz7z-eastus2.services.ai.azure.com/api/projects/nmogi-mctnmz7z-eastus2-project";
const modelDeploymentName = process.env["MODEL_DEPLOYMENT_NAME"] || "gpt-4o";
const agentId = "asst_bqad9fStBVfNo6Z4numcosQT";
const client = new AgentsClient(projectEndpoint, new DefaultAzureCredential());
console.log("[debug] client.runs methods:", Object.keys(client.runs));

async function createThread() {
  const thread = await client.threads.create({ agentId });
  console.log("Full thread object returned by client.threads.create:", thread);
  console.log("Created thread:", thread.id);
  return thread.id;
}

async function addMessage(threadId, content) {
  console.log("addMessage called with threadId:", threadId, "length:", threadId.length);
  const message = await client.messages.create(threadId, "user", content);
  console.log("Added message:", message.id);
  return message.id;
}

async function runAgent(threadId) {
  console.log("runAgent called with threadId:", threadId, "length:", threadId.length);
  const run = await client.runs.create(
    threadId,
    agentId,
    { modelDeploymentName }
  );
  console.log("Run started:", run.id);

  const streaming = (process.env.STREAMING || "").toLowerCase() === "true";

  if (streaming) {
    console.log("[runAgent] Streaming mode enabled (STREAMING=true)");
    // Stream the agent's reply in real time
    // Uses the streaming API as documented for @azure/ai-agents@1.1.0-beta.3:
    // https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/ai/ai-agents/README.md#create-run-run_and_process-or-stream
    try {
      // Use the correct Azure streaming API
      const streamEventMessages = await run.stream();
      let replyStarted = false;
      let currentMessageId = null;
      let currentMessageContent = "";
      for await (const event of streamEventMessages) {
        if (event.eventType === MessageStreamEvent.Delta && event.data?.delta?.role === "assistant") {
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
        // Optionally handle other event types (ErrorEvent, DoneEvent) if needed
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
    console.log("[runAgent] Non-streaming mode enabled (STREAMING not set or false)");
    // Wait for run to complete and print output (original logic)
    let status;
    do {
      await new Promise(r => setTimeout(r, 2000));
      status = await client.runs.get(threadId, run.id);
      process.stdout.write(".");
    } while (status.status !== "completed" && status.status !== "failed");
    console.log("\nRun status:", status.status);
    if (status.status === "completed") {
      const messages = [];
      for await (const msg of client.messages.list(threadId)) {
        messages.push(msg);
      }
      const agentReplies = messages.filter(msg => msg.role === "assistant");
      if (agentReplies.length === 0) {
        console.log("No agent replies found.");
      } else {
        const lastAgentReply = agentReplies[agentReplies.length - 1];
        console.log("Agent reply:", lastAgentReply.content);
      }
    } else {
      console.log("Run failed.");
    }
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let threadId = await createThread();
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
    await addMessage(threadId, line);
    await runAgent(threadId);
    rl.prompt();
  });
}

main().catch(console.error);
