# Migel-BOT

# 🦜 Bot de Moderação WhatsApp - Sistema Automatizado

Sistema profissional de moderação automática para grupos de WhatsApp, com gestão de regras, sistema de warnings, apelações e dashboard web.

![Status](https://img.shields.io/badge/status-active-success.svg)
![Version](https://img.shields.io/badge/version-1.1211405.1-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 📋 Índice

- [Características](#-características)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Sistema de Regras](#-sistema-de-regras)
- [Comandos de Admin](#-comandos-de-admin)
- [Sistema de Apelações](#-sistema-de-apelações)
- [Dashboard Web](#-dashboard-web)
- [Proteção Contra Ban](#-proteção-contra-ban)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contribuir](#-contribuir)
- [Licença](#-licença)

---

## ✨ Características

### **Moderação Automática**
- ✅ Sistema de warnings graduais (2 avisos antes de ban)
- ✅ Detecção inteligente de spam (volume, repetição, flood)
- ✅ Controlo de stickers com aprovação manual
- ✅ Filtro de palavras ofensivas personalizável
- ✅ Bloqueio de texto opcional (grupos só de áudio/stickers)
- ✅ Suporte para conteúdo adulto (com API externa)

### **Sistema de Apelações**
- 📮 Mensagem DM automática ao banido com documentação completa
- 💬 Chat privado entre admin e banido através do bot
- 📊 Grupo de admins recebe todas as apelações
- ⚖️ Processo formal de revisão de decisões

### **Gestão de Stickers**
- 🎨 Sistema de whitelist automática
- 👨‍💼 Aprovação manual de novos stickers pelos admins
- 🔍 Hash MD5 para identificação única
- ✅ Três opções: aprovar, rejeitar, ban imediato

### **Proteção e Segurança**
- 🛡️ Rate limiting (máx 15 ações/minuto)
- ⏱️ Delays aleatórios entre ações (0.5-2s)
- 👥 Admins nunca são moderados
- 📝 Logs completos de todas as violações

### **Dashboard Web**
- 🌐 Interface responsiva (desktop + mobile)
- 📊 Estatísticas em tempo real
- ⚙️ Configuração visual de regras
- 📋 Histórico de bans e apelações
- 🎨 Lista de stickers aprovados

### **Comunicação Formal**
- 🦜 Todas as mensagens em tom formal e completo
- 📜 Documentação detalhada em cada interação
- ⚖️ Citação de artigos do regulamento
- 📄 Parágrafos corridos com contexto completo

---

## 🔧 Pré-requisitos

### **Hardware**
- Raspberry Pi 4 (recomendado) ou servidor Linux
- 1GB RAM mínimo
- 500MB espaço em disco

### **Software**
- Node.js 20.x ou superior
- npm 10.x ou superior
- Conta WhatsApp (será usada pelo bot)

### **Grupos WhatsApp Necessários**
1. **Grupo de Logs** - Onde são documentadas todas as violações
2. **Grupo de Admins** - Onde admins recebem apelações e aprovam stickers
3. **Grupo(s) a Moderar** - O bot precisa ser ADMIN nestes grupos
