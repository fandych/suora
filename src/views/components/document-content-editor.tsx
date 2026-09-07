import { useEffect } from "react"

import MonacoEditor from "@monaco-editor/react"
import { EditorContent, useEditor } from "@tiptap/react"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableRow } from "@tiptap/extension-table-row"
import { TaskItem } from "@tiptap/extension-task-item"
import { TaskList } from "@tiptap/extension-task-list"
import StarterKit from "@tiptap/starter-kit"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { BoldIcon, ChartNoAxesCombinedIcon, Code2Icon, Columns3Icon, ItalicIcon, ListIcon, ListOrderedIcon, Rows3Icon, SigmaIcon, Table2Icon, TypeIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InlineMath, MathBlock, MermaidBlock } from "@/views/components/document-extensions"
import { markdownToTiptapHtml, tiptapJsonToMarkdown } from "@/views/components/document-markdown"

type DocumentContentEditorProps = {
  mode: "rich" | "source"
  value: string
  onChange: (value: string) => void
  sourceLanguage?: string
}

const DocumentContentEditor = ({ mode, value, onChange, sourceLanguage = "html" }: DocumentContentEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
      Image.configure({ inline: true }),
      Table.configure({ resizable: true, handleWidth: 6, cellMinWidth: 80, lastColumnResizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      MathBlock,
      InlineMath,
      MermaidBlock,
    ],
    content: markdownToTiptapHtml(value),
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(tiptapJsonToMarkdown(nextEditor.getJSON() as Parameters<typeof tiptapJsonToMarkdown>[0]))
    },
    editorProps: {
      attributes: {
        class: "document-prose h-full min-h-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none",
      },
    },
  })

  useEffect(() => {
    if (!editor || mode !== "rich") {
      return
    }

    const nextContent = markdownToTiptapHtml(value)
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false })
    }
  }, [editor, mode, value])

  if (mode === "source") {
    return (
      <div className="h-full overflow-hidden rounded-xl border border-border bg-background">
        <MonacoEditor
          height="100%"
          defaultLanguage={sourceLanguage}
          theme="vs-light"
          value={value}
          onChange={(nextValue) => onChange(nextValue ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbersMinChars: 3,
            padding: { top: 12 },
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <TooltipProvider>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pt-3">
        <NativeSelect className="w-24 shrink-0" value={editor?.getAttributes("heading").level ? `h${editor.getAttributes("heading").level}` : "paragraph"} onChange={(event) => {
          const value = event.target.value
          if (value === "paragraph") editor?.chain().focus().setParagraph().run()
          else editor?.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
        }} size="sm">
          <NativeSelectOption value="paragraph">Text</NativeSelectOption>
          {([1, 2, 3, 4, 5, 6] as const).map((level) => <NativeSelectOption key={level} value={`h${level}`}>H{level}</NativeSelectOption>)}
        </NativeSelect>
        <ButtonGroup>
          <ToolbarButton label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}><BoldIcon /></ToolbarButton>
          <ToolbarButton label="Thin" onClick={() => editor?.chain().focus().unsetBold().run()}><TypeIcon /></ToolbarButton>
        </ButtonGroup>
        <ToolbarButton label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><ItalicIcon /></ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}><ListIcon /></ToolbarButton>
        <ToolbarButton label="Ordered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrderedIcon /></ToolbarButton>
        <DropdownMenu>
          <Tooltip><TooltipTrigger render={<DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Table options" />} />}><Table2Icon /></TooltipTrigger><TooltipContent>Table options</TooltipContent></Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2Icon className="size-4" />Insert table</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor?.chain().focus().addRowAfter().run()}><Rows3Icon className="size-4" />Add row</DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor?.chain().focus().addColumnAfter().run()}><Columns3Icon className="size-4" />Add column</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarButton label="Code block" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2Icon /></ToolbarButton>
        <ToolbarButton label="Insert math" onClick={() => editor?.chain().focus().insertContent({ type: "mathBlock", attrs: { content: "x^2 + y^2 = z^2" } }).run()}><SigmaIcon /></ToolbarButton>
        <ToolbarButton label="Insert Mermaid chart" onClick={() => editor?.chain().focus().insertContent({ type: "mermaidBlock", attrs: { code: "graph TD\nA[Start] --> B[Step]" } }).run()}><ChartNoAxesCombinedIcon /></ToolbarButton>
        </div>
      </TooltipProvider>
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-auto" />
    </div>
  )
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" variant="outline" aria-label={label} />} onClick={onClick}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default DocumentContentEditor