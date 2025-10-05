const { app, Menu, Tray, BrowserWindow, Notification } = require('electron');
const path = require('path');
const ping = require('ping');

const IP_LIST = [
    "TETRAGRAMMATON",
    "NEURANIUM",
    "GALVORN",
    "raspberrypi",
    "SABRLFNNSCJ3"
];

let tray = null;
let hostsStatus = {};


// Impede múltiplas instâncias usando o lock do Electron
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // Se não obteve o lock, significa que já existe outra instância em execução.
    // Sai imediatamente para evitar múltiplas instâncias.
    app.quit();
    // Em alguns cenários o processo pode ainda continuar, força saída.
    process.exit(0);
}

// Se outra instância tentar iniciar, este evento será disparado na instância que possui o lock.
app.on('second-instance', (event, argv, workingDirectory) => {
    // Aqui podemos focar a janela existente ou exibir uma notificação.
    // Como essa aplicação usa apenas um tray, não há janela principal visível para focar.
    // Poderíamos enviar uma notificação ou abrir o menu do tray. Por simplicidade, apenas trazemos o app para frente.
    // Em vez de abrir o menu, mostra uma notificação informando que já está em execução.
    // Apenas mostra uma notificação informando que o app já está em execução.
    // Não abrirá o menu do tray nem tomará qualquer outra ação.
    try {
        sendNotification('Monitoramento de Rede', 'O aplicativo já está em execução.');
    } catch (e) {
        console.log('Erro ao tentar notificar:', e && e.message);
    }
});

async function getStatusList() {
    const results = await Promise.all(IP_LIST.map(async (ip) => {
        const res = await ping.promise.probe(ip, { timeout: 1 });
        return { ip, online: res.alive };
    }));
    return results;
}

function createMenu(statusList) {
    const items = [
        { label: '🖥️ Monitoramento de Rede', enabled: false },
        { type: 'separator' },
        ...statusList.map(s => ({
            label: `${s.ip} — ${s.online ? '✅ Online' : '❌ Offline'}`,
            enabled: false
        })),
        { type: 'separator' },
        {
            label: '⟳ Atualizar agora',
            click: () => updateMenu()
        },
        {
            label: '🛑 Sair',
            click: () => app.quit()
        }
    ];

    return Menu.buildFromTemplate(items);
}

// Função para enviar notificação
function sendNotification(title, body) {
    console.log('[sendNotification] chamado:', title, body);
    const supported = Notification.isSupported();
    console.log('[sendNotification] Notification.isSupported():', supported);
    if (supported) {
        try {
            const iconPath = getIconPath(); // Reutiliza a função para obter o caminho do ícone
            const n = new Notification({
                title: title,
                body: body,
                icon: iconPath
            });
            n.show();
            console.log('[sendNotification] notificação exibida');
        } catch (e) {
            console.log('[sendNotification] erro ao criar/exibir notificação:', e && e.message);
        }
    } else {
        console.log('Notificações não são suportadas neste ambiente. Tentando balloon do tray (Windows).');
        try {
            if (tray && process.platform === 'win32' && typeof tray.displayBalloon === 'function') {
                tray.displayBalloon({ title, content: body });
                console.log('[sendNotification] tray.displayBalloon chamado como fallback');
            }
        } catch (e) {
            console.log('[sendNotification] erro ao chamar tray.displayBalloon:', e && e.message);
        }
    }
}

async function updateMenu() {
    const currentStatusList = await getStatusList();

    // Lógica para verificar e enviar notificações
    currentStatusList.forEach(s => {
        // Se o host não tinha status anterior ou se o status mudou para online
        if (hostsStatus[s.ip] === undefined) {
            // Inicializa o status na primeira execução, sem notificar (opcional: notificar todos online no início)
            hostsStatus[s.ip] = s.online;
            if (s.online) {
                // Você pode optar por notificar que está online no primeiro check, ou não.
                // sendNotification('Status da Rede', `${s.ip} está online.`);
            }
        } else if (hostsStatus[s.ip] === false && s.online === true) {
            // Se estava offline e agora está online, notificar
            sendNotification('Status da Rede: Computador Online', `${s.ip} ficou ONLINE!`);
            hostsStatus[s.ip] = true; // Atualiza o status
        } else if (hostsStatus[s.ip] === true && s.online === false) {
            // Se estava online e agora está offline, notificar (opcional)
            sendNotification('Status da Rede: Computador Offline', `${s.ip} ficou OFFLINE!`);
            hostsStatus[s.ip] = false; // Atualiza o status
        }
    });

    const menu = createMenu(currentStatusList);
    tray.setContextMenu(menu);
}

// Função para obter o caminho correto do ícone
function getIconPath() {
    if (app.isPackaged) {
        // Quando empacotado, usa o caminho dos recursos extras
        return path.join(process.resourcesPath, 'icons', 'app.ico');
    } else {
        // Durante desenvolvimento
        return path.join(__dirname, 'icons', 'app.ico');
    }
}

app.whenReady().then(() => {
    // Define o ícone da aplicação
    const iconPath = getIconPath();
    
    // Cria uma janela invisível para definir o ícone da aplicação
    const hiddenWindow = new BrowserWindow({
        show: false,
        icon: iconPath
    });
    
    // Cria o tray
    tray = new Tray(iconPath);
    tray.setToolTip('Monitoramento de Rede');

    // Inicializa o status dos hosts e atualiza o menu
    // Chamamos updateMenu uma vez para preencher hostsStatus e configurar o menu inicial.
    // As notificações ocorrerão apenas em mudanças de estado subsequentes.
    updateMenu();
    
    // Atualiza a cada 2 minutos
    setInterval(updateMenu, 120000); 
});

// Impede que a aplicação seja fechada completamente
app.on('window-all-closed', (e) => {
    e.preventDefault();
});