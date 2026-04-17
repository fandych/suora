# Suora �?Guia do Usuário

Bem-vindo ao **Suora**, um aplicativo de desktop com inteligência artificial baseado em Electron que reúne suporte a múltiplos modelos de IA, automação e extensibilidade para o seu dia a dia.

---

## Sumário

1. [Introdução](#introdução)
2. [Instalação](#instalação)
3. [Primeiros Passos](#primeiros-passos)
4. [Chat](#chat)
5. [Modelos de IA](#modelos-de-ia)
6. [Agentes](#agentes)
7. [Habilidades](#habilidades)
8. [Temporizadores e Agendamento](#temporizadores-e-agendamento)
9. [Canais](#canais)
10. [Configurações](#configurações)
11. [Base de Conhecimento e Memória](#base-de-conhecimento-e-memória)
12. [Segurança e Privacidade](#segurança-e-privacidade)
13. [Atalhos de Teclado](#atalhos-de-teclado)
14. [Solução de Problemas](#solução-de-problemas)
15. [Perguntas Frequentes](#perguntas-frequentes)

---

## Introdução

O Suora é um aplicativo multiplataforma que permite interagir com os principais modelos de IA �?Anthropic Claude, OpenAI GPT, Google Gemini e outros �?por meio de uma interface de chat unificada. Além de conversas, ele oferece agentes inteligentes especializados em programação, redação, pesquisa e DevOps; um sistema completo de habilidades para operações com arquivos, automação de navegador, e-mail e Git; tarefas agendadas; integrações com plataformas de mensagens; e um sistema de memória persistente para que a IA mantenha contexto entre sessões.

Seja você um desenvolvedor buscando um copiloto de código, um redator em busca de assistência criativa ou um usuário avançado querendo automatizar tarefas rotineiras, o Suora se adapta às suas necessidades.

---

## Instalação

### Requisitos do Sistema

| Plataforma | Versão Mínima |
|------------|---------------|
| Windows | Windows 10 ou superior |
| macOS | macOS 11 (Big Sur) ou superior |
| Linux | Ubuntu 20.04 / Fedora 34 ou equivalente |

### Download

1. Acesse a página de **Releases** no repositório GitHub do Suora.
2. Baixe o instalador para a sua plataforma:
   - **Windows** �?instalador `.exe`
   - **macOS** �?imagem de disco `.dmg`
   - **Linux** �?pacote `.AppImage` ou `.deb`
3. Execute o instalador e siga as instruções na tela.

### Compilar a Partir do Código-Fonte

```bash
git clone https://github.com/fandych/suora.git
cd suora
npm install
npm run build
npm run package
```

---

## Primeiros Passos

Ao iniciar o aplicativo pela primeira vez, um **assistente de configuração em 5 etapas** o guiará:

1. **Boas-vindas** �?Apresentação breve do aplicativo.
2. **Configurar Provedor de Modelo** �?Insira sua chave de API para pelo menos um provedor (ex.: OpenAI, Anthropic).
3. **Conheça os Agentes** �?Visualize os agentes especializados integrados.
4. **Explore as Habilidades** �?Veja as capacidades disponíveis.
5. **Tudo Pronto!** �?Comece a conversar imediatamente.

> Você pode pular o assistente e configurar tudo depois em **Configurações**.

---

## Chat

A interface de chat é o coração do Suora.

### Iniciando uma Nova Conversa

- Clique no botão **�?* na barra lateral ou pressione `Ctrl + N` (`Cmd + N` no macOS).
- Cada conversa é uma sessão independente com seu próprio histórico.

### Enviando Mensagens

- Digite sua mensagem e pressione **Enter** para enviar.
- Use **Shift + Enter** para uma nova linha dentro da mensagem.
- Anexe imagens ou arquivos com o botão de anexo.

### Recursos da Mensagem

- **Respostas em streaming** �?As respostas da IA aparecem token por token em tempo real.
- **Renderização Markdown** �?Blocos de código com destaque de sintaxe, tabelas, listas e mais.
- **Indicadores de execução de ferramenta** �?Quando a IA invoca uma habilidade, você vê ícones de status: pendente (�?, executando (�?, sucesso (�?, erro (�?, com duração da execução.
- **Feedback** �?Avalie qualquer resposta do assistente com 👍 ou 👎.
- **Uso de tokens** �?Cada resposta mostra o número de tokens consumidos.
- **Entrada por voz** �?Pressione `Ctrl + Shift + V` para ditar uma mensagem.
- **Paleta de comandos** �?Pressione `Ctrl + K` para navegação rápida, troca de agentes e mais.

---

## Modelos de IA

O Suora suporta uma ampla variedade de provedores de IA.

### Provedores Suportados

| Provedor | Modelos de Exemplo |
|----------|-------------------|
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| OpenAI | GPT-4o, GPT-4 Turbo |
| Google Vertex AI | Gemini 1.5 Pro, Gemini 1.5 Flash |
| Ollama | Llama 3, Mistral (local) |
| DeepSeek | DeepSeek Coder, DeepSeek Chat |
| Groq | Mixtral, LLaMA (inferência rápida) |
| Together AI | Diversos modelos open-source |
| Fireworks AI | Diversos modelos open-source |
| Perplexity | Modelos Sonar |
| Cohere | Command R+ |
| Compatível com OpenAI | Qualquer endpoint compatível |

### Adicionando um Provedor

1. Vá em **Configurações �?Provedores de Modelo**.
2. Clique em **Adicionar Provedor** e escolha o tipo.
3. Insira sua **chave de API** e, opcionalmente, defina uma **URL base**.
4. Clique em **Testar Conexão** para verificar.
5. Selecione os modelos que deseja utilizar.

### Configuração por Modelo

Cada modelo pode ter **temperatura** (criatividade) e **máximo de tokens** (tamanho da resposta) personalizados.

---

## Agentes

Agentes são personas de IA especializadas com prompts de sistema, conjuntos de habilidades e estilos de resposta distintos.

### Agentes Integrados

| Agente | Ideal Para | Temperatura |
|--------|-----------|-------------|
| 🤖 Assistente | Tarefas gerais | 0.7 |
| 🧑‍�?Especialista em Código | Revisão de código, depuração | 0.5 |
| ✍️ Redator | Artigos, documentação | 0.8 |
| 📚 Pesquisador | Pesquisa, verificação de fatos | 0.6 |
| 📊 Analista de Dados | Conjuntos de dados, tendências | 0.5 |
| 🚀 Engenheiro DevOps | CI/CD, automação | 0.4 |
| 🛡�?Auditor de Segurança | Varredura de vulnerabilidades | 0.3 |
| 🌐 Tradutor | Tradução, revisão | 0.3 |
| 📱 Gerente de Produto | PRDs, histórias de usuário | 0.6 |

### Criando um Agente Personalizado

1. Navegue até o painel **Agentes**.
2. Clique em **Criar Agente**.
3. Defina **nome**, **prompt de sistema**, **estilo de resposta** (conciso / equilibrado / detalhado) e **temperatura**.
4. Atribua as habilidades que o agente deve ter acesso.
5. Salve.

Os agentes também suportam **aprendizado automático**: eles podem armazenar insights na memória durante as conversas.

---

## Habilidades

Habilidades são ferramentas que os agentes podem invocar durante as conversas.

### Categorias Integradas (18+)

| Categoria | Exemplos |
|-----------|---------|
| 📁 Sistema de Arquivos | Ler, escrever, editar, buscar, copiar, mover |
| 🖥�?Shell | Executar comandos no terminal |
| 🌐 Web | Buscar na web, acessar páginas, abrir URLs |
| 🔧 Utilitários | Área de transferência, notificações, capturas de tela, info do sistema |
| 📋 Tarefas | Gerenciar listas de tarefas |
| �?Temporizador | Criar e gerenciar temporizadores |
| 🧠 Memória | Armazenar, buscar e gerenciar memórias |
| 🌍 Automação de Navegador | Navegar, clicar, preencher formulários, extrair texto |
| 🤝 Comunicação entre Agentes | Delegar tarefas entre agentes |
| �?Automação de Eventos | Gatilhos de mudança de arquivo e agendamento |
| 🧬 Auto-Evolução | Criar e melhorar habilidades dinamicamente |
| 🔀 Git | Status, diff, log, commit, stage |
| 🔬 Análise de Código | Analisar estrutura, encontrar padrões |
| 📱 Canais | Iniciar/parar servidores webhook, enviar mensagens |
| 📧 E-mail | Enviar e-mails via SMTP |
| ⚙️ Gestão do Sistema | Trocar modelos/sessões, gerenciar plugins |

### Ativando / Desativando Habilidades

Abra **Configurações �?Habilidades** ou use a paleta de comandos (`Ctrl + K`). Desativar uma habilidade impede que todos os agentes a invoquem.

### Marketplace

Navegue por habilidades contribuídas pela comunidade no **Marketplace de Habilidades** e instale com um clique. Habilidades personalizadas são carregadas de diretórios externos como `~/.agents/skills`.

---

## Temporizadores e Agendamento

Automatize tarefas recorrentes criando temporizadores.

### Tipos de Temporizador

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **Único** | Dispara uma vez em data/hora específica | "Lembrar-me às 15h" |
| **Intervalo** | Repete a cada N minutos | A cada 30 minutos |
| **Cron** | Agendamento avançado recorrente | `0 9 * * 1-5` (9h dias úteis) |

### Referência de Expressão Cron

```
┌───────────── minuto (0-59)
�?┌───────────── hora (0-23)
�?�?┌───────────── dia do mês (1-31)
�?�?�?┌───────────── mês (1-12)
�?�?�?�?┌───────────── dia da semana (0-6, Dom=0)
�?�?�?�?�?
* * * * *
```

Exemplos comuns:
- `*/15 * * * *` �?A cada 15 minutos
- `0 */2 * * *` �?A cada 2 horas
- `30 8 * * 1` �?Segunda-feira às 8:30
- `0 0 1 * *` �?Meia-noite no 1º de cada mês

---

## Canais

Conecte o Suora a plataformas de mensagens para respostas automatizadas.

### Plataformas Suportadas

- **WeChat** �?Principal aplicativo de mensagens da China
- **Feishu (Lark)** �?Suite de colaboração da Bytedance
- **DingTalk** �?Mensageiro empresarial da Alibaba

### Configurando um Canal

1. Vá em **Canais** na barra lateral.
2. Selecione uma plataforma e insira as credenciais (App ID, App Secret, Token de Verificação, Chave de Criptografia).
3. Escolha o modo de conexão: **Webhook** ou **Stream**.
4. Ative **Resposta Automática** se desejar que a IA responda automaticamente.
5. Opcionalmente, restrinja a grupos de chat específicos.

---

## Configurações

Acesse as configurações pelo ícone de engrenagem na barra lateral.

### Geral

- **Tema** �?Claro, Escuro ou Sistema (segue a preferência do SO).
- **Idioma** �?English, 中文, 日本�? 한국�? Français, Deutsch, Español, Português, Русский, العربية.
- **Inicialização Automática** �?Iniciar o Suora com o sistema.
- **Salvamento Automático** �?Salvar sessões de chat automaticamente.
- **Espaço de Trabalho** �?Diretório para dados do aplicativo.

### Aparência

- **Tamanho da Fonte** �?Pequeno, Médio, Grande.
- **Fonte de Código** �?Fira Code, JetBrains Mono, Source Code Pro, Cascadia Code, Consolas ou Padrão.
- **Estilo de Bolha** �?Padrão, Minimalista, Com Borda, Glassmorfismo.
- **Cor de Destaque** �?Escolha uma cor de realce para a interface.

### Voz

- **Ativar Voz** �?Habilitar reconhecimento e síntese de fala.
- **Idioma** �?Código BCP 47 (ex.: `pt-BR`, `en-US`).
- **Velocidade / Tom / Volume** �?Ajuste fino da saída de voz.
- **Envio Automático** �?Enviar mensagem automaticamente após o reconhecimento de fala.

### Proxy

- **Ativar Proxy** �?Rotear tráfego por proxy HTTP, HTTPS ou SOCKS5.

### E-mail (SMTP)

- Configure um servidor SMTP para enviar e-mails via habilidade de E-mail.

### Gestão de Dados

- **Retenção de Histórico** �?Dias para manter o histórico (0 = ilimitado).
- **Limpar Histórico** �?Excluir todas as sessões.
- **Exportar / Importar** �?Backup e restauração de agentes, habilidades, sessões e provedores em JSON.

---

## Base de Conhecimento e Memória

O Suora possui um sistema de memória em camadas que fornece contexto persistente à IA.

### Tipos de Memória

| Tipo | Finalidade |
|------|-----------|
| Insight | Descobertas ou conclusões importantes |
| Preferência | Preferências e personalização do usuário |
| Correção | Erros a evitar |
| Conhecimento | Fatos gerais |

### Escopos de Memória

- **Sessão** �?Existe apenas na sessão de chat atual.
- **Global** �?Persiste em todas as sessões e agentes.

### Memória Vetorial

Para casos de uso avançados, o Suora inclui um índice vetorial em memória que possibilita busca por similaridade semântica na base de conhecimento.

---

## Segurança e Privacidade

### Políticas de Execução de Ferramentas

- **Diretórios Permitidos** �?Restrinja operações de arquivo a uma lista de diretórios autorizados.
- **Comandos Bloqueados** �?Comandos perigosos (`rm -rf`, `format`, `shutdown`, etc.) são bloqueados por padrão.
- **Prompts de Confirmação** �?Opcionalmente exija aprovação do usuário antes de qualquer execução de ferramenta.

### Integridade de Habilidades

- Habilidades são verificadas com **hashes SHA-256** e assinaturas criptográficas.
- O sistema de auditoria detecta padrões de código perigosos como `eval()`, `Function()` e `require()`.

### Registro de Auditoria

Cada execução de ferramenta é registrada com timestamp, nome da ferramenta, status, duração, dados de entrada/saída e erros. O log armazena até 10.000 entradas e pode ser exportado como JSON.

---

## Atalhos de Teclado

| Ação | Windows / Linux | macOS |
|------|----------------|-------|
| Novo Chat | `Ctrl + N` | `Cmd + N` |
| Paleta de Comandos | `Ctrl + K` | `Cmd + K` |
| Enviar Mensagem | `Enter` | `Enter` |
| Nova Linha | `Shift + Enter` | `Shift + Enter` |
| Entrada por Voz | `Ctrl + Shift + V` | `Cmd + Shift + V` |
| Alternar Barra Lateral | `Ctrl + B` | `Cmd + B` |
| Fechar Painel | `Escape` | `Escape` |

Todos os atalhos podem ser personalizados em **Configurações �?Atalhos de Teclado**.

---

## Solução de Problemas

### O aplicativo não inicia

- Verifique se o sistema atende aos requisitos mínimos.
- No Linux, confirme que o AppImage tem permissão de execução: `chmod +x Suora.AppImage`.
- Consulte os logs em `~/.suora/logs/`.

### Respostas da IA estão vazias ou falham

- Confirme que sua chave de API é válida em **Configurações �?Provedores de Modelo**.
- Clique em **Testar Conexão** para diagnosticar problemas de conectividade.
- Se estiver atrás de um firewall, configure um proxy em **Configurações �?Proxy**.

### Habilidades não executam

- Verifique se a habilidade está ativada em **Configurações �?Habilidades**.
- Confira **Segurança �?Diretórios Permitidos** se uma operação de arquivo estiver sendo bloqueada.
- Revise o **Registro de Auditoria** para detalhes do erro.

### Temporizador não dispara

- Certifique-se de que o temporizador está **ativado**.
- Verifique a expressão cron usando o painel de prévia.
- O aplicativo precisa estar em execução para que os temporizadores funcionem.

### Alto uso de memória

- Reduza a **Retenção de Histórico** nas Configurações.
- Limpe sessões de chat antigas.
- Desative habilidades e agentes não utilizados.

---

## Perguntas Frequentes

**P: Meus dados são enviados para servidores de terceiros?**
R: As conversas são enviadas apenas ao provedor de IA que você configurou (ex.: OpenAI, Anthropic). Nenhum dado é enviado à equipe do Suora.

**P: Posso usar modelos locais?**
R: Sim. Adicione um provedor **Ollama** e aponte para sua instância local.

**P: Como faço para redefinir o aplicativo?**
R: Exclua o diretório `~/.suora/` e reinicie o aplicativo.

**P: Posso usar vários provedores de IA ao mesmo tempo?**
R: Sim. Adicione quantos provedores quiser e alterne entre modelos durante a conversa.

**P: Onde minhas sessões de chat ficam armazenadas?**
R: Localmente no seu computador, no diretório do espaço de trabalho (padrão: `~/.suora/`).

**P: Como crio uma habilidade personalizada?**
R: Use a habilidade de **Auto-Evolução** (`skill_create`) ou coloque um arquivo de definição em `~/.agents/skills/`.

**P: Existe uma versão mobile?**
R: O Suora está disponível atualmente apenas para Windows, macOS e Linux.

**P: Como reporto um bug?**
R: Abra uma issue no repositório GitHub com os passos de reprodução e informações do seu sistema.

---

*Obrigado por usar o Suora! Se tiver sugestões ou feedback, adoraríamos ouvir de você no GitHub.*
