import { EventEmitter } from 'events';
import { AgentsClient } from '@azure/ai-agents';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from '../config.js';

/**
 * Azure Agent Service
 * Wraps Azure AI Agents SDK for use with Twilio Conversation Relay
 * Emits events for WebSocket communication
 *
 * Events emitted:
 * - 'textDelta': Partial text streaming (token: string)
 * - 'textComplete': Final complete text (content: string)
 * - 'toolCall': Tool execution detected (toolCall: Object)
 * - 'runComplete': Agent run completed
 * - 'error': Error occurred (error: Error)
 * - 'thinking': Agent is thinking/processing
 * - 'languageSwitch': Language switch requested (language: string)
 * - 'handoff': Human agent handoff requested (data: Object)
 */
export class AzureAgentService extends EventEmitter {
  // Shared client instance across all sessions (connection pooling)
  static _sharedClient = null;
  static _clientInitialized = false;
  static _initializationPromise = null;

  /**
   * @param {string} sessionId - Unique session identifier (callSid)
   */
  constructor(sessionId) {
    super();
    this.sessionId = sessionId;
    this.threadId = null;
    this.client = null;
    this.currentStreamController = null;
    this.isStreaming = false;
    this._initPromise = null;

    // Start initialization but don't await (constructors can't be async)
    this._initPromise = this._initialize();
  }

  /**
   * Ensure client is initialized before use
   * @private
   */
  async _ensureInitialized() {
    if (this._initPromise) {
      await this._initPromise;
      this._initPromise = null;
    }
  }

  /**
   * Initialize or reuse shared Azure AI Agents client (connection pooling)
   * @private
   */
  async _initialize() {
    try {
      // Use shared client if already initialized
      if (AzureAgentService._clientInitialized) {
        this.client = AzureAgentService._sharedClient;
        if (config.debug) {
          console.log(` [${this.sessionId}] Azure Agent Service using shared client (connection pooling)`);
        }
        return;
      }

      // If initialization is already in progress, wait for it
      if (AzureAgentService._initializationPromise) {
        await AzureAgentService._initializationPromise;
        this.client = AzureAgentService._sharedClient;
        return;
      }

      // Start initialization (singleton pattern)
      AzureAgentService._initializationPromise = (async () => {
        const fullEndpoint = `${config.azure.projectEndpoint}/api/projects/${config.azure.projectId}`;
        const credential = new DefaultAzureCredential();
        const client = new AgentsClient(fullEndpoint, credential);

        AzureAgentService._sharedClient = client;
        AzureAgentService._clientInitialized = true;

        if (config.debug) {
          console.log(` [${this.sessionId}] Azure Agent Service initialized (shared client created)`);
          console.log(`   Endpoint: ${fullEndpoint}`);
          console.log(`   Agent ID: ${config.azure.agentId}`);
        }
      })();

      await AzureAgentService._initializationPromise;
      this.client = AzureAgentService._sharedClient;
    } catch (error) {
      console.error(` [${this.sessionId}] Failed to initialize Azure Agent Service:`, error);
      AzureAgentService._initializationPromise = null;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a new thread for this conversation
   * @param {Object} [metadata] - Optional thread metadata
   * @returns {Promise<string>} Thread ID
   */
  async createThread(metadata = {}) {
    await this._ensureInitialized();

    try {
      if (config.debug) {
        console.log(` [${this.sessionId}] Creating new thread...`);
      }

      const thread = await this.client.threads.create({
        agentId: config.azure.agentId,
        metadata: {
          sessionId: this.sessionId,
          createdAt: new Date().toISOString(),
          ...metadata
        }
      });

      this.threadId = thread.id;

      if (config.debug) {
        console.log(` [${this.sessionId}] Thread created: ${this.threadId}`);
      }

      return this.threadId;
    } catch (error) {
      console.error(` [${this.sessionId}] Failed to create thread:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Set existing thread ID (for reconnection scenarios)
   * @param {string} threadId - Existing thread ID
   */
  setThreadId(threadId) {
    this.threadId = threadId;
    if (config.debug) {
      console.log(` [${this.sessionId}] Thread ID set: ${threadId}`);
    }
  }

  /**
   * Add a user message to the thread
   * @param {string} content - Message content
   * @returns {Promise<Object>} Message object
   */
  async addMessage(content) {
    await this._ensureInitialized();

    if (!this.threadId) {
      throw new Error('Thread ID not set. Call createThread() first.');
    }

    try {
      if (config.debug) {
        console.log(` [${this.sessionId}] Adding message to thread ${this.threadId}`);
        console.log(`   Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      }

      const message = await this.client.messages.create(this.threadId, 'user', content);

      return message;
    } catch (error) {
      console.error(` [${this.sessionId}] Failed to add message:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stream agent response
   * Processes the stream and emits events for WebSocket communication
   * @returns {Promise<void>}
   */
  async streamResponse() {
    await this._ensureInitialized();

    if (!this.threadId) {
      throw new Error('Thread ID not set. Call createThread() first.');
    }

    try {
      const startTime = Date.now();

      if (config.debug) {
        console.log(` [${this.sessionId}] Starting stream for thread ${this.threadId}...`);
      }

      this.isStreaming = true;
      this.emit('thinking'); // Notify that agent is processing

      // Create the streaming run
      const stream = await this.client.runs
        .create(this.threadId, config.azure.agentId)
        .stream();

      let firstTokenTime = null;
      let responseStartTime = null;

      let currentMessageContent = '';

      // Process stream events
      for await (const event of stream) {
        // Check if streaming was interrupted
        if (!this.isStreaming) {
          if (config.debug) {
            console.log(` [${this.sessionId}] Stream interrupted by user`);
          }
          break;
        }

        if (config.debug) {
          console.log(` [${this.sessionId}] Stream event: ${event.event}`);
        }

        switch (event.event) {
          case 'thread.run.created':
          case 'thread.run.queued':
          case 'thread.run.in_progress':
            // Run status events - agent is thinking
            this.emit('thinking');
            break;

          case 'thread.run.requires_action':
            // Agent needs to execute tools
            // Azure handles this automatically, but we log it
            if (event.data?.required_action?.submit_tool_outputs?.tool_calls) {
              for (const toolCall of event.data.required_action.submit_tool_outputs.tool_calls) {
                if (config.debug) {
                  console.log(` [${this.sessionId}] Tool call: ${toolCall.function?.name}`);
                }

                this.emit('toolCall', {
                  id: toolCall.id,
                  name: toolCall.function?.name,
                  arguments: toolCall.function?.arguments
                });

                // Check for special tool calls
                this._handleSpecialToolCalls(toolCall);
              }
            }
            break;

          case 'thread.run.step.created':
          case 'thread.run.step.in_progress':
          case 'thread.run.step.completed':
            // Step events - continue thinking
            this.emit('thinking');
            break;

          case 'thread.message.created':
          case 'thread.message.in_progress':
            // Message being created
            break;

          case 'thread.message.delta':
            // Streaming text content
            if (event.data?.delta?.content) {
              for (const contentPart of event.data.delta.content) {
                if (contentPart.type === 'text' && contentPart.text?.value) {
                  const token = contentPart.text.value;
                  currentMessageContent += token;

                  // Track time to first token
                  if (!firstTokenTime) {
                    firstTokenTime = Date.now();
                    responseStartTime = firstTokenTime; // Start tracking response duration
                    const latency = firstTokenTime - startTime;
                    console.log(` [${this.sessionId}] ⚡ First token latency: ${latency}ms`);
                  }

                  // Emit each token for real-time streaming
                  this.emit('textDelta', token);
                }
              }
            }
            break;

          case 'thread.message.completed':
            // Message complete
            if (currentMessageContent) {
              if (config.debug) {
                console.log(` [${this.sessionId}] Message completed (preview): ${currentMessageContent.substring(0, 100)}`);
              }
              this.emit('textComplete', currentMessageContent);

              // Log the complete agent response and timing summary
              if (responseStartTime) {
                const totalDuration = ((Date.now() - responseStartTime) / 1000).toFixed(1);
                const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : 0;

                // Log the complete response (keep console.log for important conversation log)
                console.log(` [${this.sessionId}] Agent: ${currentMessageContent}`);
                console.log(` [${this.sessionId}] Response completed - ${currentMessageContent.length} chars in ${totalDuration}s (first token: ${firstTokenLatency}ms)`);
              }
            }
            break;

          case 'thread.run.completed':
            // Run completed successfully
            if (config.debug) {
              console.log(` [${this.sessionId}] Run completed`);
            }
            this.emit('runComplete');
            break;

          case 'thread.run.failed':
          case 'thread.run.cancelled':
          case 'thread.run.expired':
            // Error states
            const error = new Error(`Run ${event.event}: ${event.data?.last_error?.message || 'Unknown error'}`);
            console.error(` [${this.sessionId}]`, error);
            this.emit('error', error);
            break;

          case 'error':
            // Stream error
            console.error(` [${this.sessionId}] Stream error:`, event.data);
            this.emit('error', new Error(event.data?.message || 'Stream error'));
            break;

          case 'done':
            // Stream complete
            if (config.debug) {
              console.log(` [${this.sessionId}] Stream done`);
            }
            break;

          default:
            if (config.debug) {
              console.log(` [${this.sessionId}] Unhandled event: ${event.event}`);
            }
        }
      }

      this.isStreaming = false;

    } catch (error) {
      console.error(` [${this.sessionId}] Stream error:`, error);
      this.emit('error', error);
      this.isStreaming = false;
      throw error;
    }
  }

  /**
   * Handle special tool calls (language switch, handoff, etc.)
   * @private
   * @param {Object} toolCall - Tool call object
   */
  _handleSpecialToolCalls(toolCall) {
    const functionName = toolCall.function?.name;

    if (!functionName) return;

    try {
      // Parse arguments if they're a string
      let args = toolCall.function.arguments;
      if (typeof args === 'string') {
        args = JSON.parse(args);
      }

      // Check for language switching
      if (functionName === 'switch_language' || functionName === 'change_language') {
        const targetLanguage = args.targetLanguage || args.language;
        if (targetLanguage) {
          console.log(` [${this.sessionId}] Language switch requested: ${targetLanguage}`);
          this.emit('languageSwitch', { targetLanguage });
        }
      }

      // Check for human agent handoff
      if (functionName === 'human_agent_handoff' || functionName === 'transfer_to_agent' || functionName === 'escalate') {
        console.log(` [${this.sessionId}] Human agent handoff requested`);
        this.emit('handoff', args);
      }
    } catch (error) {
      console.error(` [${this.sessionId}] Error handling tool call:`, error);
    }
  }

  /**
   * Stop current streaming (for user interruptions)
   */
  stopStreaming() {
    if (this.isStreaming) {
      if (config.debug) {
        console.log(` [${this.sessionId}] Stopping stream...`);
      }
      this.isStreaming = false;
    }
  }

  /**
   * Process a user message and stream response
   * @param {string} message - User message
   * @returns {Promise<void>}
   */
  async processMessage(message) {
    try {
      // Ensure thread exists
      if (!this.threadId) {
        await this.createThread();
      }

      // Add user message
      await this.addMessage(message);

      // Stream response
      await this.streamResponse();
    } catch (error) {
      console.error(` [${this.sessionId}] Error processing message:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get state for persistence
   * @returns {Object} Service state
   */
  getState() {
    return {
      sessionId: this.sessionId,
      threadId: this.threadId,
      timestamp: Date.now()
    };
  }

  /**
   * Restore state (for reconnection)
   * @param {Object} state - Saved state
   */
  restoreState(state) {
    if (state.threadId) {
      this.setThreadId(state.threadId);
      if (config.debug) {
        console.log(` [${this.sessionId}] State restored with thread ${state.threadId}`);
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopStreaming();
    this.removeAllListeners();
    if (config.debug) {
      console.log(` [${this.sessionId}] Service cleaned up`);
    }
  }
}

export default AzureAgentService;
