const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");
const { DB_PASSWORD } = require("./config");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");
  res.set("Content-Security-Policy", `script-src 'nonce-${nonce}'; object-src 'none'`);
  res.type("html").send(`<!doctype html>
<html><head><title>Product search</title></head><body>
<h1 id="search-heading"></h1><ul id="products"></ul>
<script nonce="${nonce}">
function renderSearch() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  if (path !== "/search") return;
  const term = new URLSearchParams(query).get("q") || "";
  document.getElementById("search-heading").textContent = "Search results for " + term;
  fetch("/api/products?search=" + encodeURIComponent(term))
    .then(response => response.json())
    .then(products => {
      const list = document.getElementById("products");
      list.replaceChildren();
      products.forEach(product => {
        const item = document.createElement("li");
        item.textContent = product.name;
        list.append(item);
      });
    });
}
addEventListener("hashchange", renderSearch);
renderSearch();
</script></body></html>`);
});

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: DB_PASSWORD,
  database: "app",
});

function hashPassword(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}

app.get("/api/products", (req, res) => {
  const searchTerm = req.query.search;
  const sql = "SELECT * FROM products WHERE name LIKE '%" + searchTerm + "%'";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results);
  });
});

app.get("/api/reports/:filename", (req, res) => {
  const filename = req.params.filename;
  const cmd = "cat /var/reports/" + filename;
  require("child_process").exec(cmd, (err, stdout) => {
    if (err) return res.status(500).json({ error: "Failed" });
    res.send(stdout);
  });
});

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const hashed = hashPassword(password);
  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashed],
    (err) => {
      if (err) return res.status(500).json({ error: "Registration failed" });
      res.json({ success: true });
    }
  );
});

app.get("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (results.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(results[0]);
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const hashed = hashPassword(password);
  db.query(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, hashed],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Login failed" });
      if (results.length === 0) return res.status(401).json({ error: "Invalid credentials" });
      res.json({ token: "signed-jwt-here", user: results[0] });
    }
  );
});

app.listen(3000);
