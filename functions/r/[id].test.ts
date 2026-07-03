import { describe, it, expect } from 'vitest';
import { onRequestGet, injectResultMeta, escapeHtml } from './[id]';
import { saveResult } from '../lib/results';
import type { ResultRecord } from '../lib/results';

function createFakeKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function createRecord(overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    scientificName: 'Volcanius ferox',
    commonName: 'Volcanrex',
    description: 'Un dinosaurio feroz que vive en volcanes. Escupe lava. Es enorme.',
    imageKey: 'a'.repeat(64),
    discovererName: 'Lucía',
    attrs: {
      size: 'Gigante',
      habitat: 'Volcán',
      diet: 'Carnívoro',
      feature: 'Cuernos',
      personality: 'Feroz',
    },
    createdAt: 1000,
    email: null,
    ...overrides,
  };
}

const SHELL_HTML = `<!doctype html>
<html lang="es">
  <head>
    <title>Dino Discovery Generator</title>
    <meta name="description" content="generic description" />
    <link rel="canonical" href="https://dino-discovery-generator.pages.dev/" />
    <meta property="og:title" content="Dino Discovery Generator" />
    <meta property="og:description" content="generic description" />
    <meta property="og:url" content="https://dino-discovery-generator.pages.dev/" />
    <meta property="og:image" content="https://dino-discovery-generator.pages.dev/landing-logo.webp" />
    <meta name="twitter:title" content="Dino Discovery Generator" />
    <meta name="twitter:description" content="generic description" />
    <meta name="twitter:image" content="https://dino-discovery-generator.pages.dev/landing-logo.webp" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<script>&"'</script>`)).toBe('&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;');
  });
});

describe('injectResultMeta', () => {
  it('replaces title/description/canonical/OG/Twitter tags with per-result values', () => {
    const record = createRecord();
    const html = injectResultMeta(SHELL_HTML, record, 'abc-123');

    expect(html).toContain('<title>Volcanrex (Volcanius ferox) — Dino Discovery</title>');
    expect(html).toContain(
      'https://dino-discovery-generator.pages.dev/r/abc-123'
    );
    expect(html).toContain(`https://dino-discovery-generator.pages.dev/images/${record.imageKey}.png`);
    expect(html).toContain('Un dinosaurio feroz que vive en volcanes');
    // Generic tags should be fully replaced, not left alongside the new ones.
    expect(html).not.toContain('Dino Discovery Generator</title>');
    expect(html).not.toContain('generic description');
  });

  it('HTML-escapes the description to prevent injection via AI-generated text', () => {
    const record = createRecord({ description: `A "wild" dino <script>alert(1)</script> & friends` });
    const html = injectResultMeta(SHELL_HTML, record, 'abc-123');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('truncates long descriptions with an ellipsis', () => {
    const longDescription = 'A'.repeat(300);
    const record = createRecord({ description: longDescription });
    const html = injectResultMeta(SHELL_HTML, record, 'abc-123');

    expect(html).toContain('…');
    expect(html).not.toContain('A'.repeat(250));
  });
});

describe('onRequestGet /r/:id', () => {
  it('falls through to ASSETS.fetch(request) when the result does not exist', async () => {
    const env = {
      RESULTS_KV: createFakeKV(),
      ASSETS: { fetch: async (req: Request) => new Response(`fallback:${req.url}`) },
    };
    const request = new Request('https://dino-discovery-generator.pages.dev/r/missing');

    const response = await onRequestGet({ request, params: { id: 'missing' }, env });

    expect(await response.text()).toBe(`fallback:${request.url}`);
  });

  it('returns the shell HTML with injected per-result meta tags when the result exists', async () => {
    const kv = createFakeKV();
    await saveResult(kv, 'abc-123', createRecord());
    let fetchedShellUrl: string | undefined;
    const env = {
      RESULTS_KV: kv,
      ASSETS: {
        fetch: async (req: Request) => {
          fetchedShellUrl = req.url;
          return new Response(SHELL_HTML);
        },
      },
    };
    const request = new Request('https://dino-discovery-generator.pages.dev/r/abc-123');

    const response = await onRequestGet({ request, params: { id: 'abc-123' }, env });
    const html = await response.text();

    expect(fetchedShellUrl).toBe('https://dino-discovery-generator.pages.dev/index.html');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(html).toContain('<title>Volcanrex (Volcanius ferox) — Dino Discovery</title>');
    expect(html).toContain('<div id="root"></div>');
  });
});
