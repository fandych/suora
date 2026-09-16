import { toast } from "@/components/ui/toast"

type AppToastType = "success" | "info" | "warning" | "error" | "loading"

export function showToast(input: { title: string; description?: string; type?: AppToastType; timeout?: number }) {
  toast.add(input)
}
