"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Download,
  MessageCircle,
  Phone,
  Sparkles,
  Trash2,
  TrendingUp,
  FileText,
} from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
};

type NewProjectFormState = {
  cliente: string;
  whatsappCliente: string;
  projeto: string;
  enderecoObra: string;
  uf: string;
  padraoCUB: string;
  areaM2: string;
  cubM2: string;
  valorPrevisto: string;
};

type RecentProject = {
  id: string;
  cliente: string;
  whatsappCliente?: string;
  projeto: string;
  enderecoObra?: string;
  uf?: string;
  padraoCUB?: string;
  areaM2?: number;
  cubM2Cents?: number;
  valorPrevistoCents: number;
};

type WorkTab =
  | "prioridades"
  | "diario"
  | "materiais"
  | "equipe"
  | "levantamento"
  | "video"
  | "fotos";

type LevantamentoCategoria = "Estrutural" | "Alvenaria" | "Revestimento" | "Elétrica" | "Hidráulica";

type LevantamentoItem = {
  categoria: LevantamentoCategoria;
  item: string;
  unidade?: string;
  quantidade?: number;
  observacoes?: string;
  confidence?: "low" | "medium" | "high";
};

type DiarioEntry = {
  id: string;
  createdAt: number;
  ocorrencias: string;
  mudancas: string;
};

type MaterialStatus = "cotado" | "comprado" | "entregue";

type MaterialItem = {
  id: string;
  item: string;
  fornecedor: string;
  valorCents: number;
  status: MaterialStatus;
  contato?: string;
};

type TeamMember = {
  id: string;
  nome: string;
  funcao: string;
  valorCents: number;
  contato?: string;
  faltouHoje?: boolean;
};

type AgendaEvent = {
  id: string;
  title: string;
  subtitle: string;
};

const STORAGE_KEY = "sistema-arquiteta:recent-projects";
const AGENDA_STORAGE_KEY = "sistema-arquiteta:agenda-events";

const SEED_PROJECTS: RecentProject[] = [];

const SEED_AGENDA_EVENTS: AgendaEvent[] = [];

function isAgendaEvent(value: unknown): value is AgendaEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.title === "string" && typeof v.subtitle === "string";
}

function coerceRecentProject(value: unknown): RecentProject | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return null;
  if (typeof v.cliente !== "string") return null;
  if (typeof v.projeto !== "string") return null;
  if (typeof v.valorPrevistoCents !== "number" || !Number.isFinite(v.valorPrevistoCents)) return null;

  const rawWhatsApp = v.whatsappCliente;
  const whatsappCliente =
    typeof rawWhatsApp === "string"
      ? rawWhatsApp
      : typeof rawWhatsApp === "number"
        ? String(rawWhatsApp)
        : undefined;

  const rawEndereco = v.enderecoObra;
  const enderecoObra = typeof rawEndereco === "string" ? rawEndereco : undefined;

  const uf = typeof v.uf === "string" ? v.uf : undefined;
  const padraoCUB = typeof v.padraoCUB === "string" ? v.padraoCUB : undefined;
  const areaM2 = typeof v.areaM2 === "number" && Number.isFinite(v.areaM2) ? v.areaM2 : undefined;
  const cubM2Cents =
    typeof v.cubM2Cents === "number" && Number.isFinite(v.cubM2Cents) ? v.cubM2Cents : undefined;

  return {
    id: v.id,
    cliente: v.cliente,
    projeto: v.projeto,
    valorPrevistoCents: v.valorPrevistoCents,
    whatsappCliente,
    enderecoObra,
    uf,
    padraoCUB,
    areaM2,
    cubM2Cents,
  };
}

function normalizeWhatsAppNumber(input: string) {
  return input.replace(/\D/g, "");
}

function parseAreaM2(input: string) {
  const normalized = input.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatCentsToBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function parseBRLToCents(input: string) {
  const digitsOnly = input.replace(/\D/g, "");
  if (digitsOnly.length === 0) return 0;
  return Number.parseInt(digitsOnly, 10);
}

function formatBRLInput(raw: string) {
  const cents = parseBRLToCents(raw);
  return {
    cents,
    text: cents === 0 ? "" : formatCentsToBRL(cents),
  };
}

function toJitsiRoomName(projectName: string) {
  const raw = projectName.trim().length === 0 ? "Obra" : projectName.trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
  return `Obra-${normalized.length === 0 ? "Projeto" : normalized}`;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px circle at 20% 0%, rgba(212, 175, 55, 0.16), transparent 45%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-600">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
          <p className="text-xs font-medium text-zinc-500">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function HighlightItem({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">{subtitle}</p>
        </div>
        <div className="mt-0.5 h-2 w-2 flex-none rounded-full bg-[#D4AF37]" aria-hidden="true" />
      </div>
    </div>
  );
}

function HighlightActionItem({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">{subtitle}</p>
        </div>
        <div className="mt-0.5 h-2 w-2 flex-none rounded-full bg-[#D4AF37]" aria-hidden="true" />
      </div>
    </button>
  );
}

function AgendaButton({
  title,
  subtitle,
  onClick,
  onDelete,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
      >
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-xs text-zinc-600">{subtitle}</p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
        aria-label="Apagar evento"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<NewProjectFormState>({
    cliente: "",
    whatsappCliente: "",
    projeto: "",
    enderecoObra: "",
    uf: "SP",
    padraoCUB: "R8-N",
    areaM2: "",
    cubM2: "",
    valorPrevisto: "",
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkTab>("diario");

  const [diarioByProject, setDiarioByProject] = useState<Record<string, DiarioEntry[]>>({});
  const [diarioForm, setDiarioForm] = useState({ ocorrencias: "", mudancas: "" });

  const [materialsByProject, setMaterialsByProject] = useState<Record<string, MaterialItem[]>>({});
  const [materialForm, setMaterialForm] = useState({
    item: "",
    fornecedor: "",
    valor: "",
    status: "cotado" as MaterialStatus,
    contato: "",
  });

  const [teamByProject, setTeamByProject] = useState<Record<string, TeamMember[]>>({});
  const [teamForm, setTeamForm] = useState({
    nome: "",
    funcao: "",
    valor: "",
    contato: "",
  });

  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [hasLoadedAgendaFromStorage, setHasLoadedAgendaFromStorage] = useState(false);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(SEED_PROJECTS);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>(SEED_AGENDA_EVENTS);
  const [agendaForm, setAgendaForm] = useState({ title: "", subtitle: "" });

  const [hasStartedVipMeeting, setHasStartedVipMeeting] = useState(false);

  const [levantamentoJobId, setLevantamentoJobId] = useState<string | null>(null);
  const [levantamentoStage, setLevantamentoStage] = useState<string | null>(null);
  const [levantamentoProgress, setLevantamentoProgress] = useState<number>(0);
  const [levantamentoMessage, setLevantamentoMessage] = useState<string | null>(null);
  const [levantamentoError, setLevantamentoError] = useState<string | null>(null);
  const [levantamentoTextSample, setLevantamentoTextSample] = useState<string>("");
  const [levantamentoItems, setLevantamentoItems] = useState<LevantamentoItem[]>([]);

  const modalTitleId = useId();
  const inputClienteId = useId();
  const inputWhatsAppClienteId = useId();
  const inputProjetoId = useId();
  const inputEnderecoId = useId();
  const inputUfId = useId();
  const inputPadraoId = useId();
  const inputAreaId = useId();
  const inputCubId = useId();
  const inputValorId = useId();

  const canSave = useMemo(() => {
    const whatsappDigits = normalizeWhatsAppNumber(form.whatsappCliente);
    const areaM2 = parseAreaM2(form.areaM2);
    const cubM2Cents = parseBRLToCents(form.cubM2);
    const valorCents = parseBRLToCents(form.valorPrevisto);
    const cubEstimateCents = areaM2 > 0 && cubM2Cents > 0 ? Math.round(areaM2 * cubM2Cents) : 0;
    return (
      form.cliente.trim().length > 0 &&
      form.projeto.trim().length > 0 &&
      form.enderecoObra.trim().length > 0 &&
      form.uf.trim().length > 0 &&
      form.padraoCUB.trim().length > 0 &&
      areaM2 > 0 &&
      cubM2Cents > 0 &&
      (valorCents > 0 || cubEstimateCents > 0) &&
      whatsappDigits.length >= 10
    );
  }, [
    form.cliente,
    form.projeto,
    form.enderecoObra,
    form.uf,
    form.padraoCUB,
    form.areaM2,
    form.cubM2,
    form.valorPrevisto,
    form.whatsappCliente,
  ]);

  const totalProfitCents = useMemo(() => {
    return recentProjects.reduce((acc, p) => acc + p.valorPrevistoCents, 0);
  }, [recentProjects]);

  const globalMaterialsToApproveCount = useMemo(() => {
    return Object.values(materialsByProject)
      .flat()
      .filter((m) => m.status === "cotado").length;
  }, [materialsByProject]);

  const globalMaterialsToFollowUpCount = useMemo(() => {
    return Object.values(materialsByProject)
      .flat()
      .filter((m) => m.status === "comprado").length;
  }, [materialsByProject]);

  const latestPlanChange = useMemo(() => {
    const entries = Object.values(diarioByProject).flat();
    const onlyChanges = entries.filter((e) => e.mudancas.trim().length > 0);
    if (onlyChanges.length === 0) return null;
    return onlyChanges.reduce((latest, current) =>
      current.createdAt > latest.createdAt ? current : latest
    );
  }, [diarioByProject]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return recentProjects.find((p) => p.id === selectedProjectId) ?? null;
  }, [recentProjects, selectedProjectId]);

  const selectedProjectWhatsAppLink = useMemo(() => {
    if (!selectedProject?.whatsappCliente) return null;
    const digits = normalizeWhatsAppNumber(selectedProject.whatsappCliente);
    if (digits.length < 10) return null;
    return `https://wa.me/${digits}`;
  }, [selectedProject?.whatsappCliente]);

  const selectedProjectVipMeetingLink = useMemo(() => {
    if (!selectedProject) return null;
    return `https://meet.jit.si/${toJitsiRoomName(selectedProject.projeto)}`;
  }, [selectedProject]);

  const currentMaterials = useMemo(() => {
    if (!selectedProjectId) return [];
    return materialsByProject[selectedProjectId] ?? [];
  }, [materialsByProject, selectedProjectId]);

  const currentTeam = useMemo(() => {
    if (!selectedProjectId) return [];
    return teamByProject[selectedProjectId] ?? [];
  }, [teamByProject, selectedProjectId]);

  const materialsSpentCents = useMemo(() => {
    return currentMaterials.reduce((acc, m) => acc + m.valorCents, 0);
  }, [currentMaterials]);

  const teamSpentCents = useMemo(() => {
    return currentTeam.reduce((acc, t) => acc + t.valorCents, 0);
  }, [currentTeam]);

  const currentSpentCents = useMemo(() => {
    return materialsSpentCents + teamSpentCents;
  }, [materialsSpentCents, teamSpentCents]);

  const materialsToApprove = useMemo(() => {
    return currentMaterials.filter((m) => m.status === "cotado");
  }, [currentMaterials]);

  const materialsToFollowUp = useMemo(() => {
    return currentMaterials.filter((m) => m.status === "comprado");
  }, [currentMaterials]);

  const suppliersToFollowUpCount = useMemo(() => {
    const suppliers = new Set(
      materialsToFollowUp
        .map((m) => m.fornecedor.trim())
        .filter((s) => s.length > 0)
        .map((s) => s.toLowerCase())
    );
    return suppliers.size;
  }, [materialsToFollowUp]);

  const criticalPlanChanges = useMemo(() => {
    if (!selectedProjectId) return [] as DiarioEntry[];
    const entries = diarioByProject[selectedProjectId] ?? [];
    return entries.filter((e) => e.mudancas.trim().length > 0).slice(0, 3);
  }, [diarioByProject, selectedProjectId]);

  const absentTeamToday = useMemo(() => {
    return currentTeam.filter((t) => Boolean(t.faltouHoje));
  }, [currentTeam]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    }

    if (!isModalOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setHasLoadedFromStorage(true);
        return;
      }
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setHasLoadedFromStorage(true);
        return;
      }
      const cleaned = parsed
        .map((item) => coerceRecentProject(item))
        .filter((item): item is RecentProject => Boolean(item));
      if (cleaned.length > 0) {
        setRecentProjects(cleaned);
      }
    } catch {
    } finally {
      setHasLoadedFromStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recentProjects));
    } catch {
    }
  }, [recentProjects, hasLoadedFromStorage]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AGENDA_STORAGE_KEY);
      if (!stored) {
        setHasLoadedAgendaFromStorage(true);
        return;
      }
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setHasLoadedAgendaFromStorage(true);
        return;
      }
      const cleaned = parsed.filter(isAgendaEvent);
      if (cleaned.length > 0) {
        setAgendaEvents(cleaned);
      }
    } catch {
    } finally {
      setHasLoadedAgendaFromStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedAgendaFromStorage) return;
    try {
      window.localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(agendaEvents));
    } catch {
    }
  }, [agendaEvents, hasLoadedAgendaFromStorage]);

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function onSave() {
    const whatsappDigits = normalizeWhatsAppNumber(form.whatsappCliente);
    const areaM2 = parseAreaM2(form.areaM2);
    const cubM2Cents = parseBRLToCents(form.cubM2);
    const valorPrevistoManualCents = parseBRLToCents(form.valorPrevisto);
    const valorPrevistoCents =
      valorPrevistoManualCents > 0 && Number.isFinite(valorPrevistoManualCents)
        ? valorPrevistoManualCents
        : Math.round(areaM2 * cubM2Cents);
    const newProject: RecentProject = {
      id: String(Date.now()),
      cliente: form.cliente.trim(),
      whatsappCliente: whatsappDigits,
      projeto: form.projeto.trim(),
      enderecoObra: form.enderecoObra.trim(),
      uf: form.uf.trim(),
      padraoCUB: form.padraoCUB.trim(),
      areaM2,
      cubM2Cents,
      valorPrevistoCents,
    };

    setRecentProjects((prev) => [newProject, ...prev]);
    closeModal();
    setForm({
      cliente: "",
      whatsappCliente: "",
      projeto: "",
      enderecoObra: "",
      uf: "SP",
      padraoCUB: "R8-N",
      areaM2: "",
      cubM2: "",
      valorPrevisto: "",
    });
    alert("Projeto cadastrado com sucesso!");
  }

  function onDeleteProject(id: string) {
    setRecentProjects((prev) => prev.filter((p) => p.id !== id));
    setDiarioByProject((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMaterialsByProject((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTeamByProject((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      setActiveTab("diario");
    }
  }

  function onClearAll() {
    setRecentProjects([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }

  function addAgendaEvent() {
    if (agendaForm.title.trim().length === 0 || agendaForm.subtitle.trim().length === 0) return;
    const event: AgendaEvent = {
      id: String(Date.now()),
      title: agendaForm.title.trim(),
      subtitle: agendaForm.subtitle.trim(),
    };
    setAgendaEvents((prev) => [event, ...prev]);
    setAgendaForm({ title: "", subtitle: "" });
  }

  function deleteAgendaEvent(id: string) {
    setAgendaEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function openProjectDetails(id: string) {
    setSelectedProjectId(id);
    setActiveTab("diario");
    setIsModalOpen(false);
    setHasStartedVipMeeting(false);
    setLevantamentoJobId(null);
    setLevantamentoStage(null);
    setLevantamentoProgress(0);
    setLevantamentoMessage(null);
    setLevantamentoError(null);
    setLevantamentoTextSample("");
    setLevantamentoItems([]);
  }

  function goToFirstPendingApprovals() {
    const first = recentProjects.find((p) => {
      const materials = materialsByProject[p.id] ?? [];
      return materials.some((m) => m.status === "cotado" || m.status === "comprado");
    });
    if (!first) return;
    setSelectedProjectId(first.id);
    setActiveTab("prioridades");
  }

  function backToDashboard() {
    setSelectedProjectId(null);
    setActiveTab("diario");
    setHasStartedVipMeeting(false);
    setLevantamentoJobId(null);
    setLevantamentoStage(null);
    setLevantamentoProgress(0);
    setLevantamentoMessage(null);
    setLevantamentoError(null);
    setLevantamentoTextSample("");
    setLevantamentoItems([]);
  }

  async function uploadLevantamentoPdf(file: File) {
    setLevantamentoError(null);
    setLevantamentoMessage("Enviando PDF...");
    setLevantamentoStage("upload");
    setLevantamentoProgress(1);
    setLevantamentoItems([]);
    setLevantamentoTextSample("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/levantamento/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data: unknown = await res.json().catch(() => null);
      const msg = (data as { error?: string } | null)?.error ?? "Falha no upload";
      throw new Error(msg);
    }

    const data = (await res.json()) as { id: string };
    setLevantamentoJobId(data.id);
    setLevantamentoStage("queued");
    setLevantamentoProgress(5);
    setLevantamentoMessage("Processando... (OCR pode levar alguns minutos)");
  }

  useEffect(() => {
    if (!levantamentoJobId) return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/levantamento/status?id=${encodeURIComponent(levantamentoJobId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          stage: string;
          progress: number;
          message?: string;
          error?: string;
          result?: { extractedTextSample?: string; items?: LevantamentoItem[] };
        };

        if (cancelled) return;

        setLevantamentoStage(data.stage);
        setLevantamentoProgress(typeof data.progress === "number" ? data.progress : 0);
        setLevantamentoMessage(data.message ?? null);
        setLevantamentoError(data.error ?? null);

        if (data.stage === "done") {
          setLevantamentoTextSample(data.result?.extractedTextSample ?? "");
          setLevantamentoItems(Array.isArray(data.result?.items) ? data.result?.items ?? [] : []);
          window.clearInterval(intervalId);
        }
        if (data.stage === "error") {
          window.clearInterval(intervalId);
        }
      } catch {
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [levantamentoJobId]);

  function updateLevantamentoItem(index: number, patch: Partial<LevantamentoItem>) {
    setLevantamentoItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addLevantamentoToMaterials() {
    if (!selectedProjectId) return;
    if (levantamentoItems.length === 0) return;

    const newMaterials: MaterialItem[] = levantamentoItems
      .filter((it) => it.item.trim().length > 0)
      .map((it) => {
        const qty = typeof it.quantidade === "number" && Number.isFinite(it.quantidade) ? it.quantidade : null;
        const unit = it.unidade?.trim() ? it.unidade.trim() : null;
        const suffix = qty !== null ? ` (${qty}${unit ? ` ${unit}` : ""})` : "";
        return {
          id: String(Date.now()) + "-" + Math.random().toString(16).slice(2),
          item: `${it.categoria}: ${it.item}${suffix}`,
          fornecedor: "Levantamento PDF",
          valorCents: 0,
          status: "cotado",
          contato: undefined,
        };
      });

    setMaterialsByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return { ...prev, [selectedProjectId]: [...newMaterials, ...current] };
    });

    setActiveTab("materiais");
  }

  function generateProjectDossier() {
    if (!selectedProjectId) return;
    const project = recentProjects.find((p) => p.id === selectedProjectId);
    if (!project) return;
    const diario = diarioByProject[selectedProjectId] ?? [];
    const materiais = materialsByProject[selectedProjectId] ?? [];
    const equipe = teamByProject[selectedProjectId] ?? [];

    const previsto = project.valorPrevistoCents;
    const gastoMateriais = materiais.reduce((acc, m) => acc + m.valorCents, 0);
    const gastoEquipe = equipe.reduce((acc, t) => acc + t.valorCents, 0);
    const gastoAtual = gastoMateriais + gastoEquipe;
    const saldo = previsto - gastoAtual;

    const cubEstimateCents =
      typeof project.areaM2 === "number" &&
      typeof project.cubM2Cents === "number" &&
      Number.isFinite(project.areaM2) &&
      Number.isFinite(project.cubM2Cents)
        ? Math.round(project.areaM2 * project.cubM2Cents)
        : null;

    const lines: string[] = [];
    lines.push("DOSSIÊ DA OBRA");
    lines.push("================");
    lines.push("");
    lines.push(`Cliente: ${project.cliente}`);
    lines.push(`Projeto: ${project.projeto}`);
    lines.push(`Endereço da Obra: ${project.enderecoObra ?? ""}`);
    lines.push(`WhatsApp do Cliente: ${project.whatsappCliente ?? ""}`);
    lines.push(`UF: ${project.uf ?? ""}`);
    lines.push(`Padrão (CUB/NBR 12721): ${project.padraoCUB ?? ""}`);
    lines.push(`Área (m²): ${typeof project.areaM2 === "number" ? project.areaM2.toLocaleString("pt-BR") : ""}`);
    lines.push(`CUB/m² (mês): ${typeof project.cubM2Cents === "number" ? formatCentsToBRL(project.cubM2Cents) : ""}`);
    lines.push(`Estimativa (CUB × m²): ${typeof cubEstimateCents === "number" ? formatCentsToBRL(cubEstimateCents) : ""}`);
    lines.push("");
    lines.push("RESUMO FINANCEIRO");
    lines.push("-----------------");
    lines.push(`Previsto: ${formatCentsToBRL(previsto)}`);
    lines.push(`Gasto Atual: ${formatCentsToBRL(gastoAtual)}`);
    lines.push(`Saldo: ${formatCentsToBRL(saldo)}`);
    lines.push("");
    lines.push("DIÁRIO DE OBRA (COMPLETO)");
    lines.push("------------------------");
    if (diario.length === 0) {
      lines.push("(Sem registros)");
    } else {
      diario
        .slice()
        .reverse()
        .forEach((e) => {
          lines.push(`- ${new Date(e.createdAt).toLocaleString("pt-BR")}`);
          if (e.ocorrencias.trim().length > 0) lines.push(`  Ocorrências: ${e.ocorrencias}`);
          if (e.mudancas.trim().length > 0) lines.push(`  Mudanças de Planos: ${e.mudancas}`);
        });
    }
    lines.push("");
    lines.push("MATERIAIS");
    lines.push("---------");
    if (materiais.length === 0) {
      lines.push("(Sem materiais cadastrados)");
    } else {
      materiais.forEach((m) => {
        lines.push(`- ${m.item} | Fornecedor: ${m.fornecedor} | Valor: ${formatCentsToBRL(m.valorCents)} | Status: ${m.status}`);
      });
    }
    lines.push("");
    lines.push("EQUIPE");
    lines.push("-----");
    if (equipe.length === 0) {
      lines.push("(Sem equipe cadastrada)");
    } else {
      equipe.forEach((t) => {
        lines.push(`- ${t.nome} | Função: ${t.funcao}`);
      });
    }

    const filename = `dossie-${toJitsiRoomName(project.projeto)}.txt`;
    downloadTextFile(filename, lines.join("\n"));
  }

  function startVipMeeting() {
    setHasStartedVipMeeting(true);

    if (!selectedProject || !selectedProjectVipMeetingLink) return;
    const digits = selectedProject.whatsappCliente
      ? normalizeWhatsAppNumber(selectedProject.whatsappCliente)
      : "";
    if (digits.length < 10) return;

    const message = `Olá, ${selectedProject.cliente}! Vamos iniciar nossa Reunião VIP da obra "${selectedProject.projeto}". Link: ${selectedProjectVipMeetingLink}`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function saveMaterial() {
    if (!selectedProjectId) return;
    const valorCents = parseBRLToCents(materialForm.valor);
    if (
      materialForm.item.trim().length === 0 ||
      materialForm.fornecedor.trim().length === 0 ||
      valorCents <= 0
    ) {
      return;
    }

    const material: MaterialItem = {
      id: String(Date.now()),
      item: materialForm.item.trim(),
      fornecedor: materialForm.fornecedor.trim(),
      valorCents,
      status: materialForm.status,
      contato: materialForm.contato.trim() || undefined,
    };

    setMaterialsByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return { ...prev, [selectedProjectId]: [material, ...current] };
    });
    setMaterialForm({ item: "", fornecedor: "", valor: "", status: "cotado", contato: "" });
  }

  function deleteMaterial(id: string) {
    if (!selectedProjectId) return;
    setMaterialsByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return { ...prev, [selectedProjectId]: current.filter((m) => m.id !== id) };
    });
  }

  function saveTeamMember() {
    if (!selectedProjectId) return;
    const valorCents = parseBRLToCents(teamForm.valor);
    if (teamForm.nome.trim().length === 0 || teamForm.funcao.trim().length === 0 || valorCents <= 0) {
      return;
    }

    const member: TeamMember = {
      id: String(Date.now()),
      nome: teamForm.nome.trim(),
      funcao: teamForm.funcao.trim(),
      valorCents,
      contato: teamForm.contato.trim() || undefined,
      faltouHoje: false,
    };

    setTeamByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return { ...prev, [selectedProjectId]: [member, ...current] };
    });
    setTeamForm({ nome: "", funcao: "", valor: "", contato: "" });
  }

  function deleteTeamMember(id: string) {
    if (!selectedProjectId) return;
    setTeamByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return { ...prev, [selectedProjectId]: current.filter((t) => t.id !== id) };
    });
  }

  function toggleTeamAbsentToday(id: string) {
    if (!selectedProjectId) return;
    setTeamByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return {
        ...prev,
        [selectedProjectId]: current.map((t) =>
          t.id === id ? { ...t, faltouHoje: !t.faltouHoje } : t
        ),
      };
    });
  }

  function saveDiarioEntry() {
    if (!selectedProjectId) return;
    if (diarioForm.ocorrencias.trim().length === 0 && diarioForm.mudancas.trim().length === 0) {
      return;
    }

    const entry: DiarioEntry = {
      id: String(Date.now()),
      createdAt: Date.now(),
      ocorrencias: diarioForm.ocorrencias.trim(),
      mudancas: diarioForm.mudancas.trim(),
    };

    setDiarioByProject((prev) => {
      const current = prev[selectedProjectId] ?? [];
      return { ...prev, [selectedProjectId]: [entry, ...current] };
    });
    setDiarioForm({ ocorrencias: "", mudancas: "" });
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        {selectedProject && selectedProjectId ? (
          <div className="flex flex-col gap-6">
            <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={backToDashboard}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                  >
                    Voltar
                  </button>
                  <p className="mt-5 text-sm font-medium tracking-wide text-zinc-500">Obra</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{selectedProject.projeto}</h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">{selectedProject.cliente}</p>
                  {selectedProject.enderecoObra ? (
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">{selectedProject.enderecoObra}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600">
                    {selectedProject.uf ? (
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">UF: {selectedProject.uf}</span>
                    ) : null}
                    {selectedProject.padraoCUB ? (
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">Padrão: {selectedProject.padraoCUB}</span>
                    ) : null}
                    {typeof selectedProject.areaM2 === "number" ? (
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                        Área: {selectedProject.areaM2.toLocaleString("pt-BR")} m²
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={generateProjectDossier}
                    className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Gerar Dossiê da Obra
                  </button>

                  <a
                    href={selectedProjectWhatsAppLink ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      selectedProjectWhatsAppLink
                        ? "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                        : "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-300"
                    }
                    onClick={(e) => {
                      if (!selectedProjectWhatsAppLink) e.preventDefault();
                    }}
                    aria-label="Abrir WhatsApp do cliente"
                  >
                    <MessageCircle className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                    WhatsApp do Cliente
                  </a>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-zinc-600">Valor previsto</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900">{formatCentsToBRL(selectedProject.valorPrevistoCents)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-zinc-600">Estimativa (CUB)</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900">
                    {typeof selectedProject.areaM2 === "number" && typeof selectedProject.cubM2Cents === "number"
                      ? formatCentsToBRL(Math.round(selectedProject.areaM2 * selectedProject.cubM2Cents))
                      : "-"}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {typeof selectedProject.cubM2Cents === "number"
                      ? `CUB/m²: ${formatCentsToBRL(selectedProject.cubM2Cents)}`
                      : "CUB/m²: -"}
                    {typeof selectedProject.areaM2 === "number"
                      ? ` · Área: ${selectedProject.areaM2.toLocaleString("pt-BR")} m²`
                      : ""}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-zinc-600">Gastos Atuais</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900">{formatCentsToBRL(currentSpentCents)}</div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Materiais: {formatCentsToBRL(materialsSpentCents)} · Equipe: {formatCentsToBRL(teamSpentCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-zinc-600">Medição</div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#D4AF37]" aria-hidden="true" />
                      <span className="text-xs font-medium text-zinc-600">Em acompanhamento</span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-[#D4AF37]"
                      style={{
                        width: `${
                          selectedProject.valorPrevistoCents <= 0
                            ? 0
                            : Math.min(100, Math.round((currentSpentCents / selectedProject.valorPrevistoCents) * 100))
                        }%`,
                      }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-2 text-xs font-medium text-zinc-600">
                    {formatCentsToBRL(currentSpentCents)} de {formatCentsToBRL(selectedProject.valorPrevistoCents)}
                  </div>
                </div>
              </div>

              <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />

              <nav className="mt-6 flex flex-wrap gap-2">
                <TabButton label="Prioridades para Hoje" isActive={activeTab === "prioridades"} onClick={() => setActiveTab("prioridades")} />
                <TabButton label="Diário de Obra" isActive={activeTab === "diario"} onClick={() => setActiveTab("diario")} />
                <TabButton label="Materiais" isActive={activeTab === "materiais"} onClick={() => setActiveTab("materiais")} />
                <TabButton label="Equipe" isActive={activeTab === "equipe"} onClick={() => setActiveTab("equipe")} />
                <TabButton label="Levantamento" isActive={activeTab === "levantamento"} onClick={() => setActiveTab("levantamento")} />
                <TabButton label="Vídeo" isActive={activeTab === "video"} onClick={() => setActiveTab("video")} />
                <TabButton label="Fotos" isActive={activeTab === "fotos"} onClick={() => setActiveTab("fotos")} />
              </nav>
            </header>

            <main>
              {activeTab === "prioridades" ? (
                <div className="flex flex-col gap-6">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Prioridades para Hoje</h2>
                        <p className="text-sm text-zinc-600">Centro de inteligência: aprovações, follow-ups e alertas de campo.</p>
                      </div>
                      <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 sm:flex">
                        <AlertTriangle className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                        Modo ação
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="text-sm font-medium text-zinc-600">
                          Existem <span className="font-semibold text-zinc-900">{materialsToApprove.length}</span> materiais aguardando aprovação
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">Status: Cotado (para aprovar).</div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="text-sm font-medium text-zinc-600">
                          <span className="font-semibold text-zinc-900">{suppliersToFollowUpCount}</span> fornecedores para cobrar hoje
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">Status: Comprado (pendente de entrega/follow-up).</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
                            <h3 className="text-sm font-semibold tracking-tight text-zinc-900">Materiais para Aprovar</h3>
                          </div>
                          <div className="text-xs font-medium text-zinc-600">{materialsToApprove.length} itens</div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3">
                          {materialsToApprove.map((m) => (
                            <div key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-900">{m.item}</div>
                                  <div className="mt-1 text-xs text-zinc-600">Fornecedor: {m.fornecedor} · {formatCentsToBRL(m.valorCents)}</div>
                                </div>
                                <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-semibold text-zinc-900">Cotado</span>
                              </div>
                            </div>
                          ))}
                          {materialsToApprove.length === 0 ? (
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Nenhum material aguardando aprovação.</div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
                            <h3 className="text-sm font-semibold tracking-tight text-zinc-900">Follow-up de Entregas</h3>
                          </div>
                          <div className="text-xs font-medium text-zinc-600">{materialsToFollowUp.length} itens</div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3">
                          {materialsToFollowUp.map((m) => (
                            <div key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                              <div className="text-sm font-semibold text-zinc-900">{m.item}</div>
                              <div className="mt-1 text-xs text-zinc-600">{m.fornecedor} · {formatCentsToBRL(m.valorCents)}</div>
                              <div className="mt-3 flex items-center gap-2">
                                <a
                                  href={m.contato ? `tel:${m.contato}` : undefined}
                                  className={
                                    m.contato
                                      ? "inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533]"
                                      : "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-300"
                                  }
                                  aria-label="Ligar"
                                  onClick={(e) => {
                                    if (!m.contato) e.preventDefault();
                                  }}
                                >
                                  <Phone className="h-4 w-4" aria-hidden="true" />
                                  Ligar
                                </a>
                                <a
                                  href={m.contato ? `https://wa.me/${normalizeWhatsAppNumber(m.contato)}` : undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={
                                    m.contato
                                      ? "inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533]"
                                      : "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-300"
                                  }
                                  aria-label="WhatsApp"
                                  onClick={(e) => {
                                    if (!m.contato) e.preventDefault();
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                  WhatsApp
                                </a>
                              </div>
                            </div>
                          ))}
                          {materialsToFollowUp.length === 0 ? (
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Nenhum material comprado pendente.</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
                          <h3 className="text-sm font-semibold tracking-tight text-zinc-900">Mudanças de Planos (Crítico)</h3>
                        </div>
                        <div className="text-xs font-medium text-zinc-600">{criticalPlanChanges.length} alertas</div>
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        {criticalPlanChanges.map((e) => (
                          <div key={e.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="text-xs font-medium text-zinc-500">{new Date(e.createdAt).toLocaleString("pt-BR")}</div>
                            <div className="mt-2 text-sm font-semibold text-zinc-900">Mudança registrada</div>
                            <div className="mt-1 text-sm text-zinc-800">{e.mudancas}</div>
                          </div>
                        ))}
                        {criticalPlanChanges.length === 0 ? (
                          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Sem mudanças críticas recentes.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
                          <h3 className="text-sm font-semibold tracking-tight text-zinc-900">Gestão de Faltas</h3>
                        </div>
                        <div className="text-xs font-medium text-zinc-600">{absentTeamToday.length} faltas</div>
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        {absentTeamToday.map((t) => (
                          <div key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="text-sm font-semibold text-zinc-900">{t.nome}</div>
                            <div className="mt-1 text-xs text-zinc-600">{t.funcao}</div>
                          </div>
                        ))}
                        {absentTeamToday.length === 0 ? (
                          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Nenhuma falta registrada hoje.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === "diario" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Diário de Obra</h2>
                      <p className="text-sm text-zinc-600">Registro do encarregado: ocorrências e mudanças de planos.</p>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 sm:flex">
                      {(diarioByProject[selectedProjectId] ?? []).length} registros
                    </div>
                  </div>

                  <form
                    className="mt-6 grid grid-cols-1 gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveDiarioEntry();
                    }}
                  >
                    <textarea
                      value={diarioForm.ocorrencias}
                      onChange={(e) => setDiarioForm((s) => ({ ...s, ocorrencias: e.target.value }))}
                      className="min-h-28 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Ocorrências do dia"
                    />
                    <textarea
                      value={diarioForm.mudancas}
                      onChange={(e) => setDiarioForm((s) => ({ ...s, mudancas: e.target.value }))}
                      className="min-h-28 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Mudanças de planos (crítico)"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 flex flex-col gap-3">
                    {(diarioByProject[selectedProjectId] ?? []).map((e) => (
                      <div key={e.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="text-xs font-medium text-zinc-500">{new Date(e.createdAt).toLocaleString("pt-BR")}</div>
                        {e.ocorrencias.trim().length > 0 ? <div className="mt-2 text-sm text-zinc-800">{e.ocorrencias}</div> : null}
                        {e.mudancas.trim().length > 0 ? <div className="mt-2 text-sm font-semibold text-zinc-900">{e.mudancas}</div> : null}
                      </div>
                    ))}
                    {(diarioByProject[selectedProjectId] ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Nenhum registro ainda.</div>
                    ) : null}
                  </div>
                </div>
              ) : activeTab === "materiais" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Materiais</h2>
                      <p className="text-sm text-zinc-600">Cotação, compra e entrega com foco em ação.</p>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 sm:flex">
                      {currentMaterials.length} itens
                    </div>
                  </div>

                  <form
                    className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveMaterial();
                    }}
                  >
                    <input
                      value={materialForm.item}
                      onChange={(e) => setMaterialForm((s) => ({ ...s, item: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20 md:col-span-2"
                      placeholder="Item"
                    />
                    <input
                      value={materialForm.fornecedor}
                      onChange={(e) => setMaterialForm((s) => ({ ...s, fornecedor: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20 md:col-span-2"
                      placeholder="Fornecedor"
                    />
                    <input
                      value={materialForm.valor}
                      onChange={(e) => {
                        const next = formatBRLInput(e.target.value);
                        setMaterialForm((s) => ({ ...s, valor: next.text }));
                      }}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Valor"
                      inputMode="decimal"
                    />
                    <select
                      value={materialForm.status}
                      onChange={(e) => setMaterialForm((s) => ({ ...s, status: e.target.value as MaterialStatus }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                    >
                      <option value="cotado">Cotado</option>
                      <option value="comprado">Comprado</option>
                      <option value="entregue">Entregue</option>
                    </select>
                    <input
                      value={materialForm.contato}
                      onChange={(e) => setMaterialForm((s) => ({ ...s, contato: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20 md:col-span-3"
                      placeholder="Contato (tel/WhatsApp)"
                    />
                    <div className="md:col-span-3 md:flex md:justify-end">
                      <button
                        type="submit"
                        className="h-11 w-full rounded-xl bg-[#D4AF37] px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 md:w-auto"
                      >
                        Adicionar
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200">
                    <table className="w-full">
                      <thead className="bg-white">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <th className="px-5 py-3">Item</th>
                          <th className="px-5 py-3">Fornecedor</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Valor</th>
                          <th className="px-5 py-3 text-right">Contato</th>
                          <th className="px-5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {currentMaterials.map((m) => (
                          <tr key={m.id} className="bg-white">
                            <td className="px-5 py-4 text-sm font-medium text-zinc-900">{m.item}</td>
                            <td className="px-5 py-4 text-sm text-zinc-700">{m.fornecedor}</td>
                            <td className="px-5 py-4 text-sm text-zinc-700">{m.status}</td>
                            <td className="px-5 py-4 text-right text-sm font-semibold text-zinc-900">{formatCentsToBRL(m.valorCents)}</td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <a
                                  href={m.contato ? `tel:${m.contato}` : undefined}
                                  className={
                                    m.contato
                                      ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533]"
                                      : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-300"
                                  }
                                  aria-label="Ligar"
                                  onClick={(e) => {
                                    if (!m.contato) e.preventDefault();
                                  }}
                                >
                                  <Phone className="h-4 w-4" aria-hidden="true" />
                                </a>
                                <a
                                  href={m.contato ? `https://wa.me/${normalizeWhatsAppNumber(m.contato)}` : undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={
                                    m.contato
                                      ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533]"
                                      : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-300"
                                  }
                                  aria-label="WhatsApp"
                                  onClick={(e) => {
                                    if (!m.contato) e.preventDefault();
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                </a>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => deleteMaterial(m.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                                aria-label="Excluir material"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : activeTab === "equipe" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Equipe</h2>
                      <p className="text-sm text-zinc-600">Cadastre mão de obra e marque faltas do dia.</p>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 sm:flex">
                      {currentTeam.length} pessoas
                    </div>
                  </div>

                  <form
                    className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveTeamMember();
                    }}
                  >
                    <input
                      value={teamForm.nome}
                      onChange={(e) => setTeamForm((s) => ({ ...s, nome: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20 md:col-span-2"
                      placeholder="Nome"
                    />
                    <input
                      value={teamForm.funcao}
                      onChange={(e) => setTeamForm((s) => ({ ...s, funcao: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20 md:col-span-2"
                      placeholder="Função"
                    />
                    <input
                      value={teamForm.valor}
                      onChange={(e) => {
                        const next = formatBRLInput(e.target.value);
                        setTeamForm((s) => ({ ...s, valor: next.text }));
                      }}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Valor"
                      inputMode="decimal"
                    />
                    <input
                      value={teamForm.contato}
                      onChange={(e) => setTeamForm((s) => ({ ...s, contato: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Contato"
                    />
                    <div className="md:col-span-6 md:flex md:justify-end">
                      <button
                        type="submit"
                        className="h-11 w-full rounded-xl bg-[#D4AF37] px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 md:w-auto"
                      >
                        Adicionar
                      </button>
                    </div>
                  </form>

                  <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200">
                    <table className="w-full">
                      <thead className="bg-white">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <th className="px-5 py-3">Nome</th>
                          <th className="px-5 py-3">Função</th>
                          <th className="px-5 py-3 text-right">Valor</th>
                          <th className="px-5 py-3 text-right">Faltou hoje</th>
                          <th className="px-5 py-3 text-right">Contato</th>
                          <th className="px-5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {currentTeam.map((t) => (
                          <tr key={t.id} className="bg-white">
                            <td className="px-5 py-4 text-sm font-medium text-zinc-900">{t.nome}</td>
                            <td className="px-5 py-4 text-sm text-zinc-700">{t.funcao}</td>
                            <td className="px-5 py-4 text-right text-sm font-semibold text-zinc-900">{formatCentsToBRL(t.valorCents)}</td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => toggleTeamAbsentToday(t.id)}
                                className={
                                  t.faltouHoje
                                    ? "rounded-full bg-[#D4AF37] px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                                    : "rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                                }
                              >
                                {t.faltouHoje ? "Sim" : "Não"}
                              </button>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <a
                                  href={t.contato ? `tel:${t.contato}` : undefined}
                                  className={
                                    t.contato
                                      ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533]"
                                      : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-300"
                                  }
                                  aria-label="Ligar"
                                  onClick={(e) => {
                                    if (!t.contato) e.preventDefault();
                                  }}
                                >
                                  <Phone className="h-4 w-4" aria-hidden="true" />
                                </a>
                                <a
                                  href={t.contato ? `https://wa.me/${normalizeWhatsAppNumber(t.contato)}` : undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={
                                    t.contato
                                      ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533]"
                                      : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-300"
                                  }
                                  aria-label="WhatsApp"
                                  onClick={(e) => {
                                    if (!t.contato) e.preventDefault();
                                  }}
                                >
                                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                </a>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => deleteTeamMember(t.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                                aria-label="Excluir membro"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : activeTab === "levantamento" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Levantamento Automatizado de Materiais</h2>
                      <p className="text-sm text-zinc-600">
                        Envie o PDF (planta/memorial). O sistema tenta extrair texto e, se necessário, roda OCR. Depois você revisa e confirma.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold text-zinc-900">Upload de PDF</p>
                          <p className="text-xs text-zinc-600">PDFs em imagem/scan podem levar mais tempo.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-within:ring-2 focus-within:ring-[#D4AF37] focus-within:ring-offset-2">
                          Selecionar PDF
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                await uploadLevantamentoPdf(f);
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : "Falha ao processar PDF";
                                setLevantamentoError(msg);
                                setLevantamentoStage("error");
                                setLevantamentoMessage(null);
                              } finally {
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-4 text-xs font-medium text-zinc-600">
                          <span>{levantamentoMessage ?? "Aguardando upload..."}</span>
                          <span>{levantamentoProgress}%</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-[#D4AF37]"
                            style={{ width: `${Math.max(0, Math.min(100, levantamentoProgress))}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        {levantamentoError ? (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {levantamentoError}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-zinc-900">Itens extraídos</p>
                        <p className="text-xs text-zinc-600">Você pode editar antes de confirmar.</p>
                      </div>

                      {levantamentoItems.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600">
                          Nenhum item ainda. Faça o upload do PDF para iniciar.
                        </div>
                      ) : (
                        <>
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[780px] border border-zinc-200">
                              <thead className="bg-white">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  <th className="px-4 py-3">Categoria</th>
                                  <th className="px-4 py-3">Item</th>
                                  <th className="px-4 py-3">Qtd</th>
                                  <th className="px-4 py-3">Unid.</th>
                                  <th className="px-4 py-3">Obs.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200">
                                {levantamentoItems.map((it, idx) => (
                                  <tr key={`${it.categoria}-${idx}`} className="bg-white align-top">
                                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                                      <select
                                        value={it.categoria}
                                        onChange={(e) =>
                                          updateLevantamentoItem(idx, {
                                            categoria: e.target.value as LevantamentoCategoria,
                                          })
                                        }
                                        className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                                      >
                                        {[
                                          "Estrutural",
                                          "Alvenaria",
                                          "Revestimento",
                                          "Elétrica",
                                          "Hidráulica",
                                        ].map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        value={it.item}
                                        onChange={(e) => updateLevantamentoItem(idx, { item: e.target.value })}
                                        className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                                      />
                                      {it.confidence ? (
                                        <div className="mt-1 text-xs text-zinc-500">Confiança: {it.confidence}</div>
                                      ) : null}
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        value={typeof it.quantidade === "number" ? String(it.quantidade) : ""}
                                        onChange={(e) => {
                                          const v = e.target.value.trim();
                                          const n = v.length === 0 ? undefined : Number.parseFloat(v.replace(",", "."));
                                          updateLevantamentoItem(idx, {
                                            quantidade: Number.isFinite(n as number) ? (n as number) : undefined,
                                          });
                                        }}
                                        className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                                        inputMode="decimal"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        value={it.unidade ?? ""}
                                        onChange={(e) => updateLevantamentoItem(idx, { unidade: e.target.value })}
                                        className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                                        placeholder="m², un"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <textarea
                                        value={it.observacoes ?? ""}
                                        onChange={(e) => updateLevantamentoItem(idx, { observacoes: e.target.value })}
                                        className="min-h-[2.25rem] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setLevantamentoJobId(null);
                                setLevantamentoStage(null);
                                setLevantamentoProgress(0);
                                setLevantamentoMessage(null);
                                setLevantamentoError(null);
                                setLevantamentoTextSample("");
                                setLevantamentoItems([]);
                              }}
                              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                            >
                              Limpar
                            </button>
                            <button
                              type="button"
                              onClick={addLevantamentoToMaterials}
                              className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                            >
                              Confirmar e inserir em Materiais
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {levantamentoTextSample.trim().length > 0 ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">Prévia do texto extraído (amostra)</p>
                            <p className="mt-1 text-xs text-zinc-600">Ajuda a diagnosticar quando o OCR não capturou tudo.</p>
                          </div>
                          <div className="text-xs font-medium text-zinc-600">Stage: {levantamentoStage ?? "-"}</div>
                        </div>
                        <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-700">
{levantamentoTextSample}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : activeTab === "video" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold tracking-tight text-zinc-900">Videoconferência</h2>
                        <p className="text-sm text-zinc-600">Reunião VIP integrada via Jitsi Meet.</p>
                      </div>
                      <button
                        type="button"
                        onClick={startVipMeeting}
                        className="inline-flex items-center justify-center rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      >
                        Iniciar Reunião VIP
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                      {hasStartedVipMeeting ? (
                        <iframe
                          title="Reunião VIP"
                          src={`https://meet.jit.si/${toJitsiRoomName(selectedProject.projeto)}`}
                          className="h-[70vh] w-full"
                          allow="camera; microphone; fullscreen; display-capture"
                        />
                      ) : (
                        <div className="flex h-[40vh] items-center justify-center px-6 text-center text-sm text-zinc-600">
                          Clique em <span className="font-semibold text-zinc-900">Iniciar Reunião VIP</span> para carregar a sala.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold tracking-tight text-zinc-900">Fotos</h2>
                  <p className="mt-1 text-sm text-zinc-600">Em breve: gestão completa desta aba.</p>
                </div>
              )}
            </main>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium tracking-wide text-zinc-500">Painel</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Marbe Arquitetos - Painel administrativo</h1>
                  <p className="max-w-2xl text-sm leading-6 text-zinc-600">Visão geral do estágio dos projetos, orçamentos e resultados.</p>
                </div>
                <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={openModal}
                    className="inline-flex items-center justify-center rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                  >
                    Novo Projeto
                  </button>
                  <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm sm:flex">
                    <span className="h-2 w-2 rounded-full bg-[#D4AF37]" aria-hidden="true" />
                    Atualizado agora
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </header>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                title="Projetos Ativos"
                value={String(recentProjects.length)}
                subtitle="Total cadastrados"
                icon={<Building2 className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />}
              />
              <StatCard
                title="Orçamentos Pendentes"
                value="5"
                subtitle="3 aguardando retorno"
                icon={<FileText className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />}
              />
              <StatCard
                title="Lucro Total"
                value={formatCentsToBRL(totalProfitCents)}
                subtitle="Soma dos valores previstos"
                icon={<TrendingUp className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />}
              />
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 px-6 py-5">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-zinc-900">Projetos Recentes</h2>
                  <p className="text-sm text-zinc-600">Últimos projetos cadastrados no sistema.</p>
                </div>
                <div className="hidden h-9 items-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 sm:flex">
                  {recentProjects.length} itens
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-t border-zinc-200">
                  <thead className="bg-white">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-6 py-3">Cliente</th>
                      <th className="px-6 py-3">WhatsApp</th>
                      <th className="px-6 py-3">Projeto</th>
                      <th className="px-6 py-3 text-right">Valor Previsto</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {recentProjects.map((p) => (
                      <tr key={p.id} className="bg-white">
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">{p.cliente}</td>
                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {p.whatsappCliente ? normalizeWhatsAppNumber(p.whatsappCliente) : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => openProjectDetails(p.id)}
                            className="text-left text-sm font-medium text-zinc-800 underline decoration-zinc-200 underline-offset-4 transition-colors hover:text-zinc-950 hover:decoration-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                          >
                            {p.projeto}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">{formatCentsToBRL(p.valorPrevistoCents)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <a
                              href={p.whatsappCliente ? `https://wa.me/${normalizeWhatsAppNumber(p.whatsappCliente)}` : undefined}
                              target="_blank"
                              rel="noreferrer"
                              className={
                                p.whatsappCliente
                                  ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                                  : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-300"
                              }
                              aria-label={`WhatsApp do cliente ${p.cliente}`}
                              onClick={(e) => {
                                if (!p.whatsappCliente) e.preventDefault();
                              }}
                            >
                              <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            </a>
                            <button
                              type="button"
                              onClick={() => onDeleteProject(p.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                              aria-label={`Excluir projeto ${p.projeto}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                >
                  Limpar Tudo
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Agenda da Semana</h2>
                      <p className="text-sm text-zinc-600">Reuniões, vistorias e entregas previstas.</p>
                    </div>
                    <div className="rounded-full border border-zinc-200 bg-white p-2">
                      <CalendarDays className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
                    </div>
                  </div>

                  <form
                    className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addAgendaEvent();
                    }}
                  >
                    <input
                      value={agendaForm.title}
                      onChange={(e) => setAgendaForm((s) => ({ ...s, title: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Agendar Evento"
                    />
                    <input
                      value={agendaForm.subtitle}
                      onChange={(e) => setAgendaForm((s) => ({ ...s, subtitle: e.target.value }))}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                      placeholder="Detalhes (local · hora)"
                    />
                    <button
                      type="submit"
                      className="h-11 rounded-xl bg-[#D4AF37] px-4 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                    >
                      Agendar
                    </button>
                  </form>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {agendaEvents.map((ev) => (
                      <AgendaButton
                        key={ev.id}
                        title={ev.title}
                        subtitle={ev.subtitle}
                        onClick={() => alert(`${ev.title}\n${ev.subtitle}`)}
                        onDelete={() => deleteAgendaEvent(ev.id)}
                      />
                    ))}
                    {agendaEvents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600">Nenhum evento agendado ainda.</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900">Destaques</h2>
                      <p className="text-sm text-zinc-600">Prioridades para hoje.</p>
                    </div>
                    <div className="rounded-full border border-zinc-200 bg-white p-2">
                      <Sparkles className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <HighlightActionItem
                      title="Aprovar materiais"
                      subtitle={`${globalMaterialsToApproveCount} itens cotados aguardando aprovação`}
                      onClick={goToFirstPendingApprovals}
                    />
                    <HighlightItem
                      title="Follow-up de orçamentos"
                      subtitle={`${globalMaterialsToFollowUpCount} materiais comprados pendentes de entrega`}
                    />
                    <HighlightItem
                      title="Revisar cronograma"
                      subtitle={latestPlanChange ? latestPlanChange.mudancas : "Sem mudanças de planos registradas ainda"}
                    />
                  </div>
                </div>
              </div>
            </section>

            {isModalOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
              >
                <button type="button" className="absolute inset-0 bg-black/40" onClick={closeModal} aria-label="Fechar modal" />

                <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl max-h-[calc(100vh-3rem)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium tracking-wide text-zinc-500">Cadastro</p>
                      <h2 id={modalTitleId} className="text-lg font-semibold text-zinc-900">Novo Projeto</h2>
                      <p className="mt-1 text-sm text-zinc-600">Preencha os dados principais para registrar o projeto.</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                    >
                      Fechar
                    </button>
                  </div>

                  <form
                    className="mt-4 flex max-h-[calc(100vh-11rem)] flex-col gap-3 overflow-y-auto pr-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!canSave) return;
                      onSave();
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <label htmlFor={inputClienteId} className="text-sm font-medium text-zinc-700">Cliente</label>
                      <input
                        id={inputClienteId}
                        value={form.cliente}
                        onChange={(e) => setForm((prev) => ({ ...prev, cliente: e.target.value }))}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                        placeholder="Nome do cliente"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={inputWhatsAppClienteId} className="text-sm font-medium text-zinc-700">WhatsApp do Cliente</label>
                      <input
                        id={inputWhatsAppClienteId}
                        value={form.whatsappCliente}
                        onChange={(e) => setForm((prev) => ({ ...prev, whatsappCliente: e.target.value }))}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                        placeholder="(DDD) + número"
                        required
                      />
                      <div className="text-xs text-zinc-500">Ex: 11 99999-9999</div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={inputProjetoId} className="text-sm font-medium text-zinc-700">Projeto</label>
                      <input
                        id={inputProjetoId}
                        value={form.projeto}
                        onChange={(e) => setForm((prev) => ({ ...prev, projeto: e.target.value }))}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                        placeholder="Nome da obra / projeto"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={inputEnderecoId} className="text-sm font-medium text-zinc-700">Endereço da Obra</label>
                      <input
                        id={inputEnderecoId}
                        value={form.enderecoObra}
                        onChange={(e) => setForm((prev) => ({ ...prev, enderecoObra: e.target.value }))}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                        placeholder="Rua, número, bairro, cidade"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={inputUfId} className="text-sm font-medium text-zinc-700">UF (CUB)</label>
                        <select
                          id={inputUfId}
                          value={form.uf}
                          onChange={(e) => setForm((prev) => ({ ...prev, uf: e.target.value }))}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                          required
                        >
                          {[
                            "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
                          ].map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={inputPadraoId} className="text-sm font-medium text-zinc-700">Padrão (NBR 12721)</label>
                        <select
                          id={inputPadraoId}
                          value={form.padraoCUB}
                          onChange={(e) => setForm((prev) => ({ ...prev, padraoCUB: e.target.value }))}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                          required
                        >
                          {["R1-N","R8-N","R16-N","PP-4","CAL-8"].map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={inputAreaId} className="text-sm font-medium text-zinc-700">Área (m²)</label>
                        <input
                          id={inputAreaId}
                          value={form.areaM2}
                          onChange={(e) => setForm((prev) => ({ ...prev, areaM2: e.target.value }))}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                          placeholder="Ex.: 120"
                          inputMode="decimal"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={inputCubId} className="text-sm font-medium text-zinc-700">CUB/m² (mês)</label>
                        <input
                          id={inputCubId}
                          value={form.cubM2}
                          onChange={(e) => {
                            const next = formatBRLInput(e.target.value);
                            setForm((s) => ({ ...s, cubM2: next.text }));
                          }}
                          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                          placeholder="Ex.: R$ 2.800,00"
                          inputMode="decimal"
                          required
                        />
                        <div className="text-xs text-zinc-500">Copie o CUB/m² do mês no cub.org.br para sua UF e padrão.</div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor={inputValorId} className="text-sm font-medium text-zinc-700">Valor Previsto</label>
                      <input
                        id={inputValorId}
                        value={form.valorPrevisto}
                        onChange={(e) => {
                          const next = formatBRLInput(e.target.value);
                          setForm((s) => ({ ...s, valorPrevisto: next.text }));
                        }}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/20"
                        placeholder="(Opcional) Ex.: R$ 350.000,00"
                        inputMode="decimal"
                      />
                      <div className="text-xs text-zinc-500">Se deixar em branco, o sistema usa Estimativa (CUB × m²) como valor previsto.</div>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!canSave}
                        className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-[#C9A533] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isActive
          ? "rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
          : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
      }
    >
      {label}
    </button>
  );
}
