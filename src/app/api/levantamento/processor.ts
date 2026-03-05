import type { LevantamentoItem, LevantamentoResult } from "./jobStore";
import { setJobDone, setJobError, updateJob } from "./jobStore";

import * as pdfParseModule from "pdf-parse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cleanText(input: string) {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildHeuristicItems(text: string): LevantamentoItem[] {
  const items: LevantamentoItem[] = [];
  const t = text;

  const legendRegex = /\b([A-Z]{0,2}\d{1,3})\s*(?:=|:)\s*([^\n]{3,120})/g;
  for (const match of t.matchAll(legendRegex)) {
    const sigla = match[1]?.trim();
    const desc = match[2]?.trim();
    if (!sigla || !desc) continue;
    if (desc.length < 4) continue;
    items.push({
      categoria: "Revestimento",
      item: `Legenda ${sigla}`,
      observacoes: desc,
      confidence: "medium",
    });
  }

  const areaRegex = /(\d{1,4}(?:[\.,]\d{1,2})?)\s*m\s*[²2]/gi;
  const areas = [...t.matchAll(areaRegex)].slice(0, 20);
  for (const a of areas) {
    const value = a[1]?.replace(/\./g, "").replace(",", ".");
    const area = value ? Number.parseFloat(value) : NaN;
    if (!Number.isFinite(area) || area <= 0) continue;
    items.push({
      categoria: "Revestimento",
      item: "Área identificada em planta/memorial",
      unidade: "m²",
      quantidade: area,
      confidence: "low",
    });
  }

  function countFromRegex(rx: RegExp) {
    const m = t.match(rx);
    if (!m) return null;
    const raw = m[1];
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const tomadas =
    countFromRegex(/\btomadas?\b[^\d]{0,20}(\d{1,4})/i) ??
    countFromRegex(/\bTUG\b[^\d]{0,20}(\d{1,4})/i);
  if (typeof tomadas === "number") {
    items.push({
      categoria: "Elétrica",
      item: "Tomadas (estimativa)",
      unidade: "un",
      quantidade: tomadas,
      confidence: "medium",
    });
  }

  const interruptores = countFromRegex(/\binterruptores?\b[^\d]{0,20}(\d{1,4})/i);
  if (typeof interruptores === "number") {
    items.push({
      categoria: "Elétrica",
      item: "Interruptores (estimativa)",
      unidade: "un",
      quantidade: interruptores,
      confidence: "medium",
    });
  }

  const pontosAgua =
    countFromRegex(/\b(pontos? de (?:\u00e1gua|agua))\b[^\d]{0,20}(\d{1,4})/i) ??
    countFromRegex(/\b(pontos? hidr[áa]ulic)\w*\b[^\d]{0,20}(\d{1,4})/i);
  if (typeof pontosAgua === "number") {
    items.push({
      categoria: "Hidráulica",
      item: "Pontos de água (estimativa)",
      unidade: "un",
      quantidade: pontosAgua,
      confidence: "medium",
    });
  }

  if (items.length === 0) {
    items.push({
      categoria: "Estrutural",
      item: "Nenhum quantitativo detectado automaticamente",
      observacoes: "Revise o texto extraído e ajuste manualmente.",
      confidence: "low",
    });
  }

  return items;
}

async function extractTextFromPdf(buffer: Buffer) {
  const pdfParse =
    (pdfParseModule as unknown as { default?: (b: Buffer) => Promise<{ text?: string; numpages?: number }> })
      .default ??
    (pdfParseModule as unknown as (b: Buffer) => Promise<{ text?: string; numpages?: number }>);

  const parsed = await pdfParse(buffer);
  const text = cleanText(parsed.text ?? "");
  return {
    text,
    numpages: parsed.numpages ?? 0,
  };
}

async function ocrPdfFirstPages(buffer: Buffer, pagesToOcr: number) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const pages = clamp(pagesToOcr, 1, Math.min(5, totalPages));

  const worker = await createWorker("por");
  try {
    let combined = "";

    for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");

      await (page as unknown as { render: (p: unknown) => { promise: Promise<unknown> } }).render({
        canvasContext: ctx as unknown as never,
        viewport,
        canvas: canvas as unknown as never,
      } as unknown as never).promise;

      const pngBuffer = canvas.toBuffer("image/png");
      const {
        data: { text },
      } = await worker.recognize(pngBuffer);

      combined += `\n\n--- PAGE ${pageNumber} ---\n`;
      combined += cleanText(text ?? "");
    }

    return cleanText(combined);
  } finally {
    await worker.terminate();
  }
}

export async function processLevantamentoJob(jobId: string, buffer: Buffer) {
  try {
    updateJob(jobId, {
      stage: "extracting_text",
      progress: 10,
      message: "Extraindo texto do PDF",
    });

    const { text, numpages } = await extractTextFromPdf(buffer);

    const hasEnoughText = text.replace(/\s/g, "").length >= 400;

    let finalText = text;
    if (!hasEnoughText) {
      updateJob(jobId, {
        stage: "ocr",
        progress: 35,
        message: "PDF parece ser imagem/scan. Rodando OCR",
      });
      const ocrText = await ocrPdfFirstPages(buffer, numpages > 0 ? Math.min(3, numpages) : 2);
      finalText = cleanText([text, ocrText].filter(Boolean).join("\n\n"));
    }

    updateJob(jobId, {
      stage: "structuring",
      progress: 75,
      message: "Estruturando levantamento (heurísticas)",
    });

    const items = buildHeuristicItems(finalText);

    const result: LevantamentoResult = {
      extractedTextSample: finalText.slice(0, 3500),
      items,
    };

    setJobDone(jobId, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    setJobError(jobId, message);
  }
}
