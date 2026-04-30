# Documentação técnica do Suora

Este documento é uma referência técnica baseada na implementação atual do repositório. Ele serve para contribuidores e mantenedores e descreve apenas estruturas realmente presentes no código.

## 1. Visão geral do sistema

Suora é uma bancada local de IA baseada em Electron. Os módulos principais disponíveis hoje são:

- Chat
- Documents
- Pipeline
- Models
- Agents
- Skills
- Timer
- Channels
- MCP
- Settings

A aplicação segue uma abordagem local-first. Estado do usuário, sessões, árvores de documentos, configurações de agentes, configurações de modelos e a maior parte dos metadados de execução são armazenados localmente por meio de uma camada de persistência baseada em IPC.

## 2. Arquitetura de execução

O runtime é dividido em três camadas.

| Camada | Responsabilidade |
| --- | --- |
| Electron Main Process | Gerencia sistema de arquivos, helpers de fetch de rede, Secure Storage, shell, runtime de canais e handlers IPC |
| Preload Bridge | Expõe uma API `window.electron` baseada em allowlist sob context isolation |
| React Renderer | Renderiza a UI da bancada, mantém o estado com Zustand e orquestra IA, documentos, pipelines, canais e ajustes |

O renderer usa Hash Router e carrega módulos de funcionalidade de forma lazy.

### Rotas de topo atuais

| Rota | Módulo |
| --- | --- |
| `/chat` | Bancada de chat |
| `/documents` | Bancada de documentos |
| `/pipeline` | Editor de pipelines de agentes e histórico de execução |
| `/models/:view` | Visões de providers, modelos e comparação |
| `/agents` | Gerenciamento de agentes |
| `/skills/:view` | Visões instaladas, navegação e fontes |
| `/timer` | Gestão de temporizadores e agendamentos |
| `/channels` | Integrações de mensageria |
| `/mcp` | Integrações e configuração MCP |
| `/settings/:section` | Seções de ajustes |

### Seções atuais de ajustes

- `general`
- `security`
- `voice`
- `shortcuts`
- `data`
- `logs`
- `system`

## 3. Estrutura do repositório

O repositório atual é organizado em torno de uma shell Electron e de uma aplicação React estruturada por funcionalidade.

```text
electron/
  main.ts          processo principal Electron e handlers IPC
  preload.ts       preload bridge isolado
  channelService.ts
  database.ts

src/
  App.tsx          bootstrap do roteador e inicialização global
  main.tsx         entrada do renderer
  index.css        tokens globais de tema e estilos UI
  components/      módulos de funcionalidade e UI compartilhada
  hooks/           hooks React
  services/        AI, armazenamento, i18n, pipelines, canais, documentos
  store/           store Zustand e slices
  types/           tipos compartilhados

docs/
  user/            documentação de usuário
  technical/       referências técnicas

e2e/
  testes end-to-end com Playwright
```

## 4. Stack tecnológico

| Área | Tecnologia |
| --- | --- |
| Shell desktop | Electron 41 |
| Frontend | React 19 |
| Ferramentas de build | Vite 6 + electron-vite 5 |
| Estilo | Tailwind CSS 4 |
| Estado | Zustand 5 |
| Linguagem | TypeScript 5.8 |
| Runtime de IA | Vercel AI SDK 6 |
| Testes unitários | Vitest |
| Testes E2E | Playwright |

## 5. Modelo de estado da aplicação

Suora usa um único store persistido do Zustand em `src/store/appStore.ts` para coordenar todo o estado da bancada.

### Principais domínios de estado

- sessões e abas de chat
- documentos, pastas e grupos de documentos
- modelos e configurações de providers
- agentes, memórias de agentes, versões de agentes e estatísticas de desempenho
- skills, versões de skills e fontes externas
- pipelines e metadados de execução
- temporizadores
- canais, saúde dos canais, usuários, histórico e tokens
- notificações
- configuração e estado de servidores MCP
- preferências de UI como tema, idioma, tamanho de fonte e cor de destaque

### Escopo atual de importação e exportação

- agentes personalizados
- skills personalizadas
- todas as sessões
- configurações de providers
- configurações de diretórios externos

## 6. Camada de modelos e serviço de IA

A integração de IA fica em `src/services/aiService.ts`.

### Providers atualmente suportados

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

### Responsabilidades do serviço de IA

- validar configuração de modelos
- inicializar e fazer cache de clientes por identidade do provider, chave API e base URL
- classificar erros de rede e de provider
- gerar respostas de texto comuns
- produzir respostas em streaming em um loop multi-etapas com ferramentas

### Tipos atuais de eventos de streaming

- `text-delta`
- `tool-call`
- `tool-result`
- `tool-error`
- `finish-step`
- `usage`
- `error`

## 7. Sistema de agentes e skills

### Agentes integrados atuais

- Assistant
- Code Expert
- Writing Strategist
- Research Analyst
- Security Auditor
- Data Analyst
- DevOps Expert

### Modelo de agente

O tipo `Agent` atual inclui:

- `systemPrompt`
- `modelId`
- `skills`
- `temperature`
- `maxTokens`
- `maxTurns`
- `responseStyle`
- `allowedTools`
- `disallowedTools`
- `permissionMode`
- `memories`
- `autoLearn`

Isso significa que os agentes do Suora não são apenas presets de prompt. Eles também carregam comportamento de roteamento, restrições de ferramentas e memória.

### Modelo de skills

O sistema atual de skills é baseado em pacotes de capacidade orientados por prompt. Hoje ele suporta:

- lista de skills instaladas
- navegação por registro
- gestão de fontes
- edição e preview de `SKILL.md`
- importação de um único arquivo
- importação de uma pasta completa
- exportação em markdown ou zip
- gestão de árvores de recursos ao lado de `SKILL.md`

Os comentários no código e o comportamento atual da UI separam claramente duas camadas: as ferramentas integradas continuam vindo do sistema de ferramentas, enquanto as skills adicionam instruções especializadas e recursos empacotados.

## 8. Documents, pipelines e temporizadores

### Documents

O módulo Documents atualmente suporta:

- grupos de documentos
- pastas aninhadas
- documentos markdown
- renderização Mermaid
- renderização matemática
- backlinks e referências
- busca de documentos
- visualização em grafo
- seleção de documentos como contexto de chat

### Pipeline

O módulo Pipeline atualmente suporta:

- workflows multiagente em várias etapas
- retries e estratégias de backoff
- timeouts por etapa
- execução condicional com `runIf`
- transformações de saída e exportação de variáveis
- limites de duração total, tokens e quantidade de etapas
- preview Mermaid e exportação do source
- histórico de execução e detalhes por etapa
- salvar, importar e exportar

A camada de chat também suporta comandos `/pipeline` para listar, executar, consultar status, ler histórico e cancelar pipelines salvos.

### Timer

Tipos atuais de temporizador:

- `Once`
- `Interval`
- `Cron`

Ações atualmente suportadas:

- notificação de desktop
- executar prompt de agente
- executar pipeline salvo

## 9. Channels e MCP

### Plataformas de canais

A superfície atual de `ChannelPlatform` suporta:

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

### Comportamento atual dos canais

- transporte por webhook ou stream
- um reply agent por canal
- auto-reply ligado ou desligado
- allowlist de chats
- histórico de mensagens
- lista de usuários
- painel de saúde
- painel de depuração

### MCP

O módulo de integrações oferece atualmente:

- configuração de servidores
- acompanhamento do estado de conexão
- integração de capacidades MCP na execução dos agentes

## 10. Modelo de IPC e segurança

Suora mantém context isolation no Electron e roteia operações privilegiadas pelo preload bridge.

### Principais características atuais de segurança

- o renderer não acessa diretamente APIs do Node.js
- o preload expõe apenas uma superfície invoke/on/send baseada em allowlist
- falhas de secure storage aparecem como avisos na UI
- o acesso ao sistema de arquivos pode ser sandboxado
- o usuário pode definir diretórios permitidos
- padrões perigosos de shell podem ser bloqueados
- a execução de ferramentas pode exigir confirmação prévia

### Comportamento atual de Secure Storage

A aplicação tenta primeiro gravar chaves de API no armazenamento seguro do sistema operacional. Se esse armazenamento estiver indisponível ou se a criptografia falhar, a UI avisa que as chaves ficam apenas em memória e precisam ser digitadas novamente após reiniciar.

## 11. Tema UI, internacionalização, build e testes

### Tema e preferências

O renderer usa um sistema compartilhado de tokens de tema em `src/index.css` e hooks como `useTheme`. Os eixos de preferência suportados atualmente são:

- tema claro, escuro ou do sistema
- tamanho de fonte
- fonte de código
- cor de destaque
- idioma

O modo de tema padrão é atualmente `system`.

### Idiomas atualmente integrados

- English
- Chinese
- Japanese
- Korean
- French
- German
- Spanish
- Portuguese
- Russian
- Arabic

### Comandos de desenvolvimento comuns

```bash
npm install
npm run dev
npm run build
npm run preview
npm run package
npm run lint
npm run type-check
npm run test:run
npm run test:e2e
```

### Cobertura de testes atualmente visível

- comportamento do preload do Electron
- utilitários de armazenamento
- UI de onboarding
- comportamento do editor de skills
- fluxos de marketplace e skill registry
- hooks de tema
- helpers de banco de dados
- caminhos smoke com Playwright

## 12. Notas de manutenção

Ao atualizar a documentação técnica deste repositório, priorize fatos confirmados pelo código em vez de descrições herdadas. Os pontos de ancoragem mais confiáveis são:

- as rotas reais em `src/App.tsx`
- os agentes integrados reais em `src/store/appStore.ts`
- os tipos reais de provider em `src/services/aiService.ts`
- as seções reais de ajustes em `src/components/settings/SettingsLayout.tsx`

A menos que você tenha conferido o código imediatamente antes, evite fixar na documentação números sujeitos a drift, como total de canais IPC ou total de ferramentas.