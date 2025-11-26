/**
 * Type definitions for Twilio Conversation Relay messages and application state
 * Using JSDoc for type hints in JavaScript
 */

/**
 * Twilio Call Details from incoming webhook
 * @typedef {Object} CallDetails
 * @property {string} Called - Phone number being called
 * @property {string} CalledZip - ZIP code of called number
 * @property {string} CalledCity - City of called number
 * @property {string} CalledState - State of called number
 * @property {string} CalledCountry - Country of called number
 * @property {string} To - Destination phone number
 * @property {string} ToZip - ZIP code of destination
 * @property {string} ToCity - City of destination
 * @property {string} ToState - State of destination
 * @property {string} ToCountry - Country of destination
 * @property {string} From - Originating phone number
 * @property {string} FromZip - ZIP code of originator
 * @property {string} FromCity - City of originator
 * @property {string} FromState - State of originator
 * @property {string} FromCountry - Country of originator
 * @property {string} Caller - Caller's phone number
 * @property {string} CallerZip - ZIP code of caller
 * @property {string} CallerCity - City of caller
 * @property {string} CallerState - State of caller
 * @property {string} CallerCountry - Country of caller
 * @property {string} CallSid - Unique call identifier
 * @property {string} AccountSid - Twilio account identifier
 * @property {'inbound'|'outbound'|'both'} Direction - Call direction
 * @property {'ringing'|'in-progress'|'completed'|'failed'|'busy'|'no-answer'} CallStatus - Call status
 * @property {string} ApiVersion - Twilio API version
 * @property {Object} [AddOns] - Add-ons data
 * @property {string} [FlowSid] - Flow identifier
 */

/**
 * Setup message sent when WebSocket connection is established
 * @typedef {Object} SetupMessage
 * @property {'setup'} type - Message type
 * @property {string} sessionId - Session identifier
 * @property {string} callSid - Twilio call SID
 * @property {string} parentCallSid - Parent call SID
 * @property {string} from - Caller phone number
 * @property {string} to - Called phone number
 * @property {string} forwardedFrom - Forwarded from number
 * @property {string} callerName - Caller name
 * @property {string} direction - Call direction
 * @property {string} callType - Type of call
 * @property {string} callStatus - Current call status
 * @property {string} accountSid - Twilio account SID
 * @property {string} applicationSid - Application SID
 */

/**
 * Prompt message containing user's speech-to-text
 * @typedef {Object} PromptMessage
 * @property {'prompt'} type - Message type
 * @property {string} voicePrompt - User's spoken text
 */

/**
 * Interrupt message when user speaks over AI
 * @typedef {Object} InterruptMessage
 * @property {'interrupt'} type - Message type
 * @property {string} utteranceUntilInterrupt - Text spoken before interrupt
 * @property {string} durationUntilInterruptMs - Duration until interrupt in ms
 */

/**
 * Text message containing AI response (streaming or complete)
 * @typedef {Object} TextMessage
 * @property {'text'} type - Message type
 * @property {string} token - Text token/chunk
 * @property {boolean} last - Whether this is the last chunk
 */

/**
 * End message to terminate call or handoff to agent
 * @typedef {Object} EndMessage
 * @property {'end'} type - Message type
 * @property {string} [handoffData] - JSON string with handoff context
 */

/**
 * Error message
 * @typedef {Object} ErrorMessage
 * @property {'error'} type - Message type
 * @property {string} [message] - Error description
 */

/**
 * DTMF (keypad) input message
 * @typedef {Object} DtmfMessage
 * @property {'dtmf'} type - Message type
 * @property {string} digit - The digit pressed (0-9, *, #)
 */

/**
 * Language change message sent to Twilio
 * @typedef {Object} LanguageMessage
 * @property {'language'} type - Message type
 * @property {string} ttsLanguage - Language code for text-to-speech
 * @property {string} transcriptionLanguage - Language code for speech-to-text
 */

/**
 * Union type for all Conversation Relay messages
 * @typedef {SetupMessage | PromptMessage | InterruptMessage | EndMessage | ErrorMessage | TextMessage | DtmfMessage | LanguageMessage} ConversationRelayMessage
 */

/**
 * Session data stored in active sessions map
 * @typedef {Object} SessionData
 * @property {string} threadId - Azure AI thread ID
 * @property {import('../services/azureAgentService.js').AzureAgentService} agentService - Azure agent service instance
 * @property {import('../services/dtmfHelper.js').DTMFHelper} dtmfHelper - DTMF helper instance
 * @property {import('../services/idleTimer.js').IdleTimer} idleTimer - Idle timer instance
 */

/**
 * Agent service state for persistence
 * @typedef {Object} AgentServiceState
 * @property {string} sessionId - Session identifier
 * @property {string} threadId - Azure AI thread ID
 * @property {number} timestamp - State save timestamp
 */

/**
 * Tool call information from Azure agent
 * @typedef {Object} ToolCall
 * @property {string} id - Tool call ID
 * @property {string} name - Tool function name
 * @property {Object} arguments - Tool arguments
 * @property {string} [output] - Tool execution output
 */

/**
 * Handoff data for transferring to human agent
 * @typedef {Object} HandoffData
 * @property {string} reason - Reason for handoff
 * @property {string} context - Conversation context
 * @property {string} summary - Summary of conversation
 * @property {Object} [userInfo] - User information
 * @property {string} userInfo.firstName - User's first name
 * @property {string} userInfo.lastName - User's last name
 * @property {string} userInfo.phone - User's phone number
 */

// Export an empty object to make this a module
export {};
