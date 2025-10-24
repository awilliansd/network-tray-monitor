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
  Notification: jest.fn(() => ({ show: jest.fn() })),
}));

jest.mock('./networkMonitor', () => ({
  getStatusList: jest.fn().mockResolvedValue([]),
  detectStatusChanges: jest.fn().mockReturnValue([]),
  createMenuTemplate: jest.fn().mockReturnValue([]),
}));

jest.mock('./config', () => ({
  IP_LIST: ['192.168.1.1'],
  PING_TIMEOUT: 1000,
  UPDATE_INTERVAL: 5000,
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

const { app } = require('electron');

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
    // Limpa todos os timers
    jest.clearAllTimers();
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
    
    // Avança timers para evitar execução assíncrona pós-teste
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });
});