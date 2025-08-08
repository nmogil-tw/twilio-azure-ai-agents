# twilio-azure-ai-agents

A Node.js command-line tool for interacting with Azure AI Agents. This CLI allows you to chat with an Azure-hosted agent directly from your terminal, supporting both streaming (not supported as of 7/31/25) and non-streaming responses.

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in your Azure credentials:
     - `AZURE_CLIENT_ID`
     - `AZURE_TENANT_ID`
     - `AZURE_CLIENT_SECRET`
     - `AGENT_ID` (required: your Azure AI Agent ID)
   - Optional variables:
     - `STREAMING` (controls response delivery: `off`, `sdk`, or `api`)
     - `PROJECT_ENDPOINT` and `MODEL_DEPLOYMENT_NAME` (to override defaults)

## Usage

Start the CLI with:

```sh
node console_service.js
```

- Type your message and press Enter to chat with the agent.
- Type `exit` to quit the session.
- If `STREAMING=sdk` is set in your `.env`, agent replies will stream in real time using the SDK.
- If `STREAMING=api`, the CLI will use direct REST API calls (no streaming/SSE; replies appear after processing).
- If `STREAMING=off` or unset, replies will appear after processing (no streaming).
