const { Notification } = require('electron');

function sendNotification(title, body, options = {}) {
  const { iconPath, tray, onClick } = options;

  if (Notification.isSupported()) {
    try {
      const n = new Notification({ title, body, icon: iconPath });
      if (typeof onClick === 'function') {
        n.on('click', onClick);
      }
      n.show();
    } catch (e) {
      console.error('[sendNotification] erro ao criar notificação:', e);
    }
  } else if (tray && process.platform === 'win32' && typeof tray.displayBalloon === 'function') {
    try {
      tray.displayBalloon({ title, content: body });
    } catch (e) {
      console.error('[sendNotification] erro no balloon:', e);
    }
  }
}

module.exports = { sendNotification };
