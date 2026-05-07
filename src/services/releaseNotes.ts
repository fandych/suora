const ALLOWED_RELEASE_NOTE_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DEL',
  'DIV',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'LI',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SPAN',
  'STRONG',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'UL',
])

const STRIP_RELEASE_NOTE_TAGS = new Set(['EMBED', 'IFRAME', 'IMG', 'LINK', 'META', 'OBJECT', 'SCRIPT', 'STYLE'])

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function unwrapElement(element: Element) {
  const parent = element.parentNode
  if (!parent) {
    element.remove()
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

function sanitizeAnchorElement(element: HTMLAnchorElement) {
  const href = element.getAttribute('href')?.trim() ?? ''
  if (!href) {
    element.removeAttribute('href')
    element.removeAttribute('target')
    element.removeAttribute('rel')
    return
  }

  const normalizedHref = href.startsWith('/') ? `https://github.com${href}` : href
  if (!/^(https?:|mailto:)/i.test(normalizedHref)) {
    element.removeAttribute('href')
    element.removeAttribute('target')
    element.removeAttribute('rel')
    return
  }

  element.setAttribute('href', normalizedHref)
  element.setAttribute('target', '_blank')
  element.setAttribute('rel', 'noreferrer noopener')
}

export function sanitizeReleaseNotesHtml(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (typeof DOMParser === 'undefined') {
    return escapeHtml(trimmed).replace(/\r?\n/g, '<br />')
  }

  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  const elements = Array.from(doc.body.querySelectorAll('*')).reverse()

  for (const element of elements) {
    const tagName = element.tagName.toUpperCase()

    if (STRIP_RELEASE_NOTE_TAGS.has(tagName)) {
      element.remove()
      continue
    }

    if (!ALLOWED_RELEASE_NOTE_TAGS.has(tagName)) {
      unwrapElement(element)
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase()
      if (attributeName.startsWith('on') || attributeName === 'style') {
        element.removeAttribute(attribute.name)
        continue
      }

      if (tagName === 'A' && (attributeName === 'href' || attributeName === 'title')) continue
      element.removeAttribute(attribute.name)
    }

    if (tagName === 'A') {
      sanitizeAnchorElement(element as HTMLAnchorElement)
    }
  }

  return doc.body.innerHTML.trim()
}