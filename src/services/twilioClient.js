import twilio from 'twilio';
import { config } from '../config.js';

/**
 * Twilio REST API client singleton
 * Used for initiating outbound calls and other Twilio API operations
 */
export const twilioClient = twilio(
  config.twilio.accountSid,
  config.twilio.authToken
);

/**
 * Validates E.164 phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid E.164 format
 */
export function isValidE164(phoneNumber) {
  if (!phoneNumber) return false;
  // E.164 format: +[country code][number] (e.g., +14155551212)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

export default { twilioClient, isValidE164 };
