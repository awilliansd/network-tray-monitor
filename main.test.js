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

// Mock específico para networkMonitor
jest.mock('./networkMonitor', () => ({
  getStatusList: jest.fn().mockResolvedValue([]),
  detectStatusChanges: jest.fn().mockReturnValue([]), // Garante que retorna array vazio
  createMenuTemplate: jest.fn().mockReturnValue([]),
}));

// Mock específico para config
jest.mock('./config', () => ({
  IP_LIST: ['192.168.1.1'],
  PING_TIMEOUT: 1000,
  UPDATE_INTERVAL: 5000,
}));

const { app } = require('electron');

describe('main.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve inicializar corretamente', () => {
    const main = require('./main');
    
    // Testa se as funções principais existem
    expect(typeof main.startApp).toBe('function');
    expect(typeof main.sendNotification).toBe('function');
    expect(typeof main.getIconPath).toBe('function');
  });

  test('sendNotification deve ser uma função', () => {
    const main = require('./main');
    expect(typeof main.sendNotification).toBe('function');
  });

  test('getIconPath deve retornar uma string', () => {
    const main = require('./main');
    const result = main.getIconPath();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('deve chamar startApp sem erros', async () => {
    const main = require('./main');
    
    // Mock da função whenReady para resolver imediatamente
    app.whenReady.mockImplementation(() => Promise.resolve());
    
    // Chama startApp e verifica se não lança erro
    expect(() => main.startApp()).not.toThrow();
    
    // Aguarda um tick para promises pendentes
    await new Promise(process.nextTick);
  });
});