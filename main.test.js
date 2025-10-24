// main.test.js

// MOCK DO ELECTRON PRIMEIRO
jest.mock('electron', () => {
  const mockNotification = jest.fn(() => ({
    show: jest.fn(),
  }));
  mockNotification.isSupported = jest.fn();

  return {
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
    Notification: mockNotification,
  };
});

// MOCK DOS OUTROS MÓDULOS
jest.mock('path', () => ({ 
  join: jest.fn((...args) => args.join('/'))
}));

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

// Mock do módulo main para garantir que getIconPath retorne o valor mockado
jest.mock('./main', () => {
  const actualModule = jest.requireActual('./main');
  
  return {
    ...actualModule,
    getIconPath: jest.fn(() => '/mock/app.ico'),
  };
});

// AGORA IMPORTAMOS OS MÓDULOS
const { app, Tray, Menu, Notification } = require('electron');
const main = require('./main');
const path = require('path');

describe('main.js – instância única', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve sair se não conseguir o lock', () => {
    app.requestSingleInstanceLock.mockReturnValue(false);
    main.startApp();
    expect(app.quit).toHaveBeenCalled();
  });

  test('deve continuar se conseguir o lock', () => {
    app.requestSingleInstanceLock.mockReturnValue(true);
    main.startApp();
    expect(app.quit).not.toHaveBeenCalled();
  });
});

describe('sendNotification', () => {
  let originalPlatform;

  beforeEach(() => {
    jest.clearAllMocks();
    Notification.isSupported.mockReset();
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  test('deve criar Notification quando suportado', () => {
    Notification.isSupported.mockReturnValue(true);

    main.sendNotification('Título', 'Corpo');

    expect(Notification).toHaveBeenCalledWith({
      title: 'Título',
      body: 'Corpo',
      icon: '/mock/app.ico',
    });

    const instance = Notification.mock.instances[0];
    expect(instance.show).toHaveBeenCalled();
  });

  test('deve usar balloon no Windows quando não suportado', () => {
    Notification.isSupported.mockReturnValue(false);
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const mockTray = { displayBalloon: jest.fn() };
    main.sendNotification('Título', 'Corpo', mockTray);

    expect(mockTray.displayBalloon).toHaveBeenCalledWith({
      title: 'Título',
      content: 'Corpo',
    });
  });

  test('não deve usar balloon em plataformas não-Windows', () => {
    Notification.isSupported.mockReturnValue(false);
    Object.defineProperty(process, 'platform', { value: 'linux' });

    const mockTray = { displayBalloon: jest.fn() };
    main.sendNotification('Título', 'Corpo', mockTray);

    expect(mockTray.displayBalloon).not.toHaveBeenCalled();
  });
});

// TESTES do getIconPath
describe('getIconPath', () => {
  test('deve retornar caminho mockado', () => {
    expect(main.getIconPath()).toBe('/mock/app.ico');
  });

  test('deve chamar path.join com parâmetros corretos quando não empacotado', () => {
    // Restaura a função original temporariamente
    main.getIconPath.mockRestore();
    app.isPackaged = false;
    path.join.mockClear();
    path.join.mockImplementation((...args) => args.join('/'));

    const result = main.getIconPath();
    
    expect(path.join).toHaveBeenCalledWith(__dirname, 'icons', 'app.ico');
  });

  test('deve chamar path.join com parâmetros corretos quando empacotado', () => {
    // Restaura a função original temporariamente
    main.getIconPath.mockRestore();
    app.isPackaged = true;
    path.join.mockClear();
    path.join.mockImplementation((...args) => args.join('/'));

    const result = main.getIconPath();
    
    expect(path.join).toHaveBeenCalledWith(process.resourcesPath, 'icons', 'app.ico');
    
    // Re-aplica o mock para os próximos testes
    jest.spyOn(main, 'getIconPath').mockReturnValue('/mock/app.ico');
  });
});