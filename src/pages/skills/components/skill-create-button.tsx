import { useNavigate } from "react-router"
import { PlusIcon } from "lucide-react"

import { emitDataChanged } from "@/services/data-events"
import { SkillApi } from "@/services/skill-service"
import { Button } from "@/components/ui/button"
import { useAppIntl } from "@/lib/i18n"

type SkillCreateButtonProps = {
  className?: string
  iconOnly?: boolean
}

export function SkillCreateButton({ className, iconOnly = false }: SkillCreateButtonProps) {
  const { t } = useAppIntl()
  const navigate = useNavigate()

  const handleCreate = async () => {
    const detail = await SkillApi.create()
    emitDataChanged("/skills")
    navigate(`/skills/${detail.skill.id}`)
  }

  return (
    <Button
      className={className}
      size={iconOnly ? "icon-sm" : "sm"}
      onClick={() => void handleCreate()}
      aria-label={t("newSkill.button", "Create skill")}
      title={t("newSkill.button", "Create skill")}
    >
      <PlusIcon data-icon={iconOnly ? undefined : "inline-start"} />
      {iconOnly ? <span className="sr-only">{t("newSkill.button", "Create skill")}</span> : t("newSkill.button", "Create skill")}
    </Button>
  )
}
