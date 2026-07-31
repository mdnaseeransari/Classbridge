const https = require('https');

/**
 * Send push notifications via Expo Push API (https://exp.host/--/api/v2/push/send)
 *
 * @param {Array<Object>} notifications Array of notification objects:
 *   { to: string, title: string, body: string, data?: object }
 */
async function sendExpoPushNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }

  // Filter out items without valid Expo Push tokens
  const validNotifications = notifications.filter((item) => {
    return (
      item &&
      typeof item.to === 'string' &&
      (item.to.startsWith('ExponentPushToken[') || item.to.startsWith('ExpoPushToken['))
    );
  });

  if (validNotifications.length === 0) {
    return;
  }

  const postData = JSON.stringify(validNotifications);

  const options = {
    hostname: 'exp.host',
    path: '/--/api/v2/push/send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve(parsed);
        } catch (e) {
          console.error('[PUSH] Failed to parse Expo response:', responseBody);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[PUSH] Error sending push notification:', err.message);
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendExpoPushNotifications,
};
