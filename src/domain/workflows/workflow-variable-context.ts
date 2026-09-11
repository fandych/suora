export type WorkflowVariableContext = Record<string, unknown> & { input: unknown; vars: Record<string, unknown>; steps: Record<string, unknown>; current?: unknown }

function navigateObject(object: unknown, parts: string[]): unknown {
	let current = object
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== "object") return undefined
		current = (current as Record<string, unknown>)[part]
	}
	return current
}

function applyPipeFilters(value: unknown, pipes: string[]) {
	let current = value
	for (const pipe of pipes) {
		const trimmed = pipe.trim()
		if (trimmed === "upper" || trimmed === "uppercase") current = String(current ?? "").toUpperCase()
		else if (trimmed === "lower" || trimmed === "lowercase") current = String(current ?? "").toLowerCase()
		else if (trimmed === "trim") current = String(current ?? "").trim()
		else if (trimmed === "json") current = JSON.stringify(current)
		else if (trimmed.startsWith("default(") && (current === undefined || current === null || current === "")) current = trimmed.slice(8, -1).replace(/^['"]|['"]$/g, "")
	}
	return current
}

export function readPath(context: WorkflowVariableContext, expression: string): unknown {
	const raw = expression.trim().replace(/^\{\{\s*|\s*\}\}$/g, "").replace(/^\$\{\s*|\s*\}$/g, "")
	if (!raw) return undefined
	const pipes = raw.split("|").map((part) => part.trim())
	const parts = pipes[0].replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)
	const first = parts[0]
	let value: unknown
	if (first === "input" || first === "$input") value = navigateObject(context.input, parts.slice(1))
	else if (first === "vars" || first === "$vars") value = navigateObject(context.vars, parts.slice(1))
	else if (first === "steps" || first === "$steps") value = navigateObject(context.steps, parts.slice(1))
	else value = navigateObject(context, parts) ?? navigateObject(context.vars, parts) ?? navigateObject(context.steps, parts) ?? navigateObject(context.input, parts)
	return applyPipeFilters(value, pipes.slice(1))
}

function formatValue(value: unknown) { return value === undefined || value === null ? "" : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value) }
export function interpolate(value: string | undefined | null, context: WorkflowVariableContext): string {
	if (!value) return ""
	return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression) => formatValue(readPath(context, expression))).replace(/\$\{([^}]+)\}/g, (_match, expression) => formatValue(readPath(context, expression)))
}

export function mapNodeOutput(outputSchemaJson: string | undefined, context: WorkflowVariableContext): Record<string, unknown> | undefined {
	try {
		const schema = JSON.parse(outputSchemaJson || "{}") as { properties?: Record<string, { default?: unknown; properties?: Record<string, unknown> }> }
		const resolve = (value: unknown): unknown => {
			if (typeof value !== "string") return value
			const expression = value.trim().match(/^(?:\{\{\s*([^}]+)\s*\}\}|\$\{\s*([^}]+)\s*\}|\$([a-zA-Z_][\w.]*))$/)
			if (expression) {
				const resolved = readPath(context, expression[1] ?? expression[2] ?? expression[3])
				if (resolved !== undefined) return resolved
			}
			return interpolate(value, context)
		}
		const mapProperties = (properties: Record<string, { default?: unknown; properties?: Record<string, unknown> }>): Record<string, unknown> | undefined => {
			const entries = Object.entries(properties)
			if (entries.length === 0) return undefined
			const mapped = Object.fromEntries(entries.flatMap(([name, property]) => {
				const nested = property.properties ? mapProperties(property.properties as Record<string, { default?: unknown; properties?: Record<string, unknown> }>) : undefined
				if (nested) return [[name, nested]]
				if (property.default !== undefined) return [[name, resolve(property.default)]]
				return []
			}))
			return Object.keys(mapped).length ? mapped : undefined
		}
		return mapProperties(schema.properties ?? {})
	} catch { return undefined }
}
export function combineNodeOutput(rawOutput: unknown, mappedOutput: Record<string, unknown> | undefined): unknown {
	if (!mappedOutput) return rawOutput
	return rawOutput !== null && typeof rawOutput === "object" && !Array.isArray(rawOutput) ? { ...rawOutput as Record<string, unknown>, ...mappedOutput } : { value: rawOutput, ...mappedOutput }
}
