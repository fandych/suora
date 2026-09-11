import { useNavigate } from "react-router"
import { PlusIcon } from "lucide-react"

import { emitDataChanged } from "@/application/shared/data-events"
import { skillApplicationService } from "@/application/skills/skill-application-service"
import { Button } from "@/components/ui/button"

type SkillCreateButtonProps = {
  className?: string
  iconOnly?: boolean
}

export function SkillCreateButton({ className, iconOnly = false }: SkillCreateButtonProps) {
  const navigate = useNavigate()

  const handleCreate = async () => {
    const detail = await skillApplicationService.create()
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
