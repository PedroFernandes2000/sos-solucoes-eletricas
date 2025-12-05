const Busboy = require('busboy');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { PassThrough } = require('stream');


// Caminho do DB local da function (ephemeral, mas serve)
const DB_FILE = path.join(__dirname, 'comments.db');
const db = new sqlite3.Database(DB_FILE);

// Garante a tabela com os campos necessários
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comentarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT,
      mensagem TEXT NOT NULL,
      avaliacao INTEGER NOT NULL,
      foto BLOB,
      foto_tipo TEXT,
      criado_em TEXT NOT NULL
    )
  `);
});

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

exports.handler = async (event, context) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: DEFAULT_HEADERS };
    }

    // GET -> listar comentários
    if (event.httpMethod === "GET") {
      return await listarComentarios();
    }

    // DELETE -> deletar por id (rota: /.netlify/functions/comentarios/<id>)
    if (event.httpMethod === "DELETE") {
      const parts = (event.path || '').split('/');
      const idStr = parts.pop() || parts.pop(); // last part
      const id = Number(idStr);
      if (!Number.isInteger(id)) {
        return { statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "ID inválido" }) };
      }
      return await deletarComentario(id);
    }

    // POST -> criar comentário (aceita multipart/form-data ou application/json)
    if (event.httpMethod === "POST") {
      const contentTypeHeader = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();

      if (contentTypeHeader.startsWith('multipart/form-data')) {
        return await handleMultipart(event, contentTypeHeader);
      } else {
        // fallback JSON
        return await handleJson(event);
      }
    }

    // Método não permitido
    return { statusCode: 405, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Método não permitido" }) };

  } catch (err) {
    console.error("ERRO NA FUNCTION:", err);
    return {
      statusCode: 500,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ error: "Erro interno", detalhe: (err && err.message) || String(err) })
    };
  }
};

/* ------------------------
   Funções auxiliares
   ------------------------ */

function listarComentarios() {
  return new Promise((resolve) => {
    const sql = `SELECT id, nome, email, mensagem, avaliacao, foto, foto_tipo, criado_em FROM comentarios ORDER BY criado_em DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("DB LIST ERROR:", err);
        return resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao buscar comentários" }) });
      }

      const lista = rows.map(r => {
        const fotoData = r.foto ? `data:${r.foto_tipo};base64,${Buffer.from(r.foto).toString('base64')}` : null;
        return {
          id: r.id,
          nome: r.nome,
          email: r.email,
          mensagem: r.mensagem,
          avaliacao: r.avaliacao,
          foto: fotoData,
          criado_em: r.criado_em
        };
      });

      resolve({ statusCode: 200, headers: DEFAULT_HEADERS, body: JSON.stringify(lista) });
    });
  });
}

function deletarComentario(id) {
  return new Promise((resolve) => {
    db.run(`DELETE FROM comentarios WHERE id = ?`, [id], function (err) {
      if (err) {
        console.error("DB DELETE ERROR:", err);
        return resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao deletar comentário" }) });
      }
      if (this.changes === 0) {
        return resolve({ statusCode: 404, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Comentário não encontrado" }) });
      }
      resolve({ statusCode: 200, headers: DEFAULT_HEADERS, body: JSON.stringify({ success: true }) });
    });
  });
}

function handleJson(event) {
  return new Promise((resolve) => {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return resolve({ statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "JSON inválido" }) });
    }

    const nome = (body.nome || '').trim();
    const email = (body.email || '').trim();
    const mensagem = (body.mensagem || '').trim();
    const avaliacao = Number(body.avaliacao || 0);
    const fotoBase64 = body.foto || null;
    const fotoTipo = body.foto_tipo || null;

    if (!mensagem || !avaliacao) {
      return resolve({ statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Mensagem e avaliação são obrigatórios" }) });
    }

    const fotoBin = fotoBase64 ? Buffer.from((fotoBase64.split(',').pop()), 'base64') : null;
    const criadoEm = new Date().toISOString();

    const sql = `INSERT INTO comentarios (nome, email, mensagem, avaliacao, foto, foto_tipo, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [nome || null, email || null, mensagem, avaliacao, fotoBin, fotoTipo, criadoEm], function (err) {
      if (err) {
        console.error("DB INSERT ERROR:", err);
        return resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao salvar comentário" }) });
      }
      return resolve({
        statusCode: 201,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({ id: this.lastID, nome, email, mensagem, avaliacao, criadoEm })
      });
    });
  });
}

function handleMultipart(event, contentTypeHeader) {
  return new Promise((resolve, reject) => {
    // Reconstruir buffer do body (lambda/local coloca base64 se isBase64Encoded)
    let buffer;
    try {
      if (event.isBase64Encoded) {
        buffer = Buffer.from(event.body || '', 'base64');
      } else {
        buffer = Buffer.from(event.body || '', 'utf8');
      }
    } catch (e) {
      console.error("Erro ao criar buffer do body:", e);
      return resolve({ statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Corpo inválido" }) });
    }

    // Configura o busboy com headers reais
    const headers = { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] || contentTypeHeader };

    const bb = Busboy({ headers });

    // Vars coletadas
    const fields = {};
    let fotoBuffer = null;
    let fotoTipo = null;
    let fotoFieldName = null;

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (fieldname, fileStream, info) => {
      // info: { filename, encoding, mimeType } (busboy v1+)
      fotoTipo = info && (info.mimeType || info.mime || info.mimeType) || null;
      fotoFieldName = fieldname;

      const chunks = [];
      fileStream.on('data', (d) => chunks.push(d));
      fileStream.on('end', () => {
        fotoBuffer = Buffer.concat(chunks);
      });
      fileStream.on('error', (err) => {
        console.error("Erro no stream do arquivo:", err);
      });
    });

    bb.on('error', (err) => {
      console.error("Busboy error:", err);
      return resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao processar upload" }) });
    });

    bb.on('finish', () => {
      // Agora temos campos e possivelmente fotoBuffer
      const nome = (fields.nome || '').trim();
      const email = (fields.email || '').trim();
      const mensagem = (fields.mensagem || fields.descricao || '').trim();
      const avaliacao = Number(fields.avaliacao || 0);

      if (!mensagem || !avaliacao) {
        return resolve({ statusCode: 400, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Mensagem e avaliação são obrigatórios" }) });
      }

      const criadoEm = new Date().toISOString();

      const sql = `INSERT INTO comentarios (nome, email, mensagem, avaliacao, foto, foto_tipo, criado_em)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [nome || null, email || null, mensagem, avaliacao, fotoBuffer, fotoTipo, criadoEm], function (err) {
        if (err) {
          console.error("DB INSERT ERROR:", err);
          return resolve({ statusCode: 500, headers: DEFAULT_HEADERS, body: JSON.stringify({ error: "Erro ao salvar comentário" }) });
        }
        return resolve({
          statusCode: 201,
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({ id: this.lastID, nome, email, mensagem, avaliacao, criadoEm })
        });
      });
    });

    // Pipe do buffer para o busboy
    const ps = new PassThrough();
    ps.end(buffer);
    ps.pipe(bb);
  });
}
