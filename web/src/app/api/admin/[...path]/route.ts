import { API_URL } from "@/config/api";

type Context = { params: Promise<{ path: string[] }> };

/** O navegador chama a própria origem; a API continua validando a credencial. */
async function forward(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  const headers = new Headers();
  for (const name of ["x-admin-secret", "authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Não aceita segmentos que possam escapar de /api/admin.
  if (path.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
    return Response.json({ message: "Caminho inválido." }, { status: 400 });
  }

  const query = new URL(request.url).search;
  try {
    const response = await fetch(`${API_URL}/api/admin/${path.join("/")}${query}`, {
      method: request.method,
      headers,
      ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.text() }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Não foi possível conectar ao servidor. Tente novamente em instantes." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
