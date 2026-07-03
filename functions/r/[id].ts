import type { KVLike } from '../lib/rateLimit';
import { getResult, type ResultRecord } from '../lib/results';

interface Env {
  RESULTS_KV: KVLike;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const SITE_URL = 'https://dino-discovery-generator.pages.dev';
// AI-generated, always 3 short sentences per the generation prompt (see
// functions/lib/anthropic.ts), but OG/Twitter descriptions are conventionally
// capped short — truncate defensively rather than trust that invariant here.
const MAX_OG_DESCRIPTION_LENGTH = 200;

// This whole file exists to fix NOTES.md's documented gap: the SPA's
// static index.html carries only generic OG/Twitter tags (see 2.4 in the
// audit doc), so pasting a /r/:id link into iMessage/WhatsApp/Twitter never
// showed the specific dino — the entire point of a shareable result link.
// Injecting per-result tags server-side, before the SPA shell is ever
// reached, is what makes link-unfurlers (which never execute JS) see the
// right title/image/description.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

// Pure string-templating, no DOM — testable without ever touching
// env.ASSETS. Replaces the *content* of each existing meta/title/link tag
// in the built index.html with per-result values, keeping every other tag
// (JSON-LD, fonts, viewport, etc.) untouched. Every dynamic value is
// HTML-escaped before insertion: unlike the rest of the app (React
// auto-escapes everywhere else), this is raw string concatenation into an
// HTML document, so an unescaped discoverer-influenced field here would be
// a real injection vector.
export function injectResultMeta(html: string, record: ResultRecord, resultId: string): string {
  const pageUrl = `${SITE_URL}/r/${resultId}`;
  const imageUrl = `${SITE_URL}/images/${record.imageKey}.png`;
  const title = escapeHtml(`${record.commonName} (${record.scientificName}) — Dino Discovery`);
  const description = escapeHtml(truncate(record.description, MAX_OG_DESCRIPTION_LENGTH));

  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${description}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${pageUrl}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${description}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${pageUrl}" />`
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${imageUrl}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:title" content="${title}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${description}" />`
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:image" content="${imageUrl}" />`
    );
}

export const onRequestGet = async (context: {
  request: Request;
  params: { id: string };
  env: Env;
}): Promise<Response> => {
  const record = await getResult(context.env.RESULTS_KV, context.params.id);

  // No matching result (bad id, or past the 90-day KV TTL) — fall through to
  // the normal SPA shell with its generic tags. The client-side app already
  // handles this case with its own "link expired" error screen (see
  // loadResultFromUrl in App.tsx); this route only adds metadata on top of
  // otherwise-normal SPA delivery, it never replaces the app's own handling.
  if (!record) {
    return context.env.ASSETS.fetch(context.request);
  }

  const shellResponse = await context.env.ASSETS.fetch(
    new Request(new URL('/index.html', context.request.url))
  );
  const shellHtml = await shellResponse.text();
  const html = injectResultMeta(shellHtml, record, context.params.id);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Per-result content changes if the record is ever regenerated at the
      // same id (it isn't, in practice — resultId is a fresh UUID per
      // discovery), but this is still dynamic per-URL content, not a static
      // asset — don't reuse the long-lived immutable caching public/_headers
      // sets for hashed/static assets.
      'cache-control': 'public, max-age=300',
    },
  });
};
