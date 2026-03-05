export type LevantamentoCategoria =
  | "Estrutural"
  | "Alvenaria"
  | "Revestimento"
  | "Elétrica"
  | "Hidráulica";

export type LevantamentoItem = {
  categoria: LevantamentoCategoria;
  item: string;
  unidade?: string;
  quantidade?: number;
  observacoes?: string;
  confidence?: "low" | "medium" | "high";
};

export type LevantamentoResult = {
  extractedTextSample: string;
  items: LevantamentoItem[];
};

export type JobStage =
  | "queued"
  | "extracting_text"
  | "ocr"
  | "structuring"
  | "done"
  | "error";

export type LevantamentoJob = {
  id: string;
  createdAt: number;
  stage: JobStage;
  progress: number; // 0..100
  message?: string;
  error?: string;
  result?: LevantamentoResult;
};

const jobs = new Map<string, LevantamentoJob>();

export function createJob(id: string): LevantamentoJob {
  const job: LevantamentoJob = {
    id,
    createdAt: Date.now(),
    stage: "queued",
    progress: 0,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string) {
  return jobs.get(id) ?? null;
}

export function updateJob(id: string, patch: Partial<LevantamentoJob>) {
  const current = jobs.get(id);
  if (!current) return null;
  const next: LevantamentoJob = { ...current, ...patch };
  jobs.set(id, next);
  return next;
}

export function setJobError(id: string, error: string) {
  return updateJob(id, {
    stage: "error",
    progress: 100,
    error,
    message: "Falha ao processar PDF",
  });
}

export function setJobDone(id: string, result: LevantamentoResult) {
  return updateJob(id, {
    stage: "done",
    progress: 100,
    result,
    message: "Levantamento concluído",
  });
}
