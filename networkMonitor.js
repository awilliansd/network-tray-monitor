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
 * Verifica a disponibilidade de um serviço via HTTPS
 * @param {string} host - Hostname do serviço (ex: api.ferdium.org)
 * @param {number} timeoutMs - Timeout em milissegundos
 * @returns {Promise<boolean>} true se status 2xx/3xx, false caso contrário
 */
function probeHttps(host, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port: 443,
            path: '/',
            method: 'GET',
            timeout: timeoutMs
        };

        const req = https.request(options, (res) => {
            res.resume();
            res.on('error', () => resolve(false));
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

/**
 * Verifica o status online/offline de uma lista de IPs
 * @param {string[]} ipList - Lista de IPs ou hostnames para verificar
 * @param {number} timeout - Timeout em segundos para o ping
 * @param {Object} internetCheck - Configuração para verificar internet {enabled, host, label}
 * @param {Array<{host: string, label: string}>} serviceChecks - Lista de serviços para verificar
 * @returns {Promise<Array<{ip: string, online: boolean, isInternet: boolean, isService: boolean}>>}
 */
async function getStatusList(ipList, timeout = 1, internetCheck = null, serviceChecks = []) {
    const hostsToCheck = [...ipList];
    
    // Adiciona verificação de internet se habilitado
    if (internetCheck && internetCheck.enabled) {
        hostsToCheck.unshift(internetCheck.host);
    }
    
    // Adiciona verificações de serviços (ex: api.ferdium.org)
    const serviceHosts = serviceChecks.map(s => s.host);
    hostsToCheck.push(...serviceHosts);
    
    const results = await Promise.all(hostsToCheck.map(async (ip) => {
        const isInternet = internetCheck && internetCheck.enabled && ip === internetCheck.host;
        const serviceCheck = serviceChecks.find(s => s.host === ip);
        const isService = Boolean(serviceCheck);
        
        let online;
        if (isService) {
            // Serviços web são verificados via HTTPS, pois o ping ICMP não
            // detecta erros do aplicativo (ex: HTTP 502)
            online = await probeHttps(serviceCheck.host);
        } else {
            const res = await ping.promise.probe(ip, { timeout });
            online = res.alive;
        }
        
        let displayLabel = ip;
        if (isInternet) {
            displayLabel = internetCheck.label;
        } else if (isService) {
            displayLabel = serviceCheck.label;
        }
        
        return { 
            ip, 
            online,
            isInternet: isInternet || false,
            isService,
            displayLabel
        };
    }));
    
    return results;
}

/**
 * Detecta mudanças de status entre verificações
 * @param {Object} previousStatus - Status anterior dos hosts {ip: boolean}
 * @param {Array} currentStatusList - Status atual [{ip, online}]
 * @returns {Array<{ip: string, type: 'online'|'offline', changed: boolean, isInternet: boolean, isService: boolean}>}
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
                isService: s.isService || false,
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
                isService: s.isService || false,
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
                isService: s.isService || false,
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
                isService: s.isService || false,
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

    // Separa internet check, serviços e demais hosts
    const internetStatus = statusList.find(s => s.isInternet);
    const serviceStatuses = statusList.filter(s => s.isService);
    const hostStatuses = statusList.filter(s => !s.isInternet && !s.isService);
    
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
            label: `${internetStatus.displayLabel} — ${internetStatus.online ? '✅ Online' : '❌ Offline'}`,
            enabled: false
        });
        menuItems.push({ type: 'separator' });
    }
    
    // Adiciona status dos serviços (ex: Ferdium API)
    serviceStatuses.forEach(s => {
        menuItems.push({
            label: `${s.displayLabel || s.ip} — ${s.online ? '✅ Online' : '❌ Offline'}`,
            enabled: false
        });
    });
    if (serviceStatuses.length > 0) {
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

    // Botão único de atualização — muda conforme o estado
    const busyPatterns = ['Verificando', 'Baixando', 'Instalando'];
    const isBusy = busyPatterns.some(p => updateStatusLabel.startsWith(p));
    const isUnavailable = updateStatusLabel.includes('indisponível') || updateStatusLabel.includes('indisponivel');

    let updateButtonLabel;
    let updateButtonClick = null;
    let updateButtonEnabled = false;

    if (canInstallUpdate && typeof onInstallUpdate === 'function' && !isBusy) {
        updateButtonLabel = `⚡ Instalar atualização`;
        updateButtonClick = onInstallUpdate;
        updateButtonEnabled = true;
    } else if (isBusy) {
        updateButtonLabel = `🔄 ${updateStatusLabel}`;
        updateButtonEnabled = false;
    } else if (isUnavailable) {
        updateButtonLabel = '🔄 Verificação indisponível';
        updateButtonEnabled = false;
    } else if (typeof onCheckForUpdates === 'function') {
        updateButtonLabel = '🔄 Verificar atualizações';
        updateButtonClick = onCheckForUpdates;
        updateButtonEnabled = true;
    } else {
        updateButtonLabel = '🔄 Verificação indisponível';
        updateButtonEnabled = false;
    }

    menuItems.push({
        label: updateButtonLabel,
        click: updateButtonClick,
        enabled: updateButtonEnabled
    });

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
    probeHttps,
    getStatusList,
    detectStatusChanges,
    createMenuTemplate
};
