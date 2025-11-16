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
    try {
      const currentStatusList = await getStatusList(
        config.IP_LIST, 
        config.PING_TIMEOUT,
        config.INTERNET_CHECK
      );
      
      const changes = detectStatusChanges(hostsStatus, currentStatusList);

      changes.forEach(change => {
        if (change.changed) {
          const displayName = change.displayLabel || change.ip;
          const msg = change.type === 'online'
            ? `${displayName} ficou ${change.isInternet ? 'CONECTADO' : 'ONLINE'}!`
            : `${displayName} ficou ${change.isInternet ? 'DESCONECTADO' : 'OFFLINE'}!`;
          
          const title = change.isInternet ? 'Status da Internet' : 'Status da Rede';
          sendNotification(title, msg);
        }
        hostsStatus[change.ip] = change.type === 'online';
      });

      const menu = Menu.buildFromTemplate(
        createMenuTemplate(currentStatusList, () => updateMenu(), () => app.quit())
      );
      tray.setContextMenu(menu);
      
    } catch (error) {
      console.error('Erro ao atualizar menu:', error);
      const fallbackMenu = Menu.buildFromTemplate([
        { label: '❌ Erro ao carregar', enabled: false },
        { label: 'Tentar novamente', click: () => updateMenu() },
        { label: 'Sair', click: () => app.quit() }
      ]);
      if (tray) tray.setContextMenu(fallbackMenu);
    }
  }

  app.whenReady().then(() => {
    const iconPath = getIconPath();
    
    // Janela oculta
    new BrowserWindow({ 
      show: false, 
      icon: iconPath 
    });
    
    // Tray
    tray = new Tray(iconPath);
    tray.setToolTip('Monitoramento de Rede');

    // Menu de carregamento inicial
    const loadingMenu = Menu.buildFromTemplate([
      { label: '⏳ Carregando...', enabled: false },
      { label: 'Sair', click: () => app.quit() }
    ]);
    tray.setContextMenu(loadingMenu);
    
    // Primeira atualização após breve delay
    setTimeout(updateMenu, 1000);
    
    // Intervalo de atualização
    setInterval(updateMenu, config.UPDATE_INTERVAL);
  });

  app.on('window-all-closed', e => e.preventDefault());
}

// INICIALIZAÇÃO AUTOMÁTICA - CHAMA startApp()
startApp();

module.exports = { startApp, sendNotification, getIconPath };