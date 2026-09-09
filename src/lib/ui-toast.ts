import { toast } from "@/components/ui/toast"

type AppToastType = "success" | "info" | "warning" | "error" | "loading"

export function showToast(input: { title: string; description?: string; type?: AppToastType; timeout?: number }) {
  toast.add({
    title: input.title,
    description: input.description,
    type: input.type,
    timeout: input.timeout,
  })
}
