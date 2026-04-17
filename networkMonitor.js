const ping = require('ping');
const https = require('https');

/**
 * Obtém o IP externo (público)
 * @returns {Promise<string>} IP externo ou mensagem de erro
 */
async function getExternalIP() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.ipify.org',
            port: 443,
            path: '/',
            method: 'GET',
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data.trim());
                } else {
                    resolve('Erro ao obter IP');
                }
            });
        });

        req.on('error', (error) => {
            console.error('Erro ao obter IP externo:', error);
            resolve('Erro de conexão');
        });

        req.on('timeout', () => {
            req.destroy();
            resolve('Timeout');
        });

        req.end();
    });
}

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
            isInternet: isInternet || false,
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
 * @param {Object} updateOptions - Opções de atualização
 * @returns {Array} Template de itens do menu
 */
async function createMenuTemplate(statusList, onUpdate, onQuit, updateOptions = {}) {
    const {
        updateStatusLabel = 'Inativo',
        onCheckForUpdates = null,
        onInstallUpdate = null,
        canInstallUpdate = false
    } = updateOptions;

    // Separa internet check dos demais hosts
    const internetStatus = statusList.find(s => s.isInternet);
    const hostStatuses = statusList.filter(s => !s.isInternet);
    
    const menuItems = [
        { label: '🖥️ Monitoramento de Rede', enabled: false },
        { type: 'separator' }
    ];
    
    // Adiciona IP externo
    try {
        const externalIP = await getExternalIP();
        menuItems.push({
            label: `🌍 IP Externo: ${externalIP}`,
            enabled: false
        });
        menuItems.push({ type: 'separator' });
    } catch (error) {
        console.error('Erro ao obter IP externo:', error);
        menuItems.push({
            label: '🌍 IP Externo: Erro ao carregar',
            enabled: false
        });
        menuItems.push({ type: 'separator' });
    }
    
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
    
    menuItems.push({ type: 'separator' });
    menuItems.push({
        label: `🔄 Atualizações: ${updateStatusLabel}`,
        enabled: false
    });
    menuItems.push({
        label: '⬇️ Verificar atualizações agora',
        click: onCheckForUpdates,
        enabled: typeof onCheckForUpdates === 'function'
    });

    if (canInstallUpdate && typeof onInstallUpdate === 'function') {
        menuItems.push({
            label: '⚡ Atualizar agora',
            click: onInstallUpdate
        });
    }

    menuItems.push(
        { type: 'separator' },
        {
            label: '⟳ Atualizar monitoramento agora',
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
    getExternalIP,
    getStatusList,
    detectStatusChanges,
    createMenuTemplate
};
