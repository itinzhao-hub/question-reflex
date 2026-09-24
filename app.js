const startBtn = document.getElementById("startBtn");
const replayBtn = document.getElementById("replayBtn");
const ttsFallback = document.getElementById("ttsFallback");
const audioMode = document.getElementById("audioMode");
const availabilityEl = document.getElementById("availability");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const feedbackEl = document.getElementById("feedback");
const wrongReviewEl = document.getElementById("wrongReview");
const wrongSourceTextEl = document.getElementById("wrongSourceText");
const wrongCorrectAnswerEl = document.getElementById("wrongCorrectAnswer");
const nextAfterWrongBtn = document.getElementById("nextAfterWrongBtn");
const choiceButtons = [...document.querySelectorAll(".choice")];

const nTrialsEl = document.getElementById("nTrials");
const accuracyEl = document.getElementById("accuracy");
const medianRtEl = document.getElementById("medianRt");
const under1sEl = document.getElementById("under1s");
const earlyRateEl = document.getElementById("earlyRate");

const refreshStatsBtn = document.getElementById("refreshStatsBtn");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const lifetimeSummaryEl = document.getElementById("lifetimeSummary");
const familyBody = document.getElementById("familyBody");
const speedBody = document.getElementById("speedBody");
const profileBody = document.getElementById("profileBody");
const sessionsBody = document.getElementById("sessionsBody");

let running = false;
let current = null;
let currentChoices = [];
let currentVariant = null;
let lastId = null;
let sessionId = null;
let sessionStartedAt = null;

let audioEndedAt = null;
let responseAt = null;
let responseKey = null;
let awaitingAudioEnd = false;
let answered = false;
let currentAudio = null;
let currentUtterance = null;
let fallbackStarted = false;
let responseLocked = false;
let waitingAfterWrong = false;

const sessionResults = [];

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function variantsForMode(item, mode = audioMode.value) {
  const all = item.audioVariants || [];
  if (mode === "mixed") return all;
  if (mode === "female") return all.filter(v => v.gender === "FEMALE");
  if (mode === "male") return all.filter(v => v.gender === "MALE");
  if (mode === "normal") return all.filter(v => v.speedClass === "normal");
  if (mode === "fast") return all.filter(v => v.speedClass === "fast");
  if (mode === "slow") return all.filter(v => v.speedClass === "slow");
  return all;
}

function eligibleStimuli() {
  if (ttsFallback.checked) return window.STIMULI;
  return window.STIMULI.filter(item => variantsForMode(item).length > 0);
}

function updateAvailability() {
  const eligible = eligibleStimuli();
  const total = window.STIMULI.length;
  const modeText = audioMode.options[audioMode.selectedIndex].text;
  availabilityEl.textContent =
    `当前音源“${modeText}”：${eligible.length}/${total} 条刺激可用` +
    (ttsFallback.checked ? "（允许浏览器 TTS 补缺）" : "（仅固定 MP3）");
}

function pickStimulus() {
  const eligible = eligibleStimuli();
  if (!eligible.length) return null;

  let pool = eligible.filter(x => x.id !== lastId);
  if (!pool.length) pool = eligible;

  const item = pickOne(pool);
  lastId = item.id;
  return item;
}

function chooseAudioVariant(item) {
  const choices = variantsForMode(item);
  return choices.length ? pickOne(choices) : null;
}

function enableChoices(enabled) {
  choiceButtons.forEach(btn => btn.disabled = !enabled);
}

function resetChoiceStyles() {
  choiceButtons.forEach(btn => btn.classList.remove("correct", "wrong"));
}

function hideWrongReview() {
  waitingAfterWrong = false;
  wrongReviewEl.hidden = true;
  wrongSourceTextEl.textContent = "";
  wrongCorrectAnswerEl.textContent = "";
}

function showWrongReview() {
  waitingAfterWrong = true;
  wrongSourceTextEl.textContent = current.text;
  wrongCorrectAnswerEl.textContent = current.answer;
  wrongReviewEl.hidden = false;
  nextAfterWrongBtn.focus({ preventScroll: true });
}

function continueAfterWrong() {
  if (!running || !waitingAfterWrong) return;
  hideWrongReview();
  nextTrial();
}

function renderChoices(item) {
  const d = item.distractorPools;
  const distractors = [
    pickOne(d.semantic),
    pickOne(d.person),
    pickOne(d.structure)
  ];

  currentChoices = shuffle([item.answer, ...distractors]);

  choiceButtons.forEach((btn, i) => {
    btn.querySelector("span").textContent = currentChoices[i];
  });
}

function stopPlayback() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  currentUtterance = null;
}

function makeSessionId() {
  return "S_" + new Date().toISOString().replace(/[-:.TZ]/g, "") +
    "_" + Math.random().toString(36).slice(2, 8);
}

async function beginSession() {
  sessionId = makeSessionId();
  sessionStartedAt = new Date().toISOString();
  sessionResults.length = 0;

  await QR_DB.putSession({
    id: sessionId,
    startedAt: sessionStartedAt,
    endedAt: null,
    audioMode: audioMode.value,
    fallbackEnabled: ttsFallback.checked,
    trials: 0
  });
}

async function endSession() {
  if (!sessionId) return;
  const existing = await QR_DB.getSession(sessionId);

  await QR_DB.putSession({
    ...(existing || { id: sessionId, startedAt: sessionStartedAt }),
    endedAt: new Date().toISOString(),
    audioMode: existing?.audioMode || audioMode.value,
    fallbackEnabled: existing?.fallbackEnabled ?? ttsFallback.checked,
    trials: sessionResults.length
  });

  sessionId = null;
  sessionStartedAt = null;
  await refreshAnalytics();
}

async function playStimulus({keepVariant = false} = {}) {
  stopPlayback();
  audioEndedAt = null;
  responseAt = null;
  responseKey = null;
  awaitingAudioEnd = true;
  answered = false;
  responseLocked = false;
  fallbackStarted = false;

  timerEl.textContent = "播放中…";
  feedbackEl.textContent = "";
  hideWrongReview();
  resetChoiceStyles();
  enableChoices(true);

  if (!keepVariant || !currentVariant) {
    currentVariant = chooseAudioVariant(current);
  }

  if (currentVariant) {
    const audio = new Audio(currentVariant.path);
    currentAudio = audio;
    audio.onended = () => finishAudio(performance.now());

    audio.onerror = () => {
      if (ttsFallback.checked && !fallbackStarted) {
        fallbackStarted = true;
        speakFallback(current.text);
      } else {
        statusEl.textContent = `固定 MP3 无法播放：${currentVariant.path}`;
        enableChoices(false);
      }
    };

    try {
      await audio.play();
      statusEl.textContent =
        `${current.id} · ${currentVariant.profile} · ` +
        `${currentVariant.voice} · rate ${currentVariant.speakingRate}`;
      return;
    } catch {
      if (ttsFallback.checked && !fallbackStarted) {
        fallbackStarted = true;
        speakFallback(current.text);
        return;
      }
      statusEl.textContent = `无法播放固定 MP3：${currentVariant.path}`;
      enableChoices(false);
      return;
    }
  }

  if (ttsFallback.checked && ("speechSynthesis" in window)) {
    if (!fallbackStarted) {
      fallbackStarted = true;
      speakFallback(current.text);
    }
  } else {
    statusEl.textContent = `${current.id} 在当前音源模式下没有固定 MP3。`;
    enableChoices(false);
  }
}

function speakFallback(text) {
  stopPlayback();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 1.0;

  const voices = speechSynthesis.getVoices();
  const frenchVoice = voices.find(v =>
    v.lang && v.lang.toLowerCase().startsWith("fr")
  );
  if (frenchVoice) utterance.voice = frenchVoice;

  currentVariant = null;
  currentUtterance = utterance;

  utterance.onend = () => finishAudio(performance.now());
  utterance.onerror = () => {
    statusEl.textContent = "浏览器 TTS 无法播放。";
    enableChoices(false);
  };

  statusEl.textContent = `${current.id} · 浏览器 TTS fallback`;
  speechSynthesis.speak(utterance);
}

async function replayForReview() {
  if (!current || !waitingAfterWrong) return;

  stopPlayback();

  if (currentVariant) {
    const audio = new Audio(currentVariant.path);
    currentAudio = audio;

    try {
      await audio.play();
      statusEl.textContent =
        `${current.id} · 复盘重播 · ${currentVariant.profile}`;
      return;
    } catch (err) {
      console.error(err);
    }
  }

  if (ttsFallback.checked && ("speechSynthesis" in window)) {
    const utterance = new SpeechSynthesisUtterance(current.text);
    utterance.lang = "fr-FR";
    utterance.rate = 1.0;

    const voices = speechSynthesis.getVoices();
    const frenchVoice = voices.find(v =>
      v.lang && v.lang.toLowerCase().startsWith("fr")
    );
    if (frenchVoice) utterance.voice = frenchVoice;

    currentUtterance = utterance;
    statusEl.textContent = `${current.id} · 复盘重播 · 浏览器 TTS`;
    speechSynthesis.speak(utterance);
  }
}

function finishAudio(t) {
  if (!awaitingAudioEnd) return;
  audioEndedAt = t;
  awaitingAudioEnd = false;

  if (responseAt !== null) finalizeAnswer();
  else timerEl.textContent = "0 ms";
}

function handleAnswer(index) {
  if (!running || answered || responseLocked) return;
  if (index < 0 || index > 3) return;

  responseLocked = true;
  responseAt = performance.now();
  responseKey = index;
  enableChoices(false);

  if (audioEndedAt !== null) finalizeAnswer();
  else timerEl.textContent = "提前作答";
}

async function finalizeAnswer() {
  if (answered || responseAt === null || audioEndedAt === null) return;
  answered = true;

  const chosen = currentChoices[responseKey];
  const correct = chosen === current.answer;
  const rt = Math.round(responseAt - audioEndedAt);

  timerEl.textContent = `${rt >= 0 ? "" : "−"}${Math.abs(rt)} ms`;

  choiceButtons.forEach((btn, i) => {
    const text = currentChoices[i];
    if (text === current.answer) btn.classList.add("correct");
    if (i === responseKey && !correct) btn.classList.add("wrong");
  });

  feedbackEl.textContent = correct
    ? (rt <= 1000 ? "✓" : "✓ 但超过 1 秒")
    : "✗";

  const trial = {
    sessionId,
    timestamp: new Date().toISOString(),

    stimulusId: current.id,
    text: current.text,
    family: current.family || "",
    person: current.person || "",
    function: current.function || "",
    auxOrVerb: current.auxOrVerb || "",

    chosen,
    correctAnswer: current.answer,
    correct,
    rt,
    early: rt < 0,
    within1s: correct && rt <= 1000,

    audioMode: audioMode.value,
    audioProfile: currentVariant ? currentVariant.profile : "browser_tts",
    voice: currentVariant ? currentVariant.voice : "",
    gender: currentVariant ? currentVariant.gender : "",
    speedClass: currentVariant ? currentVariant.speedClass : "",
    speakingRate: currentVariant ? currentVariant.speakingRate : null,
    pitch: currentVariant ? currentVariant.pitch : null
  };

  sessionResults.push(trial);

  try {
    await QR_DB.addTrial(trial);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "作答已完成，但 IndexedDB 写入失败。";
  }

  updateSessionStats();
  enableChoices(false);

  if (correct) {
    setTimeout(() => {
      if (running && !waitingAfterWrong) nextTrial();
    }, 420);
  } else {
    showWrongReview();
    statusEl.textContent = `${current.id} · 回答错误 · 请复盘后手动进入下一题`;
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

function summarize(rows) {
  const n = rows.length;
  if (!n) {
    return { n: 0, accuracy: null, under1s: null, earlyRate: null, medianRt: null, p90Rt: null };
  }

  const correctRows = rows.filter(r => r.correct);
  const correctRts = correctRows.map(r => Number(r.rt)).filter(Number.isFinite);
  const sorted = [...correctRts].sort((a, b) => a - b);

  return {
    n,
    accuracy: correctRows.length / n,
    under1s: rows.filter(r => r.within1s).length / n,
    earlyRate: rows.filter(r => r.early).length / n,
    medianRt: median(correctRts),
    p90Rt: percentile(sorted, 0.90)
  };
}

function pct(x) {
  return x == null ? "—" : `${(x * 100).toFixed(1)}%`;
}

function rtText(x) {
  return x == null ? "—" : `${x} ms`;
}

function updateSessionStats() {
  const s = summarize(sessionResults);
  nTrialsEl.textContent = s.n;
  accuracyEl.textContent = pct(s.accuracy);
  medianRtEl.textContent = rtText(s.medianRt);
  under1sEl.textContent = pct(s.under1s);
  earlyRateEl.textContent = pct(s.earlyRate);
}

function nextTrial() {
  hideWrongReview();
  current = pickStimulus();

  if (!current) {
    running = false;
    startBtn.textContent = "开始训练";
    replayBtn.disabled = true;
    enableChoices(false);
    statusEl.textContent =
      "当前音源模式没有可训练的固定 MP3。请切换音源，或仅在调试时启用浏览器 TTS。";
    return;
  }

  currentVariant = null;
  renderChoices(current);
  playStimulus();
}

function groupRows(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "未标记";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function fillGroupedTable(tbody, rows, keyFn, includeUnder1s = false) {
  tbody.innerHTML = "";
  const groups = [...groupRows(rows, keyFn).entries()]
    .sort((a, b) => b[1].length - a[1].length);

  for (const [key, group] of groups) {
    const s = summarize(group);
    const tr = document.createElement("tr");

    const cols = includeUnder1s
      ? [key, s.n, pct(s.accuracy), pct(s.under1s), rtText(s.medianRt), rtText(s.p90Rt)]
      : [key, s.n, pct(s.accuracy), rtText(s.medianRt), rtText(s.p90Rt)];

    for (const value of cols) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

async function refreshAnalytics() {
  let trials = [];
  let sessions = [];

  try {
    [trials, sessions] = await Promise.all([
      QR_DB.getAllTrials(),
      QR_DB.getAllSessions()
    ]);
  } catch (err) {
    console.error(err);
    lifetimeSummaryEl.innerHTML =
      "<div><strong>IndexedDB 错误</strong><span>请使用 start_local.bat 启动</span></div>";
    return;
  }

  const s = summarize(trials);
  lifetimeSummaryEl.innerHTML = `
    <div><strong>${s.n}</strong><span>累计题数</span></div>
    <div><strong>${pct(s.accuracy)}</strong><span>累计正确率</span></div>
    <div><strong>${pct(s.under1s)}</strong><span>≤1s 正确率</span></div>
    <div><strong>${rtText(s.medianRt)}</strong><span>中位 RT</span></div>
    <div><strong>${rtText(s.p90Rt)}</strong><span>P90 RT</span></div>
  `;

  fillGroupedTable(familyBody, trials, r => r.family, true);
  fillGroupedTable(speedBody, trials, r => r.speedClass || r.audioProfile, false);
  fillGroupedTable(profileBody, trials, r => r.audioProfile, false);

  sessionsBody.innerHTML = "";
  const bySession = groupRows(trials, r => r.sessionId);

  const sortedSessions = [...sessions]
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .slice(0, 20);

  for (const session of sortedSessions) {
    const group = bySession.get(session.id) || [];
    const ss = summarize(group);
    const tr = document.createElement("tr");

    const started = session.startedAt
      ? new Date(session.startedAt).toLocaleString()
      : "—";

    const cols = [
      started,
      ss.n,
      pct(ss.accuracy),
      rtText(ss.medianRt),
      session.audioMode || "—"
    ];

    for (const value of cols) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }

    sessionsBody.appendChild(tr);
  }
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

async function exportCsv() {
  const rows = await QR_DB.getAllTrials();

  if (!rows.length) {
    alert("目前没有训练记录。");
    return;
  }

  const columns = [
    "id","sessionId","timestamp",
    "stimulusId","text","family","person","function","auxOrVerb",
    "chosen","correctAnswer","correct","rt","early","within1s",
    "audioMode","audioProfile","voice","gender","speedClass","speakingRate","pitch"
  ];

  const lines = [
    columns.join(","),
    ...rows.map(row => columns.map(c => csvEscape(row[c])).join(","))
  ];

  const blob = new Blob(
    ["\ufeff" + lines.join("\r\n")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `question_reflex_trials_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

startBtn.addEventListener("click", async () => {
  if (!running) {
    if (!eligibleStimuli().length) {
      updateAvailability();
      statusEl.textContent = "当前模式没有可用固定 MP3。";
      return;
    }

    running = true;
    startBtn.textContent = "停止";
    replayBtn.disabled = false;
    audioMode.disabled = true;
    ttsFallback.disabled = true;

    await beginSession();
    nextTrial();
  } else {
    running = false;
    startBtn.textContent = "开始训练";
    replayBtn.disabled = true;
    audioMode.disabled = false;
    ttsFallback.disabled = false;

    stopPlayback();
    hideWrongReview();
    enableChoices(false);
    statusEl.textContent = "已停止";
    timerEl.textContent = "—";

    await endSession();
  }
});

replayBtn.addEventListener("click", () => {
  if (!running || !current) return;

  if (waitingAfterWrong) {
    replayForReview();
  } else {
    playStimulus({keepVariant: true});
  }
});

choiceButtons.forEach((btn, i) => {
  btn.addEventListener("click", () => handleAnswer(i));
});

nextAfterWrongBtn.addEventListener("click", continueAfterWrong);

document.addEventListener("keydown", event => {
  if (waitingAfterWrong) {
    if (event.key === "Enter" || event.key === " " || event.key.toLowerCase() === "n") {
      event.preventDefault();
      continueAfterWrong();
    }
    return;
  }

  if (["1","2","3","4"].includes(event.key)) {
    handleAnswer(Number(event.key) - 1);
  }
});

audioMode.addEventListener("change", updateAvailability);
ttsFallback.addEventListener("change", updateAvailability);
refreshStatsBtn.addEventListener("click", refreshAnalytics);
exportBtn.addEventListener("click", exportCsv);

clearBtn.addEventListener("click", async () => {
  const ok = confirm(
    "确定清空这个浏览器中所有训练记录吗？\n\n此操作不会删除题库或 MP3，但无法撤销。"
  );
  if (!ok) return;

  await QR_DB.clearAll();
  sessionResults.length = 0;
  updateSessionStats();
  await refreshAnalytics();
});

window.addEventListener("beforeunload", () => {
  stopPlayback();
});

(async function init() {
  updateAvailability();
  updateSessionStats();

  try {
    await QR_DB.open();
    await refreshAnalytics();
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "IndexedDB 初始化失败。请使用 start_local.bat 从 http://localhost 启动，而不要双击 index.html。";
  }

  if ("speechSynthesis" in window) speechSynthesis.getVoices();
})();
