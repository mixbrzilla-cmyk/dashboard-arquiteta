import { getJob } from "../jobStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Parâmetro 'id' é obrigatório." }, { status: 400 });
  }

  const job = getJob(id);
  if (!job) {
    return Response.json({ error: "Job não encontrado." }, { status: 404 });
  }

  return Response.json(job);
}
