import { NextResponse } from "next/server";

export const runtime = "nodejs";

type StoreInput = {
  domain: string;
};

type PriceSearchRequest = {
  query: string;
  stores: StoreInput[];
};

type PriceSearchResult = {
  domain: string;
  storeLabel: string;
  logoUrl: string | null;
  offers: {
    priceCents: number;
    productUrl: string;
  }[];
  searchUrl: string;
};

function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function safeUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function getStorePattern(origin: string): { label: string; logoUrl: string | null; buildSearchUrl: (q: string) => string } {
  const host = (() => {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (host.includes("leroymerlin")) {
    return {
      label: "Leroy Merlin",
      logoUrl: "https://www.leroymerlin.com.br/favicon.ico",
      buildSearchUrl: (q) => safeUrl(origin, `/busca?q=${encodeURIComponent(q)}`),
    };
  }

  if (host.includes("telhanorte")) {
    return {
      label: "Telhanorte",
      logoUrl: "https://www.telhanorte.com.br/favicon.ico",
      buildSearchUrl: (q) => safeUrl(origin, `/busca?q=${encodeURIComponent(q)}`),
    };
  }

  if (host.includes("cassol")) {
    return {
      label: "Cassol",
      logoUrl: "https://www.cassol.com.br/favicon.ico",
      buildSearchUrl: (q) => safeUrl(origin, `/busca?query=${encodeURIComponent(q)}`),
    };
  }

  if (host.includes("mercadolivre") || host.includes("mercadolibre")) {
    return {
      label: "Mercado Livre",
      logoUrl: "https://www.mercadolivre.com/favicon.ico",
      buildSearchUrl: (q) => safeUrl(origin, `/ofertas?q=${encodeURIComponent(q)}`),
    };
  }

  if (host.includes("amazon")) {
    return {
      label: "Amazon",
      logoUrl: "https://www.amazon.com.br/favicon.ico",
      buildSearchUrl: (q) => safeUrl(origin, `/s?k=${encodeURIComponent(q)}`),
    };
  }

  return {
    label: host ? host.replace(/^www\./, "") : "Loja",
    logoUrl: null,
    buildSearchUrl: (q) => safeUrl(origin, `/busca?q=${encodeURIComponent(q)}`),
  };
}

function parseBrlToCents(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function extractTopPrices(html: string, limit: number): number[] {
  const matches = html.match(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi) ?? [];
  const seen = new Set<number>();
  const cents: number[] = [];

  for (const raw of matches) {
    const c = parseBrlToCents(raw);
    if (typeof c !== "number") continue;
    if (seen.has(c)) continue;
    seen.add(c);
    cents.push(c);
    if (cents.length >= 24) break;
  }

  cents.sort((a, b) => a - b);
  return cents.slice(0, Math.max(1, limit));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<PriceSearchRequest>;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const stores = Array.isArray(body.stores) ? body.stores : [];

    if (!query) {
      return NextResponse.json({ error: "Campo 'query' obrigatório." }, { status: 400 });
    }

    const results: PriceSearchResult[] = [];

    for (const store of stores) {
      const origin = normalizeDomain(typeof store?.domain === "string" ? store.domain : "");
      if (!origin) continue;

      const pattern = getStorePattern(origin);
      const searchUrl = pattern.buildSearchUrl(query);

      try {
        const res = await fetch(searchUrl, {
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; SistemaArquitetaBot/1.0)",
            accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });

        const contentType = res.headers.get("content-type") ?? "";
        const html = contentType.includes("text/html") ? await res.text() : "";

        const topPrices = html ? extractTopPrices(html, 3) : [];
        const offers = topPrices.map((priceCents) => ({
          priceCents,
          productUrl: searchUrl,
        }));

        results.push({
          domain: origin,
          storeLabel: pattern.label,
          logoUrl: pattern.logoUrl,
          offers,
          searchUrl,
        });
      } catch {
        results.push({
          domain: origin,
          storeLabel: pattern.label,
          logoUrl: pattern.logoUrl,
          offers: [],
          searchUrl,
        });
      }
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar preços." }, { status: 500 });
  }
}
