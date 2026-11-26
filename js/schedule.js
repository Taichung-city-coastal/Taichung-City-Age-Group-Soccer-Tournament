(() => {
  "use strict";

  const SHEET_ID = "1ftHNzPYCmHHl9611hHOHmX5H6WUHiQ8h9PkPhUUlfcc";
  const SHEETS = { u6: "U6", u8: "U8", u10: "U10", u12: "U12", u15: "U15" };
  // 成人邀請賽固定在網站中，從不向 Google 試算表讀取或覆寫。
  const ADULT_MATCHES = Object.freeze([
    { type: "match", division: "adult", matchNo: null, date: "12/5", time: "1600-1700", field: "11人制球場", teamA: "藍鯨", score: "", teamB: "香港" },
    { type: "match", division: "adult", matchNo: null, date: "12/5", time: "1800-1900", field: "11人制球場", teamA: "櫻花", score: "", teamB: "香港" },
    { type: "match", division: "adult", matchNo: null, date: "12/5", time: "1900-2100", field: "11人制球場", teamA: "半線蒼鷹", score: "", teamB: "越南" },
    { type: "match", division: "adult", matchNo: null, date: "12/13", time: "1600-1800", field: "11人制球場", teamA: "臺中 Futuro", score: "", teamB: "臺電" }
  ]);
  const REFRESH_INTERVAL_MS = 30000;
  const TIMEOUT_MS = 12000;
  const engine = window.TaichungScheduleEngine || window.ScheduleEngine;
  const groupSelect = document.getElementById("group-select");
  const search = document.getElementById("schedule-search");
  const dateSelect = document.getElementById("schedule-date");
  const count = document.getElementById("schedule-count");
  const updated = document.getElementById("schedule-updated");
  const view = document.getElementById("schedule-view");
  const tabs = Array.from(document.querySelectorAll("[data-schedule-tab]"));
  if (!engine || !groupSelect || !view) return;

  const cache = new Map();
  let requestVersion = 0;
  let activeTab = "matches";
  let lastLoadedGroup = "";
  let requestCounter = 0;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function showState(heading, message, variant, icon) {
    const box = node("div", "schedule-empty" + (variant === "error" ? " is-error" : ""));
    box.setAttribute("role", variant === "error" ? "alert" : "status");
    box.append(
      node("div", "schedule-empty-icon", icon || "⚽"),
      node("h2", "", heading),
      node("p", "", message)
    );
    view.replaceChildren(box);
  }

  function normalizeSearch(value) {
    return String(value || "").normalize("NFKC").toLowerCase()
      .replace(/臺/g, "台").replace(/[\s\p{P}\p{S}]/gu, "");
  }

  function fuzzyMatch(value, query) {
    const name = normalizeSearch(value);
    if (name.includes(query)) return true;
    let offset = 0;
    for (const letter of query) {
      const index = name.indexOf(letter, offset);
      if (index < 0) return false;
      offset = index + 1;
    }
    return true;
  }

  function formatTime(value) {
    const input = String(value || "").trim().normalize("NFKC");
    const match = input.match(/^(\d{2})(\d{2})\s*[-–—~]\s*(\d{2})(\d{2})$/);
    return match ? match[1] + ":" + match[2] + "–" + match[3] + ":" + match[4] : input || "時間待定";
  }

  function dateLabel(date) {
    const text = String(date || "").trim();
    const match = text.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return text || "比賽日";
    const month = Number(match[1]);
    const day = Number(match[2]);
    return "2026 / " + month + " / " + day;
  }

  function formattedScore(raw) {
    const value = String(raw || "").normalize("NFKC").trim()
      .replace(/[：﹕∶]/g, ":")
      .replace(/點球大戰|十二碼|點球/g, "PK")
      .replace(/加時賽|延長賽/g, "OT");
    if (!value || /^(?:VS|待定|比分)$/.test(value)) return { primary: "VS", extras: [] };
    const compact = value.toUpperCase().replace(/P\s*\.?\s*K\.?/g, "PK").replace(/\s+/g, "");
    const main = compact.match(/^(\d+:\d+)/);
    const extra = compact.match(/OT\(?(\d+:\d+)\)?/);
    const pk = compact.match(/PK\(?(\d+:\d+)\)?/);
    const extras = [];
    if (extra) extras.push("加時 " + extra[1]);
    if (pk) extras.push("PK " + pk[1]);
    return { primary: main ? main[1] : (extra ? extra[1] : compact), extras };
  }

  function scheduleCard(match) {
    if (match.type === "event") {
      const event = node("div", "schedule-ceremony");
      event.append(node("strong", "", match.field || match.title || "大會活動"));
      event.append(node("span", "", formatTime(match.time)));
      return event;
    }

    const article = node("article", "schedule-match");
    const meta = node("div", "schedule-match-meta");
    meta.append(
      node("span", "schedule-match-no", match.division === "adult" ? "成人組邀請賽" :
        (match.matchNo != null ? "第 " + match.matchNo + " 場" : "場次待定")),
      node("strong", "schedule-match-time", formatTime(match.time))
    );

    const body = node("div", "schedule-match-body");
    const score = formattedScore(match.score);
    const center = node("div", "schedule-score" + (score.primary !== "VS" ? " is-final" : ""));
    center.append(node("strong", "", score.primary));
    score.extras.forEach((label) => center.append(node("small", "", label)));
    body.append(
      node("strong", "schedule-team", match.teamA || "待定"),
      center,
      node("strong", "schedule-team", match.teamB || "待定")
    );
    article.append(
      meta,
      body,
      node("span", "schedule-match-field", match.field
        ? (match.division === "adult" ? match.field : "場地 " + match.field)
        : "場地待定")
    );
    return article;
  }

  function renderMatchList() {
    const group = groupSelect.value;
    const cached = group === "adult"
      ? { matches: ADULT_MATCHES, updatedAt: null }
      : cache.get(group);
    if (!cached) {
      count.textContent = "";
      updated.textContent = "";
      showState("賽程載入中", "正在讀取大會 Google 試算表...", "pending", "⏳");
      return;
    }

    const records = cached.matches;
    const searchTerm = normalizeSearch(search.value);
    const date = dateSelect.value;
    const visible = records.filter((match) =>
      (!date || match.date === date) &&
      (!searchTerm || (match.type !== "event" &&
        (fuzzyMatch(match.teamA, searchTerm) || fuzzyMatch(match.teamB, searchTerm))))
    );
    const total = records.filter((record) => record.type === "match").length;
    const filteredCount = visible.filter((record) => record.type === "match").length;
    count.textContent = searchTerm || date
      ? "找到 " + filteredCount + " 場比賽（共 " + total + " 場）"
      : "共 " + total + " 場比賽";
    updated.textContent = group === "adult"
      ? "大會固定賽程"
      : "最後更新 " + cached.updatedAt.toLocaleTimeString("zh-TW", {
        hour: "2-digit", minute: "2-digit"
      });

    if (!visible.length) {
      showState("找不到符合的賽程", "請調整日期或隊伍名稱，搜尋其他場次。", "pending", "🔎");
      return;
    }
    const fragment = document.createDocumentFragment();
    const byDate = new Map();
    visible.forEach((match) => {
      const key = match.date || "比賽日";
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(match);
    });
    byDate.forEach((matches, key) => {
      const section = node("section", "schedule-day");
      const heading = node("div", "schedule-day-heading");
      heading.append(
        node("h2", "", dateLabel(key)),
        node("span", "", matches.filter((match) => match.type === "match").length + " 場比賽")
      );
      const list = node("div", "schedule-match-list");
      matches.forEach((match) => list.append(scheduleCard(match)));
      section.append(heading, list);
      fragment.append(section);
    });
    view.replaceChildren(fragment);
  }

  function render() {
    const isMatches = activeTab === "matches";
    const isAdult = groupSelect.value === "adult";
    search.disabled = !isMatches;
    dateSelect.disabled = !isMatches;
    tabs.forEach((button) => {
      const unavailable = isAdult && button.dataset.scheduleTab !== "matches";
      button.hidden = unavailable;
      button.disabled = unavailable;
    });
    document.querySelector(".schedule-tabs")?.classList.toggle("is-single-tab", isAdult);
    if (activeTab !== "bracket") window.TaichungBracketView?.cleanup();
    if (isAdult) {
      renderMatchList();
      return;
    }
    if (activeTab === "groups") {
      const groups = engine.GROUPS[groupSelect.value] || {};
      const cached = cache.get(groupSelect.value);
      count.textContent = Object.keys(groups).length + " 個小組 · " +
        Object.values(groups).reduce((sum, teams) => sum + teams.length, 0) + " 支隊伍";
      updated.textContent = cached
        ? "比分最後更新 " + cached.updatedAt.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
        : "分組名單已固定 · 比分待同步";
      view.replaceChildren(window.TaichungGroupView.render(groupSelect.value, cached?.matches || []));
      return;
    }
    if (activeTab === "bracket") {
      const cached = cache.get(groupSelect.value);
      count.textContent = "對戰階梯圖 · " + groupSelect.value.toUpperCase();
      updated.textContent = cached
        ? "比分最後更新 " + cached.updatedAt.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
        : "固定籤表已載入 · 比分待同步";
      const result = window.TaichungBracketView.render(groupSelect.value, cached?.matches || []);
      view.replaceChildren(result.content);
      result.activate();
      return;
    }
    renderMatchList();
  }

  function setActiveTab(tab) {
    if (groupSelect.value === "adult" && tab !== "matches") return;
    activeTab = tab;
    tabs.forEach((button) => {
      const selected = button.dataset.scheduleTab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    view.setAttribute("aria-labelledby", "schedule-tab-" + tab);
    render();
  }

  function rowsFromGviz(payload) {
    if (!payload || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)) {
      throw new Error("試算表未提供可使用的賽程");
    }
    const rows = payload.table.rows.map((row) => {
      const cells = row.c || [];
      return Array.from({ length: 8 }, (_, i) => {
        const cell = cells[i];
        return cell && cell.v != null ? String(cell.f != null ? cell.f : cell.v) : "";
      });
    });
    if (rows.length < 3 || rows[1][0].trim() !== "日期" ||
        rows[1][3].trim() !== "場次" || rows[1][6].trim() !== "成績") {
      throw new Error("賽程資料格式不符");
    }
    return rows;
  }

  function requestSheet(sheetName) {
    return new Promise((resolve, reject) => {
      // Google gviz does not expose CORS headers; use its documented responseHandler.
      const callback = "__taichungSchedule" + (++requestCounter);
      const script = document.createElement("script");
      let finished = false;
      let timer;
      function settle(error, value) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        script.remove();
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        if (error) reject(error);
        else resolve(value);
      }
      window[callback] = (payload) => {
        try { settle(null, rowsFromGviz(payload)); }
        catch (error) { settle(error); }
      };
      script.async = true;
      script.onerror = () => settle(new Error("無法連線 Google 試算表"));
      timer = window.setTimeout(() => settle(new Error("讀取賽程逾時")), TIMEOUT_MS);
      const tqx = encodeURIComponent("out:json;responseHandler:" + callback);
      script.src = "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
        "/gviz/tq?tqx=" + tqx + "&sheet=" + encodeURIComponent(sheetName) +
        "&t=" + Date.now();
      document.head.append(script);
    });
  }

  function updateDates(group) {
    const cached = group === "adult" ? { matches: ADULT_MATCHES } : cache.get(group);
    const previous = dateSelect.value;
    const dates = cached ? [...new Set(cached.matches.map((match) => match.date).filter(Boolean))] : [];
    dateSelect.replaceChildren(new Option("全部日期", ""));
    dates.forEach((date) => dateSelect.add(new Option(dateLabel(date), date)));
    dateSelect.value = dates.includes(previous) ? previous : "";
  }

  async function refresh(force) {
    const group = groupSelect.value;
    if (group === "adult") return;
    const activeVersion = ++requestVersion;
    const isFirst = !cache.has(group);
    if (activeTab === "matches" && isFirst) render();
    try {
      const rows = await requestSheet(SHEETS[group]);
      if (activeVersion !== requestVersion || groupSelect.value !== group) return;
      const matches = engine.normalizeData(rows, group);
      if (!Array.isArray(matches) || !matches.some((item) => item.type === "match")) {
        throw new Error("沒有找到有效比賽場次");
      }
      const signature = JSON.stringify(matches);
      const earlier = cache.get(group);
      cache.set(group, { matches, signature, updatedAt: new Date() });
      if (isFirst || earlier?.signature !== signature || force) {
        updateDates(group);
        render();
      } else {
        updated.textContent = "最後更新 " + new Date().toLocaleTimeString("zh-TW", {
          hour: "2-digit", minute: "2-digit"
        });
      }
    } catch (error) {
      if (activeVersion !== requestVersion || groupSelect.value !== group) return;
      console.warn("賽程更新失敗", group, error);
      if (!cache.has(group) && activeTab === "matches") {
        count.textContent = "無法取得賽程";
        updated.textContent = "更新失敗";
        showState("賽程載入失敗", "無法讀取 Google 試算表，請確認連線後重新載入。", "error", "!");
        const retry = node("button", "button button-primary", "重新載入");
        retry.type = "button";
        retry.addEventListener("click", () => refresh(true));
        view.querySelector(".schedule-empty").append(retry);
      } else {
        updated.textContent = activeTab === "groups" || activeTab === "bracket"
          ? "比分更新失敗 · 固定分組名單仍可查看"
          : "更新失敗 · 顯示上次讀取資料";
      }
    }
  }

  function selectGroup() {
    const changedByUser = lastLoadedGroup !== "" && lastLoadedGroup !== groupSelect.value;
    requestVersion += 1; // Discard slow responses from previously selected divisions.
    activeTab = "matches";
    view.setAttribute("aria-labelledby", "schedule-tab-matches");
    tabs.forEach((button) => {
      const active = button.dataset.scheduleTab === activeTab;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    search.value = "";
    dateSelect.value = "";
    updateDates(groupSelect.value);
    render();
    if (groupSelect.value !== "adult") refresh(false);
    lastLoadedGroup = groupSelect.value;
    if (changedByUser) {
      document.querySelector(".schedule-tabs")?.scrollIntoView({ block: "start" });
    }
  }

  tabs.forEach((button, index) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.scheduleTab));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      setActiveTab(next.dataset.scheduleTab);
      next.focus();
    });
  });
  search.addEventListener("input", () => { if (activeTab === "matches") render(); });
  dateSelect.addEventListener("change", () => { if (activeTab === "matches") render(); });
  document.addEventListener("taichung:group-changed", (event) => {
    if (event.detail.group !== lastLoadedGroup) selectGroup();
  });
  selectGroup();
  window.setInterval(() => {
    if (!document.hidden && groupSelect.value !== "adult") {
      refresh(false);
    }
  }, REFRESH_INTERVAL_MS);
})();
