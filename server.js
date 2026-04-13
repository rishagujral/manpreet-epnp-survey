const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const { MongoClient } = require("mongodb");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const root = __dirname;
const outputDir = path.join(root, "output");
const publicDir = path.join(root, "public");

// --------------- Storage layer ---------------
// Uses MongoDB if MONGO_URI is set, otherwise falls back to local JSON file.

let db = null;

async function connectDB() {
  if (!process.env.MONGO_URI) return;
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db("epnp_csat");
  console.log("Connected to MongoDB");
}

const dataDir = path.join(root, "data");
const responsesFile = path.join(dataDir, "responses.json");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(responsesFile)) fs.writeFileSync(responsesFile, "[]", "utf8");

async function readResponses() {
  if (db) {
    return db.collection("responses").find().toArray();
  }
  try {
    return JSON.parse(fs.readFileSync(responsesFile, "utf8"));
  } catch {
    return [];
  }
}

async function addResponse(submission) {
  if (db) {
    await db.collection("responses").insertOne(submission);
  } else {
    const responses = await readResponses();
    responses.push(submission);
    fs.writeFileSync(responsesFile, JSON.stringify(responses, null, 2), "utf8");
  }
}

// --------------- Helpers ---------------

const SATISFACTION_SCORES = {
  "Very Satisfied": 5,
  "Satisfied": 4,
  "Neutral": 3,
  "Dissatisfied": 2,
  "Very Dissatisfied": 1
};

function averageOverallSatisfaction(responses) {
  const scores = responses
    .map((r) => SATISFACTION_SCORES[r.overallSatisfaction])
    .filter((s) => s !== undefined);
  if (!scores.length) return "-";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return avg.toFixed(1) + " / 5";
}

function buildDashboardLink() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  return `${baseUrl}/output/dashboard.html`;
}

function buildSurveyLink() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  return `${baseUrl}/output/survey.html`;
}

async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
}

// --------------- Routes ---------------

app.use(express.json());
app.use(express.static(publicDir));
app.use("/output", express.static(outputDir));

app.get("/", (_req, res) => {
  res.redirect("/output/survey.html");
});

app.post("/api/submit", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const submission = {
      id: uuidv4(),
      email: String(body.email).trim(),
      serviceLines: Array.isArray(body.serviceLines) ? body.serviceLines : [],
      satisfaction: body.satisfaction || {},
      overallSatisfaction: body.overallSatisfaction || "",
      improvement: String(body.improvement || "").trim(),
      recognition: String(body.recognition || "").trim(),
      submittedAt: new Date().toISOString()
    };

    await addResponse(submission);
    res.json({ ok: true });

    const dashboardLink = buildDashboardLink();
    const satisfactionText = Object.entries(submission.satisfaction)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const serviceLines = submission.serviceLines.join(", ") || "-";

    if (process.env.ADMIN_EMAIL) {
      sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: "New EP&P CSAT response received",
        html: `
          <h2>New EP&P CSAT response</h2>
          <p><strong>Email:</strong> ${submission.email}</p>
          <p><strong>Service lines:</strong> ${serviceLines}</p>
          <p><strong>Per-team satisfaction:</strong> ${satisfactionText || "-"}</p>
          <p><strong>Overall satisfaction:</strong> ${submission.overallSatisfaction || "-"}</p>
          <p><strong>Improvement suggestions:</strong> ${submission.improvement || "-"}</p>
          <p><strong>Recognition:</strong> ${submission.recognition || "-"}</p>
          <p><strong>Dashboard:</strong> <a href="${dashboardLink}">${dashboardLink}</a></p>
        `
      }).catch((err) => console.error("Admin email failed:", err.message));
    }

    if (process.env.MANAGER_EMAIL) {
      sendEmail({
        to: process.env.MANAGER_EMAIL,
        subject: "EP&P CSAT dashboard link",
        html: `
          <h2>EP&P CSAT dashboard access</h2>
          <p>A new survey response has been submitted.</p>
          <p>Use this dashboard link to review results:</p>
          <p><a href="${dashboardLink}">${dashboardLink}</a></p>
        `
      }).catch((err) => console.error("Manager email failed:", err.message));
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit survey." });
  }
});

app.get("/api/dashboard", async (_req, res) => {
  const responses = (await readResponses()).sort((a, b) =>
    String(b.submittedAt).localeCompare(String(a.submittedAt))
  );

  res.json({
    surveyLink: buildSurveyLink(),
    dashboardLink: buildDashboardLink(),
    totalResponses: responses.length,
    averageScore: averageOverallSatisfaction(responses),
    responses
  });
});

// --------------- Start ---------------

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Survey: http://localhost:${PORT}/output/survey.html`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
