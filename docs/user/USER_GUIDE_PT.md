# Guia do usuário do Suora

Este guia foi escrito com base na implementação atual do código. Ele descreve o que o Suora consegue fazer hoje, e não o que aparecia em planos antigos ou documentação desatualizada.

## 1. O que é o Suora

Suora é uma bancada local de IA. O aplicativo atual não é apenas uma janela de chat, mas um espaço de trabalho de desktop com Chat, Documents, Models, Agents, Skills, Pipeline, Timer, Channels, MCP e Settings.

Você pode usar o Suora para:

- executar conversas e tarefas do dia a dia com diferentes modelos
- delegar trabalho a agentes especializados em código, escrita, pesquisa, segurança, dados e DevOps
- manter um espaço local de documentos e anexar esse contexto às conversas
- criar pipelines de várias etapas e executá-las manualmente ou por agenda
- conectar plataformas externas de mensagens para que o assistente de desktop responda mensagens recebidas

## 2. Instalação e primeira execução

### Requisitos

- ambiente de desktop em Windows, macOS ou Linux
- Node.js 18+ ao executar a partir do código-fonte
- npm

### Executar a partir do código-fonte

```bash
npm install
npm run dev
```

### Onboarding

Na primeira execução, o Suora mostra um fluxo de cinco etapas:

1. Welcome
2. Configure a Model Provider
3. Meet Your Agents
4. Explore Skills
5. You're All Set

Se você pular esse fluxo, pode executá-lo novamente em `Settings -> System`.

## 3. Mapa da bancada

| Módulo | Uso atual |
| --- | --- |
| Chat | Chat com várias sessões, troca de agente ou modelo, anexos e chamadas de ferramentas |
| Documents | Grupos de documentos locais, pastas, backlinks e visualização em grafo |
| Pipeline | Design e execução de fluxos multiagente |
| Models | Configuração de provedores, ativação de modelos, teste de conexão e comparação |
| Agents | Gestão de agentes nativos e personalizados, testes, importação, exportação e versionamento |
| Skills | Skills instaladas, navegação por registro e edição de `SKILL.md` |
| Timer | Agendamentos únicos, por intervalo e Cron |
| Channels | Integrações de mensagens e roteamento de respostas |
| MCP | Configuração de servidores Model Context Protocol |
| Settings | Preferências, segurança, dados, logs e diagnóstico |

## 4. Fluxo de chat

O chat atual inclui:

- múltiplas sessões e abas
- seleção de agente e modelo por sessão
- anexos de imagem, arquivo e áudio
- respostas em streaming
- renderização de markdown, blocos de código e matemática
- visualização do estado das chamadas de ferramentas
- nova tentativa para respostas que falharam
- editar, excluir, fixar e ramificar mensagens
- feedback sobre respostas do assistente
- leitura em voz alta das respostas do assistente
- citações em linha

### Atalhos que funcionam hoje

- `Ctrl/Cmd + K`: abrir a paleta de comandos
- `Enter`: enviar mensagem
- `Shift + Enter`: nova linha no campo de entrada
- `Escape`: fechar a paleta ou diálogos
- `Ctrl/Cmd + S`: salvar no editor de documentos

### Paleta de comandos

A paleta pode levar diretamente para:

- sessões
- documentos
- agentes
- skills
- modelos
- configurações
- canais
- temporizadores
- MCP
- pipeline

## 5. Modelos e provedores

A camada atual de provedores suporta:

- Anthropic
- OpenAI
- Google
- Ollama
- DeepSeek
- Zhipu
- MiniMax
- Groq
- Together AI
- Fireworks
- Perplexity
- Cohere
- endpoints compatíveis com OpenAI

### O que o módulo Models suporta hoje

- adicionar configurações de provedores
- usar presets de provedores
- inserir chaves de API e Base URLs personalizadas
- testar conectividade
- ativar ou desativar modelos individuais
- ajustar `temperature` e `maxTokens` por modelo
- ver uma lista de modelos habilitados
- comparar modelos na visualização Compare

Se você usar Ollama, o endpoint local padrão é `http://localhost:11434/v1`.

## 6. Agents e Skills

### Agents nativos

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Capacidades de agentes personalizados

O editor atual suporta:

- nome, avatar, cor e prompt de sistema
- vínculo com modelo
- atribuição de skills
- temperatura, máximo de turnos e estilo de resposta
- listas de ferramentas permitidas e bloqueadas
- auto-learn
- importar, exportar e duplicar
- snapshots de versão e restauração
- chat de teste dentro do módulo Agents

### Capacidades do módulo Skills

O fluxo atual de skills suporta:

- visualizar skills instaladas
- ativar ou desativar skills
- editar `SKILL.md`
- navegar por skills do registro
- visualizar a instalação antes de instalar
- adicionar e gerenciar fontes de skills
- importar um único arquivo de skill
- importar uma pasta completa de skill
- exportar a skill em markdown ou zip

As skills também podem ser carregadas automaticamente do workspace e de diretórios externos.

## 7. Documents, Pipeline e Timer

### Documents

O módulo Documents suporta atualmente:

- grupos de documentos
- pastas aninhadas
- documentos markdown
- diagramas Mermaid
- blocos matemáticos
- busca em documentos
- backlinks e referências
- visualização em grafo
- uso de documentos selecionados como contexto do chat

### Pipeline

O módulo Pipeline suporta atualmente:

- fluxos multiagente em várias etapas
- repetição e estratégias de backoff por etapa
- timeouts por etapa
- execução condicional com `runIf`
- transformações de saída e variáveis exportadas
- limites de duração total, tokens totais e quantidade de etapas
- pré-visualização Mermaid e exportação do código-fonte
- histórico de execução e detalhes por etapa
- salvar, importar e exportar

O chat também suporta comandos `/pipeline`, como:

- `/pipeline list`
- `/pipeline run <name-or-id>`
- `/pipeline status`
- `/pipeline history <name-or-id>`
- `/pipeline cancel`

### Timer

Os tipos atuais de temporizador são:

- Once
- Interval
- Cron

As ações atuais são:

- notificação no desktop
- executar um prompt de agente
- executar um pipeline salvo

## 8. Channels e MCP

### Plataformas de canal suportadas

- WeChat Work
- WeChat Official Account
- WeChat Mini Program
- Feishu / Lark
- DingTalk
- Slack
- Telegram
- Discord
- Microsoft Teams
- Custom channels

### O que o módulo Channels suporta hoje

- transporte por webhook ou stream
- atribuição de um agente de resposta por canal
- auto-reply ligado ou desligado
- lista de chats permitidos
- histórico de mensagens
- lista de usuários rastreados
- visão de saúde
- visão de depuração

### MCP

O módulo MCP é usado atualmente para:

- adicionar configurações de servidores
- editar configurações de servidores
- verificar o estado da conexão
- expor capacidades MCP para os agentes

## 9. Configurações, segurança e dados

As seções atuais de configuração são:

- General
- Security
- Voice
- Shortcuts
- Data
- Logs
- System

### Recursos importantes disponíveis hoje

- tema, idioma, fontes e cor de destaque
- inicialização automática
- configuração de proxy
- configuração SMTP e teste de conexão
- gerenciador de variáveis de ambiente
- política de confirmação para execução de ferramentas
- modo sandbox do sistema de arquivos
- lista de diretórios permitidos
- padrões de shell bloqueados
- preferências de voz
- gerenciamento de atalhos
- importação e exportação
- política de retenção
- logs e histórico de falhas
- métricas de execução
- reiniciar onboarding

### Chaves de API e armazenamento seguro

A implementação atual tenta armazenar primeiro as chaves de API no armazenamento seguro do sistema operacional.

Se o keyring do sistema não estiver disponível ou se a criptografia falhar, o Suora avisa que:

- as chaves ficam apenas em memória
- será necessário inseri-las novamente após reiniciar

### O que a exportação atual inclui

- agentes personalizados
- skills personalizadas
- todas as sessões
- configurações de provedores
- configurações de diretórios externos

## 10. Solução de problemas

### A conexão do modelo falha

Verifique nesta ordem:

1. a chave de API é válida
2. a Base URL corresponde ao provedor
3. pelo menos um modelo está habilitado
4. o proxy não está bloqueando a solicitação
5. o teste de conexão na tela Models funciona

### Um canal não recebe mensagens

Verifique nesta ordem:

1. o canal está habilitado
2. o agente de resposta ainda existe e está habilitado
3. o servidor local de canais está em execução para canais webhook
4. a URL de callback da plataforma corresponde exatamente à URL mostrada pelo Suora
5. o chat atual não está bloqueado por `allowedChats`
6. a visualização Health ou Debug não mostra erro de credenciais

### Uma skill não parece ativa

Verifique nesta ordem:

1. a skill está habilitada
2. a skill necessária está atribuída ao agente
3. a skill foi importada para o workspace atual ou para um diretório externo
4. o conteúdo é um `SKILL.md` válido

### Um temporizador não dispara

Verifique nesta ordem:

1. o temporizador está habilitado
2. a expressão Cron é válida
3. o agente ou pipeline de destino ainda existe
4. o aplicativo de desktop está em execução

## 11. Primeira sessão recomendada

Se você está começando com a build atual, esta ordem funciona bem:

1. adicione um provedor e habilite um modelo em `Models`
2. revise os agents nativos em `Agents`
3. inicie sua primeira conversa em `Chat`
4. crie um grupo de documentos em `Documents`
5. salve um fluxo de duas ou três etapas em `Pipeline`
6. agende esse fluxo em `Timer`
7. configure `Channels` ou `MCP` apenas quando o fluxo local estiver estável