import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { loadExternalSkillsAndAgents, saveSettingsToWorkspace, useAppStore } from '@/store/appStore';
import { SidePanel } from '@/components/layout/SidePanel';
import { SkillIcon, IconifyIcon, getSkillIconName, useSkillIconsReady } from '@/components/icons/IconifyIcons';
import { useI18n } from '@/hooks/useI18n';
import type { Skill, SkillBundledResource, SkillsLockfile } from '@/types';
import { CLAUDE_CODE_SKILLS_DIRECTORY, OTHER_AGENTS_SKILLS_DIRECTORY, createBlankSkill, deleteSkillFromDisk, serializeSkillToMarkdown, parseSkillMarkdown, loadSkillsLockfile, getSkillLockStatus, } from '@/services/skillRegistry';
import { confirm } from '@/services/confirmDialog';
import { toast } from '@/services/toast';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { SkillEditor } from './SkillEditor';
import { WorkbenchEmptyState } from '@/components/catalyst-ui/workbench-empty-state';
import { Button as UiButton } from '@/components/catalyst-ui/button';
import { workbenchSidebarAccentActionClass, workbenchSidebarCardClass, workbenchSidebarDescriptionClass, workbenchSidebarIconClass, workbenchSidebarItemClass, workbenchSidebarPillClass, workbenchSidebarPrimaryActionClass, workbenchSidebarSubtleActionClass, workbenchSidebarTitleClass } from '@/components/catalyst-ui/workbench';
import { buildSkillFromDataTransferItems, buildSkillFromFolderFiles, downloadBlob, exportSkillToZipBlob, skillArchiveName } from '@/services/skillArchive';
import { skillDirectorySegment } from '@/utils/pathSegments';
import { Input as UiInput } from "@/components/catalyst-ui/form-controls";
function buildImportedResourceManifest(resources: Array<{
    path: string;
    size: number;
}>): SkillBundledResource[] {
    const manifest = new Map<string, SkillBundledResource>();
    for (const resource of resources) {
        const parts = resource.path.split('/').filter(Boolean);
        for (let i = 1; i < parts.length; i++) {
            const dirPath = parts.slice(0, i).join('/');
            manifest.set(dirPath, { path: dirPath, type: 'directory' });
        }
        manifest.set(resource.path, {
            path: resource.path,
            type: 'file',
            size: resource.size,
            executable: resource.path.toLowerCase().startsWith('scripts/'),
            warning: resource.path.toLowerCase().startsWith('scripts/') ? `Executable script detected: ${resource.path}` : undefined,
        });
    }
    return Array.from(manifest.values()).sort((a, b) => a.path.localeCompare(b.path));
}
function normalizeFsPath(path: string | undefined): string {
    return (path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
function normalizeSkillSourcePath(path: string | undefined): string {
    const normalizedPath = normalizeFsPath(path);
    if (normalizedPath === normalizeFsPath('~/.claude/.suora/skills'))
        return normalizeFsPath(CLAUDE_CODE_SKILLS_DIRECTORY);
    if (normalizedPath === normalizeFsPath('~/.agents/.suora/skills'))
        return normalizeFsPath(OTHER_AGENTS_SKILLS_DIRECTORY);
    return normalizedPath;
}
function countSkillsForDirectory(skills: Skill[], dirPath: string, fallbackSource?: Skill['source']): number {
    const normalizedDirPath = normalizeFsPath(dirPath);
    if (!normalizedDirPath)
        return 0;
    return skills.filter((skill) => {
        const candidatePaths = [skill.skillRoot, skill.filePath]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .map(normalizeFsPath);
        return candidatePaths.some((candidate) => candidate === normalizedDirPath || candidate.startsWith(`${normalizedDirPath}/`))
            || (fallbackSource ? skill.source === fallbackSource : false);
    }).length;
}
export function SkillsLayout() {
    const [panelWidth, setPanelWidth] = useResizablePanel('skills', 340);
    const { skills, addSkill, updateSkill, removeSkill, workspacePath, externalDirectories, addExternalDirectory, updateExternalDirectory, } = useAppStore();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [skillsLockfile, setSkillsLockfile] = useState<SkillsLockfile | null>(null);
    const [togglingLocalSourcePath, setTogglingLocalSourcePath] = useState<string | null>(null);
    const { t } = useI18n();
    useSkillIconsReady();
    const sourceLabels = useMemo<Record<string, string>>(() => ({
        local: t('skills.local', 'Local'),
        project: t('skills.project', 'Project'),
        user: t('skills.user', 'User'),
        registry: t('skills.registry', 'Registry'),
        workspace: t('skills.sharedFolder', 'Shared Folder'),
        'agent-dir': t('skills.otherAgents', 'Other Agents'),
        'claude-dir': t('skills.claudeCode', 'Claude Code'),
    }), [t]);
    const editingSkill = editingId ? skills.find((s) => s.id === editingId) ?? null : null;
    const localSkillSources = useMemo(() => {
        const skillDirectories = externalDirectories.filter((directory) => directory.type === 'skills');
        const configuredDirectories = new Map(skillDirectories.map((directory) => [normalizeSkillSourcePath(directory.path), directory] as const));
        const presetSources = [
            {
                id: 'claude-code',
                path: CLAUDE_CODE_SKILLS_DIRECTORY,
                label: t('skills.claudeCode', 'Claude Code'),
                icon: 'lucide:sparkles',
                description: t('skills.claudeCodeDesc', 'Load skills from the local .claude/skills folder.'),
                enabled: configuredDirectories.get(normalizeSkillSourcePath(CLAUDE_CODE_SKILLS_DIRECTORY))?.enabled ?? false,
                skillCount: countSkillsForDirectory(skills, CLAUDE_CODE_SKILLS_DIRECTORY, 'claude-dir'),
            },
            {
                id: 'other-agents',
                path: OTHER_AGENTS_SKILLS_DIRECTORY,
                label: t('skills.otherAgents', 'Other Agents'),
                icon: 'lucide:folder-open',
                description: t('skills.otherAgentsDesc', 'Load skills from the shared .agents/skills folder.'),
                enabled: configuredDirectories.get(normalizeSkillSourcePath(OTHER_AGENTS_SKILLS_DIRECTORY))?.enabled ?? false,
                skillCount: countSkillsForDirectory(skills, OTHER_AGENTS_SKILLS_DIRECTORY, 'agent-dir'),
            },
        ];
        return presetSources;
    }, [externalDirectories, skills, t]);
    const enabledLocalSkillSourcesCount = localSkillSources.filter((source) => source.enabled).length;
    // Load skills from disk on mount
    useEffect(() => {
        if (!workspacePath)
            return;
        loadExternalSkillsAndAgents().catch(() => {
            // Ignore skill loading errors - user will see empty list
        });
        loadSkillsLockfile(workspacePath).then(setSkillsLockfile).catch(() => {
            // Ignore lockfile errors
        });
    }, [workspacePath]);
    const filteredInstalled = skills;
    const enabledSkillsCount = skills.filter((skill) => skill.enabled).length;
    // ─── Handlers ──────────────────────────────────────────────────
    const handleCreateSkill = () => {
        const newSkill = createBlankSkill(t('skills.addSkillTitle', 'New Skill'));
        addSkill(newSkill);
        setEditingId(newSkill.id);
        setIsAdding(true);
    };
    const handleSave = async (skill: Skill) => {
        let savedSkill = skill;
        // Persist to disk for local/project/user skills. Existing folder-backed
        // skills must write back into their own root; new skills are created under
        // the workspace skills directory.
        if (skill.source !== 'registry') {
            const skillRoot = skill.skillRoot || (workspacePath ? `${workspacePath}/.suora/skills/${skillDirectorySegment(skill.name)}` : '');
            if (skillRoot) {
                try {
                    const ensureResult = await window.electron.invoke('system:ensureDirectory', skillRoot) as {
                        success?: boolean;
                        error?: string;
                    };
                    if (!ensureResult?.success)
                        throw new Error(ensureResult?.error || t('skills.saveFailed', 'Failed to save skill.'));
                    const writeResult = await window.electron.invoke('fs:writeFile', `${skillRoot}/SKILL.md`, serializeSkillToMarkdown(skill)) as {
                        success?: boolean;
                        error?: string;
                    };
                    if (!writeResult?.success)
                        throw new Error(writeResult?.error || t('skills.saveFailed', 'Failed to save skill.'));
                    savedSkill = { ...skill, skillRoot, filePath: `${skillRoot}/SKILL.md` };
                }
                catch (err) {
                    toast.error(t('skills.saveFailed', 'Failed to save skill'), err instanceof Error ? err.message : String(err));
                    return;
                }
            }
            else {
                toast.warning(t('skills.workspaceRequired', 'Please set a workspace path first.'));
            }
        }
        if (editingId)
            updateSkill(editingId, savedSkill);
        else
            addSkill(savedSkill);
        setEditingId(savedSkill.id);
        setIsAdding(false);
    };
    const handleDelete = async (id: string) => {
        const skill = skills.find((s) => s.id === id);
        if (!skill)
            return;
        const ok = await confirm({
            title: t('skills.deleteTitle', 'Delete skill?'),
            body: t('skills.deleteBody', '"{name}" will be permanently removed. This cannot be undone.').replace('{name}', skill.name),
            danger: true,
            confirmText: t('common.delete', 'Delete'),
        });
        if (!ok)
            return;
        if (skill.filePath) {
            await deleteSkillFromDisk(skill.filePath);
        }
        removeSkill(id);
        if (editingId === id)
            setEditingId(null);
    };
    const handleToggleEnabled = (id: string) => {
        const skill = skills.find((s) => s.id === id);
        if (skill)
            updateSkill(id, { enabled: !skill.enabled });
    };
    const handleToggleLocalSkillSource = useCallback(async (path: string, enabled: boolean) => {
        if (!workspacePath) {
            toast.warning(t('skills.workspaceRequired', 'Please set a workspace path first.'));
            return;
        }
        const existing = externalDirectories.find((directory) => directory.path === path && directory.type === 'skills');
        if (existing) {
            updateExternalDirectory(path, { enabled });
        }
        else {
            addExternalDirectory({ path, enabled, type: 'skills' });
        }
        setTogglingLocalSourcePath(path);
        try {
            const saved = await saveSettingsToWorkspace();
            if (!saved) {
                toast.warning(t('skills.saveFailed', 'Failed to save skill.'));
            }
            await loadExternalSkillsAndAgents();
        }
        catch (err) {
            toast.error(t('skills.toggleLocalSourceFailed', 'Failed to update local skill sources'), err instanceof Error ? err.message : String(err));
        }
        finally {
            setTogglingLocalSourcePath(null);
        }
    }, [addExternalDirectory, externalDirectories, t, updateExternalDirectory, workspacePath]);
    const handleExportMarkdown = async (skill: Skill) => {
        if (skill.bundledResources?.length) {
            downloadBlob(await exportSkillToZipBlob(skill), skillArchiveName(skill));
            return;
        }
        const md = serializeSkillToMarkdown(skill);
        downloadBlob(new Blob([md], { type: 'text/markdown' }), `${skill.name.replace(/\s+/g, '-').toLowerCase()}-SKILL.md`);
    };
    const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            const raw = reader.result as string;
            const parsed = parseSkillMarkdown(raw, file.name, 'local');
            if (parsed) {
                addSkill(parsed);
                setEditingId(parsed.id);
                setIsAdding(false);
            }
            else {
                toast.error(t('skills.parseFailed', 'Failed to parse SKILL.md'), t('skills.parseFailedDetail', 'Make sure the file has YAML frontmatter.'));
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
    const folderImportErrorMessage = t('skills.folderImportInvalid', 'The selected folder does not contain a valid SKILL.md file or could not be read.');
    const importSkillFolderBundle = async (bundle: {
        skillMarkdown: string;
        resources: Array<{
            path: string;
            content: string;
            size: number;
        }>;
    } | null) => {
        if (!bundle) {
            toast.error(t('skills.parseFailed', 'Failed to parse SKILL.md'), folderImportErrorMessage);
            return;
        }
        const parsed = parseSkillMarkdown(bundle.skillMarkdown, 'SKILL.md', 'local');
        if (!parsed) {
            toast.error(t('skills.parseFailed', 'Failed to parse SKILL.md'), t('skills.parseFailedDetail', 'Make sure the file has YAML frontmatter.'));
            return;
        }
        const resources = buildImportedResourceManifest(bundle.resources);
        parsed.bundledResources = resources;
        parsed.referenceFiles = resources
            .filter((resource) => resource.type === 'file' && resource.path.toLowerCase().startsWith('references/'))
            .map((resource) => ({ path: resource.path, label: resource.path }));
        if (workspacePath) {
            const skillDir = `${workspacePath}/.suora/skills/${skillDirectorySegment(parsed.name)}`;
            try {
                const ensureRoot = await window.electron.invoke('system:ensureDirectory', skillDir) as {
                    success?: boolean;
                    error?: string;
                };
                if (!ensureRoot?.success)
                    throw new Error(ensureRoot?.error || `Failed to create ${skillDir}`);
                const writeSkill = await window.electron.invoke('fs:writeFile', `${skillDir}/SKILL.md`, bundle.skillMarkdown) as {
                    success?: boolean;
                    error?: string;
                };
                if (!writeSkill?.success)
                    throw new Error(writeSkill?.error || 'Failed to write SKILL.md');
                for (const resource of bundle.resources) {
                    const parent = resource.path.split('/').slice(0, -1).join('/');
                    if (parent) {
                        const ensureParent = await window.electron.invoke('system:ensureDirectory', `${skillDir}/${parent}`) as {
                            success?: boolean;
                            error?: string;
                        };
                        if (!ensureParent?.success)
                            throw new Error(ensureParent?.error || `Failed to create ${parent}`);
                    }
                    const writeResource = await window.electron.invoke('fs:writeFile', `${skillDir}/${resource.path}`, resource.content) as {
                        success?: boolean;
                        error?: string;
                    };
                    if (!writeResource?.success)
                        throw new Error(writeResource?.error || `Failed to write ${resource.path}`);
                }
            }
            catch (err: unknown) {
                toast.error(t('skills.importSkillFolderFailed', 'Failed to import skill folder'), err instanceof Error ? err.message : String(err));
                return;
            }
            parsed.filePath = `${skillDir}/SKILL.md`;
            parsed.skillRoot = skillDir;
            parsed.referenceFiles = resources
                .filter((resource) => resource.type === 'file' && resource.path.toLowerCase().startsWith('references/'))
                .map((resource) => ({ path: `${skillDir}/${resource.path}`, label: resource.path }));
        }
        addSkill(parsed);
        setEditingId(parsed.id);
        setIsAdding(false);
        toast.success(t('skills.importedSkill', 'Skill imported'), parsed.name);
    };
    const handleImportFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length)
            return;
        try {
            await importSkillFolderBundle(await buildSkillFromFolderFiles(files));
        }
        finally {
            e.target.value = '';
        }
    };
    const handleDropSkillFolder = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const bundle = event.dataTransfer.items.length
            ? await buildSkillFromDataTransferItems(event.dataTransfer.items)
            : event.dataTransfer.files.length
                ? await buildSkillFromFolderFiles(event.dataTransfer.files)
                : null;
        await importSkillFolderBundle(bundle);
    };
    // ─── Render ────────────────────────────────────────────────────
    return (<>
            <SidePanel title={t('skills.title', 'Skills')} width={panelWidth} action={<div className="flex items-center gap-1.5">
                        <UiButton unstyled onClick={() => fileInputRef.current?.click()} title={t('skills.importSkill', 'Import SKILL.md')} className={workbenchSidebarSubtleActionClass}>
              <IconifyIcon name="lucide:upload" size={14} color="currentColor"/>
            </UiButton>
                        <UiButton unstyled onClick={() => folderInputRef.current?.click()} title={t('skills.importSkillFolder', 'Import skill folder')} className={workbenchSidebarSubtleActionClass}>
              <IconifyIcon name="lucide:folder-up" size={14} color="currentColor"/>
            </UiButton>
                        <UiButton unstyled onClick={handleCreateSkill} className={workbenchSidebarAccentActionClass}>
              + {t('common.new', 'New')}
            </UiButton>
          </div>}>
        <UiInput ref={fileInputRef} type="file" accept=".md,.markdown" onChange={handleImportMarkdown} className="hidden" aria-label={t('skills.importSkill', 'Import SKILL.md')}/>
        <UiInput ref={folderInputRef} type="file" multiple onChange={handleImportFolder} className="hidden" aria-label={t('skills.importSkillFolder', 'Import skill folder')} webkitdirectory="" directory=""/>
        <div className="flex min-h-0 flex-1 flex-col" onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        }} onDrop={handleDropSkillFolder}>
          <div className="module-sidebar-stack flex-1 overflow-y-auto px-3 pb-3 space-y-3">
            <div className={workbenchSidebarCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-text-primary">{t('skills.localSources', 'Local Skill Sources')}</div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
                    {t('skills.localSourcesDesc', 'Enable or disable shared local skill folders for Claude Code, other runtimes, and custom workspace directories.')}
                  </p>
                </div>
                <span className="rounded-full bg-accent/12 px-2.5 py-1 text-[10px] font-semibold text-accent tabular-nums">
                  {enabledLocalSkillSourcesCount}/{localSkillSources.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {localSkillSources.map((source) => {
            const isBusy = togglingLocalSourcePath === source.path;
            return (<div key={source.id} className={`relative overflow-hidden rounded-3xl border px-4 py-3.5 transition-all duration-200 ${source.enabled
                    ? 'border-accent/20 bg-linear-to-br from-accent/10 via-surface-1/96 to-surface-2/72 shadow-[0_14px_32px_rgba(var(--t-accent-rgb),0.10)]'
                    : 'border-border-subtle/55 bg-linear-to-br from-surface-1/92 to-surface-2/50 hover:border-border-subtle/75 hover:from-surface-1 hover:to-surface-2/70'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors ${source.enabled
                    ? 'border-accent-hover/35 bg-accent-hover text-white shadow-[0_10px_24px_rgba(var(--t-accent-rgb),0.26)]'
                    : 'border-border/40 bg-surface-0/75 text-text-muted'}`}>
                              <IconifyIcon name={source.icon} size={16} color="currentColor"/>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-text-primary">{source.label}</span>
                                <span className={`h-2 w-2 rounded-full ${source.enabled
                    ? 'bg-accent-hover shadow-[0_0_0_5px_rgba(var(--t-accent-rgb),0.22)]'
                    : 'bg-zinc-500 shadow-[0_0_0_4px_rgba(113,113,122,0.18)]'}`}/>
                                                                <span className={workbenchSidebarPillClass}>
                                  {source.skillCount} {t('skills.loaded', 'loaded')}
                                </span>
                              </div>
                                                            <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted/85">{source.description}</p>
                            </div>
                          </div>
                        </div>
                        <label aria-label={`${source.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')} ${source.label}`} title={source.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')} className={`group relative inline-flex w-11 shrink-0 rounded-full p-0.5 outline-offset-2 transition-colors duration-200 ease-in-out ${source.enabled
                    ? 'bg-accent inset-ring inset-ring-white/16 shadow-[0_8px_18px_rgba(var(--t-accent-rgb),0.30)]'
                    : 'bg-zinc-500/75 inset-ring inset-ring-black/10 shadow-[inset_0_1px_2px_rgba(15,23,42,0.18)]'} ${isBusy ? 'cursor-wait opacity-75' : 'cursor-pointer'} has-focus-visible:outline-2 has-focus-visible:outline-accent`}>
                          <span className={`pointer-events-none flex size-5 items-center justify-center rounded-full bg-white ring-1 transition-transform duration-200 ease-in-out ${source.enabled ? 'translate-x-5 ring-white/20 shadow-[0_4px_12px_rgba(15,23,42,0.22)]' : 'translate-x-0 ring-black/10 shadow-[0_3px_8px_rgba(15,23,42,0.14)]'}`}>
                            {isBusy ? <IconifyIcon name="lucide:loader-circle" size={10} color="currentColor" className="animate-spin text-text-muted"/> : null}
                          </span>
                          <UiInput name={`local-skill-source-${source.id}`} type="checkbox" checked={source.enabled} onChange={(event) => handleToggleLocalSkillSource(source.path, event.target.checked)} aria-label={`${source.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')} ${source.label}`} disabled={isBusy} className="absolute inset-0 h-full w-full cursor-inherit appearance-none focus:outline-none"/>
                        </label>
                      </div>
                      <div className="mt-3">
                                                <span className="inline-flex max-w-full items-center rounded-2xl border border-border-subtle/55 bg-surface-0/55 px-2.5 py-1.5 text-[10px] font-mono text-text-muted/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                          {source.path}
                        </span>
                      </div>
                    </div>);
        })}
              </div>
            </div>

            <div className="px-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {t('skills.installed', 'Installed')}
            </div>

            {filteredInstalled.length === 0 && (<div className="rounded-3xl border border-dashed border-border-subtle/60 bg-surface-0/35 px-4 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3 border border-border-subtle">
                  <IconifyIcon name="lucide:package" size={20} color="currentColor" className="text-text-muted"/>
                </div>
                <p className="text-[12px] text-text-muted leading-relaxed">
                  {t('skills.noInstalled', 'No skills yet. Create or install one.')}
                </p>
              </div>)}
                        {filteredInstalled.map((skill) => {
            const isActive = editingId === skill.id;
            const lockStatus = getSkillLockStatus(skill, skillsLockfile);
            const lockEntry = skillsLockfile?.skills[skill.name];
            return (<div key={skill.id} tabIndex={0} onClick={() => { setEditingId(skill.id); setIsAdding(false); }} onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditingId(skill.id);
                        setIsAdding(false);
                    }
                                }} className={`${workbenchSidebarItemClass(isActive)} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className={workbenchSidebarIconClass}>
                      <SkillIcon icon={skill.icon || skill.frontmatter?.icon || getSkillIconName(skill.id)} size={18}/>
                    </div>
                    <div className="min-w-0 flex-1">
                                            <div className={`${workbenchSidebarTitleClass} flex items-center gap-1.5 flex-wrap`}>
                        {skill.name}
                        {!skill.enabled && (<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-3 text-text-muted">{t('common.off', 'OFF')}</span>)}
                      </div>
                                            <p className={workbenchSidebarDescriptionClass}>{skill.description}</p>
                      <div className="mt-3 text-[10px] text-text-muted flex items-center gap-1.5 flex-wrap">
                                                <span className={workbenchSidebarPillClass}>
                          {sourceLabels[skill.source] || skill.source}
                        </span>
                                                {skill.category && <span className={workbenchSidebarPillClass}>{skill.category}</span>}
                        {skill.frontmatter?.context && <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px]">{t(`skills.context.${skill.frontmatter.context}`, skill.frontmatter.context)}</span>}
                        {lockStatus !== 'not-locked' && (<span title={lockEntry ? `${lockEntry.source} · ${lockEntry.computedHash}` : undefined} className={`px-1.5 py-0.5 rounded-full text-[9px] ${lockStatus === 'verified'
                        ? 'bg-success/10 text-success'
                        : lockStatus === 'mismatch'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-warning/10 text-warning'}`}>
                            {lockStatus === 'verified'
                        ? t('skills.lockVerified', 'lock verified')
                        : lockStatus === 'mismatch'
                            ? t('skills.lockMismatch', 'lock mismatch')
                            : t('skills.locked', 'locked')}
                          </span>)}
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                    <UiButton unstyled type="button" onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEnabled(skill.id);
                }} aria-label={skill.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')} title={skill.enabled ? t('skills.disable', 'Disable') : t('skills.enable', 'Enable')} className={`flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-xs transition-colors ${skill.enabled
                    ? 'text-success hover:text-text-muted'
                    : 'text-text-muted hover:text-success'}`} tabIndex={isActive ? 0 : -1}>
                      <IconifyIcon name={skill.enabled ? 'lucide:toggle-right' : 'lucide:toggle-left'} size={14} color="currentColor"/>
                    </UiButton>
                    <UiButton unstyled type="button" onClick={(e) => { e.stopPropagation(); handleExportMarkdown(skill); }} aria-label={t('common.export', 'Export')} title={t('skills.export', 'Export')} className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-accent hover:bg-accent/8" tabIndex={isActive ? 0 : -1}>
                      <IconifyIcon name="lucide:download" size={12} color="currentColor"/>
                    </UiButton>
                    <UiButton unstyled type="button" onClick={(e) => { e.stopPropagation(); handleDelete(skill.id); }} aria-label={t('common.delete', 'Delete')} title={t('common.delete', 'Delete')} className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-0/65 text-text-muted transition-colors hover:text-danger hover:bg-danger/8" tabIndex={isActive ? 0 : -1}>
                      <IconifyIcon name="lucide:trash-2" size={12} color="currentColor"/>
                    </UiButton>
                  </div>
                </div>
              </div>);
        })}
          </div>
        </div>
      </SidePanel>
    <ResizeHandle width={panelWidth} onResize={setPanelWidth} minWidth={280} maxWidth={420}/>

      {/* ── Right pane: Editor or Empty state ────────────────── */}
      {isAdding || editingId ? (<SkillEditor key={editingId ?? 'new'} skill={editingSkill} onSave={handleSave} onCancel={() => { setIsAdding(false); setEditingId(null); }}/>) : (<div className="module-canvas flex-1 overflow-y-auto px-6 py-8 text-text-muted xl:px-10">
          <WorkbenchEmptyState icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>} eyebrow={t('skills.promptBased', 'Prompt-Based Skills')} title={t('skills.promptBasedWorkspace', 'Skill Workspace')} description={t('skills.promptDesc', 'Skills are markdown instructions (SKILL.md) that enhance agent capabilities. No tool specification needed — agents decide which tools to use.')} actions={(<>
                                <UiButton unstyled type="button" onClick={() => fileInputRef.current?.click()} className={workbenchSidebarPrimaryActionClass}>
                  {t('skills.importSkill', 'Import SKILL.md')}
                </UiButton>
                                <UiButton unstyled type="button" onClick={handleCreateSkill} className={workbenchSidebarSubtleActionClass}>
                  {t('skills.createSkill', 'Create Skill')}
                </UiButton>
              </>)} metrics={[
                {
                    label: t('common.total', 'Total'),
                    value: skills.length,
                    description: t('skills.installedSkills', 'installed skills'),
                },
                {
                    label: t('common.enabled', 'Enabled'),
                    value: enabledSkillsCount,
                    description: t('skills.readyToAttach', 'ready to attach'),
                },
                {
                    label: t('skills.sources', 'Sources'),
                    value: enabledLocalSkillSourcesCount,
                    description: t('skills.localSources', 'Local Skill Sources'),
                },
            ]}/>
        </div>)}
    </>);
}



