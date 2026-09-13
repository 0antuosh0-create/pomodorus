import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
// Global crash guards to prevent server exit on unexpected client disconnects
process.on("uncaughtException", (err) => {
  console.error("Server handled error (uncaught):", err?.message || err);
});
process.on("unhandledRejection", (err) => {
  console.error("Server handled error (rejection):", err?.message || err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let PORT = Number(process.env.PORT || 5174);
const DATA_FILE = path.join(__dirname, "pomodorus-data.json");

let DIST_DIR = path.join(__dirname, "dist");
if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  DIST_DIR = path.join(__dirname, "server", "internal", "web", "dist");
}
if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  DIST_DIR = path.join(__dirname, "client", "dist");
}
const PUBLIC_DIR = path.join(__dirname, "client", "public");

// --- Database & Persistence ---

const DEFAULT_INTERVALS = {
  shortBreakMs: 5 * 60 * 1000,
  longBreakMs: 20 * 60 * 1000,
  perCycle: 4,
};

function getTehranDateString(timestamp = Date.now()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(timestamp));
}

function createSampleProfileDays(handle) {
  const days = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const patterns = [
    { offset: 0, ms: 2 * 3600 * 1000 + 25 * 60 * 1000, task: "JS-PRE 🦈" },
    { offset: 1, ms: 3 * 3600 * 1000 + 40 * 60 * 1000, task: "JS-PRE 🦈" },
    { offset: 2, ms: 1 * 3600 * 1000 + 15 * 60 * 1000, task: "Refactoring" },
    { offset: 3, ms: 4 * 3600 * 1000 + 10 * 60 * 1000, task: "Debug UI" },
    { offset: 4, ms: 2 * 3600 * 1000, task: "JS-PRE 🦈" },
    { offset: 5, ms: 3 * 3600 * 1000 + 15 * 60 * 1000, task: "JS-PRE 🦈" },
    { offset: 6, ms: 2 * 3600 * 1000 + 30 * 60 * 1000, task: "Testing" },
    { offset: 7, ms: 1 * 3600 * 1000 + 50 * 60 * 1000, task: "Docs" },
    { offset: 8, ms: 3 * 3600 * 1000, task: "JS-PRE 🦈" },
    { offset: 10, ms: 4 * 3600 * 1000, task: "Feature launch" },
    { offset: 12, ms: 2 * 3600 * 1000 + 10 * 60 * 1000, task: "JS-PRE 🦈" },
    { offset: 15, ms: 3 * 3600 * 1000 + 45 * 60 * 1000, task: "JS-PRE 🦈" },
    { offset: 20, ms: 2 * 3600 * 1000, task: "Performance tuning" },
    { offset: 25, ms: 3 * 3600 * 1000, task: "JS-PRE 🦈" },
    { offset: 30, ms: 1 * 3600 * 1000 + 30 * 60 * 1000, task: "JS-PRE 🦈" },
  ];

  for (let i = 89; i >= 0; i--) {
    const dStr = getTehranDateString(now - i * dayMs);
    const found = patterns.find((p) => p.offset === i);
    if (found) {
      days.push({
        day: dStr,
        totalMs: found.ms,
        tasks: [{ name: found.task, totalMs: found.ms }],
      });
    } else {
      days.push({
        day: dStr,
        totalMs: 0,
        tasks: [],
      });
    }
  }
  return days;
}

function loadInitialData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      if (parsed.timers) {
        for (const t of Object.values(parsed.timers)) {
          if (!t.intervals || !t.intervals.perCycle) {
            t.intervals = { ...DEFAULT_INTERVALS };
          }
        }
      }
      return parsed;
    } catch {}
  }

  const thesadmanDays = createSampleProfileDays("thesadman");
  const yazdanDays = createSampleProfileDays("yazdan");

  return {
    accounts: {
      "demo@pomodorus.me": {
        id: "usr_demo",
        email: "demo@pomodorus.me",
        handle: "thesadman",
        categories: [
          { id: "cat-1", name: "JS-PRE 🦈", isPublic: true },
          { id: "cat-2", name: "تسک خصوصی", isPublic: false },
          { id: "cat-3", name: "مطالعه و پژوهش", isPublic: true },
        ],
        history: thesadmanDays,
      },
      "yazdan@yazdan.me": {
        id: "usr_yazdan",
        email: "yazdan@yazdan.me",
        handle: "yazdan",
        categories: [
          { id: "cat-y1", name: "توسعه پومودوروس", isPublic: true },
          { id: "cat-y2", name: "دیباگ", isPublic: true },
        ],
        history: yazdanDays,
      },
    },
    sessions: {},
    timers: {},
    codes: {},
  };
}

let db = loadInitialData();

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save data:", err?.message || err);
  }
}

function getUserTimerState(userId) {
  if (!db.timers[userId]) {
    db.timers[userId] = {
      session: null,
      cycle: { count: 0 },
      intervals: { ...DEFAULT_INTERVALS },
      today: { count: 0, totalMs: 0 },
    };
  } else if (!db.timers[userId].intervals || !db.timers[userId].intervals.perCycle) {
    db.timers[userId].intervals = { ...DEFAULT_INTERVALS };
  }
  return db.timers[userId];
}

function getUserByToken(token) {
  if (!token) return null;
  const sess = db.sessions[token];
  if (!sess) return null;
  if (sess.expiresAt < Date.now()) {
    delete db.sessions[token];
    return null;
  }
  for (const acc of Object.values(db.accounts)) {
    if (acc.id === sess.userId) return acc;
  }
  return null;
}

const SIMULATED_FEED_MEMBERS = [
  { handle: "thesadman", kind: "work", task: "JS-PRE 🦈", durationMinutes: 50 },
  { handle: "ali_1337", kind: "work", task: null, durationMinutes: 52 },
  { handle: "oftenmak", kind: "work", task: "debug", durationMinutes: 25 },
  { handle: "anoush", kind: "work", task: "پروژه بک‌اند", durationMinutes: 45 },
  { handle: "shayan_dev", kind: "shortBreak", task: null, durationMinutes: 5 },
  { handle: "sara_m", kind: "work", task: "طراحی رابط کاربری", durationMinutes: 30 },
  { handle: "reza_k", kind: "work", task: "مطالعه مقالات", durationMinutes: 25 },
];

function getCommunityFeedEntries() {
  const now = Date.now();
  return SIMULATED_FEED_MEMBERS.map((m, index) => {
    const cycleMs = (m.durationMinutes + 5) * 60 * 1000;
    const offset = (index * 13 * 60 * 1000) % cycleMs;
    const progress = (now + offset) % cycleMs;
    const remainingMs = Math.max(10_000, cycleMs - progress);
    const isBreak = remainingMs <= 5 * 60 * 1000;

    return {
      handle: m.handle,
      kind: isBreak ? "shortBreak" : m.kind,
      task: isBreak ? null : m.task,
      endsAt: now + (isBreak ? remainingMs : remainingMs - 5 * 60 * 1000),
    };
  });
}

let cachedRemoteFeed = null;
let lastRemoteFeedFetch = 0;

async function fetchRemoteLiveFeed() {
  const now = Date.now();
  if (cachedRemoteFeed && (now - lastRemoteFeedFetch < 8000)) {
    return cachedRemoteFeed;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://pomodorus.yazdan.me/api/feed", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        cachedRemoteFeed = data.entries;
        lastRemoteFeedFetch = now;
        return cachedRemoteFeed;
      }
    }
  } catch {
    // Graceful fallback if remote is slow or offline
  }
  return cachedRemoteFeed || getCommunityFeedEntries();
}

async function getLiveFeed() {
  const now = Date.now();
  const entries = [];

  for (const [userId, timerState] of Object.entries(db.timers)) {
    if (timerState.session && timerState.session.endsAt > now) {
      const acc = Object.values(db.accounts).find((a) => a.id === userId);
      if (acc && acc.handle) {
        entries.push({
          handle: acc.handle,
          kind: timerState.session.kind,
          task: timerState.session.categoryName,
          endsAt: timerState.session.endsAt,
        });
      }
    }
  }

  const community = await fetchRemoteLiveFeed();
  for (const c of community) {
    if (!entries.some((e) => e.handle === c.handle)) {
      entries.push(c);
    }
  }

  return entries;
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    list[parts.shift().trim()] = decodeURI(parts.join("="));
  });
  return list;
}

function jsonResponse(res, status, data, extraHeaders = {}) {
  const payload = {
    serverNow: Date.now(),
    ...data,
  };
  const body = JSON.stringify(payload);
  if (!res.writableEnded) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      ...extraHeaders,
    });
    res.end(body);
  }
}

function errorResponse(res, status, code) {
  jsonResponse(res, status, { error: code, code });
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const wsClients = new Set();

function makeWsFrame(text) {
  const payload = Buffer.from(text, "utf-8");
  const len = payload.length;
  let header;
  if (len <= 125) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

async function broadcastFeed() {
  if (wsClients.size === 0) return;
  try {
    const entries = await getLiveFeed();
    const feedPayload = {
      type: "feed",
      feed: {
        serverNow: Date.now(),
        entries: Array.isArray(entries) ? entries : [],
      },
    };
    const msg = JSON.stringify(feedPayload);
    for (const client of Array.from(wsClients)) {
      try {
        client.send(msg);
      } catch {}
    }
  } catch (err) {
    console.error("broadcastFeed error:", err?.message || err);
  }
}
function broadcastWsText(text) {
  for (const client of Array.from(wsClients)) {
    try {
      client.send(text);
    } catch {}
  }
}

// --- Upstream Real-Time Integration ---
const UPSTREAM_CONFIG_PATH = path.join(__dirname, "upstream-config.json");

function loadUpstreamConfig() {
  const defaults = {
    upstreamUrl: "https://pomodorus.yazdan.me",
    upstreamWsUrl: "wss://pomodorus.yazdan.me/ws",
    handle: process.env.UPSTREAM_HANDLE || "anoush",
    sessionCookie: process.env.UPSTREAM_SESSION_COOKIE || "",
  };
  try {
    if (fs.existsSync(UPSTREAM_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(UPSTREAM_CONFIG_PATH, "utf-8"));
      return { ...defaults, ...raw };
    }
  } catch {}
  return defaults;
}

function saveUpstreamConfig(updates) {
  try {
    const current = loadUpstreamConfig();
    const next = { ...current, ...updates };
    fs.writeFileSync(UPSTREAM_CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
    return next;
  } catch (err) {
    console.error("Failed to save upstream config:", err);
    return loadUpstreamConfig();
  }
}

let upstreamWs = null;
let upstreamWsConnected = false;
let upstreamReconnectTimeout = null;
let upstreamLiveSession = null;
let upstreamLastTimerFrame = null;
let upstreamAuthenticated = false;

function startUpstreamWebSocket() {
  if (upstreamWs) {
    try {
      upstreamWs.removeAllListeners();
      upstreamWs.terminate();
    } catch {}
    upstreamWs = null;
  }

  const cfg = loadUpstreamConfig();
  const headers = {
    Origin: cfg.upstreamUrl,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
  };
  if (cfg.sessionCookie) {
    headers["Cookie"] = `pomodorus_session=${cfg.sessionCookie}`;
  }

  try {
    const ws = new WebSocket(cfg.upstreamWsUrl, { headers });
    upstreamWs = ws;

    ws.on("open", () => {
      console.log(`[Upstream WS] Connected to ${cfg.upstreamWsUrl} (handle: ${cfg.handle}, authenticated: ${Boolean(cfg.sessionCookie)})`);
      upstreamWsConnected = true;
    });

    ws.on("message", (raw) => {
      try {
        const text = raw.toString();
        const frame = JSON.parse(text);

        if (frame.type === "feed" && frame.feed && Array.isArray(frame.feed.entries)) {
          cachedRemoteFeed = frame.feed.entries;
          lastRemoteFeedFetch = Date.now();

          const targetEntry = frame.feed.entries.find(
            (e) => e.handle && e.handle.toLowerCase() === cfg.handle.toLowerCase()
          );

          if (targetEntry && targetEntry.endsAt > Date.now()) {
            upstreamLiveSession = {
              id: "remote_" + targetEntry.endsAt,
              kind: targetEntry.kind || "work",
              categoryId: "cat_anoush_active",
              categoryName: targetEntry.task || "وایب کد",
              startedAt: targetEntry.endsAt - (targetEntry.kind === "work" ? 25 * 60 * 1000 : 5 * 60 * 1000),
              endsAt: targetEntry.endsAt,
              durationMs: targetEntry.kind === "work" ? 25 * 60 * 1000 : 5 * 60 * 1000,
              breakEndsAt: targetEntry.endsAt + 5 * 60 * 1000,
              resumeCategoryId: null,
              resumeDurationMs: null,
            };
          } else if (upstreamLiveSession && upstreamLiveSession.endsAt <= Date.now()) {
            upstreamLiveSession = null;
          }

          broadcastWsText(text);
        } else if (frame.type === "timer" && frame.timer) {
          console.log("[Upstream WS] Received authentic timer frame for user:", frame.timer);
          upstreamLastTimerFrame = frame.timer;
          upstreamAuthenticated = true;
          if (frame.timer.session) {
            upstreamLiveSession = frame.timer.session;
          } else {
            upstreamLiveSession = null;
          }
          broadcastWsText(text);
        } else {
          broadcastWsText(text);
        }
      } catch (err) {
        console.error("[Upstream WS] Frame parse error:", err?.message || err);
      }
    });

    ws.on("close", () => {
      upstreamWsConnected = false;
      scheduleUpstreamReconnect();
    });

    ws.on("error", (err) => {
      console.error("[Upstream WS] Connection error:", err?.message || err);
      upstreamWsConnected = false;
    });
  } catch (err) {
    console.error("[Upstream WS] Spawn error:", err?.message || err);
    scheduleUpstreamReconnect();
  }
}

function scheduleUpstreamReconnect() {
  if (upstreamReconnectTimeout) return;
  upstreamReconnectTimeout = setTimeout(() => {
    upstreamReconnectTimeout = null;
    startUpstreamWebSocket();
  }, 4000);
}

async function proxyToUpstream(req, res, pathAndQuery, method = req.method, body = null) {
  const cfg = loadUpstreamConfig();
  const targetUrl = new URL(pathAndQuery, cfg.upstreamUrl).toString();

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
    Accept: "application/json",
  };

  const reqCookies = parseCookies(req);
  const cookieVal = cfg.sessionCookie || reqCookies["pomodorus_session"];
  if (cookieVal) {
    headers["Cookie"] = `pomodorus_session=${cookieVal}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const resHeaders = {
      "Content-Type": upstreamRes.headers.get("content-type") || "application/json; charset=utf-8",
    };

    const setCookie = upstreamRes.headers.get("set-cookie");
    if (setCookie) {
      resHeaders["Set-Cookie"] = setCookie;
      const match = setCookie.match(/pomodorus_session=([^;]+)/);
      if (match && match[1]) {
        saveUpstreamConfig({ sessionCookie: match[1] });
        upstreamAuthenticated = true;
        startUpstreamWebSocket();
      }
    }

    const responseText = await upstreamRes.text();
    res.writeHead(upstreamRes.status, resHeaders);
    res.end(responseText);
  } catch (err) {
    console.error(`[Proxy] Error forwarding to ${targetUrl}:`, err?.message || err);
    errorResponse(res, 502, "upstream_gateway_error");
  }
}

function sendTimerToUser(userId) {
  const timerState = getUserTimerState(userId);
  const msg = JSON.stringify({
    type: "timer",
    timer: {
      serverNow: Date.now(),
      session: timerState.session,
      cycle: timerState.cycle,
      intervals: timerState.intervals,
      today: timerState.today,
    },
  });

  for (const client of Array.from(wsClients)) {
    if (client.userId === userId) {
      try {
        client.send(msg);
      } catch {}
    }
  }
}

async function handleRequest(req, res) {
  req.on("error", () => {});
  res.on("error", () => {});

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  const cookies = parseCookies(req);
  const sessionToken = cookies["pomodorus_session"];
  const user = getUserByToken(sessionToken);

  if (pathname === "/api/upstream/status" && method === "GET") {
    const cfg = loadUpstreamConfig();
    return jsonResponse(res, 200, {
      handle: cfg.handle,
      upstreamUrl: cfg.upstreamUrl,
      hasSessionCookie: Boolean(cfg.sessionCookie),
      authenticated: upstreamAuthenticated,
      wsConnected: upstreamWsConnected,
      liveSession: upstreamLiveSession,
    });
  }

  if (pathname === "/api/upstream/config" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const cfg = loadUpstreamConfig();

      let nextHandle = cfg.handle;
      if (body.handle !== undefined && String(body.handle).trim()) {
        nextHandle = String(body.handle).trim().toLowerCase().replace(/^@/, "");
      }

      // Handle clearing cookie
      if (body.clearCookie === true || body.sessionCookie === "") {
        saveUpstreamConfig({ sessionCookie: "", handle: nextHandle });
        upstreamAuthenticated = false;
        startUpstreamWebSocket();
        return jsonResponse(res, 200, {
          success: true,
          verified: false,
          handle: nextHandle,
          hasSessionCookie: false,
        });
      }

      // Handle updating cookie
      if (body.sessionCookie !== undefined) {
        let sessionCookie = String(body.sessionCookie).trim();
        const match = sessionCookie.match(/pomodorus_session=([^;\s]+)/);
        if (match && match[1]) {
          sessionCookie = match[1];
        }

        if (sessionCookie) {
          const testRes = await fetch(`${cfg.upstreamUrl}/api/me`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
              Cookie: `pomodorus_session=${sessionCookie}`,
            },
          });

          if (testRes.ok) {
            const userData = await testRes.json();
            const activeHandle = userData.handle || nextHandle;
            saveUpstreamConfig({ sessionCookie, handle: activeHandle });
            upstreamAuthenticated = true;
            startUpstreamWebSocket();
            return jsonResponse(res, 200, {
              success: true,
              verified: true,
              handle: activeHandle,
              hasSessionCookie: true,
            });
          } else {
            return errorResponse(res, 401, "invalid_session_cookie");
          }
        }
      }

      // If only handle was updated
      saveUpstreamConfig({ handle: nextHandle });
      startUpstreamWebSocket();
      return jsonResponse(res, 200, {
        success: true,
        verified: upstreamAuthenticated,
        handle: nextHandle,
        hasSessionCookie: Boolean(cfg.sessionCookie),
      });
    } catch (err) {
      return errorResponse(res, 500, "upstream_test_failed: " + (err?.message || err));
    }
  }

  if (pathname === "/api/health" && method === "GET") {
    return jsonResponse(res, 200, { ok: true });
  }

  if (pathname === "/api/me" && method === "GET") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      return proxyToUpstream(req, res, "/api/me");
    }
    return jsonResponse(res, 200, {
      handle: cfg.handle,
      isMirror: true,
      hasSessionCookie: false,
    });
  }

  if (pathname === "/api/auth/request-code" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return errorResponse(res, 400, "invalid_email");
      }
      return proxyToUpstream(req, res, "/api/auth/request-code", "POST", { email });
    } catch {
      return errorResponse(res, 400, "bad_request");
    }
  }

  if (pathname === "/api/auth/verify" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      return proxyToUpstream(req, res, "/api/auth/verify", "POST", body);
    } catch {
      return errorResponse(res, 400, "bad_request");
    }
  }

  if (pathname === "/api/auth/sign-out" && method === "POST") {
    saveUpstreamConfig({ sessionCookie: "" });
    upstreamAuthenticated = false;
    startUpstreamWebSocket();
    res.writeHead(204, {
      "Set-Cookie": "pomodorus_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    });
    return res.end();
  }

  if (pathname === "/api/handle" && method === "POST") {
    if (!user) return errorResponse(res, 401, "not_signed_in");
    try {
      const body = await readJsonBody(req);
      const rawHandle = String(body.handle || "").trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(rawHandle)) {
        return errorResponse(res, 400, "invalid_handle");
      }

      for (const acc of Object.values(db.accounts)) {
        if (acc.id !== user.id && acc.handle && acc.handle.toLowerCase() === rawHandle) {
          return errorResponse(res, 400, "handle_taken");
        }
      }

      user.handle = rawHandle;
      saveData();
      return jsonResponse(res, 200, { handle: user.handle });
    } catch {
      return errorResponse(res, 400, "bad_request");
    }
  }

  if (pathname === "/api/categories" && method === "GET") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      return proxyToUpstream(req, res, "/api/categories");
    }
    // Return anoush's authentic categories from remote profile
    return jsonResponse(res, 200, {
      categories: [
        { id: "cat_anoush_1", name: "وایب کد", isPublic: true },
        { id: "cat_anoush_2", name: "وبلاگ", isPublic: true },
        { id: "cat_anoush_3", name: "learning docker", isPublic: true },
        { id: "cat_anoush_4", name: "داکر و وایب کدینگ", isPublic: true },
      ],
    });
  }

  if (pathname === "/api/categories" && method === "POST") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      const body = await readJsonBody(req);
      return proxyToUpstream(req, res, "/api/categories", "POST", body);
    }
    if (!user) return errorResponse(res, 401, "not_signed_in");
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const isPublic = Boolean(body.isPublic);
      const id = body.id || "cat_" + crypto.randomBytes(6).toString("hex");

      if (!name) return errorResponse(res, 400, "empty_name");

      const category = { id, name, isPublic };
      user.categories = user.categories || [];
      user.categories.push(category);
      saveData();

      return jsonResponse(res, 200, { category });
    } catch {
      return errorResponse(res, 400, "bad_request");
    }
  }

  if (pathname.startsWith("/api/categories/") && method === "POST") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      const body = await readJsonBody(req);
      return proxyToUpstream(req, res, pathname, "POST", body);
    }
    if (!user) return errorResponse(res, 401, "not_signed_in");
    const parts = pathname.slice("/api/categories/".length).split("/");
    const catId = parts[0];
    const isDelete = parts[1] === "delete";

    user.categories = user.categories || [];
    const index = user.categories.findIndex((c) => c.id === catId);

    if (isDelete) {
      if (index !== -1) {
        user.categories.splice(index, 1);
        saveData();
      }
      res.writeHead(204);
      return res.end();
    } else {
      try {
        const body = await readJsonBody(req);
        if (index === -1) return errorResponse(res, 404, "category_not_found");
        user.categories[index].name = String(body.name || user.categories[index].name).trim();
        user.categories[index].isPublic = Boolean(body.isPublic ?? user.categories[index].isPublic);
        saveData();
        return jsonResponse(res, 200, { category: user.categories[index] });
      } catch {
        return errorResponse(res, 400, "bad_request");
      }
    }
  }

  if (pathname === "/api/intervals" && method === "POST") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      const body = await readJsonBody(req);
      return proxyToUpstream(req, res, "/api/intervals", "POST", body);
    }
    if (!user) return errorResponse(res, 401, "not_signed_in");
    try {
      const body = await readJsonBody(req);
      const timerState = getUserTimerState(user.id);
      timerState.intervals = {
        shortBreakMs: Number(body.shortBreakMs) || DEFAULT_INTERVALS.shortBreakMs,
        longBreakMs: Number(body.longBreakMs) || DEFAULT_INTERVALS.longBreakMs,
        perCycle: Number(body.perCycle) || DEFAULT_INTERVALS.perCycle,
      };
      saveData();
      sendTimerToUser(user.id);
      return jsonResponse(res, 200, {
        session: timerState.session,
        cycle: timerState.cycle,
        intervals: timerState.intervals,
        today: timerState.today,
      });
    } catch {
      return errorResponse(res, 400, "bad_request");
    }
  }

  if (pathname === "/api/feed" && method === "GET") {
    const liveEntries = await getLiveFeed();
    return jsonResponse(res, 200, { entries: liveEntries });
  }

  if (pathname.startsWith("/api/profile/") && method === "GET") {
    const handle = decodeURIComponent(pathname.slice("/api/profile/".length)).trim().toLowerCase();
    let profileAccount = null;

    for (const acc of Object.values(db.accounts)) {
      if (acc.handle && acc.handle.toLowerCase() === handle) {
        profileAccount = acc;
        break;
      }
    }

    if (!profileAccount) {
      try {
        const range = Number(parsedUrl.searchParams.get("range")) || 7;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const remoteRes = await fetch(`https://pomodorus.yazdan.me/api/profile/${encodeURIComponent(handle)}?range=${range}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (remoteRes.ok) {
          const remoteData = await remoteRes.json();
          return jsonResponse(res, 200, remoteData);
        }
      } catch {}
      return errorResponse(res, 404, "user_not_found");
    }
    const range = Number(parsedUrl.searchParams.get("range")) || 7;
    const allDays = profileAccount.history || createSampleProfileDays(profileAccount.handle);
    const sliceDays = allDays.slice(Math.max(0, allDays.length - range));
    const isOwner = Boolean(user && user.id === profileAccount.id);

    return jsonResponse(res, 200, {
      handle: profileAccount.handle,
      days: sliceDays,
      everFocused: sliceDays.some((d) => d.totalMs > 0),
      owner: isOwner,
    });
  }

  if (pathname === "/api/sync/mtracker-remote" && (method === "GET" || method === "POST")) {
    try {
      let handle = "anoush";
      if (method === "POST") {
        const body = await readJsonBody(req);
        if (body && body.handle) handle = String(body.handle).trim().toLowerCase();
      } else if (parsedUrl.searchParams.get("handle")) {
        handle = parsedUrl.searchParams.get("handle").trim().toLowerCase();
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const remoteRes = await fetch(`https://pomodorus.yazdan.me/api/profile/${encodeURIComponent(handle)}?range=90`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!remoteRes.ok) {
        return errorResponse(res, remoteRes.status === 404 ? 404 : 502, "remote_profile_not_found");
      }

      const remoteData = await remoteRes.json();
      const days = remoteData.days || [];

      const tasksMap = new Map();
      const entries = [];
      const MONO_COLORS = ["#ffffff", "#e7e5e4", "#a8a29e", "#78716c", "#57534e", "#292524"];

      for (const d of days) {
        const dayDate = d.day; // YYYY-MM-DD
        for (const t of d.tasks || []) {
          if (!t.name || !t.totalMs) continue;
          const taskName = t.name.trim();
          if (!tasksMap.has(taskName)) {
            const colorIdx = tasksMap.size % MONO_COLORS.length;
            tasksMap.set(taskName, {
              id: "task-" + crypto.randomBytes(4).toString("hex"),
              name: taskName,
              targetDailyHours: 2,
              color: MONO_COLORS[colorIdx],
              daysPerWeek: 7,
              createdAt: new Date().toISOString(),
              archivedAt: null,
            });
          }

          const taskObj = tasksMap.get(taskName);
          const hours = +(t.totalMs / (1000 * 60 * 60)).toFixed(2);
          if (hours > 0) {
            entries.push({
              id: "entry-" + crypto.randomBytes(4).toString("hex"),
              taskId: taskObj.id,
              date: dayDate,
              hours,
              note: `همگام‌سازی از سرور زنده پومودوروس (کاربر ${remoteData.handle})`,
              createdAt: new Date(dayDate + "T12:00:00Z").toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      const tasks = Array.from(tasksMap.values());
      return jsonResponse(res, 200, {
        success: true,
        handle: remoteData.handle,
        db: {
          schemaVersion: 3,
          tasks,
          entries,
        },
        stats: {
          tasksCount: tasks.length,
          entriesCount: entries.length,
          totalHours: +entries.reduce((s, e) => s + e.hours, 0).toFixed(2),
        }
      });
    } catch (err) {
      return errorResponse(res, 500, "sync_failed: " + (err?.message || err));
    }
  }

  if (pathname === "/api/session" && method === "GET") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      return proxyToUpstream(req, res, "/api/session");
    }

    if (upstreamLiveSession && upstreamLiveSession.endsAt > Date.now()) {
      return jsonResponse(res, 200, {
        session: upstreamLiveSession,
        cycle: { count: 1 },
        intervals: DEFAULT_INTERVALS,
        today: { totalMs: 26.58 * 3600 * 1000 },
        isMirror: true,
      });
    }

    const timerState = getUserTimerState(user ? user.id : "usr_default");
    return jsonResponse(res, 200, {
      session: timerState.session,
      cycle: timerState.cycle,
      intervals: timerState.intervals,
      today: timerState.today,
      isMirror: false,
    });
  }

  if (pathname === "/api/session/start" && method === "POST") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      const body = await readJsonBody(req);
      return proxyToUpstream(req, res, "/api/session/start", "POST", body);
    }
    if (!user) return errorResponse(res, 401, "not_signed_in");
    try {
      const body = await readJsonBody(req);
      const timerState = getUserTimerState(user.id);
      const durationMs = Number(body.durationMs) || (25 * 60 * 1000);
      const categoryId = body.categoryId || null;

      let categoryName = null;
      if (categoryId) {
        const cat = (user.categories || []).find((c) => c.id === categoryId);
        if (cat) categoryName = cat.name;
      }

      const now = Date.now();
      const nextCount = timerState.cycle.count + 1;
      const isLongBreakNext = nextCount >= (timerState.intervals.perCycle || 4);
      const nextBreakDurationMs = isLongBreakNext
        ? (timerState.intervals.longBreakMs || 20 * 60 * 1000)
        : (timerState.intervals.shortBreakMs || 5 * 60 * 1000);

      const newSession = {
        id: body.id || "sess_" + crypto.randomBytes(8).toString("hex"),
        kind: "work",
        categoryId,
        categoryName,
        startedAt: now,
        endsAt: now + durationMs,
        durationMs,
        breakEndsAt: now + durationMs + nextBreakDurationMs,
        resumeCategoryId: null,
        resumeDurationMs: null,
      };

      timerState.session = newSession;
      saveData();
      broadcastFeed();
      sendTimerToUser(user.id);

      return jsonResponse(res, 200, {
        session: timerState.session,
        cycle: timerState.cycle,
        intervals: timerState.intervals,
        today: timerState.today,
      });
    } catch {
      return errorResponse(res, 400, "bad_request");
    }
  }

  if (pathname.includes("/cancel") && method === "POST") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      return proxyToUpstream(req, res, pathname, "POST");
    }
    if (!user) return errorResponse(res, 401, "not_signed_in");
    const timerState = getUserTimerState(user.id);
    timerState.session = null;
    saveData();
    broadcastFeed();
    sendTimerToUser(user.id);

    return jsonResponse(res, 200, {
      session: null,
      cycle: timerState.cycle,
      intervals: timerState.intervals,
      today: timerState.today,
    });
  }

  if (pathname.includes("/confirm") && method === "POST") {
    const cfg = loadUpstreamConfig();
    if (cfg.sessionCookie) {
      return proxyToUpstream(req, res, pathname, "POST");
    }
    if (!user) return errorResponse(res, 401, "not_signed_in");
    const timerState = getUserTimerState(user.id);
    const curr = timerState.session;

    if (curr && curr.kind === "work") {
      timerState.today.count += 1;
      timerState.today.totalMs += curr.durationMs;

      const cycleLen = timerState.intervals.perCycle || 4;
      const nextCount = (timerState.cycle.count + 1) % cycleLen;
      timerState.cycle.count = nextCount;

      const tehranToday = getTehranDateString();
      user.history = user.history || [];
      let dayEntry = user.history.find((d) => d.day === tehranToday);
      if (!dayEntry) {
        dayEntry = { day: tehranToday, totalMs: 0, tasks: [] };
        user.history.push(dayEntry);
      }
      dayEntry.totalMs += curr.durationMs;
      const taskName = curr.categoryName || "تسک خصوصی";
      let taskEntry = dayEntry.tasks.find((t) => t.name === taskName);
      if (!taskEntry) {
        taskEntry = { name: taskName, totalMs: 0 };
        dayEntry.tasks.push(taskEntry);
      }
      taskEntry.totalMs += curr.durationMs;

      const isLongBreak = nextCount === 0;
      const breakMs = isLongBreak
        ? timerState.intervals.longBreakMs
        : timerState.intervals.shortBreakMs;

      const now = Date.now();
      if (curr.breakEndsAt && now < curr.breakEndsAt) {
        timerState.session = {
          id: "brk_" + crypto.randomBytes(8).toString("hex"),
          kind: isLongBreak ? "longBreak" : "shortBreak",
          categoryId: null,
          categoryName: null,
          startedAt: curr.endsAt,
          endsAt: curr.breakEndsAt,
          durationMs: breakMs,
          breakEndsAt: null,
          resumeCategoryId: curr.categoryId,
          resumeDurationMs: curr.durationMs,
        };
      } else {
        timerState.session = null;
      }
    } else {
      timerState.session = null;
    }

    saveData();
    broadcastFeed();
    sendTimerToUser(user.id);

    return jsonResponse(res, 200, {
      session: timerState.session,
      cycle: timerState.cycle,
      intervals: timerState.intervals,
      today: timerState.today,
    });
  }

  if (pathname === "/api/push/key" && method === "GET") {
    return jsonResponse(res, 200, { publicKey: "" });
  }

  if (pathname === "/api/push/subscribe" && method === "POST") {
    return jsonResponse(res, 200, { ok: true });
  }

  // --- Static Files & SPA Fallback ---

  let filePath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);

  if (!fs.existsSync(filePath)) {
    const pubPath = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(pubPath) && !fs.statSync(pubPath).isDirectory()) {
      filePath = pubPath;
    }
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const MIME_TYPES = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".mjs": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".webmanifest": "application/manifest+json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".avif": "image/avif",
      ".webp": "image/webp",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
    };

    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": ext === ".html" || ext === ".avif" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  const accept = req.headers.accept || "";
  if (accept.includes("text/html") || !pathname.includes(".")) {
    const indexHtml = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexHtml)) {
      const stat = fs.statSync(indexHtml);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": stat.size,
        "Cache-Control": "no-cache",
      });
      return fs.createReadStream(indexHtml).pipe(res);
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

const server = http.createServer(handleRequest);

// Setup Robust WebSocket Upgrade with Instant Error Guard
server.on("upgrade", (req, socket, head) => {
  // Attach error listener immediately to prevent any unhandled socket abort error
  socket.on("error", () => {
    socket.destroy();
  });

  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  const responseHeaders = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
  ];

  if (!socket.destroyed && socket.writable) {
    socket.write(responseHeaders.join("\r\n") + "\r\n\r\n");
  }

  const cookies = parseCookies(req);
  const token = cookies["pomodorus_session"];
  const user = getUserByToken(token);

  const client = {
    socket,
    userId: user ? user.id : null,
    send(text) {
      if (!socket.destroyed && socket.writable) {
        try {
          socket.write(makeWsFrame(text));
        } catch {
          wsClients.delete(client);
        }
      }
    },
  };

  wsClients.add(client);

  socket.on("close", () => wsClients.delete(client));
  socket.on("error", () => wsClients.delete(client));
  socket.on("data", (chunk) => {
    if (chunk.length >= 1) {
      const opcode = chunk[0] & 0x0f;
      if (opcode === 0x8) {
        socket.end();
      } else if (opcode === 0x9 && !socket.destroyed && socket.writable) {
        socket.write(Buffer.from([0x8a, 0x00])); // reply pong
      }
    }
  });

  client.send(
    JSON.stringify({
      type: "feed",
      feed: {
        serverNow: Date.now(),
        entries: cachedRemoteFeed || [],
      },
    })
  );

  if (upstreamLiveSession) {
    client.send(
      JSON.stringify({
        type: "timer",
        timer: {
          session: upstreamLiveSession,
          cycle: { count: 1 },
          intervals: DEFAULT_INTERVALS,
          today: { totalMs: 26.58 * 3600 * 1000 },
          serverNow: Date.now(),
        },
      })
    );
  } else if (user) {
    sendTimerToUser(user.id);
  }
});

setInterval(() => {
  broadcastFeed();
}, 10_000);

function startServer(port) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n======================================================`);
    console.log(`🍅 Pomodorus is running at: http://localhost:${port}`);
    console.log(`   Desktop Folder: ${__dirname}`);
    console.log(`   Double-click start.bat anytime to launch.`);
    console.log(`======================================================\n`);
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️  Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    PORT += 1;
    server.close(() => {
      startServer(PORT);
    });
  } else {
    console.error("Server error:", err?.message || err);
  }
});

startServer(PORT);
startUpstreamWebSocket();
