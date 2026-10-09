/**
 * SVG logos are served from the dashboard's own address, so a script inside one could run as the dashboard if someone
 * opened the file directly. Logos are often downloaded from the web, so everything that can run code or load other
 * pages is removed before the file is saved: scripts, embedded HTML, event handlers and links that aren't to a
 * place inside the drawing.
 */
export function cleanSvg(svg: string): string {
  let s = svg
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<\?(?!xml\s)[\s\S]*?\?>/gi, '');
  for (const tag of ['script', 'foreignObject', 'iframe', 'embed', 'object', 'audio', 'video', 'handler', 'listener']) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, 'gi'), '').replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '');
  }
  return (
    s
      // Event handlers (onload=, onclick=…), quoted or not.
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // Links may only point inside the drawing (#id). Embedded images (data:image/…) stay.
      .replace(/\s+((?:xlink:)?href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (all, _attr, _q, a, b, c) => {
        const v = String(a ?? b ?? c ?? '').trim();
        return v.startsWith('#') || /^data:image\/(png|jpeg|webp|gif);/i.test(v) ? all : '';
      })
      // Animations that set attributes can turn a safe value into a link.
      .replace(/<(set|animate)\b[^>]*attributeName\s*=\s*["']?(?:xlink:)?href[^>]*>/gi, '')
  );
}

/** Still has something that could run, after cleaning (refuse the file instead of guessing). */
export const svgLooksActive = (svg: string) => /<script|javascript:|<foreignObject|\son[a-z]+\s*=/i.test(svg);
