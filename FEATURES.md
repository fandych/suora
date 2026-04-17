# Suora - New Features Documentation

This document describes the new features and enhancements added to Suora.

## Table of Contents

- [Enhanced Builtin Tools & Agents](#enhanced-builtin-tools--agents)
- [External Directory Support](#external-directory-support)
- [Cron Timer Support](#cron-timer-support)
- [Data Export/Import](#data-exportimport)
- [UI Enhancements](#ui-enhancements)

---

## Enhanced Builtin Tools & Agents

### New Builtin Tools (14 tools)

#### Advanced Interaction Tools
- **`ask_user_question`** - Interactive user prompts with optional context
  - Use to gather user input during agent execution
  - Supports context parameter for additional information

- **`loop_execute`** - Iteration control for repetitive tasks
  - Execute actions 1-100 times
  - Supports variable passing between iterations
  - Useful for batch operations

#### Git Operations (5 tools)
- **`git_status`** - Check repository status
- **`git_diff`** - View file changes
- **`git_log`** - View commit history
- **`git_commit`** - Create commits
- **`git_add`** - Stage files for commit

#### Code Analysis (2 tools)
- **`analyze_code_structure`** - Analyze codebase structure
  - Identify classes, functions, imports
  - Generate architecture overview

- **`find_code_patterns`** - Find code patterns and TODO comments
  - Search for specific patterns
  - Locate technical debt markers

### New Builtin Skills (3 skills)

1. **`builtin-git`** - Git Version Control
   - Includes all 5 git operation tools
   - Icon: 🔀

2. **`builtin-code-analysis`** - Code Analysis
   - Includes 2 code analysis tools
   - Icon: 🔬

3. **`builtin-advanced-interaction`** - Advanced Interaction
   - Includes loop and ask user question tools
   - Icon: 🎯

### New Specialized Agents (6 agents)

#### 🧑‍💻 Code Expert
- **Temperature**: 0.5 (precise)
- **Skills**: Git, code analysis, filesystem, shell, web, utilities, memory
- **Specialization**: Code review, debugging, optimization, bug identification
- **Use Cases**: Code audits, performance optimization, technical explanations

#### ✍️ Writer
- **Temperature**: 0.8 (creative)
- **Skills**: Filesystem, web, utilities, memory, todo
- **Specialization**: Content creation, editing, proofreading
- **Use Cases**: Articles, documentation, creative writing

#### 📚 Researcher
- **Temperature**: 0.6 (balanced)
- **Skills**: Web, browser, filesystem, utilities, memory, todo
- **Specialization**: Research, fact-checking, information synthesis
- **Use Cases**: Research reports, source compilation, fact verification

#### 📊 Data Analyst
- **Temperature**: 0.5 (precise)
- **Skills**: Filesystem, shell, utilities, memory, code analysis
- **Specialization**: Data processing, statistical analysis, insights
- **Use Cases**: Dataset analysis, trend identification, data visualization insights

#### 🚀 DevOps Engineer
- **Temperature**: 0.4 (very precise)
- **Skills**: Shell, filesystem, git, utilities, memory, timer, event automation
- **Specialization**: Deployment, infrastructure, automation, system administration
- **Use Cases**: CI/CD pipelines, infrastructure management, system troubleshooting

#### 🛡️ Security Auditor
- **Temperature**: 0.3 (extremely precise)
- **Skills**: Filesystem, code analysis, git, shell, utilities, memory
- **Specialization**: Security assessment, vulnerability analysis, best practices
- **Use Cases**: Security audits, code vulnerability scans, security recommendations

---

## External Directory Support

### Overview
Load skills and agents from external directories on your filesystem, allowing for:
- Sharing configurations across machines
- Version-controlled skill/agent definitions
- Separation of custom vs. builtin resources

### Supported Directories

#### Default Locations
- `~/.agents/skills` - User agent skills directory
- `~/.claude/skills` - Claude skills directory
- `~/.agents/agents` - User agents directory
- `~/.claude/agents` - Claude agents directory

#### Custom Paths
- Add any custom directory path
- Supports `~` expansion for home directory
- Enable/disable directories individually

### Configuration

1. Navigate to **Settings** → **External Directories**
2. Use **Quick Add** buttons for default directories, or
3. Enter custom path and select type (skills/agents)
4. Click **Add** to configure
5. Toggle enabled/disabled for each directory
6. Resources reload automatically when directories are modified

### File Format

#### Skill Definition (JSON)
```json
{
  "id": "my-custom-skill",
  "name": "My Custom Skill",
  "description": "Description of the skill",
  "type": "custom",
  "enabled": true,
  "tools": [
    {
      "id": "tool-1",
      "name": "Tool Name",
      "description": "Tool description",
      "params": []
    }
  ],
  "icon": "⚡"
}
```

#### Agent Definition (JSON)
```json
{
  "id": "my-custom-agent",
  "name": "My Custom Agent",
  "avatar": "🤖",
  "systemPrompt": "You are a specialized agent...",
  "modelId": "",
  "skills": ["builtin-filesystem", "builtin-shell"],
  "temperature": 0.7,
  "maxTokens": 4096,
  "enabled": true,
  "greeting": "Hello! I'm your custom agent.",
  "responseStyle": "balanced",
  "autoLearn": true
}
```

### Visual Indicators

Skills and agents show badges indicating their source:
- **`builtin`** - Built into the application
- **`.agents`** - Loaded from `~/.agents/*` directory
- **`.claude`** - Loaded from `~/.claude/*` directory
- No badge - Custom workspace resources

---

## Cron Timer Support

### Overview
Schedule tasks using standard cron expressions for flexible, recurring automation.

### Cron Expression Format
```
minute hour day month weekday
```

#### Examples
- `0 9 * * 1-5` - 9 AM every weekday
- `0 */2 * * *` - Every 2 hours
- `30 8 * * 1` - 8:30 AM every Monday
- `0 0 1 * *` - Midnight on the 1st of every month
- `*/15 * * * *` - Every 15 minutes

### Features

#### Real-time Validation
- Instant feedback on cron expression validity
- Error messages for invalid expressions
- Format helper text displayed inline

#### Execution Preview
- Shows next 5 scheduled execution times
- Updates live as you type
- Helps verify timing is correct before saving

#### Timer Types
1. **Once** - Single execution at specific date/time
2. **Interval** - Repeat every N minutes
3. **Cron** - Advanced scheduling with cron expressions

### Usage

1. Navigate to **Timer** section
2. Click **+ New Timer**
3. Select **cron** type
4. Enter cron expression (e.g., `0 9 * * 1-5`)
5. Choose action: **Notify** or **Prompt agent**
6. Enter notification text or agent prompt
7. Save timer

### Implementation Details

- Uses `cron-parser` library for robust parsing
- Computed in Electron main process for accuracy
- Persists to `{workspace}/timers/config.json`
- Checks for due timers every 15 seconds
- Supports all standard cron syntax

---

## Data Export/Import

### Export Functionality

Export your complete configuration to a JSON file:
- Custom agents (builtin agents excluded)
- Custom skills (builtin skills excluded)
- All chat sessions and messages
- Provider configurations
- External directory settings

#### Export File Structure
```json
{
  "version": "1.0",
  "exportedAt": "2026-03-26T22:00:00.000Z",
  "agents": [...],
  "skills": [...],
  "sessions": [...],
  "providerConfigs": [...],
  "externalDirectories": [...]
}
```

#### Usage
1. Navigate to **Settings** → **Data**
2. Click **📥 Export All Data**
3. File saved as `suora-export-{timestamp}.json`

### Import Functionality

Import previously exported data:
- Merges with existing data (doesn't replace)
- Validates JSON structure
- Shows success/error messages

#### Usage
1. Navigate to **Settings** → **Data**
2. Click **📤 Import Data**
3. Select exported JSON file
4. Data merged into current workspace

### Clear Chat History

Permanently delete all chat sessions:
- Confirmation dialog before deletion
- Cannot be undone
- Agents, skills, and settings preserved

---

## UI Enhancements

### Source Badges
Visual indicators showing resource origin:
- Displayed next to skill/agent names
- Color-coded for easy identification
- Helps distinguish builtin from custom resources

### Settings Organization
Improved settings panel structure:
- Clear section headers
- Descriptive help text
- Organized by functionality
- Quick-add buttons for common tasks

### Form Improvements
- Inline validation feedback
- Real-time preview (cron timers)
- Clear placeholder text
- Error highlighting

### Status Indicators
- **ON/OFF** badges for disabled resources
- **Auto-learn** indicator for agents
- Memory count display
- Visual feedback on actions

---

## Best Practices

### External Directories
- Use version control (git) for external skill/agent directories
- Keep directory structures organized
- Test skills/agents before enabling
- Document custom configurations

### Timer Scheduling
- Verify cron expressions with preview
- Consider timezone when scheduling
- Test timers with notifications first
- Use descriptive timer names

### Data Management
- Export data regularly for backups
- Store exports in secure location
- Review data before importing
- Keep exports organized by date

### Agent Usage
- Select specialized agents for specific tasks
- Adjust temperature for desired creativity
- Enable auto-learn for personalization
- Review agent memories periodically

---

## Troubleshooting

### External Directory Issues
- **Skills not loading**: Check JSON syntax, ensure `enabled: true`
- **Path not found**: Verify path exists, check permissions
- **Duplicate IDs**: Ensure unique IDs for all skills/agents

### Timer Issues
- **Cron not firing**: Validate expression, check system time
- **Wrong timezone**: Times are in system local timezone
- **Timer disabled**: Check enabled status in timer list

### Import/Export Issues
- **Import fails**: Validate JSON structure, check version compatibility
- **Missing data**: Ensure export completed successfully
- **Duplicate resources**: Remove duplicates manually after import

---

## Version History

### v0.1.0 (Current)
- Added 14 new builtin tools across 3 skills
- Added 6 specialized agents with unique configurations
- External directory support for skills and agents
- Cron expression support for timers
- Enhanced data export/import functionality
- UI improvements with source badges
- Settings panel enhancements

---

## Future Enhancements

Planned features for upcoming releases:
- Keyboard shortcuts customization
- Plugin marketplace integration
- Advanced memory search
- Tool usage analytics
- Agent collaboration features
- Workflow automation builder
- Custom theme support
