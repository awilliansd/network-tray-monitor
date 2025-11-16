// main.test.js - VERSÃO CORRIGIDA
jest.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: jest.fn(() => true),
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    isPackaged: false,
  },
  Menu: { buildFromTemplate: jest.fn(() => ({})) },
  Tray: jest.fn(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
  })),
  BrowserWindow: jest.fn(),
  Notification: {
    isSupported: jest.fn(() => true),
  },
}));

jest.mock('./networkMonitor', () => ({
  getStatusList: jest.fn().mockResolvedValue([]),
  detectStatusChanges: jest.fn().mockReturnValue([]),
  createMenuTemplate: jest.fn().mockReturnValue([]),
}));

jest.mock('./config', () => ({
  IP_LIST: ['192.168.1.1'],
  PING_TIMEOUT: 1,
  UPDATE_INTERVAL: 5000,
  INTERNET_CHECK: {
    enabled: true,
    host: '8.8.8.8',
    label: '🌐 Internet (Google DNS)'
  }
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

const { app, Notification } = require('electron');

describe('main.js', () => {
  let main;
  let originalNodeEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    // Define NODE_ENV como test para evitar timers
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    
    // Recarrega o módulo para cada teste
    jest.isolateModules(() => {
      main = require('./main');
    });
  });

  afterEach(() => {
    // Restaura NODE_ENV original
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(() => {
    // Força saída após todos os testes
    jest.restoreAllMocks();
  });

  test('deve inicializar corretamente', () => {
    expect(typeof main.startApp).toBe('function');
    expect(typeof main.sendNotification).toBe('function');
    expect(typeof main.getIconPath).toBe('function');
  });

  test('sendNotification deve ser uma função', () => {
    expect(typeof main.sendNotification).toBe('function');
  });

  test('getIconPath deve retornar uma string', () => {
    const result = main.getIconPath();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('deve chamar startApp sem erros', async () => {
    // Mock específico para este teste
    app.whenReady.mockImplementation(() => Promise.resolve());
    
    expect(() => main.startApp()).not.toThrow();
    
    // Aguarda promises pendentes
    await Promise.resolve();
  });

  test('sendNotification deve chamar Notification quando suportado', () => {
    // Configura o mock para este teste específico
    const electron = require('electron');
    electron.Notification.isSupported.mockReturnValue(true);
    
    const mockShow = jest.fn();
    electron.Notification.mockImplementation(() => ({
      show: mockShow
    }));
    
    // Recarrega o módulo com os novos mocks
    jest.isolateModules(() => {
      const mainModule = require('./main');
      mainModule.sendNotification('Teste', 'Mensagem de teste');
      
      // Verifica se o Notification foi criado
      expect(electron.Notification).toHaveBeenCalled();
    });
  });
});