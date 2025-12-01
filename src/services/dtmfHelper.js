/**
 * DTMF Helper
 * State machine for handling DTMF (Dual-Tone Multi-Frequency) keypad input
 * Supports phone number collection
 */

export class DTMFHelper {
  /**
   * DTMF input types/states
   * @readonly
   * @enum {string}
   */
  static States = {
    PHONE_NUMBER: 'phoneNumber'
  };

  constructor() {
    /** @type {string} */
    this.state = DTMFHelper.States.PHONE_NUMBER;

    /** @type {string} */
    this.inputBuffer = '';

    /** @type {boolean} */
    this.isCollectionComplete = false;

    /** @type {number} */
    this.expectedLength = 0;
  }

  /**
   * Process a DTMF digit
   * @param {string} digit - The digit pressed (0-9, *, #)
   * @returns {string} Processing result message
   */
  processDTMF(digit) {
    // Reset completion flag
    this.isCollectionComplete = false;

    // Add digit to buffer
    this.inputBuffer += digit;

    console.log(` [DTMF] State: ${this.state}, Digit: ${digit}, Buffer: ${this.inputBuffer}`);

    // Process based on current state
    switch (this.state) {
      case DTMFHelper.States.PHONE_NUMBER:
        return this._processPhoneNumber(digit);

      default:
        this.inputBuffer = '';
        this.isCollectionComplete = true;
        return `Unknown DTMF state: ${this.state}`;
    }
  }

  /**
   * Process phone number input (expects 10 digits)
   * @private
   * @param {string} digit
   * @returns {string}
   */
  _processPhoneNumber(digit) {
    // Expected length is 10 digits
    const expectedLength = this.expectedLength || 10;

    if (this.inputBuffer.length < expectedLength) {
      this.isCollectionComplete = false;
      return `Collecting phone number... (${this.inputBuffer.length}/${expectedLength} digits)`;
    }

    if (this.inputBuffer.length === expectedLength) {
      const phoneNumber = this.inputBuffer;
      this.inputBuffer = '';
      this.isCollectionComplete = true;

      // Format as (XXX) XXX-XXXX
      const formatted = `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
      return `Phone number received: ${formatted}`;
    }

    // Too many digits
    this.inputBuffer = '';
    this.isCollectionComplete = true;
    return `Phone number input error. Too many digits entered.`;
  }


  /**
   * Set the current DTMF state
   * @param {string} newState - New state from DTMFHelper.States
   * @param {Object} [options] - Optional configuration
   * @param {number} [options.expectedLength] - Expected input length for collection states
   */
  setState(newState, options = {}) {
    console.log(` [DTMF] Changing state: ${this.state} → ${newState}`);

    this.state = newState;
    this.inputBuffer = '';
    this.isCollectionComplete = false;
    this.expectedLength = options.expectedLength || 0;

    // Log what we're expecting
    switch (newState) {
      case DTMFHelper.States.PHONE_NUMBER:
        console.log(` [DTMF] Now collecting phone number (${this.expectedLength || 10} digits expected)`);
        break;
    }
  }

  /**
   * Reset to initial state
   */
  resetState() {
    console.log(` [DTMF] Resetting to initial state (phoneNumber)`);
    this.state = DTMFHelper.States.PHONE_NUMBER;
    this.inputBuffer = '';
    this.isCollectionComplete = false;
    this.expectedLength = 0;
  }

  /**
   * Check if current collection is complete
   * @returns {boolean}
   */
  isComplete() {
    return this.isCollectionComplete;
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Get current input buffer
   * @returns {string}
   */
  getBuffer() {
    return this.inputBuffer;
  }

  /**
   * Clear the input buffer
   */
  clearBuffer() {
    console.log(`  [DTMF] Clearing input buffer`);
    this.inputBuffer = '';
    this.isCollectionComplete = false;
  }

  /**
   * Get progress information
   * @returns {Object}
   */
  getProgress() {
    return {
      state: this.state,
      buffer: this.inputBuffer,
      bufferLength: this.inputBuffer.length,
      expectedLength: this.expectedLength,
      isComplete: this.isCollectionComplete
    };
  }
}

export default DTMFHelper;
