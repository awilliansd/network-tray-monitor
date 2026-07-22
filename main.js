const { app, Menu, Tray, BrowserWindow, Notification } = require('electron');
const { getStatusList, detectStatusChanges, createMenuTemplate } = require('./networkMonitor');
const config = require('./config');
const { getIconPath } = require('./modules/iconResolver');
const { sendNotification } = require('./modules/notifications');
const { UpdaterManager } = require('./modules/updater');

let tray = null;
let hostsStatus = {};
let isMenuUpdating = false;
let hasPendingMenuUpdate = false;
let updateState = { label: 'Aguardando verificação', lastError: null };
let updaterManager = null;

const INITIAL_UPDATE_CHECK_DELAY_MS = 15000;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

function getBaseIconPath() {
  return getIconPath(app, __dirname);
}

function showNotification(title, body, onClick) {
  sendNotification(title, body, { iconPath: getBaseIconPath(), tray, onClick });
}

function canUseAutoUpdater() {
  if (!app.isPackaged) return false;
  if (process.platform !== 'linux') return true;
  return Boolean(process.env.APPIMAGE);
}

function startApp() {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    showNotification('Monitoramento de Rede', 'O aplicativo já está em execução.');
  });

  const iconPath = getBaseIconPath();

  updaterManager = new UpdaterManager({
    canUseAutoUpdater,
    notify: showNotification,
    onStateChange: (label) => {
      updateState = { label, lastError: null };
      refreshMenu();
    },
  });

  async function refreshMenu() {
    if (!tray) return;

    if (isMenuUpdating) {
      hasPendingMenuUpdate = true;
      return;
    }

    isMenuUpdating = true;

    try {
      let ipList = [...config.IP_LIST];
      if (process.platform === 'linux') {
        ipList = ipList.map(ip => ip === 'Raspberrypi' ? 'raspberrypi.local' : ip);
      }

      const currentStatusList = await getStatusList(
        ipList,
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
          showNotification(title, msg);
        }
        hostsStatus[change.ip] = change.type === 'online';
      });

      const menu = Menu.buildFromTemplate(
        await createMenuTemplate(
          currentStatusList,
          () => refreshMenu(),
          () => app.quit(),
          {
            updateStatusLabel: updateState.label,
            onCheckForUpdates: () => updaterManager.checkForUpdates(true),
            onInstallUpdate: () => updaterManager.installDownloadedUpdate(),
            canInstallUpdate: updaterManager.canInstall
          }
        )
      );
      tray.setContextMenu(menu);

    } catch (error) {
      console.error('Erro ao atualizar menu:', error);
      const fallbackMenu = Menu.buildFromTemplate([
        { label: '❌ Erro ao carregar', enabled: false },
        { label: 'Tentar novamente', click: () => refreshMenu() },
        { label: 'Sair', click: () => app.quit() }
      ]);
      if (tray) tray.setContextMenu(fallbackMenu);
    } finally {
      isMenuUpdating = false;
      if (hasPendingMenuUpdate) {
        hasPendingMenuUpdate = false;
        refreshMenu();
      }
    }
  }

  app.whenReady().then(() => {
    new BrowserWindow({ show: false, icon: iconPath });

    tray = new Tray(iconPath);
    tray.setToolTip('Monitoramento de Rede');

    const loadingMenu = Menu.buildFromTemplate([
      { label: '⏳ Carregando...', enabled: false },
      { label: 'Sair', click: () => app.quit() }
    ]);
    tray.setContextMenu(loadingMenu);

    updaterManager.initialize();

    if (!canUseAutoUpdater()) {
      updateState = { label: 'Auto-update indisponível neste ambiente', lastError: null };
    }

    setTimeout(refreshMenu, 1000);
    setInterval(refreshMenu, config.UPDATE_INTERVAL);

    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => updaterManager.checkForUpdates(false), INITIAL_UPDATE_CHECK_DELAY_MS);
      setInterval(() => updaterManager.checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
    }
  });

  app.on('window-all-closed', e => e.preventDefault());
}

startApp();

module.exports = {
  startApp,
  sendNotification: (title, body) => showNotification(title, body),
  getIconPath: getBaseIconPath,
};
