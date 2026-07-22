const { autoUpdater } = require('electron-updater');

class UpdaterManager {
  constructor(options) {
    this.canUseAutoUpdater = options.canUseAutoUpdater;
    this.notify = options.notify;
    this.onStateChange = options.onStateChange;

    this.isCheckingForUpdates = false;
    this.isInstallingUpdate = false;
    this.isUpdateDownloaded = false;
    this._initialized = false;
  }

  get canInstall() {
    return this.isUpdateDownloaded && !this.isInstallingUpdate;
  }

  installDownloadedUpdate() {
    if (!this.isUpdateDownloaded || this.isInstallingUpdate) return;
    this.isInstallingUpdate = true;
    this.onStateChange('Instalando atualização...');

    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (error) {
        console.error('[autoUpdater] erro ao instalar atualização:', error);
        this.isInstallingUpdate = false;
        this.onStateChange('Erro ao instalar atualização');
      }
    }, 250);
  }

  async checkForUpdates(manual = false) {
    if (!this.canUseAutoUpdater()) {
      this.onStateChange('Atualização automática indisponível neste modo');
      if (manual) {
        this.notify('Atualizações', 'Auto-update disponível apenas no app instalado (Linux requer AppImage).');
      }
      return;
    }

    if (this.isCheckingForUpdates) {
      if (manual) {
        this.notify('Atualizações', 'Já existe uma verificação em andamento.');
      }
      return;
    }

    try {
      this.isCheckingForUpdates = true;
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[autoUpdater] erro ao verificar atualização:', error);
      this.isCheckingForUpdates = false;
      this.onStateChange('Erro ao verificar atualização');
      if (manual) {
        this.notify('Atualizações', 'Não foi possível verificar atualizações.');
      }
    }
  }

  initialize() {
    if (this._initialized) return;
    this._initialized = true;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.isCheckingForUpdates = true;
      this.onStateChange('Verificando atualizações...');
    });

    autoUpdater.on('update-available', (info) => {
      this.onStateChange(`Nova versão ${info.version} encontrada. Baixando...`);
      this.notify('Atualização disponível', `Versão ${info.version} encontrada. Download iniciado.`);
    });

    autoUpdater.on('update-not-available', () => {
      this.isCheckingForUpdates = false;
      this.isUpdateDownloaded = false;
      this.onStateChange('Aplicativo atualizado');
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      this.onStateChange(`Baixando atualização... ${percent}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.isCheckingForUpdates = false;
      this.isUpdateDownloaded = true;
      this.onStateChange(`Atualização pronta (${info.version}) — instalando em 10s...`);
      this.notify('Atualização pronta', `Versão ${info.version} baixada. O app será reiniciado em 10 segundos para instalar.`, () => this.installDownloadedUpdate());
      setTimeout(() => this.installDownloadedUpdate(), 10000);
    });

    autoUpdater.on('error', (error) => {
      console.error('[autoUpdater] erro:', error);
      this.isCheckingForUpdates = false;
      this.onStateChange('Erro no auto-update');
    });
  }
}

module.exports = { UpdaterManager };
