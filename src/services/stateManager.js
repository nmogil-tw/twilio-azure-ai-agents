/**
 * State Manager
 * Manages session state persistence for reconnection handling
 * Singleton pattern ensures single instance across the application
 */

/**
 * @typedef {import('../types/index.js').AgentServiceState} AgentServiceState
 */

export class StateManager {
  /** @type {StateManager} */
  static instance = null;

  /** @type {Map<string, AgentServiceState>} */
  sessionStates = new Map();

  /** @type {number} - 30 minutes in milliseconds */
  static STATE_TIMEOUT = 30 * 60 * 1000;

  /**
   * Get singleton instance
   * @returns {StateManager}
   */
  static getInstance() {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Save session state
   * @param {string} sessionId - Session identifier (callSid)
   * @param {AgentServiceState} state - State to save
   */
  saveState(sessionId, state) {
    console.log(` [StateManager] Saving state for session ${sessionId}`);

    this.sessionStates.set(sessionId, {
      ...state,
      timestamp: Date.now()
    });

    // Trigger cleanup of old states
    this.cleanupOldStates();
  }

  /**
   * Restore session state
   * @param {string} sessionId - Session identifier
   * @returns {AgentServiceState | null} Restored state or null if not found/expired
   */
  restoreState(sessionId) {
    const state = this.sessionStates.get(sessionId);

    if (!state) {
      console.log(` [StateManager] No saved state found for session ${sessionId}`);
      return null;
    }

    // Check if state is too old
    const age = Date.now() - state.timestamp;
    if (age > StateManager.STATE_TIMEOUT) {
      console.log(` [StateManager] State for session ${sessionId} has expired (age: ${Math.round(age / 1000 / 60)} minutes)`);
      this.sessionStates.delete(sessionId);
      return null;
    }

    console.log(` [StateManager] Restoring state for session ${sessionId} (age: ${Math.round(age / 1000)} seconds)`);
    return state;
  }

  /**
   * Delete session state
   * @param {string} sessionId - Session identifier
   */
  deleteState(sessionId) {
    if (this.sessionStates.has(sessionId)) {
      console.log(`  [StateManager] Deleting state for session ${sessionId}`);
      this.sessionStates.delete(sessionId);
    }
  }

  /**
   * Check if state exists for session
   * @param {string} sessionId - Session identifier
   * @returns {boolean}
   */
  hasState(sessionId) {
    return this.sessionStates.has(sessionId);
  }

  /**
   * Get all active session IDs
   * @returns {string[]}
   */
  getActiveSessions() {
    return Array.from(this.sessionStates.keys());
  }

  /**
   * Get count of active sessions
   * @returns {number}
   */
  getSessionCount() {
    return this.sessionStates.size;
  }

  /**
   * Clean up expired states
   * @private
   */
  cleanupOldStates() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, state] of this.sessionStates.entries()) {
      const age = now - state.timestamp;
      if (age > StateManager.STATE_TIMEOUT) {
        this.sessionStates.delete(sessionId);
        cleanedCount++;
        console.log(` [StateManager] Cleaned up expired state for session ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(` [StateManager] Cleaned up ${cleanedCount} expired session(s)`);
    }
  }

  /**
   * Clear all states (for testing/debugging)
   */
  clearAll() {
    const count = this.sessionStates.size;
    this.sessionStates.clear();
    console.log(`  [StateManager] Cleared all ${count} session state(s)`);
  }

  /**
   * Get statistics about stored states
   * @returns {Object} Statistics object
   */
  getStats() {
    const now = Date.now();
    const states = Array.from(this.sessionStates.values());

    const stats = {
      totalSessions: states.length,
      averageAge: 0,
      oldestAge: 0,
      newestAge: 0
    };

    if (states.length === 0) {
      return stats;
    }

    const ages = states.map(s => now - s.timestamp);
    stats.averageAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length / 1000);
    stats.oldestAge = Math.round(Math.max(...ages) / 1000);
    stats.newestAge = Math.round(Math.min(...ages) / 1000);

    return stats;
  }
}

export default StateManager;
