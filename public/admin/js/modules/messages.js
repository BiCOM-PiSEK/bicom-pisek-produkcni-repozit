/**
 * BICOM PÍSEK — Messages Module (Zprávy)
 * Umožňuje operátorům procházet a spravovat konverzace uživatelů s AI Rádcem.
 */
export async function render(container, ctx) {
  const { api, showToast } = ctx;

  container.innerHTML = `
    <style>
      .messages-layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: var(--sp-5);
        height: calc(100vh - 180px);
        min-height: 520px;
      }
      @media (max-width: 768px) {
        .messages-layout {
          grid-template-columns: 1fr;
          height: auto;
        }
      }
      .chat-sidebar {
        display: flex;
        flex-direction: column;
        padding: var(--sp-4);
        height: 100%;
        overflow: hidden;
      }
      .chat-list-container {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        margin-top: var(--sp-3);
      }
      .chat-item {
        padding: var(--sp-3);
        border-radius: var(--radius-md);
        border: 1px solid var(--c-mist);
        background: var(--c-alabaster);
        cursor: pointer;
        transition: all var(--duration-fast) var(--ease-out);
        text-align: left;
        width: 100%;
      }
      .chat-item:hover {
        background: var(--c-sage-light);
        border-color: var(--c-sage);
      }
      .chat-item.active {
        background: linear-gradient(135deg, rgba(115, 138, 117, 0.12), rgba(197, 168, 128, 0.08));
        border-color: var(--c-champagne);
        font-weight: 500;
      }
      .chat-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--sp-1);
      }
      .chat-item-title {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--c-forest);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .chat-item-time {
        font-size: var(--text-xs);
        color: var(--c-sage);
        flex-shrink: 0;
      }
      .chat-item-preview {
        font-size: var(--text-xs);
        color: var(--c-sage);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .chat-detail {
        display: flex;
        flex-direction: column;
        padding: var(--sp-4);
        height: 100%;
        overflow: hidden;
        background: var(--c-white);
      }
      .chat-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: var(--sp-3);
        border-bottom: 1px solid var(--c-mist);
        margin-bottom: var(--sp-4);
      }
      .chat-messages-stream {
        flex: 1;
        overflow-y: auto;
        padding: var(--sp-2);
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        background: var(--c-alabaster);
        border-radius: var(--radius-md);
        border: 1px solid var(--c-mist);
      }
      .msg-bubble-wrapper {
        display: flex;
        width: 100%;
        margin-bottom: var(--sp-1);
      }
      .msg-bubble-wrapper.user {
        justify-content: flex-end;
      }
      .msg-bubble-wrapper.assistant {
        justify-content: flex-start;
      }
      .msg-bubble {
        max-width: 70%;
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--radius-lg);
        font-size: var(--text-sm);
        line-height: 1.5;
        position: relative;
        word-break: break-word;
      }
      .msg-bubble-wrapper.user .msg-bubble {
        background: var(--c-sage);
        color: var(--c-white);
        border-bottom-right-radius: var(--radius-sm);
      }
      .msg-bubble-wrapper.assistant .msg-bubble {
        background: var(--c-white);
        color: var(--c-charcoal);
        border-bottom-left-radius: var(--radius-sm);
        box-shadow: var(--shadow-sm);
      }
      .msg-time {
        font-size: 0.65rem;
        margin-top: var(--sp-1);
        display: block;
        text-align: right;
        opacity: 0.8;
      }
      .msg-bubble-wrapper.user .msg-time {
        color: var(--c-sage-light);
      }
      .msg-bubble-wrapper.assistant .msg-time {
        color: var(--c-sage);
      }
    </style>

    <div class="canvas-header">
      <h1 class="canvas-title">Zprávy</h1>
      <p class="canvas-subtitle">Prohlížení konverzací s AI Rádcem</p>
    </div>

    <div class="messages-layout">
      <!-- Levý panel: Seznam konverzací -->
      <div class="card chat-sidebar">
        <div class="flex justify-between items-center mb-2" style="border-bottom: 1px solid var(--c-mist); padding-bottom: var(--sp-2);">
          <h3 style="font-family: var(--font-head); font-size: var(--text-md); color: var(--c-forest); font-weight: 600;">Konverzace</h3>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-chats" style="height: 28px; width: 28px; padding: 0;" title="Obnovit seznam">🔄</button>
        </div>
        <div class="chat-list-container" id="chats-list">
          <div class="skeleton" style="width: 100%; height: 50px;"></div>
          <div class="skeleton" style="width: 100%; height: 50px; margin-top: 10px;"></div>
        </div>
      </div>

      <!-- Pravý panel: Detail vybrané konverzace -->
      <div class="card chat-detail" id="chat-detail-panel">
        <div class="empty-state" style="margin: auto; text-align: center; padding: var(--sp-6) var(--sp-4);">
          <div style="font-size: 3rem; margin-bottom: var(--sp-4);">💬</div>
          <h4 class="empty-state-title" style="font-family: var(--font-head); font-size: 1.3rem; color: var(--c-forest); margin-bottom: var(--sp-2);">Vyberte konverzaci</h4>
          <p class="empty-state-text" style="max-width: 320px; margin: 0 auto; color: var(--c-sage);">Zvolte konverzaci z levého panelu pro zobrazení historie zpráv s AI Rádcem.</p>
        </div>
      </div>
    </div>
  `;

  // Tlačítko obnovení
  const btnRefresh = container.querySelector('#btn-refresh-chats');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadConversations(container, api, showToast));
  }

  // První načtení konverzací
  await loadConversations(container, api, showToast);
}

export function destroy() {}

/**
 * Načte seznam všech konverzací z API a vykreslí je.
 */
async function loadConversations(container, api, showToast, selectedId = null) {
  const listEl = container.querySelector('#chats-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <div style="text-align: center; padding: var(--sp-4); color: var(--c-sage);">
      Načítám konverzace...
    </div>
  `;

  if (!api) {
    listEl.innerHTML = renderError('Není k dispozici API klient.');
    return;
  }

  try {
    const res = await api.getChatConversations();
    if (!res.ok || !res.data) {
      listEl.innerHTML = renderError(res.error || 'Chyba při komunikaci se serverem.');
      if (showToast) showToast('Nepodařilo se načíst konverzace: ' + (res.error || 'neznámá chyba'), 'error');
      return;
    }

    const conversations = res.data.conversations || [];

    if (conversations.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: var(--sp-6) var(--sp-2); color: var(--c-sage); font-size: var(--text-sm);">
          Zatím žádné konverzace
        </div>
      `;
      // Vyčistit pravý panel
      const detailPanel = container.querySelector('#chat-detail-panel');
      if (detailPanel) {
        detailPanel.innerHTML = `
          <div class="empty-state" style="margin: auto; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: var(--sp-4);">💬</div>
            <h4 class="empty-state-title" style="font-family: var(--font-head); font-size: 1.3rem; color: var(--c-forest);">Bez konverzací</h4>
            <p class="empty-state-text" style="color: var(--c-sage);">V databázi nejsou žádné zaznamenané chaty.</p>
          </div>
        `;
      }
      return;
    }

    listEl.innerHTML = conversations.map(c => {
      const activeClass = selectedId === c.conversation_id ? 'active' : '';
      const dateStr = formatDate(c.last_message_at);
      const idSnippet = c.conversation_id.substring(0, 8);
      const msgPreview = c.last_message ? c.last_message : '(prázdná zpráva)';

      return `
        <button class="chat-item ${activeClass}" data-id="${esc(c.conversation_id)}">
          <div class="chat-item-header">
            <span class="chat-item-title">Chat #${esc(idSnippet)}</span>
            <span class="chat-item-time">${esc(dateStr)}</span>
          </div>
          <div class="chat-item-preview">${esc(msgPreview)}</div>
          <div style="font-size: 0.65rem; color: var(--c-champagne); margin-top: var(--sp-1); text-align: right;">
            ${c.message_count} zpráv
          </div>
        </button>
      `;
    }).join('');

    // Navázat kliknutí na položky seznamu
    const items = listEl.querySelectorAll('.chat-item');
    items.forEach(item => {
      item.addEventListener('click', async () => {
        // Zrušit předchozí aktivní
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const conversationId = item.getAttribute('data-id');
        await loadConversationDetail(conversationId, container, api, showToast);
      });
    });

    // Pokud byl vybrán konkrétní chat, zajistit aktivní třídu
    if (selectedId) {
      const activeBtn = listEl.querySelector(`[data-id="${selectedId}"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }
  } catch (err) {
    listEl.innerHTML = renderError('Chyba sítě při načítání konverzací.');
    if (showToast) showToast('Chyba sítě: ' + err.message, 'error');
  }
}

/**
 * Načte zprávy jedné konverzace a vykreslí je v detailním panelu.
 */
async function loadConversationDetail(conversationId, container, api, showToast) {
  const detailPanel = container.querySelector('#chat-detail-panel');
  if (!detailPanel) return;

  detailPanel.innerHTML = `
    <div style="margin: auto; text-align: center; color: var(--c-sage);">
      Načítám detail konverzace...
    </div>
  `;

  // Request guard to prevent race conditions
  detailPanel.dataset.activeId = conversationId;

  try {
    const res = await api.getChatMessages(conversationId);
    
    // Guard check
    if (detailPanel.dataset.activeId !== conversationId) return;

    if (!res.ok || !res.data) {
      detailPanel.innerHTML = renderError(res.error || 'Nepodařilo se načíst zprávy.');
      return;
    }

    const messages = res.data.messages || [];
    const idSnippet = conversationId.substring(0, 8);

    detailPanel.innerHTML = `
      <div class="chat-detail-header">
        <div>
          <h3 style="font-family: var(--font-head); font-size: var(--text-lg); color: var(--c-forest); font-weight: 600;">
            Detail konverzace
          </h3>
          <p style="font-size: var(--text-xs); color: var(--c-sage);">ID: <code style="background: var(--c-sage-light); padding: 2px 4px; border-radius: var(--radius-sm);">${esc(conversationId)}</code></p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-delete-chat" style="background: var(--c-error-bg); color: var(--c-error); border: 1px solid var(--c-error-bg);" title="Smazat celou konverzaci">
          🗑️ Smazat chat
        </button>
      </div>
      
      <div class="chat-messages-stream" id="messages-stream">
        ${messages.map(m => {
          const roleClass = m.role === 'user' ? 'user' : 'assistant';
          const formattedRole = m.role === 'user' ? 'Klient' : 'AI Rádce';
          const msgTime = formatDate(m.created_at);
          return `
            <div class="msg-bubble-wrapper ${roleClass}">
              <div class="msg-bubble">
                <span style="font-size: 0.65rem; font-weight: 600; display: block; margin-bottom: 2px; opacity: 0.7;">
                  ${formattedRole}
                </span>
                <div>${esc(m.message).replace(/\n/g, '<br>')}</div>
                <span class="msg-time">${esc(msgTime)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Autoscroll na konec
    const streamEl = detailPanel.querySelector('#messages-stream');
    if (streamEl) {
      streamEl.scrollTop = streamEl.scrollHeight;
    }

    // Tlačítko smazání
    const btnDelete = detailPanel.querySelector('#btn-delete-chat');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        // Guard check on button click
        if (detailPanel.dataset.activeId !== conversationId) return;

        if (!confirm(`Opravdu chcete smazat celou konverzaci #${idSnippet} (celkem ${messages.length} zpráv)? Tato akce je nevratná.`)) {
          return;
        }

        btnDelete.disabled = true;
        btnDelete.textContent = 'Mažu...';

        try {
          const delRes = await api.deleteChatConversation(conversationId);
          
          // Guard check
          if (detailPanel.dataset.activeId !== conversationId) return;

          if (delRes.ok) {
            if (showToast) showToast('Konverzace byla úspěšně smazána', 'success');
            // Reset pravého panelu
            detailPanel.innerHTML = `
              <div class="empty-state" style="margin: auto; text-align: center; padding: var(--sp-6) var(--sp-4);">
                <div style="font-size: 3rem; margin-bottom: var(--sp-4);">💬</div>
                <h4 class="empty-state-title" style="font-family: var(--font-head); font-size: 1.3rem; color: var(--c-forest); margin-bottom: var(--sp-2);">Vyberte konverzaci</h4>
                <p class="empty-state-text" style="max-width: 320px; margin: 0 auto; color: var(--c-sage);">Zvolte konverzaci z levého panelu pro zobrazení historie zpráv s AI Rádcem.</p>
              </div>
            `;
            // Znovu načíst seznam
            await loadConversations(container, api, showToast);
          } else {
            btnDelete.disabled = false;
            btnDelete.textContent = '🗑️ Smazat chat';
            if (showToast) showToast('Nepodařilo se smazat konverzaci: ' + delRes.error, 'error');
          }
        } catch (err) {
          btnDelete.disabled = false;
          btnDelete.textContent = '🗑️ Smazat chat';
          if (showToast) showToast('Chyba sítě při mazání: ' + err.message, 'error');
        }
      });
    }
  } catch (err) {
    if (detailPanel.dataset.activeId === conversationId) {
      detailPanel.innerHTML = renderError('Chyba sítě při načítání zpráv.');
      if (showToast) showToast('Chyba sítě: ' + err.message, 'error');
    }
  }
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderError(message) {
  return `
    <div style="text-align: center; padding: var(--sp-4); color: var(--c-error); background: var(--c-error-bg); border-radius: var(--radius-md); font-size: var(--text-sm);">
      ⚠️ ${esc(message)}
    </div>
  `;
}

function esc(s) {
  if (!s) return '';
  const e = document.createElement('span');
  e.textContent = s;
  return e.innerHTML;
}
