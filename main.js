const { app, Menu, Tray, BrowserWindow, Notification } = require('electron');
const path = require('path');
const ping = require('ping');

const IP_LIST = [
    "192.168.1.2",
    "192.168.1.3",
    "192.168.1.4"
];

let tray = null;
let hostsStatus = {};

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
    if (Notification.isSupported()) {
        const iconPath = getIconPath(); // Reutiliza a função para obter o caminho do ícone
        new Notification({
            title: title,
            body: body,
            icon: iconPath
        }).show();
    } else {
        console.log('Notificações não são suportadas neste ambiente.');
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