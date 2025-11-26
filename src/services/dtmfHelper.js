/**
 * DTMF Helper
 * State machine for handling DTMF (Dual-Tone Multi-Frequency) keypad input
 * Supports different input types: language switching, phone numbers, date of birth, etc.
 */

export class DTMFHelper {
  /**
   * DTMF input types/states
   * @readonly
   * @enum {string}
   */
  static States = {
    LANGUAGE_SWITCH: 'languageSwitch',
    PHONE_NUMBER: 'phoneNumber',
    DATE_OF_BIRTH: 'dateOfBirth',
    CONFIRMATION: 'confirmation',
    MENU_SELECTION: 'menuSelection'
  };

  /**
   * DTMF digit mappings for language switching
   * @readonly
   */
  static LanguageMappings = {
    '1': 'spanish',
    '2': 'english'
  };

  constructor() {
    /** @type {string} */
    this.state = DTMFHelper.States.LANGUAGE_SWITCH;

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
      case DTMFHelper.States.LANGUAGE_SWITCH:
        return this._processLanguageSwitch(digit);

      case DTMFHelper.States.PHONE_NUMBER:
        return this._processPhoneNumber(digit);

      case DTMFHelper.States.DATE_OF_BIRTH:
        return this._processDateOfBirth(digit);

      case DTMFHelper.States.CONFIRMATION:
        return this._processConfirmation(digit);

      case DTMFHelper.States.MENU_SELECTION:
        return this._processMenuSelection(digit);

      default:
        this.inputBuffer = '';
        this.isCollectionComplete = true;
        return `Unknown DTMF state: ${this.state}`;
    }
  }

  /**
   * Process language switch input
   * @private
   * @param {string} digit
   * @returns {string}
   */
  _processLanguageSwitch(digit) {
    const language = DTMFHelper.LanguageMappings[digit];

    if (language) {
      this.inputBuffer = '';
      this.isCollectionComplete = true;
      return `The caller has requested to switch to ${language}.`;
    } else {
      this.inputBuffer = '';
      this.isCollectionComplete = true;
      return `Invalid language selection. Press 1 for Spanish or 2 for English.`;
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
   * Process date of birth input (expects 8 digits: MMDDYYYY)
   * @private
   * @param {string} digit
   * @returns {string}
   */
  _processDateOfBirth(digit) {
    const expectedLength = 8;

    if (this.inputBuffer.length < expectedLength) {
      this.isCollectionComplete = false;
      return `Collecting date of birth... (${this.inputBuffer.length}/${expectedLength} digits)`;
    }

    if (this.inputBuffer.length === expectedLength) {
      const dob = this.inputBuffer;
      this.inputBuffer = '';
      this.isCollectionComplete = true;

      // Format as MM/DD/YYYY
      const formatted = `${dob.slice(0, 2)}/${dob.slice(2, 4)}/${dob.slice(4)}`;
      return `Date of birth received: ${formatted}`;
    }

    // Too many digits
    this.inputBuffer = '';
    this.isCollectionComplete = true;
    return `Date of birth input error. Too many digits entered.`;
  }

  /**
   * Process confirmation input (expects 1 digit: 1=yes, 2=no)
   * @private
   * @param {string} digit
   * @returns {string}
   */
  _processConfirmation(digit) {
    this.inputBuffer = '';
    this.isCollectionComplete = true;

    if (digit === '1') {
      return `The caller confirmed with 'yes'.`;
    } else if (digit === '2') {
      return `The caller responded with 'no'.`;
    } else {
      return `Invalid confirmation. Press 1 for yes or 2 for no.`;
    }
  }

  /**
   * Process menu selection (expects 1 digit)
   * @private
   * @param {string} digit
   * @returns {string}
   */
  _processMenuSelection(digit) {
    this.inputBuffer = '';
    this.isCollectionComplete = true;
    return `Menu option ${digit} selected by the caller.`;
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
      case DTMFHelper.States.DATE_OF_BIRTH:
        console.log(` [DTMF] Now collecting date of birth (8 digits expected: MMDDYYYY)`);
        break;
      case DTMFHelper.States.LANGUAGE_SWITCH:
        console.log(` [DTMF] Ready for language selection (1=Spanish, 2=English)`);
        break;
      case DTMFHelper.States.CONFIRMATION:
        console.log(` [DTMF] Waiting for confirmation (1=Yes, 2=No)`);
        break;
      case DTMFHelper.States.MENU_SELECTION:
        console.log(` [DTMF] Waiting for menu selection`);
        break;
    }
  }

  /**
   * Reset to initial state
   */
  resetState() {
    console.log(` [DTMF] Resetting to initial state (languageSwitch)`);
    this.state = DTMFHelper.States.LANGUAGE_SWITCH;
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
