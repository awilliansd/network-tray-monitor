// main.test.js
const { app, Tray, Menu } = require('electron');

// MOCK DO ELECTRON
jest.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    isPackaged: false,
  },
  Menu: { buildFromTemplate: jest.fn(() => ({})) },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    displayBalloon: jest.fn(),
  })),
  BrowserWindow: jest.fn(),
  Notification: jest.fn(() => ({
    show: jest.fn(),
  })),
}));

// IMPORTA main.js
const main = require('./main');
const { startApp, sendNotification } = main;
const electron = require('electron');

// CONFIGURA isSupported
electron.Notification.isSupported = jest.fn();

// MOCK DO getIconPath DIRETAMENTE NO OBJETO EXPORTADO
jest.spyOn(main, 'getIconPath').mockReturnValue('/mock/app.ico');

jest.mock('path', () => ({ join: (...p) => p.join('/') }));
jest.mock('./networkMonitor', () => ({
  getStatusList: jest.fn().mockResolvedValue([]),
  detectStatusChanges: jest.fn().mockReturnValue([]),
  createMenuTemplate: jest.fn().mockReturnValue([]),
}));
jest.mock('./config', () => ({
  IP_LIST: ['HOST1'],
  PING_TIMEOUT: 1,
  UPDATE_INTERVAL: 100,
}));

describe('main.js – instância única', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deve sair se não conseguir o lock', () => {
    app.requestSingleInstanceLock.mockReturnValue(false);
    startApp();
    expect(app.quit).toHaveBeenCalled();
  });

  test('deve continuar se conseguir o lock', () => {
    app.requestSingleInstanceLock.mockReturnValue(true);
    startApp();
    expect(app.quit).not.toHaveBeenCalled();
  });
});

describe('sendNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    electron.Notification.isSupported.mockReset();
    main.getIconPath.mockReturnValue('/mock/app.ico'); // reforça
  });

  test('deve criar Notification quando suportado', () => {
    electron.Notification.isSupported.mockReturnValue(true);

    sendNotification('Título', 'Corpo');

    expect(electron.Notification).toHaveBeenCalledWith({
      title: 'Título',
      body: 'Corpo',
      icon: '/mock/app.ico',
    });

    const instance = electron.Notification.mock.instances[0];
    expect(instance.show).toHaveBeenCalled();
  });

  test('deve usar balloon no Windows quando não suportado', () => {
    electron.Notification.isSupported.mockReturnValue(false);

    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', writable: true });

    const mockTray = { displayBalloon: jest.fn() };
    sendNotification('Título', 'Corpo', mockTray);

    expect(mockTray.displayBalloon).toHaveBeenCalledWith({
      title: 'Título',
      content: 'Corpo',
    });

    Object.defineProperty(process, 'platform', { value: original, writable: true });
  });
});

// TESTE EXTRA (opcional)
test('getIconPath deve retornar mock', () => {
  expect(main.getIconPath()).toBe('/mock/app.ico');
});