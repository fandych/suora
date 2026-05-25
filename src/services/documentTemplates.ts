/**
 * Document Templates
 *
 * Pre-configured templates inspired by llm_wiki's structured wiki page types.
 * Each template provides a category, default frontmatter, and starter content
 * so users can create well-structured knowledge pages quickly.
 */

export type DocumentTemplateType =
  | 'blank'
  | 'entity'
  | 'concept'
  | 'source'
  | 'research'
  | 'comparison'
  | 'synthesis'

export interface DocumentTemplate {
  type: DocumentTemplateType
  label: string
  description: string
  icon: string
  generate: (title: string) => string
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10)
}

const TEMPLATES: DocumentTemplate[] = [
  {
    type: 'blank',
    label: 'Blank',
    description: 'Empty document with a title heading',
    icon: '📄',
    generate: (title) => `# ${title}\n\n`,
  },
  {
    type: 'entity',
    label: 'Entity',
    description: 'A person, organization, product, or named thing',
    icon: '🏷️',
    generate: (title) =>
      `---
type: entity
title: "${title}"
tags: []
created: "${formatDate()}"
sources: []
related: []
---

# ${title}

## Overview

Brief description of this entity.

## Key Facts

- **Category**: 
- **Status**: 

## References

- 
`,
  },
  {
    type: 'concept',
    label: 'Concept',
    description: 'A theory, method, technique, or abstract idea',
    icon: '💡',
    generate: (title) =>
      `---
type: concept
title: "${title}"
tags: []
created: "${formatDate()}"
sources: []
related: []
---

# ${title}

## Definition

Explain the concept clearly.

## Key Principles

1. 
2. 
3. 

## Applications

- 

## Related Concepts

- 
`,
  },
  {
    type: 'source',
    label: 'Source Summary',
    description: 'Summary and notes from a source document or article',
    icon: '📋',
    generate: (title) =>
      `---
type: source
title: "${title}"
tags: []
created: "${formatDate()}"
sources: []
related: []
description: ""
---

# ${title}

## Summary

Key takeaways from this source.

## Main Points

1. 
2. 
3. 

## Quotes & Evidence

> 

## Connections

Links to other notes and concepts in this knowledge base.

- 
`,
  },
  {
    type: 'research',
    label: 'Research',
    description: 'Research notes, findings, and open questions',
    icon: '🔬',
    generate: (title) =>
      `---
type: research
title: "${title}"
tags: []
created: "${formatDate()}"
sources: []
related: []
---

# ${title}

## Research Question

What are we trying to understand?

## Findings

### Key Discoveries

1. 
2. 

### Supporting Evidence

- 

## Open Questions

- [ ] 
- [ ] 

## Next Steps

- 
`,
  },
  {
    type: 'comparison',
    label: 'Comparison',
    description: 'Side-by-side analysis of multiple subjects',
    icon: '⚖️',
    generate: (title) =>
      `---
type: comparison
title: "${title}"
tags: []
created: "${formatDate()}"
sources: []
related: []
---

# ${title}

## Subjects

- **A**: 
- **B**: 

## Comparison

| Dimension | A | B |
|-----------|---|---|
|           |   |   |
|           |   |   |
|           |   |   |

## Analysis

### Strengths

- **A**: 
- **B**: 

### Weaknesses

- **A**: 
- **B**: 

## Conclusion

- 
`,
  },
  {
    type: 'synthesis',
    label: 'Synthesis',
    description: 'Cross-source analysis connecting multiple ideas',
    icon: '🔗',
    generate: (title) =>
      `---
type: synthesis
title: "${title}"
tags: []
created: "${formatDate()}"
sources: []
related: []
---

# ${title}

## Thesis

What overarching insight connects the sources?

## Sources Analyzed

1. 
2. 
3. 

## Connections

### Common Themes

- 

### Contradictions

- 

### Gaps

- 

## Synthesis

Integrated understanding that emerges from analyzing the sources together.

## Implications

- 
`,
  },
]

export function getDocumentTemplates(): DocumentTemplate[] {
  return TEMPLATES
}

export function getDocumentTemplate(type: DocumentTemplateType): DocumentTemplate | undefined {
  return TEMPLATES.find((t) => t.type === type)
}

export function generateDocumentFromTemplate(type: DocumentTemplateType, title: string): string {
  const template = getDocumentTemplate(type)
  if (!template) return `# ${title}\n\n`
  return template.generate(title)
}
