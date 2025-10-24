const { getStatusList, detectStatusChanges } = require('./networkMonitor'); // ← detectStatusChanges
const ping = require('ping');

jest.mock('ping');

describe('NetworkMonitor', () => {
  test('getStatusList retorna status correto', async () => {
    ping.promise.probe = jest.fn()
      .mockResolvedValueOnce({ alive: true })
      .mockResolvedValueOnce({ alive: false });

    const result = await getStatusList(['HOST1', 'HOST2']);

    expect(result).toEqual([
      { ip: 'HOST1', online: true },
      { ip: 'HOST2', online: false }
    ]);
  });

  test('detectStatusChanges detecta mudança para online', () => {
    const previous = { 'HOST1': false };
    const current = [{ ip: 'HOST1', online: true }];

    const changes = detectStatusChanges(previous, current);

    expect(changes).toEqual([
      { ip: 'HOST1', type: 'online', changed: true }
    ]);
  });
});