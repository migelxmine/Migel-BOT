# 🍼 GUIA PARA BEBÉS - DO ZERO ABSOLUTO

Vou guiar-te como se nunca tivesses tocado num computador! 👶

---

## 🎯 PARTE 1: PREPARAR O RASPBERRY PI

### **Passo 1: Instalar Sistema no USB/SD Card**

**No teu PC (Windows):**

1. **Descarrega Raspberry Pi Imager:**
   - Abre browser
   - Vai a: `https://www.raspberrypi.com/software/`
   - Clica botão verde **"Download for Windows"**
   - Aguarda download terminar
   - Vai a Downloads
   - Duplo clique em `imager_latest.exe`
   - Clica **"Install"** → **"Finish"**

2. **Prepara o USB/SD:**
   - **PEGA** no USB ou cartão SD (16GB mínimo)
   - **INSERE** no PC (porta USB ou leitor SD)
   - **ESPERA** Windows reconhecer

3. **Gravar Sistema Operativo:**
   - Abre **Raspberry Pi Imager** (ícone no desktop)
   
   **► Clica "CHOOSE DEVICE"**
   - Seleciona: **Raspberry Pi 4**
   
   **► Clica "CHOOSE OS"**
   - Seleciona: **Raspberry Pi OS (64-bit)** (o primeiro da lista)
   
   **► Clica "CHOOSE STORAGE"**
   - Seleciona o **teu USB/SD** (cuidado! vai apagar tudo)
   
   **► Clica no ícone da ENGRENAGEM ⚙️** (canto inferior direito)
   
   **Agora preenche assim:**
   
   ```
   ✅ Set hostname
      raspberrypi (deixa como está)
   
   ✅ Set username and password
      Username: pi
      Password: (inventa uma, exemplo: raspberry123)
      ⚠️ ANOTA A PASSWORD ALGURES!
   
   ✅ Configure wireless LAN
      SSID: (nome do teu WiFi, exemplo: MEO-123456)
      Password: (password do WiFi)
      Wireless LAN country: PT
   
   ✅ Set locale settings
      Time zone: Europe/Lisbon
      Keyboard layout: pt
   
   ✅ Enable SSH
      (deixa marcado)
   ```
   
   **► Clica "SAVE"**
   
   **► Clica "YES"** (aviso que vai apagar tudo)
   
   **► Clica "YES"** (confirmação final)

4. **AGUARDA** (5-10 minutos - vai aparecer barra de progresso)

5. **Quando aparecer "Write Successful":**
   - Clica **"CONTINUE"**
   - **REMOVE** USB/SD do PC com segurança (eject)

---

### **Passo 2: Ligar o Raspberry Pi**

**Preparar hardware:**

1. **PEGA** no USB/SD que acabaste de gravar
2. **INSERE** no Raspberry Pi (slot na parte de baixo)
3. **LIGA** o cabo de alimentação à corrente
4. **AGUARDA** 2-3 minutos (luzes vão piscar - é normal!)

**O Pi está agora a arrancar e a conectar ao WiFi sozinho!**

---

### **Passo 3: Conectar ao Pi pelo PC**

**No PC (Windows):**

1. **Abre PowerShell:**
   - Pressiona tecla **Windows** + **R**
   - Escreve: `powershell`
   - Pressiona **Enter**
   - Abre janela azul/preta

2. **Liga-te ao Pi:**
   
   **► Escreve EXACTAMENTE isto:**
   ```
   ssh pi@raspberrypi.local
   ```
   
   **► Pressiona Enter**
   
   **► Se aparecer "Are you sure...":**
   - Escreve: `yes`
   - Pressiona Enter
   
   **► Vai pedir password:**
   - Escreve a password que criaste (não vês as letras - é normal!)
   - Pressiona Enter

3. **✅ Se tudo correr bem, vais ver:**
   ```
   pi@raspberrypi:~ $
   ```

**PARABÉNS! Estás DENTRO do Raspberry Pi!** 🎉

---

## 💻 PARTE 2: PREPARAR O SISTEMA

### **Passo 4: Atualizar Sistema**

**Na janela PowerShell (já conectado ao Pi), escreve linha a linha:**

```bash
sudo apt update
```
**► Pressiona Enter**  
**► AGUARDA** (1-2 minutos - vai aparecer texto a correr)

```bash
sudo apt upgrade -y
```
**► Pressiona Enter**  
**► AGUARDA** (5-10 minutos - vai instalar atualizações)

**✅ Quando terminar, vês novamente:** `pi@raspberrypi:~ $`

---

### **Passo 5: Instalar Node.js**

**Escreve isto:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```
**► Pressiona Enter**  
**► AGUARDA** (1-2 minutos)

```bash
sudo apt install -y nodejs
```
**► Pressiona Enter**  
**► AGUARDA** (2-3 minutos)

**Verificar se instalou:**

```bash
node --version
```
**► Pressiona Enter**  
**► Deve aparecer:** `v20.something.something`

```bash
npm --version
```
**► Pressiona Enter**  
**► Deve aparecer:** `10.something.something`

**✅ Se aparecerem versões, está OK!**

---

## 🤖 PARTE 3: INSTALAR O BOT

### **Passo 6: Criar Pasta do Projeto**

```bash
cd ~
```
**► Enter**

```bash
mkdir whatsapp-bot
```
**► Enter**

```bash
cd whatsapp-bot
```
**► Enter**

```bash
pwd
```
**► Enter**  
**► Deve mostrar:** `/home/pi/whatsapp-bot`

---

### **Passo 7: Criar Ficheiros (UM A UM)**

#### **📄 Ficheiro 1: package.json**

```bash
nano package.json
```
**► Enter**

**Abre editor. Agora:**
- Clica botão direito do rato na janela PowerShell
- Seleciona tudo deste código abaixo
- Copia (Ctrl+C)
- Clica com botão direito na janela PowerShell (cola automaticamente)

```json
{
  "name": "whatsapp-moderator-bot",
  "version": "1.0.0",
  "description": "Bot de moderação WhatsApp",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js",
    "dashboard": "node server.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.8",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

**Guardar:**
1. Pressiona **Ctrl + X**
2. Pressiona **Y**
3. Pressiona **Enter**

---

#### **📄 Ficheiro 2: config.json**

```bash
nano config.json
```
**► Enter**

**Cola isto:**

```json
{
  "logGroupId": "",
  "adminGroupId": "",
  "botNumber": "",
  "allowedStickers": [],
  "rules": {
    "TEXT_NOT_ALLOWED": {
      "code": "Art. 1.3",
      "description": "Texto não é permitido",
      "warnings": 1,
      "enabled": false
    },
    "STICKER_WITHOUT_WHISTLE": {
      "code": "Art. 1.2",
      "description": "Stickers apenas se forem relacionados com assobios",
      "warnings": 1,
      "enabled": false
    },
    "ADULT_CONTENT": {
      "code": "Art. 2.2",
      "description": "Conteúdo adulto - BAN DIRETO",
      "warnings": 0,
      "enabled": false
    },
    "DISRESPECT": {
      "code": "Art. 3.1",
      "description": "Falta de respeito entre membros",
      "warnings": 1,
      "enabled": false
    },
    "SPAM": {
      "code": "Art. 3.2",
      "description": "Spam não é permitido",
      "warnings": 1,
      "enabled": false
    }
  },
  "disrespectfulWords": ["idiota", "estúpido", "burro", "palhaço"],
  "spamLimit": 5,
  "spamTimeWindow": 60000
}
```

**⚠️ NOTA:** Todas as regras começam **desativadas** (`"enabled": false`) para segurança!

**Guardar:** Ctrl+X → Y → Enter

---

#### **📄 Ficheiro 3: database.json**

```bash
nano database.json
```
**► Enter**

**Cola isto:**

```json
{
  "warnings": {},
  "bans": {},
  "appeals": {},
  "stats": {
    "totalBans": 0,
    "totalWarnings": 0,
    "totalAppeals": 0
  }
}
```

**Guardar:** Ctrl+X → Y → Enter

---

#### **📄 Ficheiro 4: bot.js (CÓDIGO PRINCIPAL)**

```bash
nano bot.js
```
**► Enter**

**⚠️ ESTE É GRANDE! Cola TODO este código:**

<details>
<summary><b>👉 CLICA AQUI PARA VER O CÓDIGO COMPLETO DO bot.js</b></summary>

```javascript
const { makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const crypto = require('crypto');

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
let db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));

function saveConfig() {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

const activeConversations = {};
const messageHistory = {};
const pendingStickers = {};

// ===== RATE LIMITING - PROTEGER CONTA =====
let actionsThisMinute = 0;
const MAX_ACTIONS_PER_MIN = 15;

setInterval(() => {
    if (actionsThisMinute > 0) {
        console.log(`📊 Ações no último minuto: ${actionsThisMinute}`);
    }
    actionsThisMinute = 0;
}, 60000);

async function safeAction(actionName, actionFn) {
    if (actionsThisMinute >= MAX_ACTIONS_PER_MIN) {
        console.log(`⏸️ Rate limit - aguardando 60s...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        actionsThisMinute = 0;
    }
    
    actionsThisMinute++;
    
    const delay = Math.floor(Math.random() * 1500) + 500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`🤖 [${actionsThisMinute}/${MAX_ACTIONS_PER_MIN}] ${actionName}`);
    
    return await actionFn();
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconectando em 3s...');
                setTimeout(startBot, 3000);
            }
        } else if (connection === 'open') {
            console.log('✅ Bot conectado ao WhatsApp!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
            config.botNumber = sock.user.id.split(':')[0];
            saveConfig();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action === 'add') {
            const rulesText = Object.entries(config.rules)
                .filter(([_, rule]) => rule.enabled)
                .map(([_, rule]) => `${rule.code} - ${rule.description}`)
                .join('\n');
            
            if (rulesText) {
                await safeAction('Boas-vindas', async () => {
                    return sock.sendMessage(id, {
                        text: `📜 *BEM-VINDO!*\n\n*REGRAS:*\n${rulesText}\n\n🤖 Grupo com moderação automática.`,
                        mentions: participants
                    });
                });
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        if (!msg.message || msg.key.fromMe) return;
        
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const userId = msg.key.participant || msg.key.remoteJid;
        const userName = msg.pushName || 'Usuário';
        const userNumber = userId.split('@')[0];
        
        if (!isGroup) {
            await handlePrivateMessage(sock, msg, userId, userName, userNumber);
            return;
        }
        
        const groupId = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        const isAdmin = await checkAdmin(sock, groupId, userId);
        
        if (text.startsWith('!')) {
            if (isAdmin) {
                await handleAdminCommand(sock, groupId, userId, userName, text);
            }
            return;
        }
        
        if (isAdmin) {
            return;
        }
        
        if (config.rules.TEXT_NOT_ALLOWED.enabled && 
            (msg.message.conversation || msg.message.extendedTextMessage?.text)) {
            
            await handleViolation(sock, groupId, userId, userName, userNumber, 
                config.rules.TEXT_NOT_ALLOWED, msg, text);
            
            try {
                await safeAction('Apagar texto', async () => {
                    return sock.sendMessage(groupId, { delete: msg.key });
                });
            } catch (e) {}
            return;
        }
        
        if (config.rules.STICKER_WITHOUT_WHISTLE.enabled && msg.message.stickerMessage) {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const hash = getStickerHash(buffer);
            
            if (config.allowedStickers && config.allowedStickers.includes(hash)) {
                console.log(`✅ Sticker aprovado: ${hash.substring(0, 8)}...`);
                return;
            }
            
            console.log(`🆕 Novo sticker: ${hash.substring(0, 8)}...`);
            
            await requestStickerApproval(sock, groupId, userId, userName, userNumber, msg, buffer, hash);
            
            try {
                await safeAction('Apagar sticker', async () => {
                    await sock.sendMessage(groupId, { delete: msg.key });
                    return sock.sendMessage(groupId, {
                        text: `⏳ @${userNumber}, sticker a aguardar aprovação.`,
                        mentions: [userId]
                    });
                });
            } catch (e) {}
            
            return;
        }
        
        if (config.rules.DISRESPECT.enabled) {
            if (config.disrespectfulWords.some(word => text.toLowerCase().includes(word))) {
                await handleViolation(sock, groupId, userId, userName, userNumber,
                    config.rules.DISRESPECT, msg, text);
                
                try {
                    await safeAction('Apagar desrespeito', async () => {
                        return sock.sendMessage(groupId, { delete: msg.key });
                    });
                } catch (e) {}
                return;
            }
        }
        
        if (config.rules.SPAM.enabled && isSpamImproved(userId, text)) {
            await handleViolation(sock, groupId, userId, userName, userNumber,
                config.rules.SPAM, msg, text);
            return;
        }
    });
    
    global.whatsappSocket = sock;
}

function getStickerHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

async function requestStickerApproval(sock, groupId, userId, userName, userNumber, msg, buffer, hash) {
    if (!config.adminGroupId) {
        console.log('⚠️ adminGroupId não configurado');
        return;
    }
    
    const requestId = Date.now().toString();
    
    pendingStickers[requestId] = {
        userId,
        userName,
        userNumber,
        groupId,
        msgKey: msg.key,
        buffer,
        hash
    };
    
    let groupName = 'Grupo';
    try {
        const groupMeta = await sock.groupMetadata(groupId);
        groupName = groupMeta.subject;
    } catch (e) {}
    
    const approvalMsg = `🆕 *NOVO STICKER*\n\n👤 ${userName} (+${userNumber})\n🏠 ${groupName}\n🔑 ${hash.substring(0, 12)}...\n\n✅ !sim ${requestId}\n❌ !nao ${requestId}\n🚫 !ban ${requestId}`;
    
    try {
        await safeAction('Enviar aprovação sticker', async () => {
            await sock.sendMessage(config.adminGroupId, { text: approvalMsg });
            return sock.sendMessage(config.adminGroupId, { sticker: buffer });
        });
    } catch (e) {
        console.error('❌ Erro ao enviar para admins:', e.message);
    }
}

function isSpamImproved(userId, text) {
    const now = Date.now();
    
    if (!messageHistory[userId]) {
        messageHistory[userId] = [];
    }
    
    messageHistory[userId] = messageHistory[userId].filter(m => 
        now - m.time < config.spamTimeWindow
    );
    
    messageHistory[userId].push({ time: now, text });
    
    const recentMessages = messageHistory[userId];
    
    if (recentMessages.length > config.spamLimit) {
        console.log(`🚨 SPAM: ${recentMessages.length} msgs`);
        return true;
    }
    
    const duplicates = recentMessages.filter(m => m.text === text);
    if (duplicates.length >= 3) {
        console.log(`🚨 SPAM: ${duplicates.length} repetidas`);
        return true;
    }
    
    if (recentMessages.length >= 3) {
        const last3 = recentMessages.slice(-3);
        const interval = last3[2].time - last3[0].time;
        
        if (interval < 2000) {
            console.log(`🚨 SPAM: Flood (3 em ${interval}ms)`);
            return true;
        }
    }
    
    return false;
}

async function handlePrivateMessage(sock, msg, userId, userName, userNumber) {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    if (activeConversations[userId]) {
        const bannedUserId = activeConversations[userId];
        
        await safeAction('Encaminhar msg admin→banido', async () => {
            await sock.sendMessage(bannedUserId, {
                text: `💬 *Admin:*\n\n${text}`
            });
            return sock.sendMessage(userId, {
                text: `✅ Enviado. !encerrar para terminar.`
            });
        });
        
        return;
    }
    
    const adminInConversation = Object.keys(activeConversations).find(
        adminId => activeConversations[adminId] === userId
    );
    
    if (adminInConversation) {
        await safeAction('Encaminhar msg banido→admin', async () => {
            await sock.sendMessage(adminInConversation, {
                text: `💬 *Banido (+${userNumber}):*\n\n${text}`
            });
            return sock.sendMessage(userId, {
                text: `✅ Enviado para admin.`
            });
        });
        
        return;
    }
    
    const banInfo = db.bans[userId];
    
    if (!banInfo) {
        await safeAction('Msg boas-vindas DM', async () => {
            return sock.sendMessage(userId, {
                text: `👋 Olá! Sou o bot de moderação.`
            });
        });
        return;
    }
    
    if (!db.appeals[userId]) {
        db.appeals[userId] = {
            userName,
            userNumber,
            banReason: banInfo.rule.code,
            appealText: text,
            timestamp: new Date().toISOString(),
            status: 'pending',
            assignedAdmin: null
        };
        
        db.stats.totalAppeals++;
        saveDB();
        
        await safeAction('Confirmar apelação', async () => {
            return sock.sendMessage(userId, {
                text: `✅ *Apelação recebida!*\n\nBanido por: ${banInfo.rule.code}\n\n⏳ Aguarda.`
            });
        });
        
        await notifyAdminsOfAppeal(sock, userId, userName, userNumber, banInfo, text);
        
    } else {
        await safeAction('Status apelação', async () => {
            return sock.sendMessage(userId, {
                text: `⏳ Apelação enviada. Status: ${db.appeals[userId].status}`
            });
        });
    }
}

async function notifyAdminsOfAppeal(sock, userId, userName, userNumber, banInfo, appealText) {
    if (!config.adminGroupId) return;
    
    const appealMsg = `🔔 *APELAÇÃO*\n\n👤 ${userName} (+${userNumber})\n📜 ${banInfo.rule.code}\n💬 "${appealText}"\n\n!atender ${userNumber}`;
    
    await safeAction('Notificar apelação', async () => {
        return sock.sendMessage(config.adminGroupId, { text: appealMsg });
    });
}

async function handleAdminCommand(sock, groupId, userId, userName, text) {
    const args = text.split(' ');
    const command = args[0];
    
    switch(command) {
        case '!regras':
            let lista = '📋 *REGRAS:*\n\n';
            for (const [key, rule] of Object.entries(config.rules)) {
                const status = rule.enabled ? '✅' : '❌';
                lista += `${status} ${rule.code} - ${rule.description}\n`;
            }
            await safeAction('Listar regras', async () => {
                return sock.sendMessage(groupId, { text: lista });
            });
            break;
            
        case '!stats':
            const stats = `📊 *STATS*\n\nBans: ${db.stats.totalBans}\nWarnings: ${db.stats.totalWarnings}\nApelações: ${db.stats.totalAppeals}\nStickers OK: ${config.allowedStickers?.length || 0}`;
            await safeAction('Mostrar stats', async () => {
                return sock.sendMessage(groupId, { text: stats });
            });
            break;
            
        case '!ativar':
            if (args[1]) {
                const ruleKey = args[1].toUpperCase();
                if (config.rules[ruleKey]) {
                    config.rules[ruleKey].enabled = true;
                    saveConfig();
                    await safeAction('Ativar regra', async () => {
                        return sock.sendMessage(groupId, {
                            text: `✅ ${config.rules[ruleKey].code} ATIVADA`
                        });
                    });
                }
            }
            break;
            
        case '!desativar':
            if (args[1]) {
                const ruleKey = args[1].toUpperCase();
                if (config.rules[ruleKey]) {
                    config.rules[ruleKey].enabled = false;
                    saveConfig();
                    await safeAction('Desativar regra', async () => {
                        return sock.sendMessage(groupId, {
                            text: `❌ ${config.rules[ruleKey].code} DESATIVADA`
                        });
                    });
                }
            }
            break;
            
        case '!atender':
            if (args[1]) {
                const bannedNumber = args[1].replace('+', '');
                const bannedUserId = bannedNumber + '@s.whatsapp.net';
                
                if (db.appeals[bannedUserId] && db.appeals[bannedUserId].status === 'pending') {
                    activeConversations[userId] = bannedUserId;
                    db.appeals[bannedUserId].status = 'in_progress';
                    db.appeals[bannedUserId].assignedAdmin = userId;
                    saveDB();
                    
                    await safeAction('Iniciar conversa admin-banido', async () => {
                        await sock.sendMessage(userId, {
                            text: `✅ Conversa com +${bannedNumber}\n\n!encerrar para terminar.`
                        });
                        return sock.sendMessage(bannedUserId, {
                            text: `✅ Admin aceitou apelação!`
                        });
                    });
                }
            }
            break;
            
        case '!encerrar':
            if (activeConversations[userId]) {
                const bannedUserId = activeConversations[userId];
                delete activeConversations[userId];
                
                await safeAction('Encerrar conversa', async () => {
                    await sock.sendMessage(userId, { text: '✅ Conversa encerrada.' });
                    return sock.sendMessage(bannedUserId, { text: '✅ Conversa encerrada.' });
                });
            }
            break;
            
        case '!sim':
            if (args[1] && pendingStickers[args[1]]) {
                const data = pendingStickers[args[1]];
                
                if (!config.allowedStickers) {
                    config.allowedStickers = [];
                }
                config.allowedStickers.push(data.hash);
                saveConfig();
                
                await safeAction('Aprovar sticker', async () => {
                    await sock.sendMessage(groupId, {
                        text: `✅ Sticker aprovado de ${data.userName}`
                    });
                    return sock.sendMessage(data.userId, {
                        text: `✅ Sticker aprovado!`
                    });
                });
                
                delete pendingStickers[args[1]];
            }
            break;
            
        case '!nao':
            if (args[1] && pendingStickers[args[1]]) {
                const data = pendingStickers[args[1]];
                
                await handleViolation(sock, data.groupId, data.userId, data.userName, 
                    data.userNumber, config.rules.STICKER_WITHOUT_WHISTLE, 
                    { key: data.msgKey }, null, data.buffer, 'sticker');
                
                await safeAction('Rejeitar sticker', async () => {
                    return sock.sendMessage(groupId, {
                        text: `❌ Sticker rejeitado. Warning para ${data.userName}`
                    });
                });
                
                delete pendingStickers[args[1]];
            }
            break;
            
        case '!ban':
            if (args[1] && pendingStickers[args[1]]) {
                const data = pendingStickers[args[1]];
                
                await banUser(sock, data.groupId, data.userId, data.userName, 
                    data.userNumber, config.rules.STICKER_WITHOUT_WHISTLE, 
                    '[Sticker inapropriado]');
                
                await safeAction('Ban por sticker', async () => {
                    return sock.sendMessage(groupId, {
                        text: `🚫 ${data.userName} banido.`
                    });
                });
                
                delete pendingStickers[args[1]];
            }
            break;
    }
}

async function handleViolation(sock, groupId, userId, userName, userNumber, rule, msg, evidence, mediaBuffer, mediaType) {
    await logViolation(sock, groupId, userId, userName, userNumber, rule, msg, evidence, mediaBuffer, mediaType);
    
    if (!db.warnings[userId]) {
        db.warnings[userId] = 0;
    }
    
    db.warnings[userId]++;
    db.stats.totalWarnings++;
    saveDB();
    
    console.log(`⚠️ Warning ${db.warnings[userId]}/${rule.warnings} - ${userName} (${rule.code})`);
    
    if (db.warnings[userId] >= rule.warnings && rule.warnings > 0) {
        await banUser(sock, groupId, userId, userName, userNumber, rule, evidence);
    } else if (rule.warnings === 0) {
        await banUser(sock, groupId, userId, userName, userNumber, rule, evidence);
    } else {
        await safeAction('Enviar warning', async () => {
            return sock.sendMessage(groupId, {
                text: `⚠️ *AVISO ${db.warnings[userId]}/${rule.warnings}*\n\n@${userNumber}\n\n${rule.code}`,
                mentions: [userId]
            });
        });
    }
}

async function banUser(sock, groupId, userId, userName, userNumber, rule, evidence) {
    const timestamp = new Date().toISOString();
    
    db.bans[userId] = {
        userName,
        userNumber,
        rule,
        evidence,
        timestamp,
        groupId
    };
    
    db.stats.totalBans++;
    delete db.warnings[userId];
    saveDB();
    
    console.log(`🚫 BAN: ${userName} (+${userNumber}) - ${rule.code}`);
    
    await safeAction('Anunciar ban', async () => {
        return sock.sendMessage(groupId, {
            text: `🚫 *@${userNumber} BANIDO*\n\n📜 ${rule.code}`,
            mentions: [userId]
        });
    });
    
    try {
        await safeAction('Expulsar user', async () => {
            return sock.groupParticipantsUpdate(groupId, [userId], 'remove');
        });
    } catch (e) {
        console.error('❌ Erro ao expulsar:', e.message);
    }
    
    await sendBanNotification(sock, userId, userName, userNumber, rule, evidence, groupId);
}

async function sendBanNotification(sock, userId, userName, userNumber, rule, evidence, groupId) {
    let groupName = 'Grupo';
    try {
        const groupMeta = await sock.groupMetadata(groupId);
        groupName = groupMeta.subject;
    } catch (e) {}
    
    const notification = `🚫 *BANIDO*\n\n👤 ${userName}\n📱 +${userNumber}\n🏠 ${groupName}\n\n⚖️ ${rule.code}\n${rule.description}\n\n💬 ${evidence || '[Mídia]'}\n\n🕐 ${new Date().toLocaleString('pt-PT')}\n\n📮 Responde para apelar.`;
    
    try {
        await safeAction('Enviar DM ban', async () => {
            return sock.sendMessage(userId, { text: notification });
        });
    } catch (e) {}
}

async function logViolation(sock, groupId, userId, userName, userNumber, rule, msg, evidence, mediaBuffer, mediaType) {
    if (!config.logGroupId) return;
    
    let groupName = 'Grupo';
    try {
        const groupMeta = await sock.groupMetadata(groupId);
        groupName = groupMeta.subject;
    } catch (e) {}
    
    const report = `🚨 *VIOLAÇÃO*\n\n👤 ${userName} (+${userNumber})\n🏠 ${groupName}\n📜 ${rule.code}\n💬 ${evidence || '[Mídia]'}\n⚠️ ${db.warnings[userId] || 0}/${rule.warnings}`;
    
    try {
        await safeAction('Log violação', async () => {
            await sock.sendMessage(config.logGroupId, {
                text: report,
                mentions: [userId]
            });
            
            if (mediaBuffer && mediaType === 'sticker') {
                return sock.sendMessage(config.logGroupId, { sticker: mediaBuffer });
            }
        });
    } catch (e) {}
}

async function checkAdmin(sock, groupId, userId) {
    try {
        const groupMeta = await sock.groupMetadata(groupId);
        const participant = groupMeta.participants.find(p => p.id === userId);
        
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

console.log('🤖 Bot de Moderação WhatsApp');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Sistema com Rate Limiting');
console.log('⚡ Max 15 ações/minuto');
console.log('🛡️ Proteção contra ban\n');
startBot();
```

</details>

**Guardar:** Ctrl+X → Y → Enter

---

#### **📄 Ficheiro 5: server.js**

```bash
nano server.js
```
**► Enter**

**Cola isto:**

<details>
<summary><b>👉 CLICA PARA VER server.js</b></summary>

```javascript
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
let db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));

function saveConfig() {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

app.get('/api/config', (req, res) => {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    res.json(config);
});

app.post('/api/config', (req, res) => {
    config = { ...config, ...req.body };
    saveConfig();
    res.json({ success: true, config });
});

app.get('/api/stats', (req, res) => {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    res.json(db.stats);
});

app.get('/api/bans', (req, res) => {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const bans = Object.entries(db.bans).map(([userId, ban]) => ({
        userId,
        ...ban
    }));
    res.json(bans);
});

app.get('/api/appeals', (req, res) => {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const appeals = Object.entries(db.appeals).map(([userId, appeal]) => ({
        userId,
        ...appeal
    }));
    res.json(appeals);
});

app.post('/api/rules/:ruleKey/toggle', (req, res) => {
    const { ruleKey } = req.params;
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    if (config.rules[ruleKey]) {
        config.rules[ruleKey].enabled = !config.rules[ruleKey].enabled;
        saveConfig();
        res.json({ success: true, enabled: config.rules[ruleKey].enabled });
    } else {
        res.status(404).json({ error: 'Regra não encontrada' });
    }
});

app.post('/api/spam-config', (req, res) => {
    const { spamLimit, spamTimeWindow } = req.body;
    config.spamLimit = spamLimit;
    config.spamTimeWindow = spamTimeWindow;
    saveConfig();
    res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📱 Telemóvel: http://[IP_DO_PI]:${PORT}`);
});
```

</details>

**Guardar:** Ctrl+X → Y → Enter

---

### **Passo 8: Instalar Dependências**

```bash
npm install
```
**► Enter**  
**► AGUARDA 2-3 minutos**

**✅ Quando terminar, deve dizer:** `added XXX packages`

---

### **Passo 9: Instalar PM2 (Manter Bot Rodando)**

```bash
sudo npm install -g pm2
```
**► Enter**  
**► AGUARDA 1-2 minutos**

---

## 📱 PARTE 4: CONECTAR AO WHATSAPP

### **Passo 10: Iniciar Bot e Escanear QR**

```bash
node bot.js
```
**► Enter**

**VAI APARECER QR CODE GIGANTE NO ECRÃ!**

**No telemóvel:**

1. **Abre WhatsApp**
2. **Toca nos 3 pontos** (⋮) canto superior direito
3. **Dispositivos conectados**
4. **Conectar dispositivo**
5. **APONTA para o ecrã do PC** (QR code)
6. **ESCANEIA**

**✅ Quando ligar, vais ver:**
```
✅ Bot conectado ao WhatsApp!
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**⚠️ DEIXA A JANELA ABERTA por agora!**

---

### **Passo 11: Criar Grupos no WhatsApp**

**No telemóvel:**

**► Grupo 1: LOGS**

1. WhatsApp → **Novo grupo**
2. Nome: `[BOT] Logs`
3. **Adiciona o número do bot** (teu próprio número que conectaste)
4. Cria
5. **Info do grupo** → **Adicionar admins do grupo**
6. **Torna o bot ADMIN** ⭐

**► Grupo 2: ADMINS**

1. WhatsApp → **Novo grupo**
2. Nome: `[BOT] Admins`
3. **Adiciona o bot**
4. Adiciona outros admins humanos (se quiseres)
5. Cria

---

### **Passo 12: Descobrir IDs dos Grupos**

**No grupo [BOT] Logs:**

📱 Manda mensagem: `teste`

**💻 No PC, na janela PowerShell, vais ver algo tipo:**

```
ID do grupo: 120363023447234793@g.us
```

**✏️ COPIA ESSE ID!** (seleciona com rato, Ctrl+C)

**Repete para grupo [BOT] Admins**

📱 Manda `teste` no grupo Admins

💻 Copia o ID que aparecer

---

### **Passo 13: Configurar IDs**

**Na janela PowerShell (ainda no Pi):**

**► Para parar o bot:**
- Pressiona **Ctrl + C**

```bash
nano config.json
```
**► Enter**

**► Procura estas linhas no topo:**
```json
"logGroupId": "",
"adminGroupId": "",
```

**► Muda para:**
```json
"logGroupId": "120363023447234793@g.us",
"adminGroupId": "120363555555555555@g.us",
```
(usa os IDs que copiaste!)

**Guardar:** Ctrl+X → Y → Enter

---

## 🚀 PARTE 5: INICIAR AUTOMATICAMENTE

### **Passo 14: PM2 Setup**

```bash
pm2 start bot.js --name whatsapp-bot
```
**► Enter**

```bash
pm2 start server.js --name dashboard
```
**► Enter**

```bash
pm2 save
```
**► Enter**

```bash
pm2 startup
```
**► Enter**

**► Vai aparecer um comando tipo:**
```
sudo env PATH=...
```

**► COPIA esse comando TODO**  
**► COLA na PowerShell**  
**► Enter**

**✅ PRONTO! Bot roda sempre, mesmo se desligares o Pi!**

---

## 🎮 PARTE 6: TESTAR

### **Passo 15: Criar Grupo de Teste**

📱 **WhatsApp:**

1. **Novo grupo:** `Teste Bot`
2. **Adiciona o bot**
3. **Torna bot ADMIN** ⭐ (MUITO IMPORTANTE!)

---

### **Passo 16: Ativar 1 Regra para Testar**

**💻 No grupo Teste Bot:**

Manda (como admin):
```
!ativar SPAM
```

**✅ Bot responde:** `✅ Art. 3.2 ATIVADA`

---

### **Passo 17: Testar Spam**

**📱 Manda 6 mensagens rápidas:**

```
1
2
3
4
5
6
```

**✅ Na 6ª, bot dá warning!**

**📱 Manda mais 6:**

```
7
8
9
10
11
12
```

**✅ FOSTE EXPULSO! 🎉**

**📱 Vais receber DM do bot** com toda a documentação!

**📱 Responde algo tipo:** `foi engano!`

**✅ Grupo de admins recebe apelação!**

---

## 📊 PARTE 7: DASHBOARD

### **Passo 18: Ver Dashboard**

**💻 No Pi:**

```bash
hostname -I
```
**► Enter**

**Copia o IP** (ex: `192.168.1.150`)

**No browser do PC/telemóvel:**

Vai a: `http://192.168.1.150:3000`

**✅ DASHBOARD ABERTO!** 🎉

---

## 🎓 COMANDOS DO BOT

### **Comandos de Admin (no grupo):**

```
!regras          → Ver todas as regras
!stats           → Estatísticas
!ativar SPAM     → Ativar regra SPAM
!ativar TEXT_NOT_ALLOWED → Ativar bloqueio texto
!desativar SPAM  → Desativar regra
!atender 351XXXX → Atender apelação
!encerrar        → Terminar conversa
!sim 123456      → Aprovar sticker
!nao 123456      → Rejeitar sticker
!ban 123456      → Ban direto por sticker
```

### **Regras disponíveis:**

```
TEXT_NOT_ALLOWED         → Bloqueia texto
STICKER_WITHOUT_WHISTLE  → Controla stickers
SPAM                     → Anti-spam
DISRESPECT               → Palavrões
ADULT_CONTENT            → Conteúdo adulto (precisa API)
```

---

## 🆘 COMANDOS ÚTEIS DO PI

### **Ver logs do bot:**
```bash
pm2 logs whatsapp-bot
```

### **Reiniciar bot:**
```bash
pm2 restart whatsapp-bot
```

### **Parar bot:**
```bash
pm2 stop whatsapp-bot
```

### **Ver status:**
```bash
pm2 list
```

### **Editar config:**
```bash
cd ~/whatsapp-bot
nano config.json
```

---

## ✅ CHECKLIST FINAL

- [ ] Raspberry Pi ligado
- [ ] Bot conectado (QR escaneado)
- [ ] 2 grupos criados (Logs + Admins)
- [ ] IDs configurados no config.json
- [ ] PM2 rodando (bot + dashboard)
- [ ] Bot é admin no grupo de teste
- [ ] Testaste SPAM e funcionou
- [ ] Recebeste DM quando foste banido
- [ ] Dashboard abre no browser

---

## 🎉 PARABÉNS!

**O teu bot está RODANDO 24/7!**

**⚠️ LEMBRA-TE:**
- Todas as regras começam **DESATIVADAS**
- Ativa com `!ativar NOME_DA_REGRA`
- Bot tem **rate limiting** (max 15 ações/min)
- **Bot precisa ser ADMIN** para expulsar!

---

**Algum erro? Manda print do erro e ajudo-te! 🚀**
