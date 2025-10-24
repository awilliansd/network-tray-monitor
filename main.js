// main.js
const { app, Menu, Tray, BrowserWindow, Notification } = require('electron');
const path = require('path');
const { getStatusList, detectStatusChanges, createMenuTemplate } = require('./networkMonitor');
const config = require('./config');

let tray = null;
let hostsStatus = {};

function getIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'app.ico')
    : path.join(__dirname, 'icons', 'app.ico');
}

function sendNotification(title, body, customTray = null) {
  const supported = Notification.isSupported();

  if (supported) {
    try {
      const n = new Notification({
        title,
        body,
        icon: getIconPath(),
      });
      n.show();
    } catch (e) {
      console.error('[sendNotification] erro ao criar notificação:', e);
    }
  } else {
    console.warn('Notificações não suportadas – tentando balloon (Windows).');
    const t = customTray || tray;
    if (t && process.platform === 'win32' && typeof t.displayBalloon === 'function') {
      try {
        t.displayBalloon({ title, content: body });
      } catch (e) {
        console.error('[sendNotification] erro no balloon:', e);
      }
    }
  }
}

function startApp() {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    sendNotification('Monitoramento de Rede', 'O aplicativo já está em execução.');
  });

  async function updateMenu() {
    const currentStatusList = await getStatusList(config.IP_LIST, config.PING_TIMEOUT);
    const changes = detectStatusChanges(hostsStatus, currentStatusList);

    changes.forEach(change => {
      if (change.changed) {
        const msg = change.type === 'online'
          ? `${change.ip} ficou ONLINE!`
          : `${change.ip} ficou OFFLINE!`;
        sendNotification('Status da Rede', msg);
      }
      hostsStatus[change.ip] = change.type === 'online';
    });

    const menu = Menu.buildFromTemplate(
      createMenuTemplate(currentStatusList, () => updateMenu(), () => app.quit())
    );
    tray.setContextMenu(menu);
  }

  app.whenReady().then(() => {
    const iconPath = getIconPath();
    new BrowserWindow({ show: false, icon: iconPath });

    tray = new Tray(iconPath);
    tray.setToolTip('Monitoramento de Rede');

    updateMenu();

    // Só inicia o intervalo em produção
    if (process.env.NODE_ENV !== 'test') {
      setInterval(updateMenu, config.UPDATE_INTERVAL);
    }
  });

  app.on('window-all-closed', e => e.preventDefault());
}

module.exports = { startApp, sendNotification, getIconPath };