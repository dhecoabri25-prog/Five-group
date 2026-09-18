/**
 * Five Group — backend server
 * ----------------------------------------------------
 * Server statis + REST API, ditulis hanya dengan modul bawaan
 * Node.js (termasuk node:sqlite yang sudah built-in sejak Node 22+),
 * jadi tidak perlu "npm install" apa pun. Jalankan dengan:
 *
 *     node server.js
 *
 * Database tersimpan permanen di file data/fivegroup.db (SQLite).
 *
 * Endpoint API — publik:
 *   GET  /api/products            -> daftar produk aktif
 *   GET  /api/team                 -> daftar koordinator pelaksana aktif
 *   POST /api/orders               -> buat pesanan baru
 *   POST /api/contact              -> kirim pesan kontak
 *   POST /api/visits               -> tambah & kembalikan hitungan pengunjung
 *
 * Endpoint API — admin (butuh ?key=ADMIN_KEY):
 *   GET   /api/orders              -> daftar semua pesanan
 *   PATCH /api/orders/:id          -> ubah status pesanan
 *   GET   /api/messages            -> daftar pesan kontak
 *   GET   /api/stats               -> ringkasan statistik usaha
 *   GET   /api/products/admin      -> daftar semua produk (termasuk nonaktif)
 *   POST  /api/products            -> tambah produk baru
 *   PATCH /api/products/:id        -> ubah produk (harga/nama/status aktif)
 *   DELETE /api/products/:id       -> hapus produk
 *   GET   /api/team/admin          -> daftar semua koordinator (termasuk nonaktif)
 *   POST  /api/team                -> tambah koordinator baru (foto: data URL base64)
 *   PATCH /api/team/:id            -> ubah data koordinator / status aktif
 *   DELETE /api/team/:id           -> hapus koordinator
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "fivegroup-admin";

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "fivegroup.db");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

/* ---------------------------------------------------------
   Database (SQLite, file lokal — data tidak hilang saat restart)
--------------------------------------------------------- */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    total INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Baru',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
`);

// Migrasi: tambahkan kolom image_url kalau database lama belum punya
const productCols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
if (!productCols.includes("image_url")) {
  db.exec("ALTER TABLE products ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
}

// Seed produk awal (hanya sekali, kalau tabel produk masih kosong)
const productCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
if (productCount === 0) {
  const seed = db.prepare(
    "INSERT INTO products (name, description, price, category, image_url, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  );
  const now = new Date().toISOString();
  seed.run("Kerupuk Kuah Mie", "Camilan khas perpaduan kerupuk, mie, dan kuah gurih yang bikin nagih.", 3000, "Camilan", "images/products/kerupuk-kuah-mie.jpg", now);
  seed.run("Es Nutrisari Susu", "Minuman segar rasa jeruk berpadu susu, cocok jadi teman bersantai.", 3000, "Minuman", "images/products/es-nutrisari-susu.jpg", now);
  seed.run("Paket Hemat (Kerupuk Kuah Mie + Es Nutrisari Susu)", "Dua rasa satu paket, cemilan enak dan minuman segar makin mantap.", 6000, "Paket", "images/products/paket-hemat.jpg", now);
} else {
  // Kalau produk sudah ada tapi belum punya gambar (dari sebelum fitur ini ada),
  // isi otomatis untuk 3 produk bawaan supaya menu tidak tampil kosong.
  const fillImage = db.prepare(
    "UPDATE products SET image_url = ? WHERE name = ? AND (image_url IS NULL OR image_url = '')"
  );
  fillImage.run("images/products/kerupuk-kuah-mie.jpg", "Kerupuk Kuah Mie");
  fillImage.run("images/products/es-nutrisari-susu.jpg", "Es Nutrisari Susu");
  fillImage.run("images/products/paket-hemat.jpg", "Paket Hemat (Kerupuk Kuah Mie + Es Nutrisari Susu)");
}

function getSetting(key, fallback) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value));
}
if (getSetting("visits", null) === null) setSetting("visits", 0);

// Seed koordinator pelaksana awal (hanya sekali, kalau tabel tim masih kosong)
const teamCount = db.prepare("SELECT COUNT(*) AS n FROM team").get().n;
if (teamCount === 0) {
  const seedTeam = db.prepare(
    "INSERT INTO team (name, position, description, photo, sort_order, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
  );
  seedTeam.run(
    "Dheco Abridinata",
    "Koordinator Financial",
    "Bertanggung jawab mengelola arus kas dan pencatatan keuangan harian, menyusun laporan keuangan secara berkala, serta memastikan setiap transaksi tercatat dengan rapi dan transparan. Berkontribusi menjaga stabilitas keuangan Five Group agar operasional usaha berjalan lancar dan mendukung pengambilan keputusan bisnis yang tepat.",
    "images/team/dheco-abridinata.jpg",
    0,
    new Date().toISOString()
  );
  seedTeam.run(
    "Favian Hanif Alfarza",
    "Koordinator Marketing / Promosi",
    "Bertanggung jawab merancang dan menjalankan strategi promosi produk, mengelola konten pemasaran di media sosial, serta menjaga interaksi dengan calon pelanggan agar produk Five Group semakin dikenal luas. Berkontribusi meningkatkan jangkauan pasar dan penjualan melalui promosi yang kreatif dan konsisten.",
    "images/team/favian-hanif-alfarza.jpg",
    1,
    new Date().toISOString()
  );
  seedTeam.run(
    "Arantha Linggarte Justitia",
    "Chief & Koki",
    "Bertanggung jawab meracik dan mengembangkan resep, mengawasi proses memasak dan produksi setiap hari, serta menjaga kebersihan dan standar higienitas dapur. Berkontribusi menjaga cita rasa khas Five Group tetap konsisten di setiap porsi, sehingga kualitas dan kepuasan pelanggan selalu terjaga.",
    "images/team/arantha-linggarte-justitia.jpg",
    2,
    new Date().toISOString()
  );
  seedTeam.run(
    "Januardi Bawamenewi",
    "Koordinator Tim Produksi",
    "Bertanggung jawab mengoordinasikan proses produksi harian, memastikan ketersediaan bahan baku, serta mengatur jadwal dan pembagian tugas tim produksi agar berjalan efisien. Berkontribusi memastikan produk selalu tersedia tepat waktu dengan kualitas yang terjaga, sehingga mendukung kelancaran operasional harian Five Group.",
    "images/team/januardi-bawamenewi.jpg",
    3,
    new Date().toISOString()
  );
  seedTeam.run(
    "Jemuel Andronicus",
    "Koordinator Tim Produksi",
    "Bertanggung jawab membantu mengawasi jalannya proses produksi, memastikan setiap tahapan pembuatan produk sesuai standar, serta menjaga kerja sama tim produksi agar target harian tercapai. Berkontribusi menjaga konsistensi kualitas dan kecepatan produksi sehingga pesanan pelanggan dapat terpenuhi tepat waktu.",
    "images/team/jemuel-andronicus.jpg",
    4,
    new Date().toISOString()
  );
  seedTeam.run(
    "Richer Fadli Ananda",
    "Koordinator Tim Produksi",
    "Bertanggung jawab menyiapkan bahan dan peralatan produksi, membantu proses pengemasan produk, serta menjaga kebersihan dan kerapian area produksi selama proses berlangsung. Berkontribusi menjaga kelancaran alur produksi dari awal hingga produk siap disajikan kepada pelanggan.",
    "images/team/richer-fadli-ananda.jpg",
    5,
    new Date().toISOString()
  );
}

/* ---------------------------------------------------------
   Util
--------------------------------------------------------- */
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readRequestBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function checkAdminKey(query) {
  return query.get("key") === ADMIN_KEY;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "forbidden" });
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (err2, fallback) => {
        if (err2) {
          sendJson(res, 404, { error: "not_found" });
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fallback);
        }
      });
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

/* ---------------------------------------------------------
   Handler: Produk
--------------------------------------------------------- */
function listProducts(req, res) {
  const rows = db
    .prepare("SELECT id, name, description, price, category, image_url FROM products WHERE active = 1 ORDER BY id ASC")
    .all();
  sendJson(res, 200, { products: rows });
}

async function createProduct(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  try {
    const raw = await readRequestBody(req, 10_000);
    const body = JSON.parse(raw || "{}");
    const name = (body.name || "").toString().trim().slice(0, 120);
    const description = (body.description || "").toString().trim().slice(0, 400);
    const category = (body.category || "").toString().trim().slice(0, 60);
    const price = Number(body.price);
    const imageUrl = (body.image_url || "").toString().trim().slice(0, 500);

    if (!name || !Number.isFinite(price) || price <= 0) {
      return sendJson(res, 400, { error: "Nama dan harga produk wajib diisi dengan benar." });
    }
    if (imageUrl && !/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp);base64,|images\/)/.test(imageUrl)) {
      return sendJson(res, 400, { error: "URL gambar tidak valid." });
    }

    const result = db
      .prepare("INSERT INTO products (name, description, price, category, image_url, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
      .run(name, description, Math.round(price), category, imageUrl, new Date().toISOString());

    sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  } catch (err) {
    sendJson(res, 400, { error: "Format data tidak valid." });
  }
}

async function updateProduct(req, res, query, id) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!existing) return sendJson(res, 404, { error: "Produk tidak ditemukan." });

  try {
    const raw = await readRequestBody(req, 10_000);
    const body = JSON.parse(raw || "{}");

    const name = body.name !== undefined ? String(body.name).trim().slice(0, 120) : existing.name;
    const description = body.description !== undefined ? String(body.description).trim().slice(0, 400) : existing.description;
    const category = body.category !== undefined ? String(body.category).trim().slice(0, 60) : existing.category;
    const price = body.price !== undefined ? Number(body.price) : existing.price;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
    const imageUrl = body.image_url !== undefined ? String(body.image_url).trim().slice(0, 500) : existing.image_url;

    if (!name || !Number.isFinite(price) || price <= 0) {
      return sendJson(res, 400, { error: "Nama dan harga produk wajib diisi dengan benar." });
    }
    if (imageUrl && !/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp);base64,|images\/)/.test(imageUrl)) {
      return sendJson(res, 400, { error: "URL gambar tidak valid." });
    }

    db.prepare(
      "UPDATE products SET name = ?, description = ?, category = ?, price = ?, image_url = ?, active = ? WHERE id = ?"
    ).run(name, description, category, Math.round(price), imageUrl, active, id);

    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 400, { error: "Format data tidak valid." });
  }
}

function deleteProduct(req, res, query, id) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) return sendJson(res, 404, { error: "Produk tidak ditemukan." });
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  sendJson(res, 200, { ok: true });
}

function listProductsAdmin(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const rows = db.prepare("SELECT * FROM products ORDER BY id ASC").all();
  sendJson(res, 200, { products: rows });
}

/* ---------------------------------------------------------
   Handler: Tim / Koordinator Pelaksana
--------------------------------------------------------- */
function listTeam(req, res) {
  const rows = db
    .prepare("SELECT id, name, position, description, photo FROM team WHERE active = 1 ORDER BY sort_order ASC, id ASC")
    .all();
  sendJson(res, 200, { team: rows });
}

function listTeamAdmin(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const rows = db.prepare("SELECT * FROM team ORDER BY sort_order ASC, id ASC").all();
  sendJson(res, 200, { team: rows });
}

async function createTeamMember(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  try {
    const raw = await readRequestBody(req, 4_000_000);
    const body = JSON.parse(raw || "{}");

    const name = (body.name || "").toString().trim().slice(0, 120);
    const position = (body.position || "").toString().trim().slice(0, 120);
    const description = (body.description || "").toString().trim().slice(0, 600);
    const photo = (body.photo || "").toString().trim();
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.round(Number(body.sortOrder)) : 0;

    if (!name || !position) {
      return sendJson(res, 400, { error: "Nama dan jabatan wajib diisi." });
    }
    if (photo && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(photo)) {
      return sendJson(res, 400, { error: "Format foto tidak didukung." });
    }

    const result = db
      .prepare(
        "INSERT INTO team (name, position, description, photo, sort_order, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
      )
      .run(name, position, description, photo, sortOrder, new Date().toISOString());

    sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  } catch (err) {
    if (err.message === "payload_too_large") return sendJson(res, 413, { error: "Ukuran foto terlalu besar (maks. sekitar 2MB)." });
    sendJson(res, 400, { error: "Format data tidak valid." });
  }
}

async function updateTeamMember(req, res, query, id) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const existing = db.prepare("SELECT * FROM team WHERE id = ?").get(id);
  if (!existing) return sendJson(res, 404, { error: "Anggota tim tidak ditemukan." });

  try {
    const raw = await readRequestBody(req, 4_000_000);
    const body = JSON.parse(raw || "{}");

    const name = body.name !== undefined ? String(body.name).trim().slice(0, 120) : existing.name;
    const position = body.position !== undefined ? String(body.position).trim().slice(0, 120) : existing.position;
    const description = body.description !== undefined ? String(body.description).trim().slice(0, 600) : existing.description;
    const photo = body.photo !== undefined ? String(body.photo).trim() : existing.photo;
    const sortOrder = body.sortOrder !== undefined ? Math.round(Number(body.sortOrder)) || 0 : existing.sort_order;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

    if (!name || !position) {
      return sendJson(res, 400, { error: "Nama dan jabatan wajib diisi." });
    }
    if (photo && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(photo)) {
      return sendJson(res, 400, { error: "Format foto tidak didukung." });
    }

    db.prepare(
      "UPDATE team SET name = ?, position = ?, description = ?, photo = ?, sort_order = ?, active = ? WHERE id = ?"
    ).run(name, position, description, photo, sortOrder, active, id);

    sendJson(res, 200, { ok: true });
  } catch (err) {
    if (err.message === "payload_too_large") return sendJson(res, 413, { error: "Ukuran foto terlalu besar (maks. sekitar 2MB)." });
    sendJson(res, 400, { error: "Format data tidak valid." });
  }
}

function deleteTeamMember(req, res, query, id) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const existing = db.prepare("SELECT id FROM team WHERE id = ?").get(id);
  if (!existing) return sendJson(res, 404, { error: "Anggota tim tidak ditemukan." });
  db.prepare("DELETE FROM team WHERE id = ?").run(id);
  sendJson(res, 200, { ok: true });
}

/* ---------------------------------------------------------
   Handler: Pesanan
--------------------------------------------------------- */
async function createOrder(req, res) {
  try {
    const raw = await readRequestBody(req, 10_000);
    const body = JSON.parse(raw || "{}");

    const productId = Number(body.productId);
    const qty = Math.max(1, Math.min(99, parseInt(body.qty, 10) || 1));
    const customerName = (body.customerName || "").toString().trim().slice(0, 120);
    const phone = (body.phone || "").toString().trim().slice(0, 30);
    const note = (body.note || "").toString().trim().slice(0, 300);

    if (!customerName || !phone) {
      return sendJson(res, 400, { error: "Nama dan nomor WhatsApp wajib diisi." });
    }
    if (!/^[0-9+\s-]{8,20}$/.test(phone)) {
      return sendJson(res, 400, { error: "Format nomor WhatsApp tidak valid." });
    }

    const product = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(productId);
    if (!product) {
      return sendJson(res, 400, { error: "Produk tidak ditemukan atau sudah tidak tersedia." });
    }

    const total = product.price * qty;
    const result = db
      .prepare(
        `INSERT INTO orders (product_id, product_name, price, qty, total, customer_name, phone, note, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Baru', ?)`
      )
      .run(
        product.id,
        product.name,
        product.price,
        qty,
        total,
        escapeHtml(customerName),
        escapeHtml(phone),
        escapeHtml(note),
        new Date().toISOString()
      );

    sendJson(res, 201, {
      ok: true,
      orderId: Number(result.lastInsertRowid),
      productName: product.name,
      qty,
      total
    });
  } catch (err) {
    sendJson(res, 400, { error: "Format data tidak valid." });
  }
}

function listOrders(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  sendJson(res, 200, { total: rows.length, orders: rows });
}

async function updateOrderStatus(req, res, query, id) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const existing = db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
  if (!existing) return sendJson(res, 404, { error: "Pesanan tidak ditemukan." });

  const allowed = ["Baru", "Diproses", "Selesai", "Dibatalkan"];
  try {
    const raw = await readRequestBody(req, 2_000);
    const body = JSON.parse(raw || "{}");
    const status = String(body.status || "");
    if (!allowed.includes(status)) {
      return sendJson(res, 400, { error: "Status tidak valid." });
    }
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 400, { error: "Format data tidak valid." });
  }
}

/* ---------------------------------------------------------
   Handler: Kontak & kunjungan
--------------------------------------------------------- */
async function handleContact(req, res) {
  try {
    const raw = await readRequestBody(req, 10_000);
    const body = JSON.parse(raw || "{}");

    const name = (body.name || "").toString().trim().slice(0, 120);
    const email = (body.email || "").toString().trim().slice(0, 160);
    const message = (body.message || "").toString().trim().slice(0, 2000);

    if (!name || !email || !message) {
      return sendJson(res, 400, { error: "Nama, email, dan pesan wajib diisi." });
    }
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: "Format email tidak valid." });
    }

    db.prepare("INSERT INTO messages (name, email, message, created_at) VALUES (?, ?, ?, ?)").run(
      escapeHtml(name),
      escapeHtml(email),
      escapeHtml(message),
      new Date().toISOString()
    );

    sendJson(res, 201, { ok: true });
  } catch (err) {
    if (err.message === "payload_too_large") return sendJson(res, 413, { error: "Pesan terlalu panjang." });
    sendJson(res, 500, { error: "Terjadi kesalahan pada server." });
  }
}

function listMessages(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const rows = db.prepare("SELECT * FROM messages ORDER BY id DESC").all();
  sendJson(res, 200, { total: rows.length, messages: rows });
}

function handleVisits(req, res) {
  const total = parseInt(getSetting("visits", "0"), 10) + 1;
  setSetting("visits", total);
  sendJson(res, 200, { total });
}

function handleStats(req, res, query) {
  if (!checkAdminKey(query)) return sendJson(res, 401, { error: "Kunci admin tidak valid." });
  const totalOrders = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
  const totalRevenue =
    db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status != 'Dibatalkan'").get().s;
  const pendingOrders = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'Baru'").get().n;
  const totalMessages = db.prepare("SELECT COUNT(*) AS n FROM messages").get().n;
  const totalProducts = db.prepare("SELECT COUNT(*) AS n FROM products WHERE active = 1").get().n;
  const totalTeam = db.prepare("SELECT COUNT(*) AS n FROM team WHERE active = 1").get().n;
  const visits = parseInt(getSetting("visits", "0"), 10);

  sendJson(res, 200, {
    visits,
    totalOrders,
    pendingOrders,
    totalRevenue,
    totalMessages,
    totalProducts,
    totalTeam,
    uptimeSeconds: Math.round(process.uptime())
  });
}

/* ---------------------------------------------------------
   Server & routing
--------------------------------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === "/api/products" && req.method === "GET") return listProducts(req, res);
    if (pathname === "/api/products" && req.method === "POST") return await createProduct(req, res, searchParams);
    if (pathname === "/api/products/admin" && req.method === "GET") return listProductsAdmin(req, res, searchParams);

    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && req.method === "PATCH") return await updateProduct(req, res, searchParams, productMatch[1]);
    if (productMatch && req.method === "DELETE") return deleteProduct(req, res, searchParams, productMatch[1]);

    if (pathname === "/api/team" && req.method === "GET") return listTeam(req, res);
    if (pathname === "/api/team" && req.method === "POST") return await createTeamMember(req, res, searchParams);
    if (pathname === "/api/team/admin" && req.method === "GET") return listTeamAdmin(req, res, searchParams);

    const teamMatch = pathname.match(/^\/api\/team\/(\d+)$/);
    if (teamMatch && req.method === "PATCH") return await updateTeamMember(req, res, searchParams, teamMatch[1]);
    if (teamMatch && req.method === "DELETE") return deleteTeamMember(req, res, searchParams, teamMatch[1]);

    if (pathname === "/api/orders" && req.method === "POST") return await createOrder(req, res);
    if (pathname === "/api/orders" && req.method === "GET") return listOrders(req, res, searchParams);

    const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
    if (orderMatch && req.method === "PATCH") return await updateOrderStatus(req, res, searchParams, orderMatch[1]);

    if (pathname === "/api/contact" && req.method === "POST") return await handleContact(req, res);
    if (pathname === "/api/messages" && req.method === "GET") return listMessages(req, res, searchParams);
    if (pathname === "/api/visits" && req.method === "POST") return handleVisits(req, res);
    if (pathname === "/api/stats" && req.method === "GET") return handleStats(req, res, searchParams);

    if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Endpoint tidak ditemukan." });

    serveStatic(req, res, pathname);
  } catch (err) {
    sendJson(res, 500, { error: "Terjadi kesalahan pada server." });
  }
});

server.listen(PORT, () => {
  console.log(`Five Group berjalan di http://localhost:${PORT}`);
  console.log(`Database SQLite: ${DB_PATH}`);
  console.log(`Admin key saat ini: ${ADMIN_KEY} (ubah lewat env ADMIN_KEY)`);
});
