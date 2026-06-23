/**
 * Runtime AI configuration loaded from process_states.
 * Keeps prompt orchestration tunable without deploy.
 */

const DEFAULTS = {
  ai_copywriter_tone: 'quiet_luxury',
  ai_legal_guardrail: 'optimal',
  ai_studio_prompts_enabled: '1',
  ai_studio_prompt_profile: 'default',
  ai_studio_chat_max_sentences: '4',
};

/**
 * Loads known AI runtime flags from process_states table.
 * @param {Object} env
 * @returns {Promise<Record<string, string>>}
 */
export async function loadAiRuntimeConfig(env) {
  try {
    const keys = Object.keys(DEFAULTS);
    const placeholders = keys.map(() => '?').join(', ');
    const { results } = await env.DB.prepare(
      `SELECT key, value FROM process_states WHERE key IN (${placeholders})`
    ).bind(...keys).all();

    const values = { ...DEFAULTS };
    for (const row of results || []) {
      if (typeof row?.key === 'string' && typeof row?.value === 'string') {
        values[row.key] = row.value;
      }
    }
    return values;
  } catch (err) {
    console.warn('[ai/runtime-config] Failed to load process_states, using defaults:', err?.message || err);
    return { ...DEFAULTS };
  }
}

