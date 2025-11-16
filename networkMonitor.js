const ping = require('ping');

/**
 * Verifica o status online/offline de uma lista de IPs
 * @param {string[]} ipList - Lista de IPs ou hostnames para verificar
 * @param {number} timeout - Timeout em segundos para o ping
 * @param {Object} internetCheck - Configuração para verificar internet {enabled, host, label}
 * @returns {Promise<Array<{ip: string, online: boolean, isInternet: boolean}>>}
 */
async function getStatusList(ipList, timeout = 1, internetCheck = null) {
    const hostsToCheck = [...ipList];
    
    // Adiciona verificação de internet se habilitado
    if (internetCheck && internetCheck.enabled) {
        hostsToCheck.unshift(internetCheck.host);
    }
    
    const results = await Promise.all(hostsToCheck.map(async (ip) => {
        const res = await ping.promise.probe(ip, { timeout });
        const isInternet = internetCheck && internetCheck.enabled && ip === internetCheck.host;
        
        return { 
            ip, 
            online: res.alive,
            isInternet,
            displayLabel: isInternet ? internetCheck.label : ip
        };
    }));
    
    return results;
}

/**
 * Detecta mudanças de status entre verificações
 * @param {Object} previousStatus - Status anterior dos hosts {ip: boolean}
 * @param {Array} currentStatusList - Status atual [{ip, online}]
 * @returns {Array<{ip: string, type: 'online'|'offline', changed: boolean, isInternet: boolean}>}
 */
function detectStatusChanges(previousStatus, currentStatusList) {
    const changes = [];
    
    currentStatusList.forEach(s => {
        // Primeira verificação - inicializa sem notificar
        if (previousStatus[s.ip] === undefined) {
            changes.push({ 
                ip: s.ip, 
                type: s.online ? 'online' : 'offline', 
                changed: false,
                isInternet: s.isInternet || false,
                displayLabel: s.displayLabel || s.ip
            });
        }
        // Mudou de offline para online
        else if (previousStatus[s.ip] === false && s.online === true) {
            changes.push({ 
                ip: s.ip, 
                type: 'online', 
                changed: true,
                isInternet: s.isInternet || false,
                displayLabel: s.displayLabel || s.ip
            });
        }
        // Mudou de online para offline
        else if (previousStatus[s.ip] === true && s.online === false) {
            changes.push({ 
                ip: s.ip, 
                type: 'offline', 
                changed: true,
                isInternet: s.isInternet || false,
                displayLabel: s.displayLabel || s.ip
            });
        }
        // Sem mudanças
        else {
            changes.push({ 
                ip: s.ip, 
                type: s.online ? 'online' : 'offline', 
                changed: false,
                isInternet: s.isInternet || false,
                displayLabel: s.displayLabel || s.ip
            });
        }
    });
    
    return changes;
}

/**
 * Cria os itens do menu baseado no status atual
 * @param {Array} statusList - Lista de status [{ip, online, isInternet, displayLabel}]
 * @param {Function} onUpdate - Callback para o botão atualizar
 * @param {Function} onQuit - Callback para o botão sair
 * @returns {Array} Template de itens do menu
 */
function createMenuTemplate(statusList, onUpdate, onQuit) {
    // Separa internet check dos demais hosts
    const internetStatus = statusList.find(s => s.isInternet);
    const hostStatuses = statusList.filter(s => !s.isInternet);
    
    const menuItems = [
        { label: '🖥️ Monitoramento de Rede', enabled: false },
        { type: 'separator' }
    ];
    
    // Adiciona status da internet primeiro, se existir
    if (internetStatus) {
        menuItems.push({
            label: `${internetStatus.displayLabel} — ${internetStatus.online ? '✅ Conectado' : '❌ Sem conexão'}`,
            enabled: false
        });
        menuItems.push({ type: 'separator' });
    }
    
    // Adiciona demais hosts
    hostStatuses.forEach(s => {
        menuItems.push({
            label: `💻 ${s.displayLabel || s.ip} — ${s.online ? '✅ Online' : '❌ Offline'}`,
            enabled: false
        });
    });
    
    menuItems.push(
        { type: 'separator' },
        {
            label: '⟳ Atualizar agora',
            click: onUpdate
        },
        {
            label: '🛑 Sair',
            click: onQuit
        }
    );
    
    return menuItems;
}

module.exports = {
    getStatusList,
    detectStatusChanges,
    createMenuTemplate
};