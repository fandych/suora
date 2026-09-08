import { useNavigate } from "react-router"
import { PlusIcon } from "lucide-react"

import { emitDataChanged } from "@/data/repositories/data-events"
import { createSkill } from "@/data/repositories/skill-repository"
import { Button } from "@/components/ui/button"

type SkillCreateButtonProps = {
  className?: string
  iconOnly?: boolean
}

export function SkillCreateButton({ className, iconOnly = false }: SkillCreateButtonProps) {
  const navigate = useNavigate()

  const handleCreate = async () => {
    const detail = await createSkill()
    emitDataChanged("/skills")
    navigate(`/skills/${detail.skill.id}`)
  }

  return (
    <Button className={className} size={iconOnly ? "icon-sm" : "sm"} onClick={() => void handleCreate()} aria-label="Create skill" title="Create skill">
      <PlusIcon data-icon={iconOnly ? undefined : "inline-start"} />
      {iconOnly ? <span className="sr-only">Create skill</span> : "Create skill"}
    </Button>
  )
}
