// main-debug.js
const { app, Menu, Tray, BrowserWindow, Notification } = require('electron');
const path = require('path');
const { getStatusList, detectStatusChanges, createMenuTemplate } = require('./networkMonitor');
const config = require('./config');

let tray = null;
let hostsStatus = {};

console.log('=== INICIANDO APLICAÇÃO ===');

function getIconPath() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'app.ico')
    : path.join(__dirname, 'icons', 'app.ico');
  console.log('Ícone path:', iconPath);
  return iconPath;
}

function startApp() {
  console.log('=== startApp() chamada ===');
  
  const gotTheLock = app.requestSingleInstanceLock();
  console.log('Single instance lock:', gotTheLock);

  if (!gotTheLock) {
    console.log('Já existe instância, saindo...');
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    console.log('Segunda instância detectada');
  });

  async function updateMenu() {
    console.log('=== updateMenu() chamada ===');
    
    try {
      console.log('Obtendo status dos hosts...');
      const currentStatusList = await getStatusList(config.IP_LIST, config.PING_TIMEOUT);
      console.log('Status obtido:', currentStatusList);
      
      console.log('Detectando mudanças...');
      const changes = detectStatusChanges(hostsStatus, currentStatusList);
      console.log('Mudanças:', changes);

      // Atualiza menu mesmo se não houver mudanças
      console.log('Criando menu...');
      const menu = Menu.buildFromTemplate(
        createMenuTemplate(currentStatusList, () => updateMenu(), () => app.quit())
      );
      
      console.log('Configurando menu no tray...');
      tray.setContextMenu(menu);
      console.log('=== updateMenu() concluído ===');
      
    } catch (error) {
      console.error('ERRO em updateMenu:', error);
      
      // Menu de fallback em caso de erro
      const fallbackMenu = Menu.buildFromTemplate([
        { label: '❌ Erro ao carregar', enabled: false },
        { label: 'Tentar novamente', click: () => updateMenu() },
        { label: 'Sair', click: () => app.quit() }
      ]);
      tray.setContextMenu(fallbackMenu);
    }
  }

  app.whenReady().then(() => {
    console.log('=== App ready ===');
    
    try {
      const iconPath = getIconPath();
      
      console.log('Criando janela oculta...');
      new BrowserWindow({ 
        show: false, 
        icon: iconPath 
      });
      
      console.log('Criando tray...');
      tray = new Tray(iconPath);
      tray.setToolTip('Monitoramento de Rede');
      console.log('Tray criado com sucesso!');

      // Menu temporário enquanto carrega
      console.log('Criando menu temporário...');
      const loadingMenu = Menu.buildFromTemplate([
        { label: '⏳ Carregando...', enabled: false },
        { label: 'Sair', click: () => app.quit() }
      ]);
      tray.setContextMenu(loadingMenu);
      
      // Aguarda um pouco antes da primeira atualização
      setTimeout(() => {
        console.log('Iniciando primeira atualização...');
        updateMenu();
      }, 1000);
      
      // Configura intervalo
      console.log('Configurando intervalo de atualização...');
      setInterval(updateMenu, config.UPDATE_INTERVAL);
      
    } catch (error) {
      console.error('ERRO na inicialização:', error);
    }
  });

  app.on('window-all-closed', e => {
    console.log('window-all-closed event');
    e.preventDefault();
  });
}

// Inicialização
startApp();