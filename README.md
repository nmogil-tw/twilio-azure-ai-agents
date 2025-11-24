# Twilio Azure AI Agents - Conversation Relay Example

A production-ready Node.js command-line tool demonstrating how to implement Twilio Conversation Relay with Microsoft Azure AI Agents. This CLI provides an interactive chat interface with real-time streaming responses from Azure-hosted agents.

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in your Azure credentials:
   - Required variables:
     - `PROJECT_ENDPOINT` - Your Azure AI project endpoint (e.g., `https://your-project.services.ai.azure.com`)
     - `PROJECT_ID` - Your Azure AI project ID
     - `AGENT_ID` - Your Azure AI Agent ID
   - Optional variables:
     - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` - Only needed if not using Azure CLI (`az login`) or other DefaultAzureCredential methods
     - `DEBUG` - Set to any value to enable verbose debug logging

3. **Authenticate with Azure:**
   - Either run `az login` to authenticate via Azure CLI (recommended for development)
   - Or set the Azure Service Principal credentials in your `.env` file

## Usage

Start the CLI with:

```sh
node twilio-azure-conversation-relay.js
```

The CLI provides an interactive chat interface with the following features:

- **Real-time streaming**: Agent responses stream in real-time using the Azure AI SDK
- **Thread management**: Create new conversation threads or continue existing ones
- **Metadata support**: Add custom metadata to conversation threads
- **Tool calling visibility**: See when the agent calls external functions or tools
- **Error handling**: Graceful handling of errors and connection issues

### Interactive prompts:

1. If `AGENT_ID` is not set in `.env`, you'll be prompted to enter it
2. Choose whether to create a new thread or use an existing one
3. Optionally add metadata to new threads
4. Type your messages and receive streaming responses
5. Type `exit` to quit the session

### Debug mode:

Enable detailed logging by setting the `DEBUG` environment variable:

```sh
DEBUG=1 node twilio-azure-conversation-relay.js
```

## Features

- **SDK-based streaming**: Uses Azure AI Agents SDK for efficient real-time responses
- **Comprehensive event handling**: Tracks run states, tool calls, message creation, and errors
- **Visual feedback**: Progress indicators for agent thinking and tool execution
- **Flexible authentication**: Uses DefaultAzureCredential for secure authentication
- **Production-ready**: Error handling, input validation, and clean shutdown
