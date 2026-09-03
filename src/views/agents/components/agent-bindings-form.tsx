import { useMemo, useState } from "react"

import type { AgentDetail, DocumentSummary, IntegrationSummary, SkillSummary, WorkflowSummary } from "@/data/domain/models"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

type AgentBindingsFormProps = {
  documents: DocumentSummary[]
  draft: AgentDetail
  isReadOnly?: boolean
  integrations: IntegrationSummary[]
  onToggle: (section: "workflows" | "integrations" | "skills" | "documents", itemId: string, checked: boolean) => void
  skills: SkillSummary[]
  workflows: WorkflowSummary[]
}

type SelectableItem = {
  id: string
  title: string
  description?: string
}

function BindingChecklist({
  description,
  disabled = false,
  items,
  query,
  selectedIds,
  onQueryChange,
  onToggle,
}: {
  description: string
  disabled?: boolean
  items: SelectableItem[]
  query: string
  selectedIds: string[]
  onQueryChange: (value: string) => void
  onToggle: (itemId: string, checked: boolean) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      <div className="text-xs text-muted-foreground">{description}</div>
      <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search in this section" className="h-8 text-xs" />
      <ScrollArea className="min-h-0 flex-1 rounded-xl border bg-muted/20">
        <div className="space-y-2 p-3">
        {items.length === 0 ? <div className="text-sm text-muted-foreground">No items available.</div> : null}
        {items.map((item) => {
          const checked = selectedIds.includes(item.id)
          return (
            <label key={item.id} className={`flex items-start gap-3 rounded-lg border bg-background px-3 py-2 transition-colors ${disabled ? "opacity-70" : "cursor-pointer hover:border-primary/30 hover:bg-muted/30"}`}>
              <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onToggle(item.id, value === true)} />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">{item.description || item.id}</div>
              </div>
            </label>
          )
        })}
        </div>
      </ScrollArea>
    </div>
  )
}

export function AgentBindingsForm({ documents, draft, integrations, isReadOnly = false, onToggle, skills, workflows }: AgentBindingsFormProps) {
  const [openSection, setOpenSection] = useState("workflows")
  const [queries, setQueries] = useState({
    workflows: "",
    integrations: "",
    skills: "",
    documents: "",
  })

  const buildItems = useMemo(() => (
    items: SelectableItem[],
    selectedIds: string[],
    query: string,
  ) => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? items.filter((item) => `${item.title} ${item.description ?? ""} ${item.id}`.toLowerCase().includes(keyword))
      : items

    return [...filtered].sort((left, right) => {
      const leftSelected = selectedIds.includes(left.id)
      const rightSelected = selectedIds.includes(right.id)
      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1
      }

      return left.title.localeCompare(right.title)
    })
  }, [])

  const workflowSelectedIds = draft.config.workflowIds ?? []
  const integrationSelectedIds = draft.config.toolsetIds
  const skillSelectedIds = draft.config.skillIds
  const documentSelectedIds = draft.config.documentIds ?? []

  const workflowItems = buildItems(workflows.map((workflow) => ({ id: workflow.id, title: workflow.title, description: workflow.summary })), workflowSelectedIds, queries.workflows)
  const integrationItems = buildItems(integrations.map((integration) => ({ id: integration.id, title: integration.title, description: integration.endpoint || integration.kind })), integrationSelectedIds, queries.integrations)
  const skillItems = buildItems(skills.map((skill) => ({ id: skill.id, title: skill.title, description: skill.summary })), skillSelectedIds, queries.skills)
  const documentItems = buildItems(documents.map((document) => ({ id: document.id, title: document.title, description: document.summary })), documentSelectedIds, queries.documents)

  return (
    <Card className="h-full min-h-0 min-w-0 overflow-hidden">
      <CardHeader className="gap-3 border-b">
        <CardTitle>Bindings</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Accordion className="flex min-h-0 flex-1 flex-col overflow-hidden" value={openSection ? [openSection] : []} onValueChange={(value) => setOpenSection(Array.isArray(value) ? String(value[0] ?? "") : String(value ?? ""))}>
          <AccordionItem value="workflows" className={`px-4 pt-2 ${openSection === "workflows" ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <AccordionTrigger>Workflow</AccordionTrigger>
            <AccordionContent className={openSection === "workflows" ? "flex min-h-0 flex-1 flex-col" : undefined}>
              <BindingChecklist
                description="Attach reusable workflows this agent can coordinate."
                disabled={isReadOnly}
                items={workflowItems}
                query={queries.workflows}
                selectedIds={workflowSelectedIds}
                onQueryChange={(value) => setQueries((current) => ({ ...current, workflows: value }))}
                onToggle={(itemId, checked) => onToggle("workflows", itemId, checked)}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="integrations" className={`px-4 ${openSection === "integrations" ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <AccordionTrigger>Integrations</AccordionTrigger>
            <AccordionContent className={openSection === "integrations" ? "flex min-h-0 flex-1 flex-col" : undefined}>
              <BindingChecklist
                description="Attach tool and runtime integrations."
                disabled={isReadOnly}
                items={integrationItems}
                query={queries.integrations}
                selectedIds={integrationSelectedIds}
                onQueryChange={(value) => setQueries((current) => ({ ...current, integrations: value }))}
                onToggle={(itemId, checked) => onToggle("integrations", itemId, checked)}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="skills" className={`px-4 ${openSection === "skills" ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <AccordionTrigger>Skills</AccordionTrigger>
            <AccordionContent className={openSection === "skills" ? "flex min-h-0 flex-1 flex-col" : undefined}>
              <BindingChecklist
                description="Attach reusable prompt packages."
                disabled={isReadOnly}
                items={skillItems}
                query={queries.skills}
                selectedIds={skillSelectedIds}
                onQueryChange={(value) => setQueries((current) => ({ ...current, skills: value }))}
                onToggle={(itemId, checked) => onToggle("skills", itemId, checked)}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="documents" className={`px-4 pb-2 ${openSection === "documents" ? "flex min-h-0 flex-1 flex-col" : ""}`}>
            <AccordionTrigger>Documents</AccordionTrigger>
            <AccordionContent className={openSection === "documents" ? "flex min-h-0 flex-1 flex-col" : undefined}>
              <BindingChecklist
                description="Attach knowledge documents and working notes."
                disabled={isReadOnly}
                items={documentItems}
                query={queries.documents}
                selectedIds={documentSelectedIds}
                onQueryChange={(value) => setQueries((current) => ({ ...current, documents: value }))}
                onToggle={(itemId, checked) => onToggle("documents", itemId, checked)}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
