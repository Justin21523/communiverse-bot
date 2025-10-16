// /src/services/ai/dataset.js
// English-only code & comments.
//
// Dataset ingestion API for RAG. This module delegates to the AI sidecar,
// which performs GPU embeddings, chunking and upsert into the vector store.
// JS only passes parameters (chunk policy, embed model, metadata).
//
// All exported functions return Result<T>.

import { httpPostJson } from './_client.js';
import { CONFIG } from '../../config.js';

/**
 * @typedef {import('../types').AppError} AppError
 * @typedef {{ ok: true, data: any } | { ok: false, error: AppError }} Result
 */

/**
 * Upsert a remote file by URL.
 * Let the sidecar fetch, parse, chunk and embed.
 */
export async function upsertUrl(url, doc_id, metadata = {}) {
  const payload = {
    url, doc_id, metadata,
    chunk: { size: CONFIG.rag.chunkSize, overlap: CONFIG.rag.chunkOverlap },
    embed: { model: CONFIG.embeddings.model, dim: CONFIG.embeddings.dim, normalize: true },
    index: { name: CONFIG.rag.indexName, provider: CONFIG.rag.provider }, // atlas | faiss
  };

  try {
    const res = await httpPostJson('/dataset/upsert_url', payload, CONFIG.embeddings.timeoutMs);
    if (res.status >= 400 || !res.json?.ok) {
      return { ok: false, error: { code: 'DB_ERROR', message: 'Ingest failed', cause: res.json } };
    }
    return { ok: true, data: res.json };
  } catch (err) {
    return { ok: false, error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Sidecar unreachable for ingest', cause: err } };
  }
}

/**
 * Upsert raw text (already loaded in the bot).
 */
export async function upsertText(text, metadata = {}, doc_id = undefined) {
  const payload = {
    text, doc_id, metadata,
    chunk: { size: CONFIG.rag.chunkSize, overlap: CONFIG.rag.chunkOverlap },
    embed: { model: CONFIG.embeddings.model, dim: CONFIG.embeddings.dim, normalize: true },
    index: { name: CONFIG.rag.indexName, provider: CONFIG.rag.provider },
  };

  try {
    const res = await httpPostJson('/rag/upsert_text', payload, CONFIG.embeddings.timeoutMs);
    if (res.status >= 400 || !res.json?.ok) {
      return { ok: false, error: { code: 'DB_ERROR', message: 'RAG upsert failed', cause: res.json } };
    }
    return { ok: true, data: res.json };
  } catch (err) {
    return { ok: false, error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Sidecar unreachable for rag text', cause: err } };
  }
}
