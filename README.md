# Network Tray Monitor

![Network Tray Monitor](icons/app.png)

Um aplicativo de monitoramento de rede em tempo real que fica na bandeja do sistema, desenvolvido com Electron. Monitora computadores específicos na rede e exibe seu status (online/offline) através de um menu contextual acessível pela bandeja do sistema.

## 🚀 Funcionalidades

- **Monitoramento em tempo real**: Verifica o status de conectividade dos computadores configurados
- **Interface na bandeja**: Fica discretamente na bandeja do sistema
- **Atualização automática**: Verifica o status a cada 5 minutos automaticamente
- **Atualização manual**: Permite atualizar o status instantaneamente através do menu
- **Interface amigável**: Menu contextual com emojis e indicadores visuais claros
- **Multiplataforma**: Funciona no Windows (com instalador NSIS)

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- npm (incluído com Node.js)
- Sistema operacional Windows (para o instalador)

## 🛠️ Instalação para Desenvolvimento

1. **Clone o repositório**:
```bash
git clone <url-do-repositorio>
cd network-tray-monitor
```

2. **Instale as dependências**:
```bash
npm install
npm install electron --save-dev
```

3. **Configure os IPs para monitoramento**:
Edite o arquivo `main.js` e modifique a lista `IP_LIST` com os computadores que deseja monitorar:
```javascript
const IP_LIST = [
    "192.168.1.100",      // IP do computador 1
    "DESKTOP-ESCRITORIO", // Nome do computador 2
    "SERVIDOR-CASA"       // Nome do computador 3
];
```

4. **Execute em modo de desenvolvimento**:
```bash
npm start
```

## 📦 Compilação

Para gerar o instalador do aplicativo:

```bash
npm run dist
```

O instalador será gerado na pasta `dist/` com o arquivo `.exe` para instalação no Windows.

## 🖥️ Como Usar

1. **Instale o aplicativo** através do instalador gerado
2. **Execute o aplicativo** - ele aparecerá na bandeja do sistema
3. **Clique com o botão direito** no ícone da bandeja para ver o menu
4. **Visualize o status** dos computadores monitorados:
   - ✅ **Online**: Computador está acessível na rede
   - ❌ **Offline**: Computador não está respondendo

### Menu de Opções

- **🖥️ Monitoramento de Rede**: Título informativo
- **Lista de computadores**: Mostra o status atual de cada máquina
- **⟳ Atualizar agora**: Força uma verificação imediata do status
- **🛑 Sair**: Fecha o aplicativo

## ⚙️ Configuração

### Alterando Computadores Monitorados

Para modificar quais computadores são monitorados, edite o array `IP_LIST` no arquivo `main.js`:

```javascript
const IP_LIST = [
    "192.168.1.100",      // Por IP
    "COMPUTADOR-SALA",    // Por nome do computador
    "notebook.local"      // Por hostname
];
```

### Alterando Intervalo de Atualização

Por padrão, o aplicativo verifica o status a cada 5 minutos. Para alterar isso, modifique o valor em `main.js`:

```javascript
setInterval(updateMenu, 300000); // 300000ms = 5 minutos
// Para 1 minuto: 60000
// Para 10 minutos: 600000
```

### Timeout de Ping

O timeout padrão para cada ping é de 1 segundo. Para alterar:

```javascript
const res = await ping.promise.probe(ip, { timeout: 5 }); // 5 segundos
```

## 📁 Estrutura do Projeto

```
network-tray-monitor/
├── main.js              # Arquivo principal do Electron
├── package.json         # Configurações do projeto e dependências
├── icons/
│   ├── app.ico         # Ícone em formato ICO
│   └── app.png         # Ícone em formato PNG
├── dist/               # Pasta gerada com os builds
└── README.md           # Esta documentação
```

## 🔧 Tecnologias Utilizadas

- **[Electron](https://www.electronjs.org/)**: Framework para aplicações desktop
- **[Node.js](https://nodejs.org/)**: Runtime JavaScript
- **[ping](https://www.npmjs.com/package/ping)**: Biblioteca para realizar pings de rede
- **[electron-builder](https://www.electron.build/)**: Ferramenta para empacotamento e distribuição

## 📝 Scripts Disponíveis

- `npm start`: Executa o aplicativo em modo de desenvolvimento
- `npm run dist`: Gera o instalador para distribuição

## 🐛 Solução de Problemas

### Ícone não aparece no executável
- Certifique-se de que o arquivo `icons/app.ico` tem múltiplas resoluções
- Tente usar PNG em vez de ICO temporariamente
- Verifique se a pasta `icons/` está incluída no build

### Computador não é detectado
- Verifique se o nome/IP está correto
- Teste ping manual: `ping NOME_DO_COMPUTADOR`
- Certifique-se de que não há firewall bloqueando

### Aplicativo não inicia
- Verifique se todas as dependências foram instaladas
- Execute `npm install` novamente
- Verifique logs no console para erros específicos

## 📄 Licença

Este projeto está sob licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Se você encontrar algum problema ou tiver sugestões, por favor:

1. Verifique se o problema já foi reportado nas [Issues](../../issues)
2. Se não, crie uma nova issue com detalhes do problema
3. Inclua informações sobre seu sistema operacional e versão do Node.js

## 🔄 Versões

### v1.0.0
- Monitoramento básico de computadores na rede
- Interface na bandeja do sistema
- Atualização automática a cada 5 minutos
- Instalador para Windows

---

**Desenvolvido por Alessandro Willian** 🚀