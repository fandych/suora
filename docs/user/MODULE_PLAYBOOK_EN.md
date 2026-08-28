# Suora Module Playbook (10 Modules, 10 Rounds, 30 Questions)

How to read this guide: each module is broken into 10 rounds, with 3 questions per round. You do not need to read it front to back. Jump to the module and round that matches the job you are trying to complete.

## 1. Chat

If you want the ultra-detailed version, continue to [docs/user/CHAT_DEEP_DIVE_EN.md](../user/CHAT_DEEP_DIVE_EN.md). That companion file expands Chat into 10 rounds with 30 questions per round.

### Round 1: Positioning and entry
1. What problem does Chat solve? Answer: it is the main entry point for conversations, task execution, tool calls, and pipeline commands.
2. When should you open Chat first? Answer: when your model and agent setup is ready and you want to start real work.
3. What do you need before Chat becomes useful? Answer: at least one configured provider, one enabled model, and ideally a default agent.

### Round 2: First-time setup
4. What should you look at first? Answer: the session list, then the model and agent selectors for the active session.
5. What should you confirm before sending the first message? Answer: that the session is using the model and agent you actually want.
6. What happens if nothing is configured yet? Answer: the screen loads, but real AI replies will fail or remain unavailable because no model is ready.

### Round 3: Core objects
7. What are the core objects in Chat? Answer: sessions, messages, attachments, the current agent, and the current model.
8. What is the relationship between sessions and messages? Answer: a session owns a persisted message thread that you can continue, edit, branch, and retry.
9. What do agents and models control? Answer: the agent controls role and tool boundaries; the model controls capability, speed, and cost.

### Round 4: Standard flow
10. What is the normal chat flow? Answer: pick a session, choose an agent, choose a model, send a prompt, inspect streaming output and tool events, then continue.
11. What matters when you attach files? Answer: confirm the model supports that input type and state clearly what you want the model to do with it.
12. What should you check before retrying a failed reply? Answer: provider connectivity, rate limits, tool permissions, and whether the prompt itself is the real problem.

### Round 5: Collaboration paths
13. Which modules does Chat work with most often? Answer: Models, Agents, Documents, and Pipeline.
14. When should you go back to Documents? Answer: when the task depends on long-lived source material, not just a one-off prompt.
15. When should you go back to Agents? Answer: when the problem is the role, permissions, or behavior style rather than the wording of the prompt.

### Round 6: Advanced use
16. What can Chat do beyond basic prompting? Answer: show tool calls, branch threads, edit messages, retry outputs, read responses aloud, and trigger `/pipeline` commands.
17. When is `/pipeline` worth using? Answer: when you already saved a repeatable workflow and want to list, run, or inspect it from chat.
18. When should you stop piling on context? Answer: when the thread has drifted, the context is bloated, or you need a different role.

### Round 7: Judging outcomes
19. What counts as a successful chat task? Answer: the answer is correct, uses context clearly, makes tool usage understandable, and gives you a next step.
20. What counts as a verbose but failed reply? Answer: lots of text with weak structure, weak targeting, and no actionable completion.
21. How do you know whether to keep using the current thread? Answer: keep it if the work is still evolving in the same context; otherwise start a new session or branch.

### Round 8: Common failures
22. What should you check first when no reply appears? Answer: provider connectivity, model enablement, and whether the message actually sent.
23. What should you check first when a tool call misbehaves? Answer: the agent tool policy and the confirmation or blocking rules in `Settings -> Security`.
24. Why do attachments sometimes produce poor results? Answer: often because the model does not support that modality or the prompt does not explain the task clearly.

### Round 9: Safety boundaries
25. What should you treat most carefully in Chat? Answer: sensitive attachments, dangerous commands, and prompts that trigger high-risk tools.
26. Why can the same task have different risk levels across agents? Answer: because allowed tools, disallowed tools, and permission mode differ per agent.
27. Why does the secure-storage warning matter to Chat? Answer: because it determines whether model keys survive restarts or live only in memory.

### Round 10: Maintenance and iteration
28. How should you clean up chat usage over time? Answer: move durable knowledge into Documents and move repeatable procedures into Pipeline.
29. When should you create a dedicated agent? Answer: when the same class of task keeps appearing and the general assistant needs repeated correction.
30. What should you optimize first in Chat? Answer: model selection and agent selection first, then context and tool strategy.

## 2. Documents

If you want the ultra-detailed version, continue to [docs/user/DOCUMENTS_DEEP_DIVE_EN.md](../user/DOCUMENTS_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Documents solve? Answer: it manages local knowledge, note structure, backlinks, and graph-aware exploration.
2. When should you open Documents first? Answer: when the task depends on durable source material instead of transient chat context.
3. What do you need before using it? Answer: mostly a workspace structure idea; models are optional for the first pass.

### Round 2: First-time setup
4. What should you create first? Answer: a document group, then folders and documents inside it.
5. Why start with groups instead of documents? Answer: because groups define long-lived knowledge boundaries for search, graphing, and chat context.
6. What happens if one group grows without structure? Answer: maintenance drops quickly and backlinks and graph views become harder to trust.

### Round 3: Core objects
7. What are the core objects in Documents? Answer: document groups, folders, document nodes, and markdown content.
8. Why do backlinks and references matter? Answer: they show what depends on a note, what is isolated, and where connections are missing.
9. Is the graph view just decoration? Answer: no, it is an analysis surface for bridges, sparse clusters, and knowledge gaps.

### Round 4: Standard flow
10. What is the normal writing flow? Answer: choose a group, choose a folder, create a markdown file, edit it, save it, then inspect backlinks and search.
11. When should you use Mermaid? Answer: when the content is better expressed as a process, structure, or dependency graph.
12. When should you use math blocks? Answer: when you need precise notation, derivations, or analytical expressions.

### Round 5: Collaboration paths
13. Which module works most closely with Documents? Answer: Chat.
14. Why not dump all long-lived material straight into Chat? Answer: because chat context drifts while documents need stable structure, storage, and traceable links.
15. When do Agents matter here? Answer: when you want Document editor or another agent to help create, rewrite, or organize content.

### Round 6: Advanced use
16. What is the real advanced value of Documents? Answer: not just markdown editing, but turning knowledge into searchable, linkable, observable local assets.
17. When is the graph view most useful? Answer: after you have enough notes to expose broken links and unexpected relationships.
18. When is health analysis worth checking? Answer: when your note base is growing and you suspect the structure is getting uneven.

### Round 7: Judging outcomes
19. What does a healthy document area look like? Answer: clear topic boundaries, stable folders, searchable content, and important notes with backlinks instead of isolation.
20. What does “lots of notes but little value” look like? Answer: duplicated content, inconsistent names, few links, and poor retrieval.
21. When should you split into a new document group? Answer: when the topic, audience, or work domain is no longer aligned with the original area.

### Round 8: Common failures
22. What should you check when search quality is poor? Answer: naming, headings, keywords, and whether the notes were actually saved.
23. Why can the graph feel useless? Answer: usually because linking habits are weak and relationships were never made explicit.
24. What should you do after a messy import? Answer: clean up groups and folders first, normalize naming, then restore important links.

### Round 9: Safety boundaries
25. What should you treat carefully in Documents? Answer: sensitive imports, exports, and what gets injected into Chat.
26. Why should document context be selected instead of dumped wholesale? Answer: because indiscriminate injection raises cost and can leak irrelevant sensitive material into a task.
27. What does local-first mean here? Answer: your knowledge assets live in the local workbench by default instead of requiring a remote backend.

### Round 10: Maintenance and iteration
28. How do you maintain the document space over time? Answer: prune duplicates, strengthen key backlinks, and split hot topics into stable folders.
29. When should you hand document work to agents? Answer: when your structure and writing rules are stable enough for AI to apply consistently.
30. What should you optimize first in Documents? Answer: structure and naming first, then graph relationships, then automation.

## 3. Pipeline

If you want the ultra-detailed version, continue to [docs/user/PIPELINE_DEEP_DIVE_EN.md](../user/PIPELINE_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Pipeline solve? Answer: it saves multi-step agent work as repeatable workflows.
2. When should you open Pipeline first? Answer: when you have already performed the same workflow manually more than once and the steps are stabilizing.
3. What should be ready before you start? Answer: working agents, usable models, and a workflow worth standardizing.

### Round 2: First-time setup
4. What should you do first when creating a pipeline? Answer: define the target output before adding steps.
5. Should the first version be complex? Answer: no, start with the shortest runnable flow.
6. Why avoid overbuilding the first draft? Answer: because long flows are much harder to debug and maintain.

### Round 3: Core objects
7. What are the core objects in Pipeline? Answer: saved pipelines, steps, variables, budgets, and execution history.
8. What does `runIf` do? Answer: it controls whether a step runs or gets skipped under certain conditions.
9. Why do budgets matter? Answer: they constrain total duration, total tokens, or maximum steps so runtime does not sprawl.

### Round 4: Standard flow
10. What is the standard authoring flow? Answer: name the pipeline, describe it, add steps, assign agents, define variables and conditions, run it, then inspect history.
11. Why is dry-run useful? Answer: it exposes structure, variable, and condition issues before a full execution.
12. What should you inspect after a real run? Answer: step states, outputs, errors, and execution engine or fallback labels.

### Round 5: Collaboration paths
13. Which modules work most closely with Pipeline? Answer: Agents, Chat, and Timer.
14. When should a chat workflow become a pipeline? Answer: when the conversation reveals a stable multi-step pattern.
15. When should you add Timer? Answer: when the workflow must happen on a schedule, not just on demand.

### Round 6: Advanced use
16. What are the most valuable advanced features? Answer: variable passing, conditional execution, budgets, and persistent history.
17. Why does Mermaid preview matter? Answer: it lets you validate the process shape before you spend runtime on it.
18. When do retries and backoff help? Answer: when steps depend on flaky providers, external tools, or network edges.

### Round 7: Judging outcomes
19. What makes a pipeline good? Answer: clear step boundaries, traceable inputs and outputs, debuggable failures, and controlled cost.
20. What makes a pipeline look powerful but hard to keep? Answer: too many steps, tightly coupled prompts, unreadable history, and constant manual rescue.
21. When should one pipeline become two? Answer: when one flow mixes different goals or trigger contexts.

### Round 8: Common failures
22. What should you check first when a pipeline fails? Answer: the step agent, inputs, variable references, and tool permissions.
23. What does a fallback warning mean? Answer: that execution fell back from the workflow path to the legacy path or another safe downgrade.
24. Why do steps sometimes skip unexpectedly? Answer: usually because of `runIf`, variable values, or disabled steps.

### Round 9: Safety boundaries
25. What is the main risk surface of Pipeline? Answer: connecting high-risk tools, external systems, and sensitive content across multiple automated steps.
26. Why should steps stay single-purpose? Answer: because narrow steps are easier to debug and easier to permission correctly.
27. When should you step back into Settings or Agents? Answer: when the real issue is provider setup, agent policy, or global tool security rather than workflow design.

### Round 10: Maintenance and iteration
28. When should you review a pipeline? Answer: when history shows repeated errors, rising cost, or too much manual intervention.
29. When should you export a backup? Answer: before major edits to steps, variables, or budgets.
30. What should you optimize first? Answer: shorten the path, stabilize inputs and outputs, then add more advanced branching.

## 4. Models

If you want the ultra-detailed version, continue to [docs/user/MODELS_DEEP_DIVE_EN.md](../user/MODELS_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Models solve? Answer: it manages providers, enabled models, connection tests, and model comparison.
2. When should you open Models first? Answer: whenever any AI capability stops working.
3. What should you prepare? Answer: API keys, local endpoints, or private gateway details.

### Round 2: First-time setup
4. Which subview should you open first? Answer: `Providers`.
5. Is provider setup enough by itself? Answer: no, you still need to enable concrete models in `Models`.
6. Why test the connection early? Answer: to expose key, base URL, and model-ID issues before you debug other modules.

### Round 3: Core objects
7. What are the core objects in Models? Answer: provider configs, provider model lists, enablement state, and model parameters.
8. What is the difference between a provider and a model? Answer: the provider is the connection surface; the model is the capability actually consumed by the app.
9. What is the purpose of Compare? Answer: to help you evaluate speed, quality, and stability before binding a model to real workflows.

### Round 4: Standard flow
10. What is the standard setup flow? Answer: create a provider, fill key and base URL, save, test it, enable models, then use them elsewhere.
11. How is Ollama different from hosted providers? Answer: it usually talks to a local endpoint and does not depend on a cloud API key.
12. When is OpenAI-compatible useful? Answer: for private gateways, self-hosted proxies, or vendors that expose the OpenAI protocol.

### Round 5: Collaboration paths
13. Which modules depend most on Models? Answer: Chat, Agents, Pipeline, Timer, and Channels.
14. Why should you revisit Models when an agent performs poorly? Answer: because many apparent agent issues are actually model choice or model enablement issues.
15. What can Compare influence? Answer: default model choice, per-agent bindings, and workflow cost design.

### Round 6: Advanced use
16. What is the advanced value of Models? Answer: running cloud, local, and compatible-gateway models from the same workbench.
17. Why should UI support and runtime support be treated separately? Answer: because runtime provider support is broader than the current editor UI.
18. When should you keep multiple providers? Answer: when you need to balance cost, speed, context length, and redundancy.

### Round 7: Judging outcomes
19. What counts as a finished model setup? Answer: the provider connects, at least one model is enabled, and Chat can use it successfully.
20. What counts as “configured but not actually usable”? Answer: the provider exists but models are disabled or never selected downstream.
21. When should a model be retired? Answer: when it is consistently broken, overpriced, or replaced by a better option.

### Round 8: Common failures
22. What should you check first when connection fails? Answer: the API key, base URL, model ID, and network or proxy path.
23. Why can a model disappear from the app? Answer: because it was never synced from the provider or was not enabled.
24. What should you do if Chat still fails after saving a provider? Answer: go back to `Models -> Models`, confirm enablement, then reselect the model in Chat.

### Round 9: Safety boundaries
25. What is the most sensitive data in Models? Answer: API keys and private gateway endpoints.
26. Why should you care about the secure-storage warning? Answer: because it decides whether keys are safely persisted or only kept in memory.
27. What is the risk of a bad base URL? Answer: requests can fail, hit the wrong environment, or send sensitive traffic to an untrusted service.

### Round 10: Maintenance and iteration
28. When should you review model setup? Answer: when providers multiply, cost rises, or quality becomes inconsistent.
29. How do you keep the model list manageable? Answer: only enable the models you actually use.
30. What should you optimize first? Answer: provider stability first, then model list hygiene, then task-specific comparisons.

## 5. Agents

If you want the ultra-detailed version, continue to [docs/user/AGENTS_DEEP_DIVE_EN.md](../user/AGENTS_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Agents solve? Answer: it turns role, prompt, model preference, skills, tool permissions, and behavior into reusable execution units.
2. When should you open Agents first? Answer: when you keep restating the same role, format, and safety boundaries.
3. What should be ready first? Answer: at least one usable model and a rough idea of the job the agent should own.

### Round 2: First-time setup
4. What should you inspect first? Answer: the built-in agents so you understand which are general-purpose, which are builders, and which are specialist roles.
5. Should you always start from a blank agent? Answer: no, duplicating an existing one is often faster and safer.
6. What are the minimum fields for a usable agent? Answer: a name, a system prompt, a model preference, and enabled state.

### Round 3: Core objects
7. What are the core agent settings? Answer: prompt, model, skills, temperature, token limits, max turns, tool allow and deny lists, permission mode, and memories.
8. What is the relationship between skills and agents? Answer: skills provide reusable domain instructions and resources; agents decide when to use them.
9. Why is an agent more than a prompt preset? Answer: because it also carries runtime limits, tool policy, and memory behavior.

### Round 4: Standard flow
10. What is the normal process for creating an agent? Answer: duplicate or create, name it, write the prompt, pick a model, attach skills, tune behavior, set tool policy, test, then save.
11. Why does the in-module test surface matter? Answer: because it validates behavior before you pollute real sessions.
12. When should you make a version snapshot? Answer: before major edits to prompts, permissions, or skill bindings.

### Round 5: Collaboration paths
13. Which modules use agents most heavily? Answer: almost every AI-facing module, especially Chat, Pipeline, Timer, and Channels.
14. When should you leave Chat and return to Agents? Answer: when the failure is the role definition, not just the wording of the task.
15. What is the role of Skills here? Answer: they stabilize repeated domain behavior across agents.

### Round 6: Advanced use
16. What is the value of built-in builder agents? Answer: they help create agents, pipelines, timers, or channels without directly completing the end business task.
17. When should memories be enabled? Answer: when an agent needs to accumulate reusable preferences or long-lived patterns.
18. When do tool allow and deny lists matter? Answer: when you want explicit control over risk or scope.

### Round 7: Judging outcomes
19. What makes an agent good? Answer: a clear role, stable output style, tight permissions, and obvious boundaries.
20. What does overfitting look like? Answer: it performs well only in a narrow prompt shape and falls apart elsewhere.
21. When should one agent become two? Answer: when one profile mixes conflicting styles or permission needs.

### Round 8: Common failures
22. What should you check first when an agent performs poorly? Answer: model choice, system prompt, skills, and tool permissions.
23. Why might an agent refuse to use tools? Answer: because of permission mode, allow or deny rules, model capability, or an unclear task.
24. What should you do with imported agents? Answer: test them locally first and normalize their model, skills, and permissions before wider use.

### Round 9: Safety boundaries
25. What is the main risk in Agents? Answer: combining broad tool permissions with vague system prompts.
26. Why are specialist agents often safer than general agents? Answer: because narrower responsibilities are easier to permission and validate.
27. Which agents deserve extra caution? Answer: automated agents tied to Channels, Timer, or high-risk tools.

### Round 10: Maintenance and iteration
28. How should agents be maintained over time? Answer: keep snapshots, prune prompt sprawl, and review failed cases.
29. When should an agent be retired? Answer: when its purpose overlaps heavily or its maintenance cost outweighs its value.
30. What should you optimize first? Answer: system prompt first, then model binding, then skills and tool strategy.

## 6. Skills

If you want the ultra-detailed version, continue to [docs/user/SKILLS_DEEP_DIVE_EN.md](../user/SKILLS_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Skills solve? Answer: it packages reusable domain instructions, process rules, and resources around `SKILL.md`.
2. When should you open Skills first? Answer: when you want multiple agents to share the same domain behavior instead of copying prompts.
3. What should you understand first? Answer: a skill is not the low-level tool registry; it is a prompt and resource package.

### Round 2: First-time setup
4. What should you look at first? Answer: installed skills and the source filter.
5. Should you install or edit first? Answer: install existing skills first when possible, then edit or create only when necessary.
6. When do external directories matter? Answer: when you maintain a shared skill library outside the current workspace.

### Round 3: Core objects
7. What are the core objects in Skills? Answer: metadata, `SKILL.md` content, resource trees, source, and enabled state.
8. Why does source matter? Answer: because local, project, user, registry, and shared-directory skills behave differently.
9. Why does the resource tree matter? Answer: because a skill can carry templates, scripts, notes, and assets, not just text.

### Round 4: Standard flow
10. What is the standard skill workflow? Answer: create or import a skill, edit `SKILL.md`, add resources, save it, bind it to an agent, then test that agent.
11. What is the difference between importing a file and a folder? Answer: a file import is lightweight; a folder import supports a full bundled skill.
12. What is the difference between markdown export and zip export? Answer: markdown exports text only; zip exports the full package.

### Round 5: Collaboration paths
13. Which module works most closely with Skills? Answer: Agents.
14. Why not just paste skill content into an agent prompt? Answer: because that hurts reuse, versioning, and source management.
15. What is the team value of external directories? Answer: they let multiple workspaces load the same shared skill source.

### Round 6: Advanced use
16. What is the advanced value of Skills? Answer: they turn personal operating knowledge into portable, versionable prompt assets.
17. Why does source-path normalization matter? Answer: because Claude Code and other agent directories have compatibility mapping.
18. When is a skill better than a new agent? Answer: when the changing part is domain knowledge rather than role or permissions.

### Round 7: Judging outcomes
19. What makes a skill good? Answer: clear scope, actionable instructions, stable resources, and consistent value across multiple agents.
20. What makes a skill bad? Answer: bloated content, conflicting rules, or a messy resource tree that destabilizes agents.
21. When should one skill become several? Answer: when it mixes unrelated domains or incompatible operating modes.

### Round 8: Common failures
22. What if a bound skill has little effect? Answer: verify the agent actually enables it and that the skill text is specific enough.
23. Why do imports fail? Answer: common causes are malformed folder structure, parse errors, or incomplete bundles.
24. What if an external directory does not load? Answer: confirm the directory is enabled and the workspace settings were actually saved.

### Round 9: Safety boundaries
25. What is the main risk in Skills? Answer: packaging risky scripts, vague instructions, or untrusted resources into agent context.
26. Why does “skills are not tools” matter? Answer: because skills must not be confused with a way to bypass runtime tool permissions.
27. When should registry skills be treated carefully? Answer: when the source is unclear, the bundle is large, or it includes executable resources.

### Round 10: Maintenance and iteration
28. How should skills be maintained over time? Answer: manage them by source, export backups, prune duplicates, and review actual effect.
29. When should you move to a shared directory? Answer: when a skill graduates from personal experimentation to team asset.
30. What should you optimize first? Answer: scope clarity and content quality first, then resources, then source management.

## 7. Timer

If you want the ultra-detailed version, continue to [docs/user/TIMER_DEEP_DIVE_EN.md](../user/TIMER_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Timer solve? Answer: it triggers reminders, agent prompts, or saved pipelines on time.
2. When should you open Timer first? Answer: when a workflow must happen on a schedule, not just on demand.
3. What should be ready first? Answer: the agent or pipeline the timer will trigger.

### Round 2: First-time setup
4. What is the first scheduling question? Answer: is this a one-time, interval, or cron task?
5. Which type is safest for beginners? Answer: once or low-frequency interval timers.
6. Why avoid high-frequency timers early? Answer: because they amplify model cost and misfires very quickly.

### Round 3: Core objects
7. What are the core objects in Timer? Answer: scheduled tasks, schedule types, action types, enabled state, next run, and recent history.
8. What action types exist? Answer: desktop notification, agent prompt, and saved pipeline execution.
9. Why does Timer load pipelines? Answer: because pipeline execution is one of its primary actions.

### Round 4: Standard flow
10. What is the standard timer flow? Answer: name the task, choose the schedule type, set the time rule, choose the action, bind an agent or pipeline, save it, enable it, and inspect the next run.
11. Why is Run now useful? Answer: because you can validate the action path before waiting for real time.
12. When do timezone and missed-run policies matter? Answer: when the machine sleeps, the work crosses timezones, or catch-up behavior matters.

### Round 5: Collaboration paths
13. Which modules work most closely with Timer? Answer: Pipeline, Agents, and Settings.
14. When is a direct agent prompt enough? Answer: for lightweight prompts, short summaries, or simple reminders.
15. When is a pipeline a better action? Answer: when the task is multi-step, structured, or retry-sensitive.

### Round 6: Advanced use
16. What is the advanced value of Timer? Answer: turning manual AI tasks into observable scheduled workflows.
17. When is AI Create useful? Answer: when you know the business goal but do not want to hand-fill all timer fields.
18. When should retries be configured explicitly? Answer: when the action depends on providers, networks, or external systems.

### Round 7: Judging outcomes
19. What makes a timer good? Answer: clear timing, validated action paths, controlled retries, and reasonable model cost.
20. What makes a running timer low-value? Answer: nobody uses the output, timing is wrong, or the automation should not exist.
21. When should one timer become several? Answer: when timing, timezone, or action semantics are different.

### Round 8: Common failures
22. What should you check when a timer does not fire? Answer: enabled state, schedule validity, and the next-run timestamp.
23. What if it fires but produces nothing useful? Answer: inspect the bound agent, pipeline, provider, and logs.
24. Why does cron fail so often? Answer: because the expression is wrong or the runtime assumptions are wrong.

### Round 9: Safety boundaries
25. What is the main risk in Timer? Answer: automatically repeating expensive or high-permission work without human supervision.
26. Why do scheduled tasks demand more restraint than manual tasks? Answer: because mistakes repeat in the background.
27. Which timer actions should always be tested manually first? Answer: anything that touches models, tools, pipelines, or external platforms.

### Round 10: Maintenance and iteration
28. How should timers be maintained? Answer: prune stale tasks, review failure patterns, and consolidate overlaps.
29. When should a timer be disabled instead of patched? Answer: when it no longer has business value or the schedule is obviously wrong.
30. What should you optimize first? Answer: schedule correctness first, then action correctness, then retry behavior.

## 8. Channels

If you want the ultra-detailed version, continue to [docs/user/CHANNELS_DEEP_DIVE_EN.md](../user/CHANNELS_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Channels solve? Answer: it connects external messaging platforms to the workbench and routes incoming messages to a selected agent.
2. When should you open Channels first? Answer: when Suora needs to receive work from outside the desktop UI.
3. What should you prepare? Answer: platform credentials, webhook or stream details, and the reply agent.

### Round 2: First-time setup
4. What should you decide first for a new channel? Answer: target platform, transport mode, and reply agent.
5. Which platforms currently exist? Answer: WeChat Work, Personal WeChat, WeChat Official Account, WeChat Mini Program, Feishu, DingTalk, Slack, Telegram, Discord, Teams, Email, and Custom.
6. How do you choose between webhook and stream? Answer: use stream when available and you do not want a public callback, otherwise use webhook.

### Round 3: Core objects
7. What are the core objects in Channels? Answer: channel config, platform credentials, connection mode, reply agent, messages, users, health state, and debug logs.
8. Why bind one agent per channel? Answer: because it stabilizes the tone and permission boundary for that incoming source.
9. Why does `allowedChats` matter? Answer: it limits which conversations can trigger inbound processing.

### Round 4: Standard flow
10. What is the normal channel flow? Answer: choose a platform, fill credentials, choose mode, bind the agent, save, start the service or connection, send a test message, then inspect health and debug.
11. Which detail tab should you inspect first? Answer: Config first, then Health, then Debug.
12. Why does message history matter? Answer: it confirms whether the upstream platform is actually delivering traffic.

### Round 5: Collaboration paths
13. Which modules work most closely with Channels? Answer: Models, Agents, Settings, and Logs.
14. Why must the reply agent be stable before a channel goes live? Answer: because the channel is only the inbound surface; behavior quality still depends on the agent.
15. What makes Email different from chat platforms? Answer: it adds IMAP and SMTP configuration, filter rules, and action chains.

### Round 6: Advanced use
16. What is the advanced value of Channels? Answer: it turns the workbench into a multi-entry operating surface rather than a desktop-only chat UI.
17. What is special about Personal WeChat today? Answer: it supports QR-based binding plus bridge and direct polling or reply fields.
18. What can the Email channel do? Answer: poll a mailbox, filter messages, and run auto-reply, forward, label, agent-process, or webhook actions.

### Round 7: Judging outcomes
19. What makes a channel setup successful? Answer: the platform delivers messages, health stays normal, debug stays clean, and the reply agent answers predictably.
20. What counts as “saved but not really live”? Answer: the service is not running, credentials were never validated, or no test message succeeded.
21. When should one channel become several? Answer: when different platforms, audiences, or workflows need different agents and rules.

### Round 8: Common failures
22. What should you check first when no inbound message arrives? Answer: enabled state, server or connection state, and platform-side callback details.
23. What if messages arrive but replies fail? Answer: inspect the reply agent, platform credentials, and model availability.
24. Why can Email appear idle? Answer: because IMAP, SMTP, polling interval, filters, or action rules are wrong.

### Round 9: Safety boundaries
25. What is the main risk in Channels? Answer: connecting auto-reply, high-permission agents, and open inbound surfaces too casually.
26. Why is a whitelist important? Answer: it prevents irrelevant conversations or unknown senders from triggering model usage.
27. Which credentials deserve the most care? Answer: webhook secrets, bot tokens, signing keys, mailbox passwords, and bridge auth tokens.

### Round 10: Maintenance and iteration
28. How should live channels be maintained? Answer: review Health, Debug, message volume, and failure modes before rotating credentials or changing the agent.
29. When should a channel be disabled first? Answer: when auto-replies go wrong, credentials may be compromised, or debug errors persist.
30. What should you optimize first? Answer: transport stability first, then agent stability, then richer automation rules.

## 9. MCP

If you want the ultra-detailed version, continue to [docs/user/MCP_DEEP_DIVE_EN.md](../user/MCP_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does MCP solve? Answer: it connects external MCP services so agents can use additional capabilities.
2. When should you open MCP first? Answer: when built-in tools and ordinary skills are not enough.
3. What should you prepare? Answer: transport details, command or URL, environment variables, and authentication headers if required.

### Round 2: First-time setup
4. What is the first design choice for a new server? Answer: whether it belongs at workspace scope or user scope.
5. Which transports are supported? Answer: `stdio`, `http`, `sse`, and `ws`.
6. Which transport is easiest to start with? Answer: `http` or `sse` for mature services, then `stdio` for local command-backed servers.

### Round 3: Core objects
7. What are the core objects in MCP? Answer: server config, transport, scope, arguments, env vars, auth headers, status, and exposed tools.
8. Why does scope matter? Answer: because it determines whether the config follows one workspace or the wider user environment.
9. Why should you care about exposed tools? Answer: because that determines what agents can actually call.

### Round 4: Standard flow
10. What is the standard setup flow? Answer: add a server, choose transport, fill command or URL, add env or headers, save it, test it, then bind it through agents.
11. Why test the connection early? Answer: because it isolates config issues before you debug real task execution.
12. When do headers or env vars matter? Answer: when the remote service or local process depends on auth or runtime environment.

### Round 5: Collaboration paths
13. Which modules work most closely with MCP? Answer: Agents, Chat, and Settings.
14. Why is it safer to configure MCP before tuning agents? Answer: because the agent tool boundary means little until the service actually connects.
15. What is the difference between Skills and MCP? Answer: skills package instructions and resources, while MCP exposes real external capabilities.

### Round 6: Advanced use
16. What is the advanced value of MCP? Answer: it extends the workbench into a tool-using execution surface that can reach external systems.
17. When is `stdio` a good fit? Answer: for local command-backed tools or development-stage services.
18. When are `ws` and `sse` useful? Answer: when the MCP service depends on longer-lived streams or live updates.

### Round 7: Judging outcomes
19. What counts as a finished MCP setup? Answer: the server connects, exposes usable capabilities, and agents can call them in real tasks.
20. What counts as “saved but not really connected”? Answer: the config exists but status never turns healthy or agents never consume it.
21. When should one server become several? Answer: when capability domains, trust levels, or scopes differ materially.

### Round 8: Common failures
22. What should you check first when connection fails? Answer: transport, URL, command, working directory, env vars, and auth headers.
23. Why can a URL look valid but still fail? Answer: unsupported protocol, service downtime, or unreachable network paths.
24. What if agents cannot see MCP capability? Answer: confirm server status first, then inspect the agent runtime path.

### Round 9: Safety boundaries
25. What is the main risk in MCP? Answer: exposing powerful external capabilities to broad-permission agents.
26. Why should scope be chosen carefully? Answer: because user-scoped services affect more workspaces and widen the blast radius.
27. Which services deserve the most scrutiny? Answer: those that touch filesystems, shell commands, production systems, or long-lived secrets.

### Round 10: Maintenance and iteration
28. How should MCP be maintained? Answer: split by service domain, test regularly, and prune stale endpoints and credentials.
29. When should a service be disabled first? Answer: when behavior looks abnormal, permissions are unclear, or status remains unstable.
30. What should you optimize first? Answer: connectivity first, then permission boundaries, then breadth of capability.

## 10. Settings

If you want the ultra-detailed version, continue to [docs/user/SETTINGS_DEEP_DIVE_EN.md](../user/SETTINGS_DEEP_DIVE_EN.md).

### Round 1: Positioning and entry
1. What problem does Settings solve? Answer: it centralizes appearance, security, data handling, knowledge settings, automation, plugins, logs, and system state.
2. When should you open Settings first? Answer: when you need to control workspace-wide behavior instead of a single local screen.
3. Which sections exist today? Answer: `general`, `security`, `voice`, `shortcuts`, `data`, `knowledge`, `events`, `external-dirs`, `plugins`, `logs`, and `system`.

### Round 2: First-time setup
4. Which sections should most users inspect first? Answer: General and Security.
5. Why start with General? Answer: because it defines theme, language, workspace defaults, proxy, and baseline environment settings.
6. Why inspect Security next? Answer: because filesystem rules, tool confirmation, and dangerous-pattern blocking affect the whole workbench.

### Round 3: Core objects
7. What are the core objects in Settings? Answer: theme and language, tool security, shortcuts, import/export settings, knowledge settings, event automation, external directories, plugins, logs, and system data.
8. Why does Settings affect every module? Answer: because keys, tool policy, logging, data paths, and external resources are controlled here.
9. How do external directories relate to Skills and Agents? Answer: they are the entry path for shared resource directories into the current workspace.

### Round 4: Standard flow
10. What is the standard settings review flow? Answer: start in General, then Security, then inspect Data, Logs, System, and task-specific sections.
11. When should you export data? Answer: before major edits, environment moves, or large configuration imports.
12. When are Logs most valuable? Answer: when something feels wrong but the root cause is still unclear.

### Round 5: Collaboration paths
13. Which modules depend most on Settings? Answer: almost all of them, especially Models, Skills, Agents, Channels, and MCP.
14. Why do external directories matter downstream? Answer: because shared skill and agent resources load through them.
15. Why are Logs and System not secondary screens? Answer: because they expose runtime evidence and health signals that other modules cannot.

### Round 6: Advanced use
16. What is the advanced value of Settings? Answer: it turns the workbench from merely runnable into controllable, diagnosable, and portable.
17. What is the purpose of Events? Answer: to manage automation triggered by files, clipboard, startup, and other events.
18. When does Knowledge become important? Answer: when document and semantic-recall behavior becomes part of a long-lived knowledge workflow.

### Round 7: Judging outcomes
19. What makes settings healthy? Answer: the UI feels stable, permissions are not overly broad, logs are useful, data is exportable, and shared directories are organized.
20. What does settings sprawl look like? Answer: too much permission, unclear key state, stale directories, unused plugins, and no backup discipline.
21. When should settings be cleaned up? Answer: when old agents, directories, plugins, or automations no longer serve current workflows.

### Round 8: Common failures
22. What should you check when a setting change has no effect? Answer: whether it was saved, whether it is workspace-scoped, and whether another layer is caching it.
23. Why can model keys disappear after restart? Answer: because secure storage was unavailable and the keys remained in memory only.
24. What if external directories fail to load? Answer: check the path, enabled state, and whether workspace settings actually saved.

### Round 9: Safety boundaries
25. What is the main risk in Settings? Answer: widening global permissions and external entry points without realizing the impact.
26. Which sections deserve the most caution? Answer: Security, External Directories, Plugins, and Data.
27. Why are logs also part of safety? Answer: because they are the evidence surface for abnormal execution and configuration faults.

### Round 10: Maintenance and iteration
28. When should Settings be reviewed again? Answer: after adding new automation classes, external channels, or shared directories.
29. When should you back up immediately? Answer: before major global changes or large imports.
30. What should you optimize first? Answer: safety first, then data hygiene, then automation and extension breadth.