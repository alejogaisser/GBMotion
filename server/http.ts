import type { IncomingMessage, ServerResponse } from 'node:http';

/** Error con código HTTP; el mensaje ya está en español y se puede mostrar tal cual. */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Junta el cuerpo como Buffers y decodifica una sola vez al final: decodificar
 * chunk por chunk rompe una ñ o una tilde que quede partida entre dos chunks.
 * Si pasa el límite corta la conexión en vez de seguir leyendo.
 */
export const readBody = (req: IncomingMessage, limitBytes: number): Promise<Buffer> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;
  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    reject(error);
  };
  req.on('data', (chunk: Buffer | string) => {
    if (settled) return;
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > limitBytes) {
      chunks.length = 0;
      fail(new HttpError(413, 'El pedido es demasiado grande.'));
      req.destroy();
      return;
    }
    chunks.push(buffer);
  });
  req.on('end', () => {
    if (settled) return;
    settled = true;
    resolve(Buffer.concat(chunks));
  });
  req.on('error', fail);
  req.on('close', () => fail(new HttpError(400, 'Se cortó la conexión.')));
});

export const readJson = async (req: IncomingMessage, limitBytes = 16 * 1024 * 1024): Promise<unknown> => {
  const buffer = await readBody(req, limitBytes);
  try { return JSON.parse(buffer.toString('utf8')); } catch { throw new HttpError(400, 'El pedido no es un JSON válido.'); }
};

export const json = (response: ServerResponse, status: number, payload: unknown) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

/** Sin Origin (curl, scripts locales) o desde esta misma app. Cualquier otra web queda afuera. */
export const isAllowedOrigin = (origin: string | undefined, port: number): boolean => {
  if (origin === undefined || origin === '') return true;
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
};

/**
 * `null`: no hay un rango usable, se manda el archivo entero.
 * `'invalid'`: el rango cae fuera del archivo (416).
 */
export const parseRange = (header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return 'invalid';
  if (size <= 0) return 'invalid';
  let start: number;
  let end: number;
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (suffix <= 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
};
