// netlify/functions/comentarios.js
const { neon } = require("@netlify/neon");
const Busboy = require("busboy");
const { PassThrough } = require("stream");

const sql = neon(process.env.NETLIFY_DATABASE_URL || ""); // usa NETLIFY_DATABASE_URL automaticamente

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

exports.handler = async (event, context) =>{
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: DEFAULT_HEADERS };
    }

    if (event.httpMethod === "GET") {
      return await listarComentarios();
    }

    if (event.httpMethod === "DELETE") {
      // path: /.netlify/functions/comentarios/<id>
      const parts = (event.path || "").split("/").filter(Boolean);
      const idStr = parts[parts.length - 1];
      const id = Number(idStr);
      if (!Number.isInteger(id)) {
        return {
          statusCode: 400,
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({ error: "ID inválido" })
        };
      }
      return await deletarComentario(id);
    }

    if (event.httpMethod === "POST") {
      const contentType = (event.headers["content-type"] || event.headers["Content-Type"] || "").toLowerCase();
      if (contentType.startsWith("multipart/form-data")) {
        return await handleMultipart(event, contentType);
      } else {
        return await handleJson(event);
      }
    }

    return {
      statusCode: 405,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Método não permitido" })
    };

  } catch (err) {
    console.error("ERRO NA FUNCTION:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Erro interno", detalhe: err?.message || String(err) })
    };
  }
}

/* -------------------------
   LISTAR
   ------------------------- */
async function listarComentarios() {
  try {
    const rows = await sql`SELECT id, nome, email, mensagem, avaliacao, foto, foto_tipo, criado_em
                           FROM comentarios
                           ORDER BY criado_em DESC;`;

    // cada row.foto pode ser Buffer (bytea) ou null
    const lista = rows.map(r => {
      const fotoData = r.foto ? `data:${r.foto_type || r.foto_tipo};base64,${Buffer.from(r.foto).toString("base64")}` : null;
      // neon may return field names exactly as in DB; try both foto_tipo or foto_type
      const fotoTipo = r.foto_tipo || r.foto_type || null;
      return {
        id: r.id,
        nome: r.nome,
        email: r.email,
        mensagem: r.mensagem,
        avaliacao: r.avaliacao,
        foto: r.foto ? `data:${fotoTipo};base64,${Buffer.from(r.foto).toString("base64")}` : null,
        criado_em: r.criado_em
      };
    });

    return { statusCode: 200, headers: DEFAULT_HEADERS, body: JSON.stringify(lista) };
  } catch (err) {
    console.error("Erro no LIST:", err);
    return { statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao buscar comentários" }) };
  }
}

/* -------------------------
   DELETE
   ------------------------- */
async function deletarComentario(id) {
  try {
    const res = await sql`DELETE FROM comentarios WHERE id = ${id} RETURNING id;`;
    if (!res || res.length === 0) {
      return { statusCode: 404, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Comentário não encontrado" }) };
    }
    return { statusCode: 200, headers: DEFAULT_HEADERS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Erro DELETE:", err);
    return { statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao deletar" }) };
  }
}

/* -------------------------
   JSON POST (fallback)
   ------------------------- */
async function handleJson(event) {
  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "JSON inválido" }) };
    }

    const nome = (body.nome || "").trim() || null;
    const email = (body.email || "").trim() || null;
    const mensagem = (body.mensagem || body.descricao || "").trim();
    const avaliacao = Number(body.avaliacao || 0);
    const fotoBase64 = body.foto || null;
    const fotoTipo = body.foto_tipo || body.fotoType || null;

    if (!mensagem || !avaliacao) {
      return { statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Mensagem e avaliação são obrigatórios" }) };
    }

    const fotoBin = fotoBase64 ? Buffer.from(fotoBase64.split(",").pop(), "base64") : null;

    const result = await sql`
      INSERT INTO comentarios (nome, email, mensagem, avaliacao, foto, foto_tipo, criado_em)
      VALUES (${nome}, ${email}, ${mensagem}, ${avaliacao}, ${fotoBin}, ${fotoTipo}, NOW())
      RETURNING id, criado_em;
    `;

    const inserted = result?.[0] ?? null;
    return {
      statusCode: 201,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ id: inserted?.id ?? null, nome, email, mensagem, avaliacao, criado_em: inserted?.criado_em ?? null })
    };
  } catch (err) {
    console.error("Erro handleJson:", err);
    return { statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao salvar", detalhe: err?.message }) };
  }
}

/* -------------------------
   MULTIPART POST (FormData)
   ------------------------- */
async function handleMultipart(event, contentTypeHeader) {
  return new Promise((resolve) => {
    // reconstrói buffer do body (netlify/cli usa base64 para bodies binários)
    let buffer;
    try {
      if (event.isBase64Encoded) {
        buffer = Buffer.from(event.body || "", "base64");
      } else {
        buffer = Buffer.from(event.body || "", "utf8");
      }
    } catch (e) {
      console.error("Erro ao criar buffer:", e);
      return resolve({ statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Corpo inválido" }) });
    }

    const headers = { "content-type": event.headers["content-type"] || event.headers["Content-Type"] || contentTypeHeader };

    const bb = Busboy({ headers });

    const fields = {};
    let fotoBuffer = null;
    let fotoTipo = null;

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("file", (fieldname, fileStream, info) => {
      // info: { filename, encoding, mimeType } depending on busboy version
      fotoTipo = info?.mimeType || info?.mime || null;
      const chunks = [];
      fileStream.on("data", (d) => chunks.push(d));
      fileStream.on("end", () => {
        fotoBuffer = Buffer.concat(chunks);
      });
      fileStream.on("error", (err) => {
        console.error("Erro no stream do arquivo:", err);
      });
    });

    bb.on("error", (err) => {
      console.error("Busboy error:", err);
      resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao processar upload" }) });
    });

    bb.on("finish", async () => {
      try {
        const nome = (fields.nome || "").trim() || null;
        const email = (fields.email || "").trim() || null;
        const mensagem = (fields.mensagem || fields.descricao || "").trim();
        const avaliacao = Number(fields.avaliacao || 0);

        if (!mensagem || !avaliacao) {
          return resolve({ statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Mensagem e avaliação são obrigatórios" }) });
        }

        const result = await sql`
          INSERT INTO comentarios (nome, email, mensagem, avaliacao, foto, foto_tipo, criado_em)
          VALUES (${nome}, ${email}, ${mensagem}, ${avaliacao}, ${fotoBuffer}, ${fotoTipo}, NOW())
          RETURNING id, criado_em;
        `;

        const inserted = result?.[0] ?? null;
        return resolve({
          statusCode: 201,
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({ id: inserted?.id ?? null, nome, email, mensagem, avaliacao, criado_em: inserted?.criado_em ?? null })
        });
      } catch (err) {
        console.error("DB INSERT multipart error:", err);
        return resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao salvar", detalhe: err?.message }) });
      }
    });

    // pipe buffer into busboy
    const ps = new PassThrough();
    ps.end(buffer);
    ps.pipe(bb);
  });
}
