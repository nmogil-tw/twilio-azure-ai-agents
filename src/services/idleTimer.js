import { EventEmitter } from 'events';
import { DTMFHelper } from './dtmfHelper.js';

/**
 * Idle Timer
 * Manages timeouts for DTMF input collection
 * Emits 'idleTimeout' event when timer expires
 *
 * Events:
 * - 'idleTimeout': Emitted when timer expires (data: { type: 'idleTimeout', message: string })
 */
export class IdleTimer extends EventEmitter {
  /**
   * @param {number} timeoutDuration - Timeout duration in milliseconds
   * @param {DTMFHelper} dtmfHelper - DTMF helper instance to reset on timeout
   */
  constructor(timeoutDuration, dtmfHelper) {
    super();

    /** @type {NodeJS.Timeout | null} */
    this.timer = null;

    /** @type {number} */
    this.timeoutDuration = timeoutDuration;

    /** @type {DTMFHelper} */
    this.dtmfHelper = dtmfHelper;

    /** @type {boolean} */
    this.isActive = false;
  }

  /**
   * Start or restart the timer
   */
  start() {
    // Clear any existing timer
    this.clear();

    this.isActive = true;

    console.log(` [IdleTimer] Starting timer (${this.timeoutDuration}ms)`);

    this.timer = setTimeout(() => {
      console.log(` [IdleTimer] Timer expired after ${this.timeoutDuration}ms`);

      // Reset DTMF state on timeout
      if (this.dtmfHelper) {
        this.dtmfHelper.resetState();
      }

      // Emit timeout event
      this.emit('idleTimeout', {
        type: 'idleTimeout',
        message: 'Session timed out due to inactivity. DTMF input was not received in time.'
      });

      this.isActive = false;
    }, this.timeoutDuration);
  }

  /**
   * Clear the timer
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.isActive = false;
      console.log(` [IdleTimer] Timer cleared`);
    }
  }

  /**
   * Restart the timer (convenience method)
   */
  restart() {
    console.log(` [IdleTimer] Restarting timer`);
    this.start();
  }

  /**
   * Check if timer is currently active
   * @returns {boolean}
   */
  isRunning() {
    return this.isActive;
  }

  /**
   * Update the timeout duration
   * @param {number} newDuration - New timeout duration in milliseconds
   */
  setDuration(newDuration) {
    console.log(` [IdleTimer] Updating duration: ${this.timeoutDuration}ms → ${newDuration}ms`);
    this.timeoutDuration = newDuration;

    // If timer is active, restart with new duration
    if (this.isActive) {
      this.start();
    }
  }

  /**
   * Get current timeout duration
   * @returns {number}
   */
  getDuration() {
    return this.timeoutDuration;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clear();
    this.removeAllListeners();
    console.log(` [IdleTimer] Cleaned up`);
  }
}

export default IdleTimer;
