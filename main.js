// main.js
const { app, Menu, Tray, BrowserWindow, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { getStatusList, detectStatusChanges, createMenuTemplate } = require('./networkMonitor');
const config = require('./config');

let tray = null;
let hostsStatus = {};
let isMenuUpdating = false;
let hasPendingMenuUpdate = false;
let refreshMenuFn = null;
let updaterInitialized = false;
let isCheckingForUpdates = false;
let isInstallingUpdate = false;
let isUpdateDownloaded = false;
let updateState = {
  label: 'Aguardando verificação',
  lastError: null
};

const INITIAL_UPDATE_CHECK_DELAY_MS = 15000;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

function getIconPath() {
  if (process.platform === 'linux') {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'app-2.png')
      : path.join(__dirname, 'icons', 'app-2.png');
  } else {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'icons', 'app.ico')
      : path.join(__dirname, 'icons', 'app.ico');
  }
}

function sendNotification(title, body, customTray = null, onClick = null) {
  const supported = Notification.isSupported();

  if (supported) {
    try {
      const n = new Notification({
        title,
        body,
        icon: getIconPath(),
      });
      if (typeof onClick === 'function') {
        n.on('click', onClick);
      }
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

function setUpdateStatus(label, lastError = null) {
  updateState = {
    label,
    lastError
  };
}

function refreshMenuIfPossible() {
  if (typeof refreshMenuFn === 'function') {
    refreshMenuFn();
  }
}

function canUseAutoUpdater() {
  if (!app.isPackaged) return false;
  if (process.platform !== 'linux') return true;
  return Boolean(process.env.APPIMAGE);
}

function installDownloadedUpdate() {
  if (!isUpdateDownloaded || isInstallingUpdate) return;
  isInstallingUpdate = true;
  setUpdateStatus('Instalando atualização...');
  refreshMenuIfPossible();

  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      console.error('[autoUpdater] erro ao instalar atualização:', error);
      isInstallingUpdate = false;
      setUpdateStatus('Erro ao instalar atualização', error);
      refreshMenuIfPossible();
    }
  }, 250);
}

async function checkForUpdates(manual = false) {
  if (!canUseAutoUpdater()) {
    setUpdateStatus('Atualização automática indisponível neste modo');
    refreshMenuIfPossible();
    if (manual) {
      sendNotification(
        'Atualizações',
        'Auto-update disponível apenas no app instalado (Linux requer AppImage).'
      );
    }
    return;
  }

  if (isCheckingForUpdates) {
    if (manual) {
      sendNotification('Atualizações', 'Já existe uma verificação em andamento.');
    }
    return;
  }

  try {
    isCheckingForUpdates = true;
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('[autoUpdater] erro ao verificar atualização:', error);
    isCheckingForUpdates = false;
    setUpdateStatus('Erro ao verificar atualização', error);
    refreshMenuIfPossible();
    if (manual) {
      sendNotification('Atualizações', 'Não foi possível verificar atualizações.');
    }
  }
}

function initializeAutoUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    isCheckingForUpdates = true;
    setUpdateStatus('Verificando atualizações...');
    refreshMenuIfPossible();
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateStatus(`Nova versão ${info.version} encontrada. Baixando...`);
    refreshMenuIfPossible();
    sendNotification('Atualização disponível', `Versão ${info.version} encontrada. Download iniciado.`);
  });

  autoUpdater.on('update-not-available', () => {
    isCheckingForUpdates = false;
    isUpdateDownloaded = false;
    setUpdateStatus('Aplicativo atualizado');
    refreshMenuIfPossible();
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent || 0);
    setUpdateStatus(`Baixando atualização... ${percent}%`);
    refreshMenuIfPossible();
  });

  autoUpdater.on('update-downloaded', (info) => {
    isCheckingForUpdates = false;
    isUpdateDownloaded = true;
    setUpdateStatus(`Atualização pronta (${info.version}) — instalando em 10s...`);
    refreshMenuIfPossible();
    sendNotification(
      'Atualização pronta',
      `Versão ${info.version} baixada. O app será reiniciado em 10 segundos para instalar.`,
      null,
      installDownloadedUpdate
    );
    // Auto-instala após 10 segundos
    setTimeout(() => installDownloadedUpdate(), 10000);
  });

  autoUpdater.on('error', (error) => {
    console.error('[autoUpdater] erro:', error);
    isCheckingForUpdates = false;
    setUpdateStatus('Erro no auto-update', error);
    refreshMenuIfPossible();
  });
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
    if (!tray) return;

    if (isMenuUpdating) {
      hasPendingMenuUpdate = true;
      return;
    }

    isMenuUpdating = true;

    try {
      // Modifica a lista de IPs para Linux (adiciona .local para mDNS)
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
          sendNotification(title, msg);
        }
        hostsStatus[change.ip] = change.type === 'online';
      });

      // Modifique esta linha para usar await
      const menu = Menu.buildFromTemplate(
        await createMenuTemplate(
          currentStatusList,
          () => updateMenu(),
          () => app.quit(),
          {
            updateStatusLabel: updateState.label,
            onCheckForUpdates: () => checkForUpdates(true),
            onInstallUpdate: () => installDownloadedUpdate(),
            canInstallUpdate: isUpdateDownloaded
          }
        )
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
    } finally {
      isMenuUpdating = false;
      if (hasPendingMenuUpdate) {
        hasPendingMenuUpdate = false;
        updateMenu();
      }
    }
  }

  refreshMenuFn = () => updateMenu();

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

    initializeAutoUpdater();

    if (!canUseAutoUpdater()) {
      setUpdateStatus('Auto-update indisponível neste ambiente');
    } else {
      setUpdateStatus('Aguardando verificação');
    }

    // Primeira atualização após breve delay
    setTimeout(updateMenu, 1000);

    // Intervalo de atualização
    setInterval(updateMenu, config.UPDATE_INTERVAL);

    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => checkForUpdates(false), INITIAL_UPDATE_CHECK_DELAY_MS);
      setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
    }
  });

  app.on('window-all-closed', e => e.preventDefault());
}

// INICIALIZAÇÃO AUTOMÁTICA - CHAMA startApp()
startApp();

module.exports = { startApp, sendNotification, getIconPath };
