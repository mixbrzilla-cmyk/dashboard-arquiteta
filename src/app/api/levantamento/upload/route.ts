import { createJob, updateJob } from "../jobStore";
import { processLevantamentoJob } from "../processor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "Arquivo PDF não enviado (campo 'file')." }, { status: 400 });
    }

    if (typeof file === "string") {
      return Response.json(
        {
          error: "Campo 'file' inválido. Esperado arquivo, recebido texto.",
        },
        { status: 400 },
      );
    }

    if (!(file instanceof Blob)) {
      return Response.json(
        {
          error: "Campo 'file' inválido. Esperado arquivo (Blob/File).",
          receivedType: typeof file,
        },
        { status: 400 },
      );
    }

    const filename = (file as unknown as { name?: string }).name ?? "upload.pdf";
    const mime = file.type ?? "";

    if (mime !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Envie um arquivo PDF." }, { status: 400 });
    }

    const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now());
    createJob(id);
    updateJob(id, {
      stage: "queued",
      progress: 1,
      message: "Job criado. Iniciando processamento...",
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    setTimeout(() => {
      void processLevantamentoJob(id, buffer);
    }, 0);

    return Response.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return Response.json({ error: message }, { status: 500 });
  }
}
