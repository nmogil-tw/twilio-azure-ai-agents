import { WebSocket } from 'ws';
import { AzureAgentService } from './azureAgentService.js';
import { DTMFHelper } from './dtmfHelper.js';
import { IdleTimer } from './idleTimer.js';
import { StateManager } from './stateManager.js';
import { config } from '../config.js';

/**
 * @typedef {import('../types/index.js').ConversationRelayMessage} ConversationRelayMessage
 * @typedef {import('../types/index.js').SessionData} SessionData
 */

/**
 * Global map to track active sessions
 * @type {Map<string, SessionData>}
 */
const activeSessions = new Map();

/**
 * Get the state manager singleton
 */
const stateManager = StateManager.getInstance();

/**
 * Initialize WebSocket handlers
 * @param {import('ws').WebSocketServer} wss - WebSocket server instance
 */
export function initializeWebSocketHandlers(wss) {
  console.log(' Initializing WebSocket handlers...');

  wss.on('connection', (ws) => {
    console.log(' New WebSocket connection established');

    /** @type {AzureAgentService | null} */
    let agentService = null;

    /** @type {DTMFHelper | null} */
    let dtmfHelper = null;

    /** @type {IdleTimer | null} */
    let idleTimer = null;

    /** @type {string} */
    let currentSessionId = '';

    /**
     * Initialize or restore a session
     * @param {string} sessionId - Session identifier (callSid)
     */
    const initializeSession = async (sessionId) => {
      currentSessionId = sessionId;

      // Check if we have an existing session to restore
      const existingSession = activeSessions.get(sessionId);

      if (existingSession) {
        // Restore existing session
        console.log(` [${sessionId}] Restoring existing session`);
        agentService = existingSession.agentService;
        dtmfHelper = existingSession.dtmfHelper;
        idleTimer = existingSession.idleTimer;
      } else {
        // Create new session
        console.log(` [${sessionId}] Creating new session`);

        // Initialize services
        agentService = new AzureAgentService(sessionId);
        dtmfHelper = new DTMFHelper();
        idleTimer = new IdleTimer(10000, dtmfHelper); // 10 second timeout

        // Try to restore state from state manager
        const savedState = stateManager.restoreState(sessionId);
        if (savedState) {
          console.log(` [${sessionId}] Restored state from state manager`);
          agentService.restoreState(savedState);

          // Send a notice to the agent about the reconnection
          try {
            await agentService.addMessage(
              'SYSTEM NOTICE: The connection was temporarily disconnected and has now been restored. ' +
              'If the user\'s last message is unclear or incomplete, please politely ask them to repeat or clarify their request.'
            );
          } catch (error) {
            console.error(` [${sessionId}] Error adding reconnection notice:`, error);
          }
        } else {
          // Create new thread for new session
          await agentService.createThread({
            source: 'twilio-conversation-relay',
            startTime: new Date().toISOString()
          });
        }

        // Store session
        activeSessions.set(sessionId, { agentService, dtmfHelper, idleTimer });
      }

      // Setup event listeners
      setupEventListeners();
    };

    /**
     * Setup event listeners for agent service and idle timer
     */
    const setupEventListeners = () => {
      // Remove existing listeners to prevent duplicates
      if (agentService) {
        agentService.removeAllListeners();
      }
      if (idleTimer) {
        idleTimer.removeAllListeners();
      }

      // Agent Service Event Listeners

      // Handle text streaming (partial content)
      agentService.on('textDelta', (token) => {
        if (config.debug) {
          console.log(` [${currentSessionId}] Text delta: ${token}`);
        }

        ws.send(JSON.stringify({
          type: 'text',
          token: token,
          last: false
        }));
      });

      // Handle complete text
      agentService.on('textComplete', (content) => {
        if (config.debug) {
          console.log(` [${currentSessionId}] Text complete: ${content.substring(0, 100)}...`);
        }

        ws.send(JSON.stringify({
          type: 'text',
          token: '',
          last: true
        }));
      });

      // Handle agent thinking/processing
      agentService.on('thinking', () => {
        // Could send a message to indicate processing, if desired
        if (config.debug) {
          console.log(` [${currentSessionId}] Agent is thinking...`);
        }
      });

      // Handle tool calls
      agentService.on('toolCall', (toolCall) => {
        console.log(` [${currentSessionId}] Tool call: ${toolCall.name}`);
        // Tools are handled by Azure, just log for visibility
      });

      // Handle language switch
      agentService.on('languageSwitch', (data) => {
        const targetLanguage = data.targetLanguage;
        const languageConfig = config.languages[targetLanguage];

        if (!languageConfig) {
          console.error(` [${currentSessionId}] Language not supported: ${targetLanguage}`);
          return;
        }

        console.log(` [${currentSessionId}] Switching language to: ${targetLanguage}`);

        ws.send(JSON.stringify({
          type: 'language',
          ttsLanguage: languageConfig.locale_code,
          transcriptionLanguage: languageConfig.locale_code
        }));
      });

      // Handle human agent handoff
      agentService.on('handoff', (handoffData) => {
        console.log(` [${currentSessionId}] Human agent handoff requested`);
        console.log(`   Reason: ${handoffData.reason || 'Not specified'}`);

        ws.send(JSON.stringify({
          type: 'end',
          handoffData: JSON.stringify(handoffData)
        }));
      });

      // Handle errors
      agentService.on('error', (error) => {
        console.error(` [${currentSessionId}] Agent service error:`, error);

        ws.send(JSON.stringify({
          type: 'error',
          message: error.message || 'An error occurred'
        }));
      });

      // Handle run complete
      agentService.on('runComplete', () => {
        if (config.debug) {
          console.log(` [${currentSessionId}] Agent run completed`);
        }
      });

      // Idle Timer Event Listeners

      idleTimer.on('idleTimeout', (data) => {
        console.log(` [${currentSessionId}] Idle timeout occurred`);

        // Notify the agent that DTMF input wasn't received
        agentService.processMessage(
          'SYSTEM NOTICE: DTMF input was not received within the expected timeframe. ' +
          'Please reprompt the caller or continue with the conversation.'
        ).catch(error => {
          console.error(` [${currentSessionId}] Error handling idle timeout:`, error);
        });

        // Reset DTMF state
        dtmfHelper.resetState();
      });
    };

    // WebSocket Message Handlers

    ws.on('message', async (message) => {
      try {
        /** @type {ConversationRelayMessage} */
        const parsedMessage = JSON.parse(message.toString());

        if (config.debug) {
          console.log(`[${currentSessionId || 'pending'}] Received:`, parsedMessage.type);
        }

        switch (parsedMessage.type) {
          case 'setup':
            // Initialize session
            await initializeSession(parsedMessage.callSid);
            console.log(` [${currentSessionId}] Session initialized`);
            break;

          case 'prompt':
            // User spoke something
            if (!agentService) {
              console.error(` Session not initialized`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Session not initialized. Setup message required first.'
              }));
              return;
            }

            console.log(` [${currentSessionId}] User: ${parsedMessage.voicePrompt}`);

            // Process the message through agent service
            agentService.processMessage(parsedMessage.voicePrompt).catch(error => {
              console.error(` [${currentSessionId}] Error processing prompt:`, error);
            });
            break;

          case 'dtmf':
            // Keypad input
            if (!dtmfHelper || !idleTimer || !agentService) {
              console.error(` [${currentSessionId}] Services not initialized for DTMF handling`);
              return;
            }

            console.log(` [${currentSessionId}] DTMF: ${parsedMessage.digit}`);

            // Process DTMF input
            const processedDTMF = dtmfHelper.processDTMF(parsedMessage.digit);

            // Restart idle timer on each digit
            idleTimer.restart();

            // If collection is complete, send to agent
            if (dtmfHelper.isComplete()) {
              console.log(` [${currentSessionId}] DTMF collection complete: ${processedDTMF}`);

              // Clear idle timer
              idleTimer.clear();

              // Send to agent as a system message
              agentService.processMessage(`DTMF INPUT: ${processedDTMF}`).catch(error => {
                console.error(` [${currentSessionId}] Error processing DTMF result:`, error);
              });

              // Reset DTMF state
              dtmfHelper.resetState();
            } else {
              if (config.debug) {
                const progress = dtmfHelper.getProgress();
                console.log(` [${currentSessionId}] DTMF collecting: ${progress.bufferLength}/${progress.expectedLength || '?'}`);
              }
            }
            break;

          case 'interrupt':
            // User interrupted AI
            if (agentService) {
              console.log(` [${currentSessionId}] User interrupted`);
              agentService.stopStreaming();
            }
            break;

          case 'error':
            // Error from Twilio
            console.error(` [${currentSessionId}] Twilio error received`);
            break;

          default:
            console.warn(` [${currentSessionId}] Unknown message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error(` [${currentSessionId}] Error parsing message:`, error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    // WebSocket Close Handler

    ws.on('close', () => {
      console.log(` [${currentSessionId}] WebSocket connection closed`);

      // Save state before cleanup
      if (agentService && currentSessionId) {
        const state = agentService.getState();
        stateManager.saveState(currentSessionId, state);
        console.log(` [${currentSessionId}] State saved for potential reconnection`);
      }

      // Clear idle timer
      if (idleTimer) {
        idleTimer.clear();
      }

      // Schedule cleanup after grace period (5 minutes)
      setTimeout(() => {
        if (currentSessionId && activeSessions.has(currentSessionId)) {
          console.log(` [${currentSessionId}] Cleaning up session after grace period`);

          // Get session before deleting
          const session = activeSessions.get(currentSessionId);

          // Remove from active sessions
          activeSessions.delete(currentSessionId);

          // Cleanup services
          if (session) {
            session.agentService?.cleanup();
            session.idleTimer?.cleanup();
          }

          // Remove from state manager
          stateManager.deleteState(currentSessionId);
        }
      }, 5 * 60 * 1000); // 5 minute grace period
    });

    // WebSocket Error Handler

    ws.on('error', (error) => {
      console.error(` [${currentSessionId}] WebSocket error:`, error);

      // Save state on error
      if (agentService && currentSessionId) {
        const state = agentService.getState();
        stateManager.saveState(currentSessionId, state);
        console.log(` [${currentSessionId}] State saved due to error`);
      }
    });
  });

  // Server-level stats logging
  setInterval(() => {
    const sessionCount = activeSessions.size;
    const stateCount = stateManager.getSessionCount();
    console.log(` Active sessions: ${sessionCount}, Saved states: ${stateCount}`);
  }, 60000); // Log every minute
}

/**
 * Get active session count (for monitoring)
 * @returns {number}
 */
export function getActiveSessionCount() {
  return activeSessions.size;
}

/**
 * Get all active session IDs (for monitoring)
 * @returns {string[]}
 */
export function getActiveSessionIds() {
  return Array.from(activeSessions.keys());
}

export default { initializeWebSocketHandlers, getActiveSessionCount, getActiveSessionIds };
