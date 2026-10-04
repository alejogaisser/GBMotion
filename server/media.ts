import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError, json, parseRange } from './http.ts';
import { probe } from './ffmpeg.ts';

export const FPS = 30;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;
const UPLOAD_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv'];
const MEDIA_ID = /^[0-9a-f-]{36}\.(mp4|mov|m4v|webm|mkv)$/;
const MIME: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };
const UNREADABLE = 'No pude leer ese video. Probá con un MP4.';

export const isMediaId = (value: unknown): value is string => typeof value === 'string' && MEDIA_ID.test(value);
export const mediaPath = (mediaDir: string, mediaId: string) => join(mediaDir, mediaId);

const decodeName = (header: string | string[] | undefined) => {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
};

/** Guarda el cuerpo tal cual llega, sin pasarlo por memoria, y corta si pasa el tope. */
const storeUpload = async (req: IncomingMessage, target: string) => {
  let size = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) done(new HttpError(413, 'El video es demasiado grande (máximo 4 GB).'));
      else done(null, chunk);
    },
  });
  await pipeline(req, limit, createWriteStream(target));
};

const upload = async (req: IncomingMessage, res: ServerResponse, mediaDir: string) => {
  const name = decodeName(req.headers['x-file-name']);
  const extension = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();
  if (!UPLOAD_EXTENSIONS.includes(extension)) throw new HttpError(415, 'Ese formato no está soportado. Subí un MP4, MOV, M4V, WEBM o MKV.');
  mkdirSync(mediaDir, { recursive: true });
  const mediaId = `${randomUUID()}.${extension}`;
  const target = mediaPath(mediaDir, mediaId);
  try {
    await storeUpload(req, target);
  } catch (error) {
    await unlink(target).catch(() => undefined);
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Se cortó la subida del video.');
  }
  try {
    const info = await probe(target);
    json(res, 201, { mediaId, name, durationInFrames: Math.max(1, Math.round(info.durationSec * FPS)), width: info.width, height: info.height, hasAudio: info.hasAudio });
  } catch {
    await unlink(target).catch(() => undefined);
    throw new HttpError(422, UNREADABLE);
  }
};

const serve = (req: IncomingMessage, res: ServerResponse, mediaDir: string, mediaId: string) => {
  if (!isMediaId(mediaId)) return json(res, 400, { error: 'Id de video inválido.' });
  const file = mediaPath(mediaDir, mediaId);
  if (!existsSync(file)) return json(res, 404, { error: 'No encuentro ese video.' });
  const size = statSync(file).size;
  const extension = mediaId.slice(mediaId.lastIndexOf('.') + 1);
  res.setHeader('Content-Type', MIME[extension] ?? 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  const range = parseRange(req.headers.range, size);
  if (range === 'invalid') {
    res.statusCode = 416;
    res.setHeader('Content-Range', `bytes */${size}`);
    return res.end();
  }
  if (range) {
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Length', size);
  }
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file, range ? { start: range.start, end: range.end } : undefined);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
};

/** Devuelve true si la ruta era de media y ya se respondió. */
export const handleMedia = async (req: IncomingMessage, res: ServerResponse, path: string, mediaDir: string): Promise<boolean> => {
  if (req.method === 'POST' && path === '/api/media') {
    try { await upload(req, res, mediaDir); } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (!res.headersSent) json(res, status, { error: error instanceof Error ? error.message : UNREADABLE });
    }
    return true;
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && path.startsWith('/media/')) {
    serve(req, res, mediaDir, path.slice('/media/'.length));
    return true;
  }
  return false;
};
