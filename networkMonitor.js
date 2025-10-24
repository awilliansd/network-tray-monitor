const ping = require('ping');

/**
 * Verifica o status online/offline de uma lista de IPs
 * @param {string[]} ipList - Lista de IPs ou hostnames para verificar
 * @param {number} timeout - Timeout em segundos para o ping
 * @returns {Promise<Array<{ip: string, online: boolean}>>}
 */
async function getStatusList(ipList, timeout = 1) {
    const results = await Promise.all(ipList.map(async (ip) => {
        const res = await ping.promise.probe(ip, { timeout });
        return { ip, online: res.alive };
    }));
    return results;
}

/**
 * Detecta mudanças de status entre verificações
 * @param {Object} previousStatus - Status anterior dos hosts {ip: boolean}
 * @param {Array} currentStatusList - Status atual [{ip, online}]
 * @returns {Array<{ip: string, type: 'online'|'offline', changed: boolean}>}
 */
function detectStatusChanges(previousStatus, currentStatusList) {
    const changes = [];
    
    currentStatusList.forEach(s => {
        // Primeira verificação - inicializa sem notificar
        if (previousStatus[s.ip] === undefined) {
            changes.push({ ip: s.ip, type: s.online ? 'online' : 'offline', changed: false });
        }
        // Mudou de offline para online
        else if (previousStatus[s.ip] === false && s.online === true) {
            changes.push({ ip: s.ip, type: 'online', changed: true });
        }
        // Mudou de online para offline
        else if (previousStatus[s.ip] === true && s.online === false) {
            changes.push({ ip: s.ip, type: 'offline', changed: true });
        }
        // Sem mudanças
        else {
            changes.push({ ip: s.ip, type: s.online ? 'online' : 'offline', changed: false });
        }
    });
    
    return changes;
}

/**
 * Cria os itens do menu baseado no status atual
 * @param {Array} statusList - Lista de status [{ip, online}]
 * @param {Function} onUpdate - Callback para o botão atualizar
 * @param {Function} onQuit - Callback para o botão sair
 * @returns {Array} Template de itens do menu
 */
function createMenuTemplate(statusList, onUpdate, onQuit) {
    return [
        { label: '🖥️ Monitoramento de Rede', enabled: false },
        { type: 'separator' },
        ...statusList.map(s => ({
            label: `${s.ip} — ${s.online ? '✅ Online' : '❌ Offline'}`,
            enabled: false
        })),
        { type: 'separator' },
        {
            label: '⟳ Atualizar agora',
            click: onUpdate
        },
        {
            label: '🛑 Sair',
            click: onQuit
        }
    ];
}

module.exports = {
    getStatusList,
    detectStatusChanges,
    createMenuTemplate
};