const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

async function initFirebase() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
    return;
  }
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase Admin SDK initialized');
  } catch (err) {
    logger.error('Firebase init failed', err);
  }
}

async function sendPushNotification({ token, title, body, data = {} }) {
  if (!firebaseApp) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    });
  } catch (err) {
    logger.warn(`Push notification failed for token ${token?.substring(0, 20)}...`, err.message);
  }
}

async function sendMulticastPush({ tokens, title, body, data = {} }) {
  if (!firebaseApp || !tokens?.length) return;
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));
  for (const chunk of chunks) {
    await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  }
}

module.exports = { initFirebase, sendPushNotification, sendMulticastPush };
