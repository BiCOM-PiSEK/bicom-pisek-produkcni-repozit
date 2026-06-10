/**
 * BICOM PÍSEK — Safe Markdown Renderer
 * Escapes HTML characters first to prevent XSS, then parses a subset of markdown.
 */

/**
 * Renders a markdown string into safe HTML.
 * Normalizes literal "\n" sequences, escapes HTML, and converts headers, bold,
 * italic, lists, blockquotes, and paragraphs.
 *
 * @param {string} text - Raw markdown text
 * @returns {string} Safe HTML string
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // 1. Normalize literal \n (backslash + n) to actual newline
  let normalized = text.replace(/\\n/g, '\n');

  // 2. Escape HTML characters to prevent XSS
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  let html = normalized.replace(/[&<>"']/g, m => escapeMap[m]);

  // 3. Process inline formatting (**bold**, *italic*)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 4. Parse block elements line by line
  const lines = html.split('\n');
  const result = [];

  let inList = false;
  let inQuote = false;
  let currentParagraph = [];
  let currentQuote = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      result.push(`<p>${currentParagraph.join('<br>')}</p>`);
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (inList) {
      result.push('</ul>');
      inList = false;
    }
  };

  const flushQuote = () => {
    if (inQuote) {
      result.push(`<blockquote>${currentQuote.join('<br>')}</blockquote>`);
      currentQuote = [];
      inQuote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line terminates block elements
    if (trimmed === '') {
      flushList();
      flushQuote();
      flushParagraph();
      continue;
    }

    // Heading 3: ### Heading
    if (trimmed.startsWith('### ')) {
      flushList();
      flushQuote();
      flushParagraph();
      result.push(`<h3>${trimmed.slice(4).trim()}</h3>`);
      continue;
    }

    // Heading 2: ## Heading
    if (trimmed.startsWith('## ')) {
      flushList();
      flushQuote();
      flushParagraph();
      result.push(`<h2>${trimmed.slice(3).trim()}</h2>`);
      continue;
    }

    // List item: - Item
    if (trimmed.startsWith('- ')) {
      flushQuote();
      flushParagraph();
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${trimmed.slice(2).trim()}</li>`);
      continue;
    }

    // Blockquote: > Quote (escaped as &gt;)
    if (trimmed.startsWith('&gt; ')) {
      flushList();
      flushParagraph();
      inQuote = true;
      currentQuote.push(trimmed.slice(5).trim());
      continue;
    }

    // Regular text line
    flushList();
    flushQuote();
    currentParagraph.push(line);
  }

  // Flush remaining elements
  flushList();
  flushQuote();
  flushParagraph();

  return result.join('\n');
}
