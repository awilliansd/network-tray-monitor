const { app, Menu, Tray, BrowserWindow } = require('electron');
const path = require('path');
const ping = require('ping');

const IP_LIST = [
    "192.168.1.100",      // IP do computador 1
    "DESKTOP-ESCRITORIO", // Nome do computador 2
    "SERVIDOR-CASA"       // Nome do computador 3
];

let tray = null;

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

async function updateMenu() {
    const status = await getStatusList();
    const menu = createMenu(status);
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
    
    // Define o ícone padrão da aplicação
    app.setAppUserModelId('com.alessandrowillian.networkmonitor');
    
    // Cria uma janela invisível para definir o ícone da aplicação
    const hiddenWindow = new BrowserWindow({
        show: false,
        icon: iconPath,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    // Define o ícone da janela explicitamente
    if (process.platform === 'win32') {
        hiddenWindow.setIcon(iconPath);
    }
    
    // Cria o tray
    tray = new Tray(iconPath);
    tray.setToolTip('Monitoramento de Rede');

    updateMenu();
    setInterval(updateMenu, 300000); // atualiza a cada 5 minuto
});

// Impede que a aplicação seja fechada completamente
app.on('window-all-closed', (e) => {
    e.preventDefault();
});