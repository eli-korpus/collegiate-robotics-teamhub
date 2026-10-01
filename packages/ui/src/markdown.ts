/**
 * Safe markdown subset for announcements, notebook entries, etc.
 * HTML is escaped FIRST, then a small set of formatting is applied, so user content can never inject markup.
 * Supported: ### headings, **bold**, *italic*, `code`, [links](https://…), bare URLs, - / 1. lists, > quotes, paragraphs.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, t, u) => `<a href="${u}" target="_blank" rel="noreferrer noopener">${t}</a>`);
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, pre, u) => `${pre}<a href="${u}" target="_blank" rel="noreferrer noopener">${u}</a>`);
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = (src ?? '').replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpExecArray | null;
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flushPara();
      closeList();
      const lvl = m[1].length <= 2 ? 3 : 4;
      html.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
      flushPara();
      if (list !== 'ul') {
        closeList();
        html.push('<ul>');
        list = 'ul';
      }
      html.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      if (list !== 'ol') {
        closeList();
        html.push('<ol>');
        list = 'ol';
      }
      html.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara();
      closeList();
      html.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return html.join('');
}

/** Plain-text excerpt for previews and search results. */
export function markdownExcerpt(src: string, max = 140): string {
  const text = (src ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
