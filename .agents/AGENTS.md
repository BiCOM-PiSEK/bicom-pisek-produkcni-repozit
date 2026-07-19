# Project-Scoped Rules for Bicom Písek

### ⚠️ Cloudflare Workers: Klonování odpovědí a komprese
Při klonování nebo modifikaci `Response` objektů (např. pro přidání CORS hlaviček) v middleware nebo handlerech je nutné **vždy odstranit hlavičky `Content-Encoding` a `Content-Length`**, pokud se předává tělo streamu (`response.body`). Cloudflare dekomprimuje tělo automaticky, což bez smazání těchto hlaviček vede k chybám `ERR_CONTENT_DECODING_FAILED` (bílá stránka) nebo stahování HTML stránek jako `.txt` souborů.

**Příklad bezpečného klonování:**
```javascript
function safeCloneResponse(response, extraHeaders = {}) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.delete('Content-Encoding');
  newResponse.headers.delete('Content-Length');
  Object.entries(extraHeaders).forEach(([k, v]) => newResponse.headers.set(k, v));
  return newResponse;
}
```
