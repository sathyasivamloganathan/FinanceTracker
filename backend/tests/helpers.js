process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.CLIENT_ORIGINS = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.RUN_JOBS = 'false';

const express = require('express');
const User = require('../src/models/User');
const { errorHandler } = require('../src/middleware/errorHandler');

// A real Mongoose document, but save() only validates (no database needed).
function makeUser(extra = {}) {
  const u = new User({ name: 'Test', email: 't@example.com', hasPassword: true, emailVerified: true, ...extra });
  u.save = async function save() { await this.validate(); return this; };
  return u;
}

async function startApp(user, mount) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  mount(app);
  app.use(errorHandler);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, json };
  };
  return { call, close: () => new Promise((r) => server.close(r)), base };
}

module.exports = { makeUser, startApp, User };
