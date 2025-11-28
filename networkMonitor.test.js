const { getStatusList, detectStatusChanges, createMenuTemplate } = require('./networkMonitor');
const ping = require('ping');

jest.mock('ping');

describe('NetworkMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Limpar todos os mocks do https
    jest.resetModules();
  });

  test('getStatusList retorna status correto sem internet check', async () => {
    ping.promise.probe = jest.fn()
      .mockResolvedValueOnce({ alive: true })
      .mockResolvedValueOnce({ alive: false });

    const result = await getStatusList(['HOST1', 'HOST2']);

    expect(result).toEqual([
      { ip: 'HOST1', online: true, isInternet: false, displayLabel: 'HOST1' },
      { ip: 'HOST2', online: false, isInternet: false, displayLabel: 'HOST2' }
    ]);
  });

  test('getStatusList retorna status correto com internet check', async () => {
    ping.promise.probe = jest.fn()
      .mockResolvedValueOnce({ alive: true }) // Internet
      .mockResolvedValueOnce({ alive: true }) // HOST1
      .mockResolvedValueOnce({ alive: false }); // HOST2

    const internetCheck = {
      enabled: true,
      host: '8.8.8.8',
      label: '🌐 Internet'
    };

    const result = await getStatusList(['HOST1', 'HOST2'], 1, internetCheck);

    expect(result).toEqual([
      { ip: '8.8.8.8', online: true, isInternet: true, displayLabel: '🌐 Internet' },
      { ip: 'HOST1', online: true, isInternet: false, displayLabel: 'HOST1' },
      { ip: 'HOST2', online: false, isInternet: false, displayLabel: 'HOST2' }
    ]);
  });

  test('detectStatusChanges detecta mudança para online', () => {
    const previous = { 'HOST1': false };
    const current = [{ 
      ip: 'HOST1', 
      online: true, 
      isInternet: false, 
      displayLabel: 'HOST1' 
    }];

    const changes = detectStatusChanges(previous, current);

    expect(changes).toEqual([
      { 
        ip: 'HOST1', 
        type: 'online', 
        changed: true, 
        isInternet: false, 
        displayLabel: 'HOST1' 
      }
    ]);
  });

  test('detectStatusChanges detecta mudança para offline', () => {
    const previous = { 'HOST1': true };
    const current = [{ 
      ip: 'HOST1', 
      online: false, 
      isInternet: false, 
      displayLabel: 'HOST1' 
    }];

    const changes = detectStatusChanges(previous, current);

    expect(changes).toEqual([
      { 
        ip: 'HOST1', 
        type: 'offline', 
        changed: true, 
        isInternet: false, 
        displayLabel: 'HOST1' 
      }
    ]);
  });

  test('detectStatusChanges não notifica na primeira verificação', () => {
    const previous = {};
    const current = [{ 
      ip: 'HOST1', 
      online: true, 
      isInternet: false, 
      displayLabel: 'HOST1' 
    }];

    const changes = detectStatusChanges(previous, current);

    expect(changes[0].changed).toBe(false);
  });

  test('createMenuTemplate cria menu corretamente', async () => {
    // Mock específico para este teste
    jest.doMock('https', () => ({
      request: jest.fn((options, callback) => {
        // Simula uma resposta bem-sucedida
        const mockResponse = {
          statusCode: 200,
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler('123.456.789.012');
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        
        callback(mockResponse);
        
        return {
          on: jest.fn(),
          end: jest.fn()
        };
      })
    }), { virtual: true });

    // Recarrega o módulo para usar o mock
    const { createMenuTemplate } = require('./networkMonitor');

    const statusList = [
      { ip: '8.8.8.8', online: true, isInternet: true, displayLabel: '🌐 Internet' },
      { ip: 'HOST1', online: true, isInternet: false, displayLabel: 'HOST1' },
      { ip: 'HOST2', online: false, isInternet: false, displayLabel: 'HOST2' }
    ];

    const onUpdate = jest.fn();
    const onQuit = jest.fn();

    const menu = await createMenuTemplate(statusList, onUpdate, onQuit);

    expect(menu.length).toBeGreaterThan(0);
    expect(menu[0].label).toBe('🖥️ Monitoramento de Rede');
    
    // Verifica se tem o IP externo
    const externalIPItem = menu.find(item => item.label && item.label.includes('IP Externo'));
    expect(externalIPItem).toBeDefined();
    expect(externalIPItem.label).toContain('123.456.789.012');
    
    // Verifica se tem o item da internet
    const internetItem = menu.find(item => item.label && item.label.includes('Internet'));
    expect(internetItem).toBeDefined();
    
    // Verifica se tem os hosts
    const host1Item = menu.find(item => item.label && item.label.includes('HOST1'));
    expect(host1Item).toBeDefined();
  });

  test('createMenuTemplate lida com erro ao obter IP externo', async () => {
    // Mock específico para simular erro
    jest.doMock('https', () => ({
      request: jest.fn(() => {
        return {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              handler(new Error('Erro de conexão'));
            }
          }),
          end: jest.fn()
        };
      })
    }), { virtual: true });

    // Recarrega o módulo para usar o mock
    const { createMenuTemplate } = require('./networkMonitor');

    const statusList = [
      { ip: 'HOST1', online: true, isInternet: false, displayLabel: 'HOST1' }
    ];

    const onUpdate = jest.fn();
    const onQuit = jest.fn();

    const menu = await createMenuTemplate(statusList, onUpdate, onQuit);

    // Verifica se o menu ainda é criado mesmo com erro
    expect(menu.length).toBeGreaterThan(0);
    
    // Verifica se tem a mensagem de erro para o IP externo
    const externalIPItem = menu.find(item => item.label && item.label.includes('IP Externo'));
    expect(externalIPItem).toBeDefined();
    expect(externalIPItem.label).toContain('Erro');
  });
});