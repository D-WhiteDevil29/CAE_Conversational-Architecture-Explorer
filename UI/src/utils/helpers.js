import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import hljs from 'highlight.js/lib/common';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

export function truncate(str, length = 50) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function parseMarkdown(text) {
  if (!text) return '';

  // Strip image markdown \u2014 images cannot be rendered in chat bubbles
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // ![alt](url)
  text = text.replace(/!Image\b[^\n]*/gi, '');       // !Image placeholder
  text = text.replace(/!\[[^\]]*\]/g, '');            // bare ![alt]
  text = text.replace(/\n{3,}/g, '\n\n');             // collapse blank lines left behind

  // Step 1: Protect fenced code blocks with placeholders
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    const rawCode = code.replace(/\r\n/g, '\n').trimEnd();

    // Syntax-highlight with highlight.js
    let highlighted;
    try {
      highlighted = lang && hljs.getLanguage(lang)
        ? hljs.highlight(rawCode, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(rawCode).value;
    } catch {
      highlighted = rawCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const langLabel = lang || 'code';
    codeBlocks.push(
      `<div class="md-code-wrapper">` +
        `<div class="md-code-header">` +
          `<span class="md-code-lang">${langLabel}</span>` +
          `<button class="md-copy-btn" title="Copy code">` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>` +
            `<span class="md-copy-label">Copy</span>` +
          `</button>` +
        `</div>` +
        `<pre class="md-pre hljs"><code class="hljs language-${langLabel}">${highlighted}</code></pre>` +
      `</div>`
    );
    return `\x00CODE${idx}\x00`;
  });

  // Step 2: Tables — must run before \n → <br> conversion
  // Pre-pass: convert tab-separated header lines adjacent to pipe rows → proper pipe-table
  text = text.replace(
    /^([^\n|`*#>\-]+\t[^\n]+)\n(\n)?((?:\|[^\n]+\n?)+)/gm,
    (_, tabHeader, _blank, pipeBlock) => {
      const cols = tabHeader.split('\t').map(c => c.trim()).filter(Boolean);
      const pipeHeader = '| ' + cols.join(' | ') + ' |';
      const sep        = '| ' + cols.map(c => '-'.repeat(Math.max(3, c.length))).join(' | ') + ' |';
      const cleanBlock = pipeBlock.replace(/^\|[\s\-:|]+\|\n?/m, '');
      return `${pipeHeader}\n${sep}\n${cleanBlock}`;
    }
  );

  // Main table renderer: tolerates missing separator row
  text = text.replace(/((?:\|[^\n]+\|\n?){2,})/g, (tableBlock) => {
    const isSep  = r => /^\|[\s\-:|]+\|$/.test(r.trim());
    const rows   = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;

    // Determine header rows and body rows depending on whether separator is present
    let headerRow, bodyRows;
    if (isSep(rows[1])) {
      headerRow = rows[0];
      bodyRows  = rows.slice(2).filter(r => !isSep(r));
    } else {
      // No separator — treat first row as header, rest as body (skip any sep-like rows)
      headerRow = rows[0];
      bodyRows  = rows.slice(1).filter(r => !isSep(r));
    }

    const parseRow = row => row.split('|').slice(1, -1).map(c => c.trim());
    const headers  = parseRow(headerRow);
    if (headers.length === 0) return tableBlock;

    const headHtml = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    const bodyHtml = bodyRows
      .map(row => `<tr>${parseRow(row).map(c => `<td>${c}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="md-table-wrap"><table class="md-table"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table></div>\n`;
  });

  // Step 3: Headers (h1–h4)
  text = text.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  text = text.replace(/^### (.+)$/gm,  '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^## (.+)$/gm,   '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^# (.+)$/gm,    '<h1 class="md-h1">$1</h1>');

  // Numbered section headers: "1) Title" style (model sometimes uses this instead of ##)
  text = text.replace(/^\d+\)\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');

  // Step 4: Horizontal rule
  text = text.replace(/^---+$/gm, '<hr class="md-hr" />');

  // Step 5: Lists — group consecutive bullet / numbered lines
  // Bold "Term: description" patterns inside list items (e.g. "Order capture: capturing orders")
  const boldListTerm = s => s.replace(/^([A-Za-z][^:<\n]{1,60}?): /, '<strong>$1</strong>: ');

  const lines = text.split('\n');
  const out   = [];
  let inUL = false, inOL = false;
  for (const line of lines) {
    const ulMatch = line.match(/^[-*] (.*)$/);
    const olMatch = line.match(/^\d+\. (.*)$/);
    if (ulMatch) {
      if (inOL) { out.push('</ol>'); inOL = false; }
      if (!inUL) { out.push('<ul class="md-ul">'); inUL = true; }
      out.push(`<li>${boldListTerm(ulMatch[1])}</li>`);
    } else if (olMatch) {
      if (inUL) { out.push('</ul>'); inUL = false; }
      if (!inOL) { out.push('<ol class="md-ol">'); inOL = true; }
      out.push(`<li>${boldListTerm(olMatch[1])}</li>`);
    } else {
      if (inUL) { out.push('</ul>'); inUL = false; }
      if (inOL) { out.push('</ol>'); inOL = false; }
      out.push(line);
    }
  }
  if (inUL) out.push('</ul>');
  if (inOL) out.push('</ol>');
  text = out.join('\n');

  // Step 6: Inline code
  text = text.replace(/`([^`\n]+)`/g, '<code class="md-inline-code">$1</code>');

  // Step 7: Bold+italic, bold, italic
  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*([^*\n]+)\*\*/g,      '<strong>$1</strong>');
  text = text.replace(/\*([^*\n]+)\*/g,           '<em>$1</em>');

  // Step 8: Links
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Step 9: Remaining newlines → line breaks
  text = text.replace(/\n/g, '<br>');

  // Step 10: Restore protected code blocks
  codeBlocks.forEach((block, idx) => {
    text = text.replace(`\x00CODE${idx}\x00`, block);
  });

  return text;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

export function downloadJSON(data, filename = 'export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
