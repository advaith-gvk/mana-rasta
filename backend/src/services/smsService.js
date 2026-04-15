const logger = require('../utils/logger');

let twilioClient;

function getTwilio() {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendOTP(phone, otp) {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }

  await getTwilio().messages.create({
    body: `Your Mana Rasta OTP is: ${otp}. Valid for 5 minutes. Do not share.`,
    from: process.env.TWILIO_FROM_NUMBER,
    to:   phone,
  });
}

module.exports = { sendOTP };
