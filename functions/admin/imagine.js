/**
 * BICOM PÍSEK — AI Studio Visual Pipeline
 * GET  /admin/imagine              list media assets
 * GET  /admin/imagine?view=jobs    list visual generation jobs
 * POST /admin/imagine              generate visual asset
 * PUT  /admin/imagine              update asset status/metadata
 */

import { json, auditStmt } from '../lib/cms.js';
import { stripTags } from '../lib/sanitize.js';
import { runImage } from '../lib/ai/providers.js';
import { getSkill } from '../lib/ai/skills/index.js';
import { loadAiRuntimeConfig } from '../lib/ai/skills/runtime-config.js';
import { buildOverlaySvg } from '../lib/ai/composer.js';

const VALID_KINDS = ['article_cover', 'social_post', 'social_story', 'social_carousel', 'web_banner'];
const VALID_STATUSES = ['draft', 'approved', 'archived', 'failed'];
const VALID_JOB_STATUSES = ['running', 'succeeded', 'failed'];
const MAX_PROMPT_CHARS = 1200;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function checkDailyImageCap(env, runtimeConfig) {
  if (!env.CACHE) return true;
  const cap = Number(runtimeConfig.ai_studio_daily_image_cap || 50);
  if (!Number.isFinite(cap) || cap <= 0) return true;

  const today = new Date().toISOString().split('T')[0];
  const key = `ai_studio_image_daily:${today}`;
  const currentRaw = await env.CACHE.get(key);
  const current = currentRaw ? Number(currentRaw) : 0;
  if (current >= cap) return false;
  await env.CACHE.put(key, String(current + 1), { expirationTtl: 172800 });
  return true;
}

function sanitizeText(value, maxLen = 500) {
  return stripTags(value, maxLen).trim();
}

function parseLimit(raw, fallback = 20) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

async function ensureAiJobsTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
      payload_json TEXT,
      result_json TEXT,
      error_message TEXT,
      provider TEXT,
      model TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES operators(id)
    )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created_at ON ai_jobs(status, created_at)').run();
}

function parseVisualInput(body) {
  const kind = sanitizeText(body.kind, 80);
  const brief = sanitizeText(body.brief ?? body.prompt, MAX_PROMPT_CHARS);
  const overlayText = sanitizeText(body.overlay_text || '', 280);
  const overlaySubline = sanitizeText(body.overlay_subline || '', 280);

  if (!VALID_KINDS.includes(kind)) {
    throw httpError(400, 'Neplatný typ výstupu.');
  }
  if (!brief) {
    throw httpError(400, 'Chybí creative brief/prompt.');
  }
  return { kind, brief, overlayText, overlaySubline };
}

async function createRunningJob(env, operatorId, payload, retryCount = 0) {
  const jobId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO ai_jobs
      (id, job_type, status, payload_json, retry_count, created_by, started_at, created_at, updated_at)
     VALUES (?, 'visual_generation', 'running', ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`
  ).bind(jobId, JSON.stringify(payload), retryCount, operatorId).run();
  return jobId;
}

async function markJobSucceeded(env, jobId, result) {
  await env.DB.prepare(
    `UPDATE ai_jobs
     SET status = 'succeeded',
         result_json = ?,
         provider = ?,
         model = ?,
         finished_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    JSON.stringify({
      asset_id: result.id,
      image_url: result.image_url,
      overlay_svg_url: result.overlay_svg_url,
      kind: result.kind,
      width: result.width,
      height: result.height,
    }),
    result.provider,
    result.model,
    jobId
  ).run();
}

async function markJobFailed(env, jobId, errorMessage) {
  await env.DB.prepare(
    `UPDATE ai_jobs
     SET status = 'failed',
         error_message = ?,
         finished_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(errorMessage, jobId).run();
}

async function generateAndStoreAsset({ env, operator, visualInput, runtimeConfig }) {
  const buildVisualSkill = getSkill('visual-content');
  const visualPrompt = buildVisualSkill({
    kind: visualInput.kind,
    brief: visualInput.brief,
    overlayText: visualInput.overlayText,
    runtimeConfig,
  });

  const generated = await runImage({
    env,
    prompt: visualPrompt.prompt,
    negativePrompt: visualPrompt.negativePrompt,
    width: visualPrompt.width,
    height: visualPrompt.height,
  });

  const id = crypto.randomUUID();
  const year = new Date().getUTCFullYear();
  const ext = generated.mimeType?.includes('webp') ? 'webp' : 'png';
  const imageKey = `ai-studio/${year}/${id}.${ext}`;

  await env.MEDIA.put(imageKey, generated.bytes, {
    httpMetadata: { contentType: generated.mimeType || 'image/png' },
  });

  const imageUrl = `/api/media/${imageKey}`;
  let overlaySvgUrl = null;
  if (visualInput.overlayText || visualInput.overlaySubline) {
    const overlaySvg = buildOverlaySvg({
      baseImageUrl: imageUrl,
      width: visualPrompt.width,
      height: visualPrompt.height,
      headline: visualInput.overlayText,
      subline: visualInput.overlaySubline,
    });
    const overlayKey = `ai-studio/${year}/${id}-overlay.svg`;
    await env.MEDIA.put(overlayKey, overlaySvg, {
      httpMetadata: { contentType: 'image/svg+xml; charset=utf-8' },
    });
    overlaySvgUrl = `/api/media/${overlayKey}`;
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO media_assets
        (id, kind, status, prompt, negative_prompt, overlay_text, overlay_subline, provider, model, r2_key, image_url, overlay_svg_url, mime_type, width, height, created_by, created_at, updated_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      visualInput.kind,
      visualPrompt.prompt,
      visualPrompt.negativePrompt,
      visualInput.overlayText || null,
      visualInput.overlaySubline || null,
      generated.provider,
      generated.model,
      imageKey,
      imageUrl,
      overlaySvgUrl,
      generated.mimeType || 'image/png',
      visualPrompt.width,
      visualPrompt.height,
      operator.id
    ),
    auditStmt(env.DB, 'media_assets', id, 'create', operator, `AI visual generated (${visualInput.kind}, ${generated.provider}:${generated.model})`),
  ]);

  return {
    id,
    kind: visualInput.kind,
    status: 'draft',
    provider: generated.provider,
    model: generated.model,
    image_url: imageUrl,
    overlay_svg_url: overlaySvgUrl,
    width: visualPrompt.width,
    height: visualPrompt.height,
  };
}

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);
    const view = sanitizeText(url.searchParams.get('view') || '', 40);
    const status = url.searchParams.get('status');
    const kind = url.searchParams.get('kind');
    const limit = parseLimit(url.searchParams.get('limit'), 24);
    if (view === 'jobs') {
      await ensureAiJobsTable(env);
      const binds = [];
      let sql = `SELECT id, status, job_type, payload_json, result_json, error_message, provider, model, retry_count, started_at, finished_at, created_at, updated_at
                 FROM ai_jobs`;
      if (status && VALID_JOB_STATUSES.includes(status)) {
        sql += ' WHERE status = ?';
        binds.push(status);
      }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      binds.push(limit);
      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      return json({ ok: true, data: { jobs: results || [] } });
    }

    const where = [];
    const binds = [];
    if (status && VALID_STATUSES.includes(status)) {
      where.push('status = ?');
      binds.push(status);
    }
    if (kind && VALID_KINDS.includes(kind)) {
      where.push('kind = ?');
      binds.push(kind);
    }

    let sql = `SELECT id, kind, status, prompt, overlay_text, provider, model, image_url, overlay_svg_url, width, height, created_by, created_at, updated_at
               FROM media_assets`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ' ORDER BY created_at DESC LIMIT ?';
    binds.push(limit);

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, data: { assets: results || [] } });
  } catch (err) {
    console.error('[admin/imagine] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání AI assetů.' }, 500);
  }
}

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  if (!env.MEDIA) return json({ ok: false, error: 'Úložiště médií (R2) není dostupné.' }, 503);

  try {
    const body = await request.json();
    await ensureAiJobsTable(env);
    const action = sanitizeText(body.action || '', 40);
    let visualInput;
    let retryCount = 0;

    if (action === 'retry') {
      const retryJobId = sanitizeText(body.job_id || '', 80);
      if (!retryJobId) throw httpError(400, 'Chybí job_id pro retry.');
      const sourceJob = await env.DB.prepare('SELECT id, status, payload_json, retry_count FROM ai_jobs WHERE id = ?').bind(retryJobId).first();
      if (!sourceJob) throw httpError(404, 'Zdrojový job nebyl nalezen.');
      if (sourceJob.status === 'running') throw httpError(409, 'Job stále běží, retry nelze spustit.');
      let payload = {};
      try {
        payload = sourceJob.payload_json ? JSON.parse(sourceJob.payload_json) : {};
      } catch {
        throw httpError(500, 'Payload původního jobu je nečitelný.');
      }
      visualInput = parseVisualInput(payload);
      retryCount = Number(sourceJob.retry_count || 0) + 1;
    } else {
      visualInput = parseVisualInput(body);
    }

    const runtimeConfig = await loadAiRuntimeConfig(env);
    const allowedByCap = await checkDailyImageCap(env, runtimeConfig);
    if (!allowedByCap) {
      return json({ ok: false, error: 'Denní limit AI generování obrázků byl vyčerpán.' }, 429);
    }

    const jobPayload = {
      kind: visualInput.kind,
      brief: visualInput.brief,
      overlay_text: visualInput.overlayText,
      overlay_subline: visualInput.overlaySubline,
    };
    const jobId = await createRunningJob(env, data.operator.id, jobPayload, retryCount);
    let asset;
    try {
      asset = await generateAndStoreAsset({
        env,
        operator: data.operator,
        visualInput,
        runtimeConfig,
      });
      await markJobSucceeded(env, jobId, asset);
    } catch (generationErr) {
      const message = generationErr?.message || 'Generování vizuálu selhalo.';
      await markJobFailed(env, jobId, message);
      throw generationErr;
    }

    return json({
      ok: true,
      data: {
        ...asset,
        job_id: jobId,
      },
    }, 201);
  } catch (err) {
    console.error('[admin/imagine] POST error:', err);
    const status = Number(err?.status) || 500;
    const message = err?.message || 'Generování vizuálu selhalo.';
    return json({ ok: false, error: message }, status);
  }
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const id = sanitizeText(body.id || '', 80);
    if (!id) return json({ ok: false, error: 'Chybí ID assetu.' }, 400);

    const existing = await env.DB.prepare('SELECT id, status FROM media_assets WHERE id = ?').bind(id).first();
    if (!existing) return json({ ok: false, error: 'Asset nebyl nalezen.' }, 404);

    const status = sanitizeText(body.status || existing.status, 40);
    if (!VALID_STATUSES.includes(status)) {
      return json({ ok: false, error: 'Neplatný status assetu.' }, 400);
    }

    const overlayText = body.overlay_text != null ? sanitizeText(body.overlay_text, 280) : null;
    const overlaySubline = body.overlay_subline != null ? sanitizeText(body.overlay_subline, 280) : null;

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE media_assets
         SET status = ?, overlay_text = COALESCE(?, overlay_text), overlay_subline = COALESCE(?, overlay_subline), updated_at = datetime('now')
         WHERE id = ?`
      ).bind(status, overlayText, overlaySubline, id),
      auditStmt(env.DB, 'media_assets', id, 'update', data.operator, `AI visual updated (status: ${status})`),
    ]);

    return json({ ok: true, data: { id, status } });
  } catch (err) {
    console.error('[admin/imagine] PUT error:', err);
    return json({ ok: false, error: 'Aktualizace AI assetu selhala.' }, 500);
  }
}
