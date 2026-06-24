import { useMemo, useState, type ComponentPropsWithoutRef, type ComponentType } from 'react';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { PluggableList } from 'unified';
import { IconifyIcon } from '@/components/icons/IconifyIcons';
import { useI18n } from '@/hooks/useI18n';
import 'katex/dist/katex.min.css';
import { Button as UiButton } from "@/components/catalyst-ui/button";
import { Input as UiInput } from "@/components/catalyst-ui/form-controls";
const MARKDOWN_SANITIZE_SCHEMA = {
    ...defaultSchema,
    tagNames: Array.from(new Set([
        ...(defaultSchema.tagNames ?? []),
        'article',
        'aside',
        'details',
        'div',
        'figcaption',
        'figure',
        'footer',
        'header',
        'input',
        'kbd',
        'main',
        'mark',
        'nav',
        'section',
        'span',
        'sub',
        'summary',
        'sup',
        'table',
        'tbody',
        'td',
        'tfoot',
        'th',
        'thead',
        'tr',
    ])),
    attributes: {
        ...defaultSchema.attributes,
        '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className'],
        a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
        code: [...(defaultSchema.attributes?.code ?? []), 'className'],
        img: [...(defaultSchema.attributes?.img ?? []), 'width', 'height'],
        input: ['checked', 'disabled', 'type'],
        ol: [...(defaultSchema.attributes?.ol ?? []), 'start'],
        td: [...(defaultSchema.attributes?.td ?? []), 'colSpan', 'rowSpan', 'align'],
        th: [...(defaultSchema.attributes?.th ?? []), 'colSpan', 'rowSpan', 'align'],
    },
} as const;
export function CopyButton({ text, className = '' }: {
    text: string;
    className?: string;
}) {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            // Clipboard write can fail in certain contexts.
        });
    };
    return (<UiButton unstyled type="button" onClick={copy} title={copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')} aria-label={copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')} className={`text-[11px] px-1.5 py-0.5 rounded-md transition-colors inline-flex items-center gap-1 ${copied ? 'text-success' : 'text-text-muted hover:text-text-secondary hover:bg-surface-3/60'} ${className}`}>
      {copied ? <><IconifyIcon name="ui-check" size={14} color="currentColor"/> {t('common.copied', 'Copied')}</> : <><IconifyIcon name="ui-copy" size={14} color="currentColor"/> {t('common.copy', 'Copy')}</>}
    </UiButton>);
}
function CodeBlock({ children, className, ...rest }: ComponentPropsWithoutRef<'code'>) {
    const { t } = useI18n();
    const isInline = !className;
    const code = String(children).replace(/\n$/, '');
    const lang = className?.replace('language-', '') ?? '';
    if (isInline) {
        return <code className="text-[12.5px] px-1.5 py-0.5 rounded-md bg-surface-3/80 text-accent font-[JetBrains_Mono,monospace] border border-border-subtle/40" {...rest}>{children}</code>;
    }
    return (<div className="relative group my-3 rounded-xl overflow-hidden border border-border-subtle/80 bg-surface-0/60 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/40 border-b border-border-subtle/60">
        <span className="text-[10px] text-text-muted/70 uppercase tracking-wider font-semibold">{lang || t('chat.codeFallback', 'code')}</span>
        <CopyButton text={code}/>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[12px] leading-relaxed"><code className="font-[JetBrains_Mono,monospace] text-text-primary" {...rest}>{children}</code></pre>
    </div>);
}
const MD_COMPONENTS = {
    code: CodeBlock,
    p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => <p className="mb-2 last:mb-0" {...props}>{children}</p>,
    ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...props}>{children}</ul>,
    ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props}>{children}</ol>,
    li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => <li className="text-[13.5px] leading-[1.7]" {...props}>{children}</li>,
    h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => <h1 className="text-base font-bold mt-3 mb-1.5" {...props}>{children}</h1>,
    h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => <h2 className="text-[15px] font-bold mt-2.5 mb-1" {...props}>{children}</h2>,
    h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => <h3 className="text-[14px] font-semibold mt-2 mb-1" {...props}>{children}</h3>,
    h4: ({ children, ...props }: ComponentPropsWithoutRef<'h4'>) => <h4 className="text-[13.5px] font-semibold mt-2 mb-0.5" {...props}>{children}</h4>,
    h5: ({ children, ...props }: ComponentPropsWithoutRef<'h5'>) => <h5 className="text-[13px] font-semibold mt-1.5 mb-0.5 text-text-secondary" {...props}>{children}</h5>,
    h6: ({ children, ...props }: ComponentPropsWithoutRef<'h6'>) => <h6 className="text-[12.5px] font-semibold mt-1.5 mb-0.5 text-text-muted" {...props}>{children}</h6>,
    blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => <blockquote className="border-l-2 border-accent/30 pl-3 my-2 text-text-secondary italic" {...props}>{children}</blockquote>,
    table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => <div className="overflow-x-auto my-2"><table className="w-full text-[12.5px] border-collapse" {...props}>{children}</table></div>,
    thead: ({ children, ...props }: ComponentPropsWithoutRef<'thead'>) => <thead className="bg-surface-2/60" {...props}>{children}</thead>,
    tbody: ({ children, ...props }: ComponentPropsWithoutRef<'tbody'>) => <tbody {...props}>{children}</tbody>,
    tr: ({ children, ...props }: ComponentPropsWithoutRef<'tr'>) => <tr className="even:bg-surface-1/40 border-b border-border/40" {...props}>{children}</tr>,
    th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => <th className="border border-border px-2 py-1.5 bg-surface-2/80 text-left font-semibold text-text-secondary" {...props}>{children}</th>,
    td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => <td className="border border-border px-2 py-1.5 text-text-primary" {...props}>{children}</td>,
    a: ({ children, ...props }: ComponentPropsWithoutRef<'a'>) => <a className="text-accent underline underline-offset-2 hover:text-accent-hover" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>,
    hr: (props: ComponentPropsWithoutRef<'hr'>) => <hr className="my-3 border-border" {...props}/>,
    del: ({ children, ...props }: ComponentPropsWithoutRef<'del'>) => <del className="text-text-muted" {...props}>{children}</del>,
    input: ({ size: _size, ...props }: ComponentPropsWithoutRef<'input'>) => <UiInput className="mr-1 accent-accent" {...props}/>,
} as const;
export function MarkdownRenderer({ content, allowHtml = false, }: {
    content: string;
    allowHtml?: boolean;
}) {
    const rehypePlugins = useMemo<PluggableList>(() => allowHtml
        ? [rehypeRaw, [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA], rehypeKatex]
        : [rehypeKatex], [allowHtml]);
    return (<Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={rehypePlugins} components={MD_COMPONENTS as Record<string, ComponentType<unknown>>}>
      {content}
    </Markdown>);
}


