import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Editor from '@monaco-editor/react';
import { generateId } from '@/utils/helpers';
import { IconifyIcon } from '@/components/icons/IconifyIcons';
import { useI18n } from '@/hooks/useI18n';
import type { Skill, SkillBundledResource, SkillSource, SkillExecutionContext } from '@/types';
import { MarkdownEditor } from './SkillEditorPanels';
import { parseSkillMarkdown, serializeSkillToMarkdown } from '@/services/skillRegistry';
import { confirm } from '@/services/confirmDialog';
import { toast } from '@/services/toast';
import { SKILL_TOP_LEVEL_FOLDERS, type SkillTopLevelFolder, classifySkillFileKind, getDefaultSkillFileName, getSkillFileIcon, isEditableSkillFile, isSafeSkillResourcePath, isSkillResourceExecutable, isSkillTopLevelFolder, } from '@/utils/skillPaths';
import { Button as UiButton } from "@/components/shared/button";
import { Input as UiInput, Select as UiSelect } from "@/components/shared/form-controls";
import { workbenchDetailSectionClass, workbenchSectionDescriptionClass, workbenchSectionEyebrowClass, workbenchSectionTitleClass } from '@/components/workbench/styles';
type SkillEditorFileKind = 'skill-markdown' | 'markdown' | 'script' | 'data' | 'image' | 'binary';
function makeDefaultSkill(): Skill {
    return {
        id: generateId('skill'),
        name: '',
        description: '',
        enabled: true,
        source: 'local' as SkillSource,
        content: '## Instructions\n\nDescribe what this skill does and how the agent should behave...\n',
        frontmatter: {
            name: '',
            description: '',
        },
        context: 'inline' as SkillExecutionContext,
    };
}
function EditorSection({ eyebrow, title, description, children, className = '', }: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
}) {
    return (<section className={`${workbenchDetailSectionClass} ${className}`}>
      <div className="mb-5">
        <div className={workbenchSectionEyebrowClass}>{eyebrow}</div>
        <h3 className={workbenchSectionTitleClass}>{title}</h3>
        <p className={workbenchSectionDescriptionClass}>{description}</p>
      </div>
      {children}
    </section>);
}
function normalizeResourcePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean).join('/');
}
function joinSkillPath(skillRoot: string, resourcePath: string): string {
    return `${skillRoot.replace(/[\\/]+$/, '')}/${normalizeResourcePath(resourcePath)}`;
}
function filePathToMonacoLanguage(pathValue: string): string {
  const ext = normalizeResourcePath(pathValue).split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'md':
    case 'markdown':
    case 'txt':
      return 'markdown';
    case 'xml':
      return 'xml';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    default:
      return 'plaintext';
  }
}
function fileKindForEditor(pathValue: string): SkillEditorFileKind {
  if (normalizeResourcePath(pathValue).toLowerCase() === 'skill.md') return 'skill-markdown';
  return classifySkillFileKind(pathValue);
}
function buildSkillMarkdownContent(skill: Skill): string {
  return serializeSkillToMarkdown(skill);
}
function parseEditedSkillMarkdown(raw: string, existingSkill: Skill, parseErrorMessage: string): Partial<Skill> | null {
  const parsed = parseSkillMarkdown(raw, existingSkill.filePath || `${existingSkill.skillRoot || ''}/SKILL.md`, existingSkill.source);
  if (!parsed) {
    toast.error(parseErrorMessage);
    return null;
  }
  return {
    ...parsed,
    id: existingSkill.id,
    enabled: existingSkill.enabled,
    source: existingSkill.source,
    skillRoot: existingSkill.skillRoot,
    filePath: existingSkill.filePath,
    bundledResources: existingSkill.bundledResources,
    referenceFiles: existingSkill.referenceFiles,
    memories: existingSkill.memories,
    installInfo: existingSkill.installInfo,
  };
}
function sortResources(resources: SkillBundledResource[]): SkillBundledResource[] {
    return [...resources].sort((a, b) => {
        const aDepth = a.path.split('/').length;
        const bDepth = b.path.split('/').length;
        if (aDepth !== bDepth)
            return aDepth - bDepth;
        if (a.type !== b.type)
            return a.type === 'directory' ? -1 : 1;
        return a.path.localeCompare(b.path);
    });
}
function isSameOrDescendantPath(candidatePath: string, parentPath: string): boolean {
    const candidate = normalizeResourcePath(candidatePath);
    const parent = normalizeResourcePath(parentPath);
    return candidate === parent || candidate.startsWith(`${parent}/`);
}
function topFolderOf(pathValue: string): SkillTopLevelFolder | null {
    const top = normalizeResourcePath(pathValue).split('/')[0];
    return isSkillTopLevelFolder(top) ? top : null;
}
const TOP_LEVEL_ICON: Record<SkillTopLevelFolder, string> = {
    scripts: 'lucide:terminal-square',
    references: 'lucide:book-open',
    assets: 'lucide:image',
    other: 'lucide:folder',
};
// ─── component ──────────────────────────────────────────────────────────
interface PendingCreate {
    parent: string; // top-level folder, or sub-folder path
    kind: 'file' | 'folder';
    value: string;
}
function ResourceTreePanel({ skill, onChange, }: {
    skill: Skill;
    onChange: (patch: Partial<Skill>) => void;
}) {
    const { t } = useI18n();
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [uploadFolder, setUploadFolder] = useState<SkillTopLevelFolder>('assets');
    const resources = useMemo(() => sortResources(skill.bundledResources ?? []), [skill.bundledResources]);
    const [search, setSearch] = useState('');
    const [selectedPath, setSelectedPath] = useState<string>('SKILL.md');
    const [renamingPath, setRenamingPath] = useState('');
    const [renameValue, setRenameValue] = useState('');
    const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
    // Editor pane state — keyed by selectedPath
    const [editorContent, setEditorContent] = useState('');
    const [editorOriginal, setEditorOriginal] = useState('');
    const [editorError, setEditorError] = useState('');
    const [editorLoading, setEditorLoading] = useState(false);
    const [savingFile, setSavingFile] = useState(false);
    const dirty = editorContent !== editorOriginal && !!selectedPath;
    // ── load file content when selection changes ─────────────────────────
    useEffect(() => {
        setEditorError('');
      if (selectedPath === 'SKILL.md') {
        const next = buildSkillMarkdownContent(skill);
        setEditorContent(next);
        setEditorOriginal(next);
        setEditorLoading(false);
        return;
      }
        if (!selectedPath || !skill.skillRoot) {
            setEditorContent('');
            setEditorOriginal('');
            return;
        }
        const normalizedSelected = normalizeResourcePath(selectedPath);
        const resource = resources.find((r) => normalizeResourcePath(r.path) === normalizedSelected);
        if (!resource || resource.type !== 'file') {
            setEditorContent('');
            setEditorOriginal('');
            return;
        }
        if (!isEditableSkillFile(resource.path)) {
            setEditorContent('');
            setEditorOriginal('');
            return;
        }
        let cancelled = false;
        setEditorLoading(true);
        window.electron
            .invoke('fs:readFile', joinSkillPath(skill.skillRoot, selectedPath))
            .then((result) => {
            if (cancelled)
                return;
            if (typeof result === 'string') {
                setEditorContent(result);
                setEditorOriginal(result);
                setEditorError('');
            }
            else {
                setEditorContent('');
                setEditorOriginal('');
                setEditorError((result as {
                    error?: string;
                })?.error ??
                    t('skills.referencePreviewFailed', 'Unable to read file.'));
            }
        })
            .catch((err: unknown) => {
            if (cancelled)
                return;
            setEditorError(err instanceof Error ? err.message : String(err));
        })
            .finally(() => {
            if (!cancelled)
                setEditorLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedPath, skill, skill.skillRoot, resources, t]);
    const removeResourceFromState = useCallback((resourcePath: string) => {
        const normalized = normalizeResourcePath(resourcePath);
        onChange({
            bundledResources: (skill.bundledResources ?? []).filter((resource) => normalizeResourcePath(resource.path) !== normalized &&
                !normalizeResourcePath(resource.path).startsWith(`${normalized}/`)),
            referenceFiles: (skill.referenceFiles ?? []).filter((ref) => !normalizeResourcePath(ref.path).endsWith(normalized)),
        });
        if (isSameOrDescendantPath(selectedPath, normalized)) {
            setSelectedPath('');
            setEditorContent('');
            setEditorOriginal('');
            setEditorError('');
        }
    }, [onChange, skill.bundledResources, skill.referenceFiles, selectedPath]);
    const handleDelete = async (resource: SkillBundledResource) => {
        if (!skill.skillRoot) {
            removeResourceFromState(resource.path);
            return;
        }
        const ok = await confirm({
            title: t('skills.deleteResourceTitle', 'Delete bundled resource?'),
            body: t('skills.deleteResourceBody', '"{path}" will be removed from this skill.').replace('{path}', resource.path),
            danger: true,
            confirmText: t('common.delete', 'Delete'),
        });
        if (!ok)
            return;
        const channel = resource.type === 'directory' ? 'fs:deleteDir' : 'fs:deleteFile';
        await window.electron.invoke(channel, joinSkillPath(skill.skillRoot, resource.path));
        removeResourceFromState(resource.path);
    };
    const startRename = (resource: SkillBundledResource) => {
        setRenamingPath(resource.path);
        setRenameValue(resource.path);
    };
    const cancelRename = () => {
        setRenamingPath('');
        setRenameValue('');
    };
    const handleRename = async (resource: SkillBundledResource, nextPath: string) => {
        if (!nextPath || nextPath === resource.path) {
            cancelRename();
            return;
        }
        if (!isSafeSkillResourcePath(nextPath)) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.invalidResourcePathHint', 'Paths must start with one of: {folders}/').replace('{folders}', SKILL_TOP_LEVEL_FOLDERS.join(', ')));
            return;
        }
        const normalizedNext = normalizeResourcePath(nextPath);
        const oldPath = normalizeResourcePath(resource.path);
        if (normalizedNext === oldPath) {
            cancelRename();
            return;
        }
        if (isSameOrDescendantPath(normalizedNext, oldPath)) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.renameIntoSelf', 'A folder cannot be renamed into itself.'));
            return;
        }
        const pathExists = (skill.bundledResources ?? []).some((entry) => {
            const entryPath = normalizeResourcePath(entry.path);
            return entryPath !== oldPath && entryPath === normalizedNext;
        });
        if (pathExists) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.resourceAlreadyExists', 'A resource at this path already exists.'));
            return;
        }
        if (skill.skillRoot) {
            const parent = normalizedNext.split('/').slice(0, -1).join('/');
            if (parent) {
                const ensureResult = (await window.electron.invoke('system:ensureDirectory', joinSkillPath(skill.skillRoot, parent))) as {
                    success?: boolean;
                    error?: string;
                };
                if (!ensureResult?.success) {
                    throw new Error(ensureResult?.error ||
                        t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'));
                }
            }
            const moveResult = (await window.electron.invoke('fs:moveFile', joinSkillPath(skill.skillRoot, resource.path), joinSkillPath(skill.skillRoot, normalizedNext))) as {
                success?: boolean;
                error?: string;
            };
            if (!moveResult?.success) {
                throw new Error(moveResult?.error || t('skills.renameResourceFailed', 'Failed to rename resource.'));
            }
        }
        onChange({
            bundledResources: (skill.bundledResources ?? []).map((entry) => {
                const entryPath = normalizeResourcePath(entry.path);
                if (entryPath === oldPath)
                    return { ...entry, path: normalizedNext };
                if (entryPath.startsWith(`${oldPath}/`)) {
                    return { ...entry, path: `${normalizedNext}/${entryPath.slice(oldPath.length + 1)}` };
                }
                return entry;
            }),
            referenceFiles: (skill.referenceFiles ?? []).map((ref) => {
                const refPath = normalizeResourcePath(ref.path);
                const normalizedSkillRoot = skill.skillRoot ? normalizeResourcePath(skill.skillRoot) : '';
                const resourceRelativePath = normalizedSkillRoot && refPath.startsWith(normalizedSkillRoot)
                    ? normalizeResourcePath(refPath.slice(normalizedSkillRoot.length))
                    : refPath;
                if (!isSameOrDescendantPath(resourceRelativePath, oldPath))
                    return ref;
                const suffix = resourceRelativePath === oldPath ? '' : resourceRelativePath.slice(oldPath.length + 1);
                const nextRelativePath = suffix ? `${normalizedNext}/${suffix}` : normalizedNext;
                return {
                    ...ref,
                    path: skill.skillRoot ? joinSkillPath(skill.skillRoot, nextRelativePath) : nextRelativePath,
                    label: nextRelativePath,
                };
            }),
        });
        if (isSameOrDescendantPath(selectedPath, oldPath)) {
            const selectedSuffix = normalizeResourcePath(selectedPath) === oldPath
                ? ''
                : normalizeResourcePath(selectedPath).slice(oldPath.length + 1);
            setSelectedPath(selectedSuffix ? `${normalizedNext}/${selectedSuffix}` : normalizedNext);
        }
        cancelRename();
    };
    const commitRename = (resource: SkillBundledResource) => {
        handleRename(resource, renameValue).catch((err: unknown) => {
            toast.error(t('skills.renameResourceFailed', 'Failed to rename resource'), err instanceof Error ? err.message : String(err));
        });
    };
    // ── create file / folder ─────────────────────────────────────────────
    const beginCreate = (parent: string, kind: 'file' | 'folder') => {
        const defaultName = kind === 'file' ? getDefaultSkillFileName(parent) : 'new-folder';
        setPendingCreate({ parent, kind, value: defaultName });
    };
    const cancelCreate = () => setPendingCreate(null);
    const commitCreate = async () => {
        if (!pendingCreate)
            return;
        const { parent, kind, value } = pendingCreate;
        const trimmed = value.trim();
        if (!trimmed) {
            cancelCreate();
            return;
        }
        if (trimmed.includes('/') || trimmed.includes('\\')) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.invalidResourceName', 'Name must not contain slashes.'));
            return;
        }
        const normalizedParent = normalizeResourcePath(parent);
        const newPath = normalizedParent ? `${normalizedParent}/${trimmed}` : trimmed;
        if (!isSafeSkillResourcePath(newPath)) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.topLevelFolderLocked', 'Top-level folder must be one of: {folders}.').replace('{folders}', SKILL_TOP_LEVEL_FOLDERS.join(', ')));
            return;
        }
        const exists = (skill.bundledResources ?? []).some((r) => normalizeResourcePath(r.path) === newPath);
        if (exists) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.resourceAlreadyExists', 'A resource at this path already exists.'));
            return;
        }
        if (!skill.skillRoot) {
            // Just add to in-memory list; real persistence happens once skill is saved.
            onChange({
                bundledResources: [
                    ...(skill.bundledResources ?? []),
                    kind === 'folder'
                        ? { path: newPath, type: 'directory' }
                        : { path: newPath, type: 'file', size: 0 },
                ],
            });
            cancelCreate();
            if (kind === 'file')
                setSelectedPath(newPath);
            return;
        }
        try {
            if (kind === 'folder') {
                const result = (await window.electron.invoke('system:ensureDirectory', joinSkillPath(skill.skillRoot, newPath))) as {
                    success?: boolean;
                    error?: string;
                };
                if (!result?.success) {
                    throw new Error(result?.error ||
                        t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'));
                }
                onChange({
                    bundledResources: [
                        ...(skill.bundledResources ?? []),
                        { path: newPath, type: 'directory' },
                    ],
                });
            }
            else {
                if (normalizedParent) {
                    const ensure = (await window.electron.invoke('system:ensureDirectory', joinSkillPath(skill.skillRoot, normalizedParent))) as {
                        success?: boolean;
                        error?: string;
                    };
                    if (!ensure?.success) {
                        throw new Error(ensure?.error ||
                            t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'));
                    }
                }
                const write = (await window.electron.invoke('fs:writeFile', joinSkillPath(skill.skillRoot, newPath), '')) as {
                    success?: boolean;
                    error?: string;
                };
                if (!write?.success) {
                    throw new Error(write?.error || t('skills.createResourceFailed', 'Failed to create file.'));
                }
                onChange({
                    bundledResources: [
                        ...(skill.bundledResources ?? []),
                        {
                            path: newPath,
                            type: 'file',
                            size: 0,
                            executable: isSkillResourceExecutable(newPath),
                        },
                    ],
                });
                setSelectedPath(newPath);
            }
            cancelCreate();
        }
        catch (err: unknown) {
            toast.error(t('skills.createResourceFailed', 'Failed to create resource'), err instanceof Error ? err.message : String(err));
        }
    };
    // ── upload ───────────────────────────────────────────────────────────
    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !skill.skillRoot)
            return;
        const resourcePath = normalizeResourcePath(`${uploadFolder}/${file.name}`);
        if (!isSafeSkillResourcePath(resourcePath)) {
            toast.error(t('skills.invalidResourcePath', 'Invalid resource path'), t('skills.invalidResourceName', 'Invalid file name.'));
            return;
        }
        try {
            const ensure = await window.electron.invoke('system:ensureDirectory', joinSkillPath(skill.skillRoot, uploadFolder)) as {
                success?: boolean;
                error?: string;
            };
            if (!ensure?.success)
                throw new Error(ensure?.error || t('skills.createResourceDirectoryFailed', 'Failed to create resource directory.'));
          const kind = classifySkillFileKind(resourcePath);
          const write = await window.electron.invoke(kind === 'image' || kind === 'binary' ? 'fs:writeBinaryFile' : 'fs:writeFile', joinSkillPath(skill.skillRoot, resourcePath), kind === 'image' || kind === 'binary'
            ? btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())))
            : await file.text()) as {
                success?: boolean;
                error?: string;
            };
            if (!write?.success)
                throw new Error(write?.error || t('skills.createResourceFailed', 'Failed to create file.'));
            onChange({
                bundledResources: [
                    ...(skill.bundledResources ?? []).filter((resource) => normalizeResourcePath(resource.path) !== resourcePath),
                    {
                        path: resourcePath,
                        type: 'file',
                        size: file.size,
                        executable: isSkillResourceExecutable(resourcePath),
                    },
                ],
            });
            setSelectedPath(resourcePath);
        }
        catch (err: unknown) {
            toast.error(t('skills.uploadFailed', 'Failed to upload resource'), err instanceof Error ? err.message : String(err));
        }
    };
    // ── save edited file ────────────────────────────────────────────────
    const saveCurrentFile = async () => {
      if (!selectedPath || !dirty)
            return;
      if (selectedPath === 'SKILL.md') {
        const reparsed = parseEditedSkillMarkdown(editorContent, skill, t('skills.parseFailed', 'Failed to parse SKILL.md'));
        if (!reparsed)
          return;
        onChange(reparsed);
        setEditorOriginal(editorContent);
        toast.success(t('skills.fileSaved', 'File saved'));
        return;
      }
      if (!skill.skillRoot)
        return;
        setSavingFile(true);
        try {
            const result = (await window.electron.invoke('fs:writeFile', joinSkillPath(skill.skillRoot, selectedPath), editorContent)) as {
                success?: boolean;
                error?: string;
            };
            if (!result?.success) {
                throw new Error(result?.error || t('skills.saveFileFailed', 'Failed to save file.'));
            }
            const newSize = new TextEncoder().encode(editorContent).length;
            onChange({
                bundledResources: (skill.bundledResources ?? []).map((entry) => normalizeResourcePath(entry.path) === selectedPath ? { ...entry, size: newSize } : entry),
            });
            setEditorOriginal(editorContent);
            toast.success(t('skills.fileSaved', 'File saved'));
        }
        catch (err: unknown) {
            toast.error(t('skills.saveFileFailed', 'Failed to save file'), err instanceof Error ? err.message : String(err));
        }
        finally {
            setSavingFile(false);
        }
    };
    const handleSelect = async (resource: SkillBundledResource) => {
        if (resource.type !== 'file')
            return;
        const nextPath = normalizeResourcePath(resource.path);
        if (dirty && normalizeResourcePath(selectedPath) !== nextPath) {
            const ok = await confirm({
                title: t('common.unsavedChanges', 'Unsaved changes'),
                body: t('skills.unsavedFileBody', 'You have unsaved changes in the current file. Discard them?'),
                danger: true,
                confirmText: t('common.discard', 'Discard'),
            });
            if (!ok)
                return;
        }
        setSelectedPath(nextPath);
    };
    // ── tree grouping ───────────────────────────────────────────────────
    const filteredResources = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return resources;
        return resources.filter((r) => r.path.toLowerCase().includes(q));
    }, [resources, search]);
    const grouped = useMemo(() => {
        const out: Record<SkillTopLevelFolder, SkillBundledResource[]> = {
            scripts: [],
            references: [],
            assets: [],
            other: [],
        };
        for (const resource of filteredResources) {
            const top = topFolderOf(resource.path);
            if (top)
                out[top].push(resource);
            else
                out.other.push(resource);
        }
        return out;
    }, [filteredResources]);
    const normalizedSelectedPath = normalizeResourcePath(selectedPath);
    const selectedResource = normalizedSelectedPath === 'SKILL.md'.toLowerCase()
      ? { path: 'SKILL.md', type: 'file' as const, size: new TextEncoder().encode(buildSkillMarkdownContent(skill)).length }
      : normalizedSelectedPath
        ? resources.find((r) => normalizeResourcePath(r.path) === normalizedSelectedPath)
        : null;
    const selectedKind = selectedPath ? fileKindForEditor(selectedPath) : null;
    // ── render ──────────────────────────────────────────────────────────
    return (<div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.82fr)_minmax(0,1.18fr)] xl:items-stretch">
      <EditorSection eyebrow={t('skills.resources', 'Resources')} title={t('skills.resourceTree', 'Bundled File Tree')} description={t('skills.resourceTreeHint', 'Browse and manage files packaged alongside SKILL.md.')} className="flex h-full flex-col">
        <div className="flex min-h-168 flex-1 flex-col">
          {/* search + upload */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <UiInput type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('skills.searchResources', 'Search files…')} wrapperClassName="min-w-40 flex-1" controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-2/75 px-3 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted/60"/>
            <UiSelect aria-label={t('skills.uploadFolder', 'Upload target folder')} value={uploadFolder} onChange={(event) => setUploadFolder(event.target.value as SkillTopLevelFolder)} disabled={!skill.skillRoot} controlClassName="rounded-2xl border border-border-subtle/55 bg-surface-2/75 px-2 py-1.5 text-[11px] text-text-secondary disabled:opacity-50">
              {SKILL_TOP_LEVEL_FOLDERS.map((folder) => (<option key={folder} value={folder}>
                  {folder}/
                </option>))}
            </UiSelect>
            <UiInput ref={uploadInputRef} type="file" onChange={handleUpload} aria-label={t('skills.uploadResource', 'Upload')} className="hidden"/>
            <UiButton unstyled type="button" onClick={() => uploadInputRef.current?.click()} disabled={!skill.skillRoot} className="rounded-2xl bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-45">
              <IconifyIcon name="lucide:upload" size={12} color="currentColor"/>{' '}
              {t('skills.uploadResource', 'Upload')}
            </UiButton>
          </div>

          {!skill.skillRoot && (<p className="mb-3 text-[11px] leading-4 text-text-muted">
              {t('skills.saveBeforeResources', 'Save the skill to disk before editing resources.')}
            </p>)}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              <div className={`group flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors ${selectedPath === 'SKILL.md'
                    ? 'bg-accent/12 ring-1 ring-accent/35'
                    : 'bg-surface-2/60 hover:bg-surface-2/85'}`}>
                <IconifyIcon name="lucide:file-badge-2" size={12} color="currentColor" className="text-text-muted"/>
                <UiButton unstyled type="button" onClick={() => setSelectedPath('SKILL.md')} className={`min-w-0 flex-1 truncate text-left font-mono text-[11px] hover:text-accent ${selectedPath === 'SKILL.md' ? 'text-accent' : 'text-text-secondary'}`}>
                  SKILL.md
                </UiButton>
                <span className="text-[9px] tabular-nums text-text-muted">
                  {new TextEncoder().encode(buildSkillMarkdownContent(skill)).length}b
                </span>
              </div>
              {SKILL_TOP_LEVEL_FOLDERS.map((folder) => {
            const entries = grouped[folder];
            const isCreatingHere = pendingCreate && normalizeResourcePath(pendingCreate.parent) === folder;
            return (<div key={folder} className="rounded-3xl border border-border-subtle/45 bg-surface-0/55 p-3">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted/60">
                  <IconifyIcon name={TOP_LEVEL_ICON[folder]} size={12} color="currentColor"/>
                  {folder}/
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] tabular-nums">
                    {entries.length}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <UiButton unstyled type="button" onClick={() => beginCreate(folder, 'file')} title={t('skills.newFile', 'New file')} aria-label={t('skills.newFile', 'New file')} className="rounded-xl px-1.5 py-1 text-text-muted hover:bg-surface-3 hover:text-accent">
                      <IconifyIcon name="lucide:file-plus" size={12} color="currentColor"/>
                    </UiButton>
                    <UiButton unstyled type="button" onClick={() => beginCreate(folder, 'folder')} title={t('skills.newFolder', 'New folder')} aria-label={t('skills.newFolder', 'New folder')} className="rounded-xl px-1.5 py-1 text-text-muted hover:bg-surface-3 hover:text-accent">
                      <IconifyIcon name="lucide:folder-plus" size={12} color="currentColor"/>
                    </UiButton>
                  </div>
                </div>

                {isCreatingHere && pendingCreate && (<div className="mb-2 flex items-center gap-2 rounded-2xl bg-surface-2/60 px-3 py-2">
                    <IconifyIcon name={pendingCreate.kind === 'folder' ? 'lucide:folder' : 'lucide:file'} size={12} color="currentColor" className="text-text-muted"/>
                    <UiInput autoFocus value={pendingCreate.value} onChange={(e) => setPendingCreate({ ...pendingCreate, value: e.target.value })} onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitCreate();
                        }
                        if (e.key === 'Escape')
                            cancelCreate();
                    }} placeholder={t('skills.fileNamePlaceholder', 'name…')} wrapperClassName="min-w-0 flex-1" controlClassName="rounded-xl border border-accent/20 bg-surface-0 px-2 py-1 font-mono text-[11px] text-text-primary"/>
                    <UiButton unstyled type="button" onClick={commitCreate} className="rounded-xl bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent/25">
                      {t('common.confirm', 'OK')}
                    </UiButton>
                    <UiButton unstyled type="button" onClick={cancelCreate} className="rounded-xl px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary">
                      {t('common.cancel', 'Cancel')}
                    </UiButton>
                  </div>)}

                {entries.length === 0 ? (!isCreatingHere && (<div className="rounded-2xl border border-dashed border-border-subtle/45 px-3 py-2 text-[11px] text-text-muted">
                      {t('common.empty', 'Empty')}
                    </div>)) : (<div className="space-y-1.5">
                    {entries.map((resource) => {
                        const isSelected = resource.path === selectedPath;
                        return (<div key={resource.path} className={`group flex items-center gap-2 rounded-2xl px-3 py-2 transition-colors ${isSelected
                                ? 'bg-accent/12 ring-1 ring-accent/35'
                                : 'bg-surface-2/60 hover:bg-surface-2/85'}`}>
                          <IconifyIcon name={resource.type === 'directory'
                                ? 'lucide:folder'
                                : getSkillFileIcon(resource.path, resource.executable)} size={12} color="currentColor" className="text-text-muted"/>
                            {renamingPath === resource.path ? (<UiInput value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        commitRename(resource);
                                    }
                                    if (event.key === 'Escape')
                                        cancelRename();
                              }} onBlur={() => commitRename(resource)} autoFocus aria-label={t('common.rename', 'Rename')} title={t('common.rename', 'Rename')} placeholder={t('common.rename', 'Rename')} wrapperClassName="min-w-0 flex-1" controlClassName="rounded-xl border border-accent/20 bg-surface-0 px-2 py-1 font-mono text-[11px] text-text-primary"/>) : resource.type === 'file' ? (<UiButton unstyled type="button" onClick={() => handleSelect(resource)} className={`min-w-0 flex-1 truncate text-left font-mono text-[11px] hover:text-accent ${isSelected ? 'text-accent' : 'text-text-secondary'}`}>
                              {resource.path}
                            </UiButton>) : (<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-secondary">
                              {resource.path}/
                            </span>)}
                          {resource.size !== undefined && resource.type === 'file' && (<span className="text-[9px] tabular-nums text-text-muted">
                              {resource.size}b
                            </span>)}
                          {resource.warning && (<IconifyIcon name="lucide:triangle-alert" size={12} color="currentColor" className="text-warning"/>)}
                          <UiButton unstyled type="button" onClick={() => startRename(resource)} aria-label={t('common.rename', 'Rename')} className="opacity-0 transition-opacity group-hover:opacity-100 text-text-muted hover:text-accent">
                            <IconifyIcon name="lucide:pencil" size={12} color="currentColor"/>
                          </UiButton>
                          <UiButton unstyled type="button" onClick={() => handleDelete(resource)} aria-label={t('common.delete', 'Delete')} className="opacity-0 transition-opacity group-hover:opacity-100 text-text-muted hover:text-danger">
                            <IconifyIcon name="lucide:trash-2" size={12} color="currentColor"/>
                          </UiButton>
                        </div>);
                    })}
                  </div>)}
              </div>);
        })}
            </div>
          </div>
        </div>
      </EditorSection>

      <EditorSection eyebrow={t('skills.resourceEditor', 'File')} title={selectedPath || t('skills.noFileSelected', 'No file selected')} description={selectedResource && selectedResource.type === 'file'
        ? `${selectedKind === 'skill-markdown' ? 'markdown' : classifySkillFileKind(selectedResource.path)} · ${selectedResource.size ?? 0}b`
            : t('skills.fileEditorHint', 'Pick a file from the tree to view or edit its contents.')} className="flex h-full flex-col">
        <div className="flex min-h-168 flex-1 flex-col">
          {!selectedPath ? (<div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border-subtle/55 bg-surface-0/45 p-8 text-center text-[12px] text-text-muted">
              {t('skills.noFileSelected', 'No file selected.')}
            </div>) : editorError ? (<div className="flex flex-1 items-center rounded-3xl border border-danger/20 bg-danger/8 p-4 text-[12px] text-danger">
              {editorError}
            </div>) : selectedResource && selectedKind !== 'skill-markdown' && !isEditableSkillFile(selectedResource.path) ? (<div className="flex flex-1 flex-col rounded-3xl border border-border-subtle/55 bg-surface-2/60 p-5 text-[12px] text-text-secondary">
              <div className="mb-2 font-semibold text-text-primary">
                {t('skills.cannotEditBinary', 'Binary file — preview only.')}
              </div>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px]">
                <dt className="text-text-muted">{t('skills.path', 'Path')}</dt>
                <dd className="font-mono">{selectedResource.path}</dd>
                <dt className="text-text-muted">{t('skills.size', 'Size')}</dt>
                <dd className="font-mono">{selectedResource.size ?? 0} bytes</dd>
                <dt className="text-text-muted">{t('skills.kind', 'Kind')}</dt>
                <dd>{classifySkillFileKind(selectedResource.path)}</dd>
              </dl>
            </div>) : editorLoading ? (<div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border-subtle/55 bg-surface-0/45 p-8 text-center text-[12px] text-text-muted">
              {t('common.loading', 'Loading…')}
            </div>) : (<div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle/55 bg-surface-0/55 px-3 py-2 text-[11px] text-text-muted">
                <span className="rounded-full border border-border-subtle/45 bg-surface-2/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/70">
                  {selectedKind === 'skill-markdown'
                ? 'markdown'
                : selectedResource
                    ? classifySkillFileKind(selectedResource.path)
                    : t('skills.file', 'File')}
                </span>
                {selectedResource?.size !== undefined && (<span className="rounded-full border border-border-subtle/45 bg-surface-2/75 px-2 py-1 text-[10px] font-mono text-text-secondary/80">
                    {selectedResource.size} bytes
                  </span>)}
                <span className="min-w-0 flex-1 truncate font-mono text-text-secondary">
                  {selectedResource?.path ?? selectedPath}
                </span>
              </div>

              {(selectedKind === 'skill-markdown' || selectedKind === 'markdown') && (<MarkdownEditor value={editorContent} onChange={(value) => setEditorContent(value)} ariaLabel={t('skills.fileContent', 'File content')} placeholder={t('skills.fileContent', 'File content')} fillHeight/>) }
              {(selectedKind === 'script' || selectedKind === 'data') && (<div className="min-h-112 flex-1 overflow-hidden rounded-3xl border border-border-subtle/55 bg-surface-2/75">
                  <Editor height="100%" theme="vs-dark" language={filePathToMonacoLanguage(selectedPath)} value={editorContent} onChange={(value) => setEditorContent(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, wordWrap: 'on', scrollBeyondLastLine: false }} />
                </div>)}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-text-muted">
                  {t('skills.fileEditorHint', 'Pick a file from the tree to view or edit its contents.')}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] ${dirty ? 'text-warning' : 'text-text-muted'}`}>
                    {dirty
                ? t('skills.unsavedChanges', 'Unsaved changes')
                : t('skills.noChanges', 'No changes')}
                  </span>
                  <UiButton unstyled type="button" onClick={saveCurrentFile} disabled={!dirty || savingFile || (selectedPath !== 'SKILL.md' && !skill.skillRoot)} className="rounded-2xl bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45">
                    {savingFile
                ? t('common.saving', 'Saving…')
                : t('skills.saveFile', 'Save file')}
                  </UiButton>
                </div>
              </div>
            </div>)}
        </div>
      </EditorSection>
    </div>);
}
export function SkillEditor({ skill, onSave, onCancel }: {
    skill: Skill | null;
    onSave: (skill: Skill) => void;
    onCancel: () => void;
}) {
    const [dirty, setDirty] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [form, setForm] = useState<Skill>(skill ?? makeDefaultSkill());
    const { t } = useI18n();
    const updateForm = (patch: Partial<Skill>) => {
        setDirty(true);
        setForm((f) => ({ ...f, ...patch }));
    };
    const handleCancel = async () => {
        if (dirty) {
            const ok = await confirm({
                title: t('common.unsavedChanges', 'Unsaved changes'),
                body: t('common.discardChanges', 'You have unsaved changes. Discard them?'),
                danger: true,
                confirmText: t('common.discard', 'Discard'),
            });
            if (!ok)
                return;
        }
        onCancel();
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const name = form.name || form.frontmatter.name;
        if (!name.trim()) {
            setValidationError(t('skills.skillName', 'Skill name is required.'));
            return;
        }
        // Ensure name is synced
        const final: Skill = {
            ...form,
            name: name.trim(),
            frontmatter: { ...form.frontmatter, name: name.trim() },
        };
        setValidationError('');
        onSave(final);
        setDirty(false);
    };
    return (<form onSubmit={handleSubmit} className="module-canvas flex-1 overflow-y-auto">
      <div className="module-content mx-auto flex w-full max-w-432 flex-col gap-6 px-5 py-6 xl:px-8 xl:py-8">
        <section className="rounded-[28px] border border-border-subtle/55 bg-surface-1/70 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={workbenchSectionEyebrowClass}>
                {skill ? t('skills.editSkill', 'Edit Skill') : t('skills.addSkillTitle', 'New Skill')}
              </div>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-text-primary">
                {(form.frontmatter.name || form.name).trim() || 'SKILL.md'}
              </h2>
              <p className="mt-1 text-[12px] text-text-secondary/82">
                {t('skills.resourceTreeHint', 'Browse and manage files packaged alongside SKILL.md.')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <UiButton unstyled type="submit" className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(var(--t-accent-rgb),0.22)] transition-all hover:bg-accent-hover">
                {skill ? t('skills.saveChanges', 'Save Changes') : t('skills.addSkillTitle', 'Create Skill')}
              </UiButton>
              <UiButton unstyled type="button" onClick={handleCancel} className="rounded-2xl bg-surface-3 px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-4">
                {t('common.cancel', 'Cancel')}
              </UiButton>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <ResourceTreePanel skill={form} onChange={updateForm}/>

          {validationError && (<p className="rounded-2xl border border-danger/20 bg-danger/8 px-4 py-3 text-[12px] text-danger">{validationError}</p>)}
        </div>
      </div>
    </form>);
}

