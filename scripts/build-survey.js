const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");

const root = path.join(__dirname, "..");
const inputDocx = path.join(root, "input", "questions.docx");
const outputDir = path.join(root, "output");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const RATING_OPTIONS = ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"];
const YES_NO_OPTIONS = ["Yes", "No", "Not Applicable"];
const GATE_OPTIONS = ["Satisfied", "Neutral", "Dissatisfied"];

function defaultConfig(rawText) {
  return {
    title: "EP&P CSAT Survey",
    brandFull: "Enterprise Procurement & Payables",
    introText:
      "As an important internal client of EP&P in GCH, your input is critical to help us improve our services and measure our impact to you.",
    instructionText: "Please take two minutes to complete this survey and share your feedback.",
    emailPrompt: "Please enter your email.",

    serviceLinePrompt:
      "Please mark below the Service Line(s) you have used and help us answer the related questions",

    improvementQuestion: "What could we have done better?",

    serviceLines: [
      {
        key: "supplier_onboarding",
        label: "Supplier Onboarding",
        description:
          "Facilitates supplier setup, documentation, and system enablement to ensure suppliers are ready for seamless engagement.",
        questions: [
          { id: "q1", type: "rating", text: "How clear were the onboarding process and guidelines/training provided?" },
          { id: "q2", type: "rating", text: "How effectively did the Onboarding team support you throughout the process?" },
          { id: "q3", type: "rating", text: "Was the turn-around time aligned with your expectations?" },
          { id: "q4", type: "text", text: "What went well and what could be improved?" }
        ]
      },
      {
        key: "service_desk",
        label: "Service Desk",
        description:
          "Acts as the first point of contact for procurement-related queries, issue resolution, and general support to ensure smooth operations.",
        questions: [
          { id: "q1", type: "rating", text: "How effective was the Service Desk team in addressing your queries?" },
          { id: "q2", type: "rating", text: "How responsive was the Service Desk team to your queries?" },
          { id: "q3", type: "text", text: "What went well and what could be improved?" }
        ]
      },
      {
        key: "accounts_payable",
        label: "Accounts Payable",
        description:
          "Handles invoice processing, payments, and query resolution to ensure timely and accurate supplier payments.",
        questions: [
          { id: "q1", type: "rating", text: "How easy was it to review and/or approve the invoices?" },
          { id: "q2", type: "rating", text: "How clear was the process to check the status of your invoice?" },
          { id: "q3", type: "rating", text: "Were the invoices you submitted and/or approved processed on time?" },
          { id: "q4", type: "text", text: "What went well and what could be improved?" }
        ]
      },
      {
        key: "buy_desk",
        label: "Buy Desk",
        description:
          "Sourcing support for purchases below USD 100k. Provides purchase order support, requisition processing, and transactional buying assistance to enable efficient procurement execution.",
        questions: [
          { id: "q1", type: "rating", text: "How easy was it to submit a Sourcing Support Request Form (SSRF)?" },
          { id: "q2", type: "rating", text: "How helpful was the Buy Desk in supporting your request?" },
          {
            id: "q3",
            type: "yesno",
            text: "If you submitted a SSRF before agreeing the commercials with the supplier, was the Buy Desk able to negotiate a better deal?"
          },
          { id: "q4", type: "text", text: "What went well and what could be improved?" }
        ]
      },
      {
        key: "sourcing",
        label: "Sourcing",
        description:
          "Sourcing support for purchases above USD 100k. Supports supplier selection, contract negotiations, renewals, and competitive bidding to help you achieve optimal value.",
        questions: [
          { id: "q1", type: "rating", text: "How well did the Sourcing team understand your business needs?" },
          { id: "q2", type: "rating", text: "How effective was the collaboration and communication with the team?" },
          {
            id: "q3",
            type: "yesno",
            text: "If you submitted a SSRF before agreeing the commercials with the supplier, was the Sourcing team able to negotiate a better deal?"
          },
          { id: "q4", type: "text", text: "What went well and what could be improved?" }
        ]
      },
      {
        key: "risk_screening",
        label: "Risk Screening",
        description:
          "Supports risk screening requests as part of the sourcing and supplier management process.",
        questions: [
          { id: "q1", type: "rating", text: "How easy was it to submit a Risk Screening request?" },
          { id: "q2", type: "rating", text: "Were your requests handled in a timely manner?" },
          { id: "q3", type: "text", text: "What went well and what could be improved?" }
        ]
      }
    ],

    ratingOptions: RATING_OPTIONS,
    yesNoOptions: YES_NO_OPTIONS,
    gateOptions: GATE_OPTIONS,

    recognitionQuestion:
      "Would you like to highlight any EP&P members who have gone above and beyond in providing you with exceptional service?",

    rawImportedText: rawText
  };
}

function optionsForQuestion(config, question) {
  if (question.type === "yesno") return config.yesNoOptions;
  return config.ratingOptions;
}

function renderQuestion(config, question, namePrefix) {
  const fieldName = `${namePrefix}_${question.id}`;
  if (question.type === "text") {
    return `
            <div class="question">
              <label for="${fieldName}"><strong>${question.text}</strong></label>
              <textarea id="${fieldName}" name="${fieldName}" rows="3" placeholder="Your feedback..."></textarea>
            </div>`;
  }
  const options = optionsForQuestion(config, question);
  return `
            <div class="question">
              <p><strong>${question.text}</strong></p>
              <div class="ratings">
                ${options
                  .map(
                    (opt) => `
                <label class="radio-pill">
                  <input type="radio" name="${fieldName}" value="${opt}" />
                  <span>${opt}</span>
                </label>`
                  )
                  .join("")}
              </div>
            </div>`;
}

async function build() {
  ensureDir(outputDir);

  if (!fs.existsSync(inputDocx)) {
    throw new Error(`Word file not found: ${inputDocx}`);
  }

  const result = await mammoth.extractRawText({ path: inputDocx });
  const rawText = result.value || "";

  const config = defaultConfig(rawText);

  fs.writeFileSync(
    path.join(outputDir, "survey-config.json"),
    JSON.stringify(config, null, 2),
    "utf8"
  );

  const REMINDER_KEYS = ["buy_desk", "sourcing"];

  const serviceLineCheckboxesHtml = config.serviceLines
    .map(
      (sl) => `
            <div class="service-block">
              <label class="checkbox-row">
                <input type="checkbox" name="serviceLines" value="${sl.label}" data-slkey="${sl.key}" class="sl-checkbox" />
                <span><strong>${sl.label}</strong></span>
              </label>
              <p class="service-desc">${sl.description}</p>
            </div>`
    )
    .join("");

  const gateOptionsHtml = (key) =>
    config.gateOptions
      .map(
        (opt) => `
                <label class="radio-pill">
                  <input type="radio" name="${key}_gate" value="${opt}" />
                  <span>${opt}</span>
                </label>`
      )
      .join("");

  const serviceLineQuestionBlocksHtml = config.serviceLines
    .map(
      (sl) => `
          <div class="sl-block" data-slkey="${sl.key}">
            <h3>${sl.label}</h3>
            ${REMINDER_KEYS.includes(sl.key) ? `<p class="sl-reminder">${sl.description}</p>` : ""}
            <div class="question">
              <p><strong>How satisfied are you with ${sl.label}?</strong></p>
              <div class="ratings">${gateOptionsHtml(sl.key)}
              </div>
            </div>

            <div class="sl-subblock sl-neutral-block hidden" data-slkey="${sl.key}">
              <div class="question">
                <label for="${sl.key}_improvement"><strong>${config.improvementQuestion}</strong></label>
                <textarea id="${sl.key}_improvement" name="${sl.key}_improvement" rows="3" placeholder="Your feedback..."></textarea>
              </div>
            </div>

            <div class="sl-subblock sl-dissatisfied-block hidden" data-slkey="${sl.key}">
              ${sl.questions.map((q) => renderQuestion(config, q, sl.key)).join("")}
            </div>
          </div>`
    )
    .join("");

  const surveyHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${config.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="brand">${config.brandFull}</div>
      <h1>${config.title}</h1>

      <form id="surveyForm">

        <!-- STEP: landing -->
        <section class="step active-step" data-step="landing">
          <p>${config.introText}</p>
          <p>${config.instructionText}</p>
          <label for="email">${config.emailPrompt}</label>
          <input id="email" name="email" type="email" required placeholder="name@bcg.com" />
          <div class="nav-row nav-row-end">
            <button type="button" class="btn btn-next">Next</button>
          </div>
        </section>

        <!-- STEP: service line selection -->
        <section class="step" data-step="servicelines">
          <h2>Service Lines</h2>
          <p>${config.serviceLinePrompt}</p>
          ${serviceLineCheckboxesHtml}
          <div class="nav-row">
            <button type="button" class="btn btn-outline btn-back">Back</button>
            <button type="button" class="btn btn-next">Next</button>
          </div>
        </section>

        <!-- STEP: per-service-line satisfaction + conditional follow-up -->
        <section class="step" data-step="details">
          <h2>Tell us more</h2>
          ${serviceLineQuestionBlocksHtml}
          <div class="nav-row">
            <button type="button" class="btn btn-outline btn-back">Back</button>
            <button type="button" class="btn btn-next">Next</button>
          </div>
        </section>

        <!-- STEP: recognition (final, always shown) -->
        <section class="step" data-step="recognition">
          <h2>Recognition</h2>
          <div class="question">
            <label for="recognition"><strong>${config.recognitionQuestion}</strong></label>
            <textarea id="recognition" name="recognition" rows="4" placeholder="Name any team members..."></textarea>
          </div>
          <div class="nav-row">
            <button type="button" class="btn btn-outline btn-back">Back</button>
            <button type="submit" class="btn">Submit survey</button>
          </div>
        </section>

      </form>

      <div id="thankYou" class="hidden success">
        <h2>Thank you!</h2>
        <p>Your response has been recorded. We appreciate your feedback.</p>
        <p style="margin-top:16px"><a href="/output/dashboard.html" class="btn" style="text-decoration:none;display:inline-block">View Dashboard</a></p>
      </div>
    </div>
  </div>

  <script src="/app.js"></script>
</body>
</html>`;

  const slDefsForDashboard = config.serviceLines.map((sl) => ({
    key: sl.key,
    label: sl.label,
    questions: sl.questions.map((q) => ({ id: q.id, text: q.text, type: q.type }))
  }));

  const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>EP&P CSAT Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="brand">${config.brandFull}</div>
      <h1>EP&P CSAT Dashboard</h1>
      <p class="muted">Refresh this page anytime to see the latest results</p>
      <p style="margin-top:12px"><a href="/output/invite.html" class="btn" style="text-decoration:none;display:inline-block">Share Survey</a></p>

      <!-- Summary stats -->
      <div class="stats" id="stats"></div>

      <!-- Charts row -->
      <div class="section">
        <h2>Key Highlights</h2>
        <div class="chart-row">
          <div class="chart-box">
            <h3>Overall Satisfaction (Service Lines)</h3>
            <canvas id="chartOverall"></canvas>
          </div>
          <div class="chart-box">
            <h3>Service Line Usage</h3>
            <canvas id="chartUsage"></canvas>
          </div>
        </div>
        <div class="chart-row">
          <div class="chart-box">
            <h3>Per Service Line Avg Rating (Dissatisfied Follow-up)</h3>
            <canvas id="chartServiceLine"></canvas>
          </div>
          <div class="chart-box" id="recognitionBox">
            <h3>Recognised Team Members</h3>
            <ul id="recognitionList"></ul>
          </div>
        </div>
      </div>

      <!-- Individual responses -->
      <div class="section">
        <h2>All Responses</h2>
        <div id="responses"></div>
      </div>
    </div>
  </div>

  <script>
    const SCORE_MAP = { "Very Satisfied": 5, "Satisfied": 4, "Neutral": 3, "Dissatisfied": 2, "Very Dissatisfied": 1 };
    const GATE_SCORE_MAP = { "Satisfied": 3, "Neutral": 2, "Dissatisfied": 1 };
    const COLORS = ["#178a4b","#fbbf24","#f87171","#34d399","#9333ea","#3b82f6"];
    const SL_DEFS = ${JSON.stringify(slDefsForDashboard)};

    function nameFromEmail(email) {
      const local = (email || "").split("@")[0] || "";
      return local.split(".").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }

    function formatDate(iso) {
      const d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    }

    async function loadDashboard() {
      const res = await fetch("/api/dashboard");
      if (!res.ok) { document.body.innerHTML = '<div class="page"><div class="card"><h1>No data yet</h1></div></div>'; return; }
      const data = await res.json();
      const responses = data.responses || [];

      // --- Gate value counts (across all service line selections) ---
      let gateCount = 0, dissatisfiedCount = 0;
      const gateCounts = { "Satisfied": 0, "Neutral": 0, "Dissatisfied": 0 };
      responses.forEach(r => {
        Object.values(r.serviceLineResponses || {}).forEach(sl => {
          if (sl && sl.gate && gateCounts[sl.gate] !== undefined) {
            gateCounts[sl.gate]++;
            gateCount++;
            if (sl.gate === "Dissatisfied") dissatisfiedCount++;
          }
        });
      });

      // --- Stats ---
      document.getElementById("stats").innerHTML =
        '<div class="stat"><div class="stat-number">' + data.totalResponses + '</div><div class="stat-label">Total Responses</div></div>' +
        '<div class="stat"><div class="stat-number">' + data.averageScore + '</div><div class="stat-label">Avg Satisfaction (Service Lines)</div></div>' +
        '<div class="stat"><div class="stat-number">' + dissatisfiedCount + '</div><div class="stat-label">Dissatisfied Flags</div></div>';

      // --- Overall satisfaction doughnut (gate values) ---
      new Chart(document.getElementById("chartOverall"), {
        type: "doughnut",
        data: {
          labels: Object.keys(gateCounts),
          datasets: [{ data: Object.values(gateCounts), backgroundColor: COLORS }]
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });

      // --- Service line usage bar ---
      const usageCounts = {};
      SL_DEFS.forEach(sl => usageCounts[sl.label] = 0);
      responses.forEach(r => (r.serviceLines || []).forEach(s => { if (usageCounts[s] !== undefined) usageCounts[s]++; }));
      new Chart(document.getElementById("chartUsage"), {
        type: "bar",
        data: {
          labels: Object.keys(usageCounts),
          datasets: [{ label: "Respondents", data: Object.values(usageCounts), backgroundColor: "#178a4b" }]
        },
        options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } } }
      });

      // --- Per service line avg rating bar (only from Dissatisfied follow-up questions) ---
      const slAvgs = SL_DEFS.map(sl => {
        const ratingQIds = sl.questions.filter(q => q.type === "rating").map(q => q.id);
        const scores = [];
        responses.forEach(r => {
          const slResp = (r.serviceLineResponses || {})[sl.key];
          if (!slResp || slResp.gate !== "Dissatisfied") return;
          ratingQIds.forEach(qid => {
            const score = SCORE_MAP[slResp[qid]];
            if (score !== undefined) scores.push(score);
          });
        });
        return scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : 0;
      });
      new Chart(document.getElementById("chartServiceLine"), {
        type: "bar",
        data: {
          labels: SL_DEFS.map(s => s.label),
          datasets: [{ label: "Avg Score (out of 5)", data: slAvgs, backgroundColor: "#3b82f6" }]
        },
        options: { responsive: true, scales: { y: { min: 0, max: 5 } }, plugins: { legend: { display: false } } }
      });

      // --- Recognition list ---
      const recognitions = responses.map(r => r.recognition).filter(Boolean);
      const recList = document.getElementById("recognitionList");
      if (recognitions.length) {
        recList.innerHTML = recognitions.map(r => '<li>' + r + '</li>').join("");
      } else {
        recList.innerHTML = '<li class="muted">No recognitions yet</li>';
      }

      // --- Individual responses ---
      const container = document.getElementById("responses");
      container.innerHTML = responses.map(r => {
        const name = nameFromEmail(r.email);
        let detailHtml = "";
        if ((r.serviceLines || []).length) {
          detailHtml = (r.serviceLines || []).map(label => {
            const sl = SL_DEFS.find(s => s.label === label);
            if (!sl) return "";
            const slResp = (r.serviceLineResponses || {})[sl.key] || {};
            const gate = slResp.gate || "-";
            let extraHtml = "";
            if (gate === "Neutral" && slResp.improvement) {
              extraHtml = '<div class="qa-row"><span class="qa-q">What could we have done better?</span><span class="qa-a">' + slResp.improvement + '</span></div>';
            } else if (gate === "Dissatisfied") {
              extraHtml = sl.questions.map(q => {
                const ans = slResp[q.id];
                if (!ans) return "";
                return '<div class="qa-row"><span class="qa-q">' + q.text + '</span><span class="qa-a">' + ans + '</span></div>';
              }).join("");
            }
            return '<div class="sl-response"><div class="sl-response-title">' + label + ' &mdash; ' + gate + '</div>' + extraHtml + '</div>';
          }).join("");
        }
        return '<div class="response-card">' +
          '<div class="response-header"><strong>' + name + '</strong> <span class="muted">' + r.email + '</span></div>' +
          '<div class="response-meta">' + formatDate(r.submittedAt) + '</div>' +
          '<div><strong>Service lines used:</strong> ' + ((r.serviceLines || []).join(", ") || "-") + '</div>' + detailHtml +
          (r.recognition ? '<div><strong>Recognition:</strong> ' + r.recognition + '</div>' : '') +
        '</div>';
      }).join("");
    }
    loadDashboard();
  <\/script>
</body>
</html>`;

  const inviteHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Share EP&P Survey</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="brand">${config.brandFull}</div>
      <h1>Share the Survey</h1>
      <p>Copy the survey link below and share it with your colleagues via email, Teams, or any channel.</p>

      <!-- Copy survey link -->
      <div class="section">
        <h2>Survey Link</h2>
        <div class="copy-row">
          <input type="text" id="surveyLink" readonly class="copy-input" />
          <button class="btn" onclick="copyLink('surveyLink')">Copy</button>
        </div>
        <p id="copiedMsg" class="copied-msg hidden">Copied to clipboard!</p>
      </div>

      <!-- Copy dashboard link -->
      <div class="section">
        <h2>Dashboard Link</h2>
        <p class="muted">Share this so others can view the results too.</p>
        <div class="copy-row">
          <input type="text" id="dashLink" readonly class="copy-input" />
          <button class="btn" onclick="copyLink('dashLink')">Copy</button>
        </div>
        <p id="copiedMsg2" class="copied-msg hidden">Copied to clipboard!</p>
      </div>

      <!-- Quick compose -->
      <div class="section">
        <h2>Quick Email Compose</h2>
        <p class="muted">Enter email addresses and we'll open your email client with a pre-filled message.</p>
        <label for="emailList">Email addresses (comma separated)</label>
        <textarea id="emailList" rows="3" placeholder="alice@bcg.com, bob@bcg.com, charlie@bcg.com"></textarea>
        <div style="margin-top:12px">
          <button class="btn" onclick="openMailto()">Open in Email Client</button>
          <button class="btn btn-outline" onclick="copyEmailBody()" style="margin-left:8px">Copy Email Body</button>
        </div>
        <p id="copiedBody" class="copied-msg hidden">Email body copied!</p>
      </div>

      <div class="section" style="border-top:none;margin-top:8px">
        <a href="/output/dashboard.html" class="muted">Back to Dashboard</a>
      </div>
    </div>
  </div>

  <script>
    const base = window.location.origin;
    document.getElementById("surveyLink").value = base + "/output/survey.html";
    document.getElementById("dashLink").value = base + "/output/dashboard.html";

    function copyLink(inputId) {
      const input = document.getElementById(inputId);
      navigator.clipboard.writeText(input.value);
      const msg = inputId === "surveyLink" ? document.getElementById("copiedMsg") : document.getElementById("copiedMsg2");
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2000);
    }

    function getEmailBody() {
      const link = document.getElementById("surveyLink").value;
      return "Hi,\\n\\nAs an important internal client of EP&P in GCH, your input is critical to help us improve our services.\\n\\nPlease take two minutes to complete this survey and share your feedback:\\n\\n" + link + "\\n\\nThank you!\\nEP&P Team";
    }

    function openMailto() {
      const emails = document.getElementById("emailList").value.trim();
      if (!emails) { alert("Please enter at least one email address."); return; }
      const subject = encodeURIComponent("EP&P CSAT Survey - Your Feedback Matters");
      const body = encodeURIComponent(getEmailBody());
      window.location.href = "mailto:" + encodeURIComponent(emails) + "?subject=" + subject + "&body=" + body;
    }

    function copyEmailBody() {
      navigator.clipboard.writeText(getEmailBody().replace(/\\\\n/g, "\\n"));
      const msg = document.getElementById("copiedBody");
      msg.classList.remove("hidden");
      setTimeout(() => msg.classList.add("hidden"), 2000);
    }
  <\/script>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "survey.html"), surveyHtml, "utf8");
  fs.writeFileSync(path.join(outputDir, "dashboard.html"), dashboardHtml, "utf8");
  fs.writeFileSync(path.join(outputDir, "invite.html"), inviteHtml, "utf8");

  console.log("Survey build complete.");
  console.log("Created:");
  console.log("- output/survey.html");
  console.log("- output/dashboard.html");
  console.log("- output/invite.html");
  console.log("- output/survey-config.json");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
