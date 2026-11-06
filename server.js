const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");
const { DB_PASSWORD } = require("./config");

const app = express();
app.use(express.json());

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: DB_PASSWORD,
  database: "app",
});

function hashPassword(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}

app.get(["/api/products", "/rest/products/search"], (req, res) => {
  const isRestSearch = req.path === "/rest/products/search";
  const searchTerm = isRestSearch ? req.query.q : req.query.search;
  const sql = "SELECT * FROM products WHERE name LIKE ?";
  db.query(sql, ["%" + searchTerm + "%"], (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(isRestSearch ? { status: "success", data: results } : results);
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
