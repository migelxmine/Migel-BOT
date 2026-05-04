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
                        text: `🦜 Prezado membro, seja muito bem-vindo ao presente grupo. No âmbito da manutenção da ordem e do cumprimento das normas estabelecidas, informamos que este espaço é supervisionado por um sistema automatizado de moderação. Solicitamos a vossa atenção para o regulamento interno, cujos artigos se encontram discriminados de seguida. O incumprimento das referidas disposições resultará na aplicação de sanções, incluindo advertências formais e, em casos reincidentes ou de maior gravidade, a remoção imediata do grupo. Agradecemos antecipadamente a vossa colaboração e desejamos uma participação construtiva e respeitosa.\n\n*REGULAMENTO INTERNO:*\n${rulesText}\n\n🦜`,
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
                        text: `🦜 Prezado membro @${userNumber}, informamos que o sticker por vós submetido se encontra neste momento sob análise pela administração deste grupo. Até à conclusão do processo de aprovação, o referido conteúdo permanecerá temporariamente indisponível. Solicitamos a vossa compreensão e paciência enquanto os responsáveis procedem à devida avaliação, tendo em conta os critérios de adequação e conformidade com as normas vigentes no presente espaço. Ser-vos-á comunicada a decisão final assim que a análise estiver concluída. Agradecemos a vossa colaboração. 🦜`,
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
                        text: `🦜 Prezado membro, vimos por este meio informar que o sticker por vós submetido foi devidamente analisado pela administração e mereceu aprovação favorável. A partir deste momento, encontra-se autorizado a utilizar o referido sticker no presente grupo, sem quaisquer restrições. Agradecemos o vosso respeito pelas normas estabelecidas e pela paciência demonstrada durante o processo de análise. Desejamos que continue a contribuir de forma positiva para a boa convivência neste espaço. 🦜`
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
                text: `🦜 Prezado membro @${userNumber}, cumpre-nos informar que foi registada uma infração ao regulamento interno deste grupo, conforme especificado no artigo ${rule.code}, que estabelece o seguinte: "${rule.description}". Em conformidade com o sistema disciplinar em vigor, a presente comunicação constitui a ${db.warnings[userId] === 1 ? 'primeira' : 'segunda'} advertência formal que lhe é dirigida. Importa salientar que, nos termos do Artigo 5.1 do regulamento, o incumprimento reiterado das normas estabelecidas resultará na aplicação de sanções, podendo culminar na vossa remoção do grupo. ${db.warnings[userId] === rule.warnings - 1 ? 'Alertamos que se encontra no limite de advertências permitidas, pelo que qualquer nova violação acarretará a imediata expulsão do grupo.' : ''} Solicitamos que tome conhecimento da gravidade da situação e que, doravante, passe a observar rigorosamente todas as disposições regulamentares. Agradecemos a vossa atenção e esperamos não ter de voltar a dirigir-vos qualquer comunicação desta natureza. 🦜`,
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
           text: `🦜 Prezados membros, vimos por este meio comunicar que o utilizador @${userNumber} foi objeto de remoção do presente grupo, em consequência do incumprimento do disposto no ${rule.code} do regulamento interno, o qual estabelece que "${rule.description}". Conforme previsto no Artigo 5.1, que estipula que "o incumprimento das regras resulta em ban", a decisão foi tomada de forma automática pelo sistema de moderação, após constatação inequívoca da infração. Esta medida visa preservar a ordem, o respeito mútuo e o cumprimento das normas que regem este espaço. Reiteramos a todos os membros a importância de observarem escrupulosamente o regulamento estabelecido, a fim de evitarem situações idênticas. Agradecemos a vossa compreensão e colaboração. 🦜`,
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
