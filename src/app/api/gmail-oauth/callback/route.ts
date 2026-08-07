export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(
      [
        "<!doctype html>",
        '<html lang="id">',
        '<head><meta charset="utf-8"><title>Gmail OAuth Error</title></head>',
        '<body style="font-family:sans-serif;padding:24px">',
        "<h1>Gmail OAuth gagal</h1>",
        `<p>Error: <code>${escapeHtml(error)}</code></p>`,
        "</body></html>",
      ].join(""),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (!code) {
    return new Response("OAuth code tidak ditemukan.", { status: 400 });
  }

  return new Response(
    [
      "<!doctype html>",
      '<html lang="id">',
      '<head><meta charset="utf-8"><title>Gmail OAuth Code</title></head>',
      '<body style="font-family:sans-serif;padding:24px;line-height:1.5">',
      "<h1>Copy code ini ke terminal</h1>",
      '<textarea readonly style="width:100%;min-height:160px;font-family:monospace">',
      escapeHtml(code),
      "</textarea>",
      "<p>Setelah dicopy, kembali ke terminal dan paste ke prompt <strong>Paste code:</strong>.</p>",
      "</body></html>",
    ].join(""),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
