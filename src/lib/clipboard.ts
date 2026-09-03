export async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Fall back to document copy below when the Clipboard API is unavailable or denied.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available in this runtime.")
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    const copied = document.execCommand("copy")
    if (!copied) {
      throw new Error("Clipboard copy is not supported in this runtime.")
    }
  } finally {
    textarea.remove()
  }
}