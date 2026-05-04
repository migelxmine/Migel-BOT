const {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');

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
        console.log(`⏸️ Rate limit atingido — a aguardar 60s...`);
        await new Promise(resolve => setTimeout(resolve, 60000));
        actionsThisMinute = 0;
    }

    actionsThisMinute++;

    const delay = Math.floor(Math.random() * 1500) + 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`🤖 [${actionsThisMinute}/${MAX_ACTIONS_PER_MIN}] ${actionName}`);

    return await actionFn();
}

function getStickerHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

function shouldModerateGroup(groupId) {
    if (config.mainGroupId) {
        return groupId === config.mainGroupId;
    }

    if (Array.isArray(config.allowedGroups) && config.allowedGroups.length > 0) {
        return config.allowedGroups.includes(groupId);
    }

    return true;
}

function cleanupPendingSticker(requestId) {
    if (pendingStickers[requestId]) {
        delete pendingStickers[requestId];
    }
}

function schedulePendingStickerCleanup(requestId, minutes = 10) {
    setTimeout(() => cleanupPendingSticker(requestId), minutes * 60 * 1000);
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
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('🔄 Reconectar em 3 segundos...');
                setTimeout(startBot, 3000);
            }
        } else if (connection === 'open') {
            console.log('✅ Bot ligado ao WhatsApp!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');

            if (sock.user?.id) {
                config.botNumber = sock.user.id.split(':')[0];
                saveConfig();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (action !== 'add') return;
        if (!shouldModerateGroup(id)) return;

        const rulesText = Object.entries(config.rules || {})
            .filter(([_, rule]) => rule.enabled)
            .map(([_, rule]) => `${rule.code} - ${rule.description}`)
            .join('\n');

        if (!rulesText) return;

        await safeAction('Boas-vindas', async () => {
            return sock.sendMessage(id, {
                text:
                    `🦜 Prezado membro, seja muito bem-vindo ao presente grupo. No âmbito da manutenção da ordem e do cumprimento das normas estabelecidas, informamos que este espaço é supervisionado por um sistema automatizado de moderação. Solicitamos a vossa atenção para o regulamento interno, cujos artigos se encontram discriminados de seguida. O incumprimento das referidas disposições resultará na aplicação de sanções, incluindo advertências formais e, em casos reincidentes ou de maior gravidade, a remoção imediata do grupo. Agradecemos antecipadamente a vossa colaboração e desejamos uma participação construtiva e respeitosa.\n\n` +
                    `*REGULAMENTO INTERNO:*\n${rulesText}\n\n🦜`,
                mentions: participants
            });
        });
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg?.message || msg.key?.fromMe) return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const userId = msg.key.participant || msg.key.remoteJid;
        const userName = msg.pushName || 'Utilizador';
        const userNumber = userId.split('@')[0];

        if (!isGroup) {
            await handlePrivateMessage(sock, msg, userId, userName, userNumber);
            return;
        }

        const groupId = msg.key.remoteJid;

        if (!shouldModerateGroup(groupId)) {
            return;
        }

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const isAdmin = await checkAdmin(sock, groupId, userId);

        if (text.startsWith('!')) {
            if (isAdmin) {
                await handleAdminCommand(sock, groupId, userId, userName, text);
            }
            return;
        }

        if (isAdmin) return;

        if (config.rules?.TEXT_NOT_ALLOWED?.enabled &&
            (msg.message.conversation || msg.message.extendedTextMessage?.text)) {

            await handleViolation(
                sock,
                groupId,
                userId,
                userName,
                userNumber,
                config.rules.TEXT_NOT_ALLOWED,
                msg,
                text
            );

            try {
                await safeAction('Apagar texto', async () => {
                    return sock.sendMessage(groupId, { delete: msg.key });
                });
            } catch (e) {}

            return;
        }

        if (config.rules?.STICKER_WITHOUT_WHISTLE?.enabled && msg.message.stickerMessage) {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const hash = getStickerHash(buffer);

            if (Array.isArray(config.allowedStickers) && config.allowedStickers.includes(hash)) {
                console.log(`✅ Sticker aprovado: ${hash.substring(0, 8)}...`);
                return;
            }

            console.log(`🆕 Novo sticker: ${hash.substring(0, 8)}...`);

            await requestStickerApproval(
                sock,
                groupId,
                userId,
                userName,
                userNumber,
                msg,
                buffer,
                hash
            );

            try {
                await safeAction('Apagar sticker', async () => {
                    await sock.sendMessage(groupId, { delete: msg.key });
                    return sock.sendMessage(groupId, {
                        text:
                            `🦜 Prezado membro @${userNumber}, informamos que o sticker por vós submetido se encontra neste momento sob análise pela administração deste grupo. Até à conclusão do processo de aprovação, o referido conteúdo permanecerá temporariamente indisponível. Solicitamos a vossa compreensão e paciência enquanto os responsáveis procedem à devida avaliação, tendo em conta os critérios de adequação e conformidade com as normas vigentes no presente espaço. Ser-vos-á comunicada a decisão final assim que a análise estiver concluída. Agradecemos a vossa colaboração. 🦜`,
                        mentions: [userId]
                    });
                });
            } catch (e) {}

            return;
        }

        if (config.rules?.DISRESPECT?.enabled) {
            const words = Array.isArray(config.disrespectfulWords) ? config.disrespectfulWords : [];
            if (words.some(word => text.toLowerCase().includes(word.toLowerCase()))) {
                await handleViolation(
                    sock,
                    groupId,
                    userId,
                    userName,
                    userNumber,
                    config.rules.DISRESPECT,
                    msg,
                    text
                );

                try {
                    await safeAction('Apagar desrespeito', async () => {
                        return sock.sendMessage(groupId, { delete: msg.key });
                    });
                } catch (e) {}

                return;
            }
        }

        if (config.rules?.SPAM?.enabled && isSpamImproved(userId, text)) {
            await handleViolation(
                sock,
                groupId,
                userId,
                userName,
                userNumber,
                config.rules.SPAM,
                msg,
                text
            );
        }
    });

    global.whatsappSocket = sock;
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

    schedulePendingStickerCleanup(requestId, 10);

    let groupName = 'Grupo';
    try {
        const groupMeta = await sock.groupMetadata(groupId);
        groupName = groupMeta.subject;
    } catch (e) {}

    const approvalMsg =
        `🆕 *NOVO STICKER*\n\n` +
        `👤 ${userName} (+${userNumber})\n` +
        `🏠 ${groupName}\n` +
        `🔑 ${hash.substring(0, 12)}...\n\n` +
        `✅ !sim ${requestId}\n` +
        `❌ !nao ${requestId}\n` +
        `🚫 !ban ${requestId}`;

    try {
        await safeAction('Enviar sticker para aprovação', async () => {
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

    const windowMs = Number(config.spamTimeWindow) || 60000;

    messageHistory[userId] = messageHistory[userId].filter(m => now - m.time < windowMs);
    messageHistory[userId].push({ time: now, text });

    const recentMessages = messageHistory[userId];

    if (recentMessages.length > (Number(config.spamLimit) || 5)) {
        console.log(`🚨 SPAM: ${recentMessages.length} mensagens`);
        return true;
    }

    const duplicates = recentMessages.filter(m => m.text === text);
    if (duplicates.length >= 3) {
        console.log(`🚨 SPAM: ${duplicates.length} mensagens repetidas`);
        return true;
    }

    if (recentMessages.length >= 3) {
        const last3 = recentMessages.slice(-3);
        const interval = last3[2].time - last3[0].time;

        if (interval < 2000) {
            console.log(`🚨 SPAM: Flood (3 mensagens em ${interval}ms)`);
            return true;
        }
    }

    return false;
}

async function handlePrivateMessage(sock, msg, userId, userName, userNumber) {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (activeConversations[userId]) {
        const bannedUserId = activeConversations[userId];

        await safeAction('Encaminhar mensagem admin→utilizador', async () => {
            await sock.sendMessage(bannedUserId, {
                text: `🦜 Mensagem recebida da administração do grupo:\n\n${text}\n\n🦜`
            });
            return sock.sendMessage(userId, {
                text: `🦜 A vossa mensagem foi devidamente encaminhada para o utilizador. Para encerrar a presente comunicação, utilize o comando !encerrar. 🦜`
            });
        });

        return;
    }

    const adminInConversation = Object.keys(activeConversations).find(
        adminId => activeConversations[adminId] === userId
    );

    if (adminInConversation) {
        await safeAction('Encaminhar mensagem utilizador→admin', async () => {
            await sock.sendMessage(adminInConversation, {
                text: `🦜 Mensagem recebida do utilizador banido (+${userNumber}):\n\n${text}\n\n🦜`
            });
            return sock.sendMessage(userId, {
                text: `🦜 A vossa mensagem foi devidamente encaminhada para o administrador responsável pela análise da vossa apelação. Aguarde resposta. 🦜`
            });
        });

        return;
    }

    const banInfo = db.bans[userId];

    if (!banInfo) {
        await safeAction('Mensagem de boas-vindas', async () => {
            return sock.sendMessage(userId, {
                text:
                    `🦜 Prezado utilizador, seja bem-vindo ao sistema automatizado de moderação. O presente serviço foi concebido para assegurar o cumprimento das normas estabelecidas nos grupos geridos por esta plataforma. Caso tenha sido objeto de alguma medida disciplinar, ser-lhe-ão fornecidas todas as informações e instruções necessárias de forma automática. Agradecemos a vossa atenção. 🦜`
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
                text:
                    `🦜 Prezado utilizador, acusamos a recepção da vossa apelação relativamente à decisão de remoção do grupo, fundamentada na violação do ${banInfo.rule.code} do regulamento interno. Informamos que o vosso pedido de revisão foi devidamente registado no sistema e encontra-se neste momento pendente de análise por parte da administração do grupo. Os responsáveis irão proceder à avaliação criteriosa dos argumentos por vós apresentados, à luz das circunstâncias concretas da infração e do historial de participação no grupo. Solicitamos que aguarde pacientemente pela resposta, a qual será comunicada assim que a administração conclua a sua deliberação. Agradecemos a vossa compreensão e reiteramos o nosso compromisso com a aplicação justa e equitativa das normas estabelecidas. 🦜`
            });
        });

        await notifyAdminsOfAppeal(sock, userId, userName, userNumber, banInfo, text);
    } else {
        await safeAction('Estado da apelação', async () => {
            return sock.sendMessage(userId, {
                text: `⏳ Apelação enviada. Estado: ${db.appeals[userId].status}`
            });
        });
    }
}

async function notifyAdminsOfAppeal(sock, userId, userName, userNumber, banInfo, appealText) {
    if (!config.adminGroupId) return;

    const appealMsg =
        `🦜 Prezados administradores, cumpre-nos informar que foi submetida uma apelação por parte do utilizador ${userName}, portador do número de contacto +${userNumber}, relativamente à decisão de expulsão do grupo motivada pela infração ao ${banInfo.rule.code} do regulamento interno.\n\n` +
        `O utilizador em causa apresentou os seguintes argumentos em sua defesa: "${appealText}".\n\n` +
        `A apelação encontra-se registada no sistema com a data de ${new Date(banInfo.timestamp).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'full', timeStyle: 'long' })} e aguarda deliberação por parte da administração.\n\n` +
        `Caso algum dos responsáveis deseje assumir a condução do processo de análise e estabelecer comunicação direta com o apelante, deverá utilizar o comando !atender ${userNumber} para iniciar o diálogo. Agradecemos a vossa atenção e disponibilidade para a resolução desta questão. 🦜`;

    await safeAction('Notificar apelação', async () => {
        return sock.sendMessage(config.adminGroupId, { text: appealMsg });
    });
}

async function handleAdminCommand(sock, groupId, userId, userName, text) {
    const args = text.trim().split(/\s+/);
    const command = (args[0] || '').toLowerCase();

    switch (command) {
        case '!regras': {
            let lista = '📋 *REGRAS:*\n\n';
            for (const [_, rule] of Object.entries(config.rules || {})) {
                const status = rule.enabled ? '✅' : '❌';
                lista += `${status} ${rule.code} - ${rule.description}\n`;
            }

            await safeAction('Listar regras', async () => {
                return sock.sendMessage(groupId, { text: lista });
            });
            break;
        }

        case '!stats': {
            const stats =
                `📊 *STATS*\n\n` +
                `Bans: ${db.stats.totalBans}\n` +
                `Warnings: ${db.stats.totalWarnings}\n` +
                `Apelações: ${db.stats.totalAppeals}\n` +
                `Stickers OK: ${Array.isArray(config.allowedStickers) ? config.allowedStickers.length : 0}`;

            await safeAction('Mostrar stats', async () => {
                return sock.sendMessage(groupId, { text: stats });
            });
            break;
        }

        case '!ativar': {
            if (args[1]) {
                const ruleKey = args[1].toUpperCase();
                if (config.rules?.[ruleKey]) {
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
        }

        case '!desativar': {
            if (args[1]) {
                const ruleKey = args[1].toUpperCase();
                if (config.rules?.[ruleKey]) {
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
        }

        case '!atender': {
            if (args[1]) {
                const bannedNumber = args[1].replace('+', '');
                const bannedUserId = bannedNumber + '@s.whatsapp.net';

                if (db.appeals[bannedUserId] && db.appeals[bannedUserId].status === 'pending') {
                    activeConversations[userId] = bannedUserId;
                    db.appeals[bannedUserId].status = 'in_progress';
                    db.appeals[bannedUserId].assignedAdmin = userId;
                    saveDB();

                    await safeAction('Iniciar conversa admin→utilizador', async () => {
                        await sock.sendMessage(userId, {
                            text:
                                `🦜 Prezado administrador, informamos que foi estabelecida com sucesso a ligação de comunicação direta com o utilizador +${bannedNumber}, que se encontra a aguardar a análise da sua apelação. A partir deste momento, todas as mensagens que dirigir ao presente sistema serão automaticamente encaminhadas para o utilizador em questão, permitindo-lhe conduzir o diálogo de forma privada e confidencial. Quando pretender encerrar a comunicação, deverá utilizar o comando !encerrar. Agradecemos o vosso empenho na resolução justa e ponderada desta situação. 🦜`
                        });

                        return sock.sendMessage(bannedUserId, {
                            text:
                                `🦜 Prezado utilizador, temos o prazer de informar que um membro da administração do grupo aceitou proceder à análise da vossa apelação e encontra-se disponível para estabelecer um diálogo direto convosco. A partir deste momento, poderá expor de forma mais detalhada as vossas razões e esclarecer quaisquer dúvidas ou mal-entendidos relativos à situação que motivou a vossa expulsão. Todas as mensagens que enviar ao presente sistema serão encaminhadas para o administrador responsável, que responderá às vossas questões e deliberará sobre a eventual revisão da decisão. Solicitamos que mantenha um tom respeitoso e construtivo ao longo de todo o processo. Agradecemos a vossa colaboração. 🦜`
                        });
                    });
                } else {
                    await sock.sendMessage(groupId, {
                        text: '⚠️ Não foi encontrada uma apelação pendente para esse número.'
                    });
                }
            }
            break;
        }

        case '!encerrar': {
            if (activeConversations[userId]) {
                const bannedUserId = activeConversations[userId];
                delete activeConversations[userId];

                await safeAction('Encerrar conversa', async () => {
                    await sock.sendMessage(userId, { text: '✅ Conversa encerrada.' });
                    return sock.sendMessage(bannedUserId, { text: '✅ Conversa encerrada.' });
                });
            }
            break;
        }

        case '!sim': {
            if (args[1] && pendingStickers[args[1]]) {
                const data = pendingStickers[args[1]];

                if (!Array.isArray(config.allowedStickers)) {
                    config.allowedStickers = [];
                }

                if (!config.allowedStickers.includes(data.hash)) {
                    config.allowedStickers.push(data.hash);
                    saveConfig();
                }

                await safeAction('Aprovar sticker', async () => {
                    await sock.sendMessage(groupId, {
                        text: `✅ Sticker aprovado de ${data.userName}`
                    });
                    return sock.sendMessage(data.userId, {
                        text: `✅ Sticker aprovado!`
                    });
                });

                cleanupPendingSticker(args[1]);
            }
            break;
        }

        case '!nao': {
            if (args[1] && pendingStickers[args[1]]) {
                const data = pendingStickers[args[1]];

                await handleViolation(
                    sock,
                    data.groupId,
                    data.userId,
                    data.userName,
                    data.userNumber,
                    config.rules.STICKER_WITHOUT_WHISTLE,
                    { key: data.msgKey },
                    null,
                    data.buffer,
                    'sticker'
                );

                await safeAction('Rejeitar sticker', async () => {
                    return sock.sendMessage(groupId, {
                        text: `❌ Sticker rejeitado. Warning aplicado a ${data.userName}`
                    });
                });

                cleanupPendingSticker(args[1]);
            }
            break;
        }

        case '!ban': {
            if (args[1] && pendingStickers[args[1]]) {
                const data = pendingStickers[args[1]];

                await banUser(
                    sock,
                    data.groupId,
                    data.userId,
                    data.userName,
                    data.userNumber,
                    config.rules.STICKER_WITHOUT_WHISTLE,
                    '[Sticker inapropriado]'
                );

                await safeAction('Ban por sticker', async () => {
                    return sock.sendMessage(groupId, {
                        text: `🚫 ${data.userName} banido.`
                    });
                });

                cleanupPendingSticker(args[1]);
            }
            break;
        }

        case '!setmain': {
            config.mainGroupId = groupId;
            config.allowedGroups = [];
            saveConfig();

            let groupName = 'este grupo';
            try {
                const groupMeta = await sock.groupMetadata(groupId);
                groupName = groupMeta.subject;
            } catch (e) {}

            await safeAction('Definir grupo principal', async () => {
                return sock.sendMessage(groupId, {
                    text:
                        `🦜 Prezados administradores, informamos que o grupo "${groupName}" foi formalmente registado como grupo principal para efeitos de moderação automatizada. A partir deste momento, o sistema de moderação encontra-se ativo e operacional exclusivamente neste espaço, ignorando quaisquer outros grupos nos quais o bot possa estar presente. Agradecemos a vossa atenção. 🦜`
                });
            });
            break;
        }

        case '!clearmain': {
            config.mainGroupId = '';
            saveConfig();

            await safeAction('Limpar grupo principal', async () => {
                return sock.sendMessage(groupId, {
                    text: '✅ Grupo principal removido.'
                });
            });
            break;
        }

        case '!addgroup': {
            if (!Array.isArray(config.allowedGroups)) {
                config.allowedGroups = [];
            }

            if (!config.allowedGroups.includes(groupId)) {
                config.allowedGroups.push(groupId);
                config.mainGroupId = '';
                saveConfig();

                await safeAction('Adicionar grupo à lista', async () => {
                    return sock.sendMessage(groupId, {
                        text:
                            `🦜 Prezados administradores, informamos que este grupo foi adicionado à lista de grupos sob moderação ativa. O sistema encontra-se agora operacional neste espaço. Total de grupos moderados: ${config.allowedGroups.length}. 🦜`
                    });
                });
            } else {
                await sock.sendMessage(groupId, {
                    text: `🦜 Este grupo já se encontra registado na lista de moderação. 🦜`
                });
            }
            break;
        }

        case '!removegroup': {
            if (Array.isArray(config.allowedGroups) && config.allowedGroups.includes(groupId)) {
                config.allowedGroups = config.allowedGroups.filter(id => id !== groupId);
                saveConfig();

                await safeAction('Remover grupo da lista', async () => {
                    return sock.sendMessage(groupId, {
                        text:
                            `🦜 Prezados administradores, informamos que este grupo foi removido da lista de moderação ativa. O bot continuará presente mas não atuará sobre violações. 🦜`
                    });
                });
            } else {
                await sock.sendMessage(groupId, {
                    text: `🦜 Este grupo não se encontra na lista de moderação. 🦜`
                });
            }
            break;
        }

        case '!listgroups': {
            let groupsList = '🦜 *GRUPOS SOB MODERAÇÃO:*\n\n';

            if (config.mainGroupId) {
                try {
                    const meta = await sock.groupMetadata(config.mainGroupId);
                    groupsList += `📍 Grupo principal: ${meta.subject}\n`;
                } catch (e) {
                    groupsList += `📍 Grupo principal: ${config.mainGroupId}\n`;
                }
            } else if (Array.isArray(config.allowedGroups) && config.allowedGroups.length > 0) {
                for (const gid of config.allowedGroups) {
                    try {
                        const meta = await sock.groupMetadata(gid);
                        groupsList += `• ${meta.subject}\n`;
                    } catch (e) {
                        groupsList += `• ${gid}\n`;
                    }
                }
            } else {
                groupsList += 'Nenhum grupo configurado (moderação ativa em TODOS os grupos).\n';
            }

            groupsList += '\n🦜';

            await safeAction('Listar grupos', async () => {
                return sock.sendMessage(groupId, { text: groupsList });
            });
            break;
        }

        default:
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
                text:
                    `🦜 Prezado membro @${userNumber}, cumpre-nos informar que foi registada uma infração ao regulamento interno deste grupo, conforme especificado no artigo ${rule.code}, que estabelece o seguinte: "${rule.description}". Em conformidade com o sistema disciplinar em vigor, a presente comunicação constitui a ${db.warnings[userId] === 1 ? 'primeira' : 'segunda'} advertência formal que lhe é dirigida. Importa salientar que, nos termos do Artigo 5.1 do regulamento, o incumprimento reiterado das normas estabelecidas resultará na aplicação de sanções, podendo culminar na vossa remoção do grupo. ${db.warnings[userId] === rule.warnings - 1 ? 'Alertamos que se encontra no limite de advertências permitidas, pelo que qualquer nova violação acarretará a imediata expulsão do grupo.' : ''} Solicitamos que tome conhecimento da gravidade da situação e que, doravante, passe a observar rigorosamente todas as disposições regulamentares. Agradecemos a vossa atenção e esperamos não ter de voltar a dirigir-vos qualquer comunicação desta natureza. 🦜`,
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
            text:
                `🦜 Prezados membros, vimos por este meio comunicar que o utilizador @${userNumber} foi objeto de remoção do presente grupo, em consequência do incumprimento do disposto no ${rule.code} do regulamento interno, o qual estabelece que "${rule.description}". Conforme previsto no Artigo 5.1, que estipula que "o incumprimento das regras resulta em ban", a decisão foi tomada de forma automática pelo sistema de moderação, após constatação inequívoca da infração. Esta medida visa preservar a ordem, o respeito mútuo e o cumprimento das normas que regem este espaço. Reiteramos a todos os membros a importância de observarem escrupulosamente o regulamento estabelecido, a fim de evitarem situações idênticas. Agradecemos a vossa compreensão e colaboração. 🦜`,
            mentions: [userId]
        });
    });

    try {
        await safeAction('Expulsar utilizador', async () => {
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

    const notification =
        `🦜 Prezado utilizador ${userName}, vimos por este meio notificá-lo formalmente de que foi objeto de remoção do grupo "${groupName}", em consequência do incumprimento do regulamento interno que rege o referido espaço. A presente decisão fundamenta-se na violação do ${rule.code}, que estabelece expressamente o seguinte: "${rule.description}". De acordo com o sistema disciplinar em vigor, conforme previsto no Artigo 5.1 do regulamento, que estipula que "o incumprimento das regras resulta em ban", a medida de expulsão foi aplicada de forma automática pelo sistema de moderação.\n\n` +
        `*DADOS DA OCORRÊNCIA:*\n` +
        `Nome do utilizador: ${userName}\n` +
        `Número de contacto: +${userNumber}\n` +
        `Grupo de origem: ${groupName}\n` +
        `Artigo infringido: ${rule.code} - ${rule.description}\n` +
        `Evidência registada: ${evidence || 'Conteúdo multimédia anexado ao processo'}\n` +
        `Data e hora da infração: ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'full', timeStyle: 'long' })}\n\n` +
        `*DIREITO DE APELAÇÃO:*\n` +
        `Caso entenda que a decisão ora comunicada foi tomada de forma injusta ou que existem circunstâncias atenuantes que não foram devidamente consideradas, fica salvaguardado o vosso direito de apresentar uma apelação. Para tal, deverá responder à presente mensagem, expondo de forma clara e fundamentada as razões pelas quais considera que a sanção não deveria ter sido aplicada. A vossa apelação será encaminhada para a administração do grupo, que procederá à sua análise e deliberará sobre a eventual revisão da decisão. Alertamos que apelações infundadas, ofensivas ou que não respeitem o devido decoro poderão resultar em sanções adicionais, incluindo a impossibilidade de readmissão no grupo em causa. Agradecemos a vossa atenção e compreensão relativamente à aplicação das normas estabelecidas. 🦜`;

    try {
        await safeAction('Enviar DM do ban', async () => {
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

    const report =
        `🚨 *VIOLAÇÃO*\n\n` +
        `👤 ${userName} (+${userNumber})\n` +
        `🏠 ${groupName}\n` +
        `📜 ${rule.code}\n` +
        `💬 ${evidence || '[Mídia]'}\n` +
        `⚠️ ${db.warnings[userId] || 0}/${rule.warnings}`;

    try {
        await safeAction('Registar violação', async () => {
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

        return !!(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
    } catch (e) {
        return false;
    }
}

console.log('🤖 Bot de Moderação WhatsApp');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Sistema com Rate Limiting');
console.log('⚡ Máximo de 15 ações por minuto');
console.log('🛡️ Proteção contra ban\n');

startBot();    
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

// ===== FILTRO DE GRUPOS - SÓ MODERAR GRUPOS PERMITIDOS =====
if (config.mainGroupId && groupId !== config.mainGroupId) {
    return; // Ignora grupos que não sejam o principal
}

if (config.allowedGroups && config.allowedGroups.length > 0 && !config.allowedGroups.includes(groupId)) {
    return; // Ignora grupos que não estejam na lista
}
// ============================================================

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
                text: `🦜 Mensagem recebida da administração do grupo:\n\n${text}\n\n🦜`
            });
            return sock.sendMessage(userId, {
                text: `🦜 A vossa mensagem foi devidamente encaminhada para o utilizador. Para encerrar a presente comunicação, utilize o comando !encerrar. 🦜`
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
                text: `🦜 Mensagem recebida do utilizador banido (+${userNumber}):\n\n${text}\n\n🦜`
            });
            return sock.sendMessage(userId, {
                text: `🦜 A vossa mensagem foi devidamente encaminhada para o administrador responsável pela análise da vossa apelação. Aguarde resposta. 🦜`
            });
        });
        
        return;
    }
    
    const banInfo = db.bans[userId];
    
    if (!banInfo) {
        await safeAction('Msg boas-vindas DM', async () => {
            return sock.sendMessage(userId, {
                text: `🦜 Prezado utilizador, seja bem-vindo ao sistema automatizado de moderação. O presente serviço foi concebido para assegurar o cumprimento das normas estabelecidas nos grupos geridos por esta plataforma. Caso tenha sido objeto de alguma medida disciplinar, ser-lhe-ão fornecidas todas as informações e instruções necessárias de forma automática. Agradecemos a vossa atenção. 🦜`
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
                text: `🦜 Prezado utilizador, acusamos a recepção da vossa apelação relativamente à decisão de remoção do grupo, fundamentada na violação do ${banInfo.rule.code} do regulamento interno. Informamos que o vosso pedido de revisão foi devidamente registado no sistema e encontra-se neste momento pendente de análise por parte da administração do grupo. Os responsáveis irão proceder à avaliação criteriosa dos argumentos por vós apresentados, à luz das circunstâncias concretas da infração e do historial de participação no grupo. Solicitamos que aguarde pacientemente pela resposta, a qual será comunicada assim que a administração conclua a sua deliberação. Agradecemos a vossa compreensão e reiteramos o nosso compromisso com a aplicação justa e equitativa das normas estabelecidas. 🦜`
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
    
    const appealMsg = `🦜 Prezados administradores, cumpre-nos informar que foi submetida uma apelação por parte do utilizador ${userName}, portador do número de contacto +${userNumber}, relativamente à decisão de expulsão do grupo motivada pela infração ao ${banInfo.rule.code} do regulamento interno. O utilizador em causa apresentou os seguintes argumentos em sua defesa: "${appealText}". A apelação encontra-se registada no sistema com a data de ${new Date(banInfo.timestamp).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'full', timeStyle: 'long' })} e aguarda deliberação por parte da administração. Caso algum dos responsáveis deseje assumir a condução do processo de análise e estabelecer comunicação direta com o apelante, deverá utilizar o comando !atender ${userNumber} para iniciar o diálogo. Agradecemos a vossa atenção e disponibilidade para a resolução desta questão. 🦜`;
    
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
                            text: `🦜 Prezado administrador, informamos que foi estabelecida com sucesso a ligação de comunicação direta com o utilizador +${bannedNumber}, que se encontra a aguardar a análise da sua apelação. A partir deste momento, todas as mensagens que dirigir ao presente sistema serão automaticamente encaminhadas para o utilizador em questão, permitindo-lhe conduzir o diálogo de forma privada e confidencial. Quando pretender encerrar a comunicação, deverá utilizar o comando !encerrar. Agradecemos o vosso empenho na resolução justa e ponderada desta situação. 🦜`
                        });
                        return sock.sendMessage(bannedUserId, {
                            text: `🦜 Prezado utilizador, temos o prazer de informar que um membro da administração do grupo aceitou proceder à análise da vossa apelação e encontra-se disponível para estabelecer um diálogo direto convosco. A partir deste momento, poderá expor de forma mais detalhada as vossas razões e esclarecer quaisquer dúvidas ou mal-entendidos relativos à situação que motivou a vossa expulsão. Todas as mensagens que enviar ao presente sistema serão encaminhadas para o administrador responsável, que responderá às vossas questões e deliberará sobre a eventual revisão da decisão. Solicitamos que mantenha um tom respeitoso e construtivo ao longo de todo o processo. Agradecemos a vossa colaboração. 🦜`
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
                        text: `🦜 Informa-se que o sticker submetido pelo membro ${data.userName} foi analisado e mereceu aprovação. O referido conteúdo foi adicionado à lista de stickers autorizados. 🦜`
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
                        text: `🦜 Informa-se que o sticker submetido pelo membro ${data.userName} foi analisado e não mereceu aprovação, tendo sido rejeitado. Foi registada uma advertência formal no sistema disciplinar do utilizador em conformidade com o regulamento. 🦜`
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
                        text: `🦜 Informa-se que o utilizador ${data.userName} foi objeto de expulsão imediata do grupo, em consequência da submissão de conteúdo inapropriado. A decisão foi executada em conformidade com o disposto no regulamento interno. 🦜`
                    });
                });
                
                delete pendingStickers[args[1]];
            }
            break;

            case '!ban':
            // ... código existente do !ban ...
            break;
            
        // ===== NOVO COMANDO: DEFINIR GRUPO PRINCIPAL =====
        case '!setmain':
            config.mainGroupId = groupId;
            config.allowedGroups = []; // Limpa lista se existir
            saveConfig();
            
            let groupName = 'este grupo';
            try {
                const groupMeta = await sock.groupMetadata(groupId);
                groupName = groupMeta.subject;
            } catch (e) {}
            
            await safeAction('Definir grupo principal', async () => {
                return sock.sendMessage(groupId, {
                    text: `🦜 Prezados administradores, informamos que o grupo "${groupName}" foi formalmente registado como grupo principal para efeitos de moderação automatizada. A partir deste momento, o sistema de moderação encontra-se ativo e operacional exclusivamente neste espaço, ignorando quaisquer outros grupos nos quais o bot possa estar presente. Agradecemos a vossa atenção. 🦜`
                });
            });
            break;
            
        case '!addgroup':
            // Adiciona grupo atual à lista de permitidos
            if (!config.allowedGroups) {
                config.allowedGroups = [];
            }
            
            if (!config.allowedGroups.includes(groupId)) {
                config.allowedGroups.push(groupId);
                config.mainGroupId = ''; // Limpa mainGroupId se existir
                saveConfig();
                
                await safeAction('Adicionar à lista', async () => {
                    return sock.sendMessage(groupId, {
                        text: `🦜 Prezados administradores, informamos que este grupo foi adicionado à lista de grupos sob moderação ativa. O sistema encontra-se agora operacional neste espaço. Total de grupos moderados: ${config.allowedGroups.length}. 🦜`
                    });
                });
            } else {
                await sock.sendMessage(groupId, {
                    text: `🦜 Este grupo já se encontra registado na lista de moderação. 🦜`
                });
            }
            break;
            
        case '!removegroup':
            // Remove grupo atual da lista
            if (config.allowedGroups && config.allowedGroups.includes(groupId)) {
                config.allowedGroups = config.allowedGroups.filter(id => id !== groupId);
                saveConfig();
                
                await safeAction('Remover da lista', async () => {
                    return sock.sendMessage(groupId, {
                        text: `🦜 Prezados administradores, informamos que este grupo foi removido da lista de moderação ativa. O bot continuará presente mas não atuará sobre violações. 🦜`
                    });
                });
            } else {
                await sock.sendMessage(groupId, {
                    text: `🦜 Este grupo não se encontra na lista de moderação. 🦜`
                });
            }
            break;
            
        case '!listgroups':
            // Mostra grupos moderados
            let groupsList = '🦜 *GRUPOS SOB MODERAÇÃO:*\n\n';
            
            if (config.mainGroupId) {
                try {
                    const meta = await sock.groupMetadata(config.mainGroupId);
                    groupsList += `📍 Grupo principal: ${meta.subject}\n`;
                } catch (e) {
                    groupsList += `📍 Grupo principal: ${config.mainGroupId}\n`;
                }
            } else if (config.allowedGroups && config.allowedGroups.length > 0) {
                for (const gid of config.allowedGroups) {
                    try {
                        const meta = await sock.groupMetadata(gid);
                        groupsList += `• ${meta.subject}\n`;
                    } catch (e) {
                        groupsList += `• ${gid}\n`;
                    }
                }
            } else {
                groupsList += 'Nenhum grupo configurado (moderação ativa em TODOS os grupos).\n';
            }
            
            groupsList += '\n🦜';
            
            await safeAction('Listar grupos', async () => {
                return sock.sendMessage(groupId, { text: groupsList });
            });
            break;
    }
}m
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
    
    const notification = `🦜 Prezado utilizador ${userName}, vimos por este meio notificá-lo formalmente de que foi objeto de remoção do grupo "${groupName}", em consequência do incumprimento do regulamento interno que rege o referido espaço. A presente decisão fundamenta-se na violação do ${rule.code}, que estabelece expressamente o seguinte: "${rule.description}". De acordo com o sistema disciplinar em vigor, conforme previsto no Artigo 5.1 do regulamento, que estipula que "o incumprimento das regras resulta em ban", a medida de expulsão foi aplicada de forma automática pelo sistema de moderação.\n\n*DADOS DA OCORRÊNCIA:*\nNome do utilizador: ${userName}\nNúmero de contacto: +${userNumber}\nGrupo de origem: ${groupName}\nArtigo infringido: ${rule.code} - ${rule.description}\nEvidência registada: ${evidence || 'Conteúdo multimédia anexado ao processo'}\nData e hora da infração: ${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'full', timeStyle: 'long' })}\n\n*DIREITO DE APELAÇÃO:*\nCaso entenda que a decisão ora comunicada foi tomada de forma injusta ou que existem circunstâncias atenuantes que não foram devidamente consideradas, fica salvaguardado o vosso direito de apresentar uma apelação. Para tal, deverá responder à presente mensagem, expondo de forma clara e fundamentada as razões pelas quais considera que a sanção não deveria ter sido aplicada. A vossa apelação será encaminhada para a administração do grupo, que procederá à sua análise e deliberará sobre a eventual revisão da decisão. Alertamos que apelações infundadas, ofensivas ou que não respeitem o devido decoro poderão resultar em sanções adicionais, incluindo a impossibilidade de readmissão no grupo em causa. Agradecemos a vossa atenção e compreensão relativamente à aplicação das normas estabelecidas. 🦜`;
   
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
