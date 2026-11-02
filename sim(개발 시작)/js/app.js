(function () {
  const SAVE_KEY = "sim.saved.v1";
  const THEME_KEY = "sim.theme";
  const BROADCAST_KEY = "sim.broadcasts.v1";
  const TITLES = {
    home: "축구 중계 속 영어",
    dict: "중계 영어 사전",
    match: "영상 속 표현",
    saved: "저장한 표현",
    settings: "설정"
  };

  const state = {
    view: "home",
    category: "all",
    saved: loadSaved(),
    broadcasts: loadBroadcasts(),
    activeVideoId: "",
    pendingVideoId: ""
  };

  let player = null;
  let playerReady = false;
  let pendingVideo = "";

  const $ = (id) => document.getElementById(id);

  function loadSaved() {
    try {
      return new Set(JSON.parse(localStorage.getItem(SAVE_KEY)) || []);
    } catch (error) {
      return new Set();
    }
  }

  function persistSaved() {
    localStorage.setItem(SAVE_KEY, JSON.stringify([...state.saved]));
  }

  function loadBroadcasts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BROADCAST_KEY));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.id && Array.isArray(item.items));
    } catch (error) {
      return [];
    }
  }

  function persistBroadcasts() {
    localStorage.setItem(BROADCAST_KEY, JSON.stringify(state.broadcasts));
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === "light" ? "#ffffff" : "#071018";
    document.querySelectorAll('[data-action="set-theme"]').forEach((button) => {
      const on = button.dataset.theme === next;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function catLabel(id) {
    const found = (window.SIM_CATEGORIES || []).find((item) => item.id === id);
    return found ? found.label : id;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function highlight(text, start, end) {
    return `${escapeHtml(text.slice(0, start))}<mark>${escapeHtml(text.slice(start, end))}</mark>${escapeHtml(text.slice(end))}`;
  }

  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function bookmarkButton(id) {
    const on = state.saved.has(id);
    return `<button type="button" class="icon-btn ${on ? "is-on" : ""}" data-action="toggle-save" data-id="${id}" aria-pressed="${on}" aria-label="표현 저장">
      <i class="fa-${on ? "solid" : "regular"} fa-bookmark"></i>
    </button>`;
  }

  function refreshBookmarks(id) {
    document.querySelectorAll(`[data-action="toggle-save"][data-id="${id}"]`).forEach((button) => {
      const on = state.saved.has(id);
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(on));
      button.innerHTML = `<i class="fa-${on ? "solid" : "regular"} fa-bookmark"></i>`;
    });
  }

  function showView(view) {
    state.view = TITLES[view] ? view : "home";
    document.querySelectorAll(".view").forEach((section) => {
      section.hidden = section.dataset.view !== state.view;
    });
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.nav === state.view);
    });
    $("view-title").textContent = TITLES[state.view];
    if (state.view === "home") renderHome();
    if (state.view === "dict") renderDict();
    if (state.view === "saved") renderSaved();
    if (state.view === "settings") applyTheme(currentTheme());
    if (state.view === "match") {
      const typed = window.SIM.parseVideoId($("yt-url").value);
      if (typed && typed !== state.activeVideoId) {
        state.activeVideoId = state.broadcasts.some((item) => item.id === typed) ? typed : "";
      } else if (!typed && state.activeVideoId) {
        const current = activeBroadcast();
        if (current) $("yt-url").value = current.url;
      }
      const current = activeBroadcast();
      if (current && window.SIM.parseVideoId($("yt-url").value) === current.id) cueVideo(current.id);
      renderBroadcasts();
    }
    document.querySelector(".main").scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function routeFromHash() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const head = parts[0] || "home";
    if (head === "term" && parts[1]) {
      if (state.view === "home") showView("dict");
      openTerm(parts[1]);
      return;
    }
    closeSheet(true);
    showView(TITLES[head] ? head : "home");
  }

  function go(view) {
    const next = view === "home" ? "#/" : `#/${view}`;
    if (location.hash !== next) location.hash = next;
    else routeFromHash();
  }

  function renderHome() {
    const term = termOfDay();
    const total = window.SIM_TERMS.length;
    $("home-mount").innerHTML = `
      <article class="hero-card">
        <span class="kicker">오늘의 표현</span>
        <h2>${escapeHtml(term.term)}</h2>
        <p class="say">${escapeHtml(term.say)} · ${escapeHtml(term.ko)}</p>
        <p>${escapeHtml(term.blurb)}</p>
        <blockquote class="quote">
          <p>${escapeHtml(term.example)}</p>
          <p class="ko">${escapeHtml(term.exampleKo)}</p>
        </blockquote>
        <div class="row-actions">
          <button type="button" class="btn btn-primary" data-action="open-term" data-id="${term.id}">설명 보기</button>
          <button type="button" class="btn btn-ghost" data-action="speak-term" data-id="${term.id}"><i class="fa-solid fa-volume-high"></i> 발음</button>
        </div>
      </article>
      <div class="quick-grid">
        <a class="feature-link" href="#/dict"><i class="fa-solid fa-book-open"></i><span><strong>사전 ${total}개</strong><span>전술, 슈팅, 중계 표현을 상황과 함께</span></span></a>
        <a class="feature-link" href="#/match"><i class="fa-brands fa-youtube"></i><span><strong>영상에서 찾기</strong><span>자막과 음성에서 용어를 시간순으로</span></span></a>
        <a class="feature-link" href="#/saved"><i class="fa-solid fa-bookmark"></i><span><strong>저장 ${state.saved.size}개</strong><span>다시 보고 싶은 표현만 모아 둡니다</span></span></a>
      </div>
      <p class="section-label">바로 들어 보기</p>
      <div class="chips">
        ${["offside-trap", "screamer", "clean-sheet", "high-press", "brace", "nutmeg"].map((id) => {
          const item = window.SIM.termById(id);
          return `<button type="button" class="chip term-chip" data-action="open-term" data-id="${id}">${escapeHtml(item.term)}</button>`;
        }).join("")}
      </div>`;
  }

  function termOfDay() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const day = Math.floor((now - start) / 86400000);
    return window.SIM_TERMS[day % window.SIM_TERMS.length];
  }

  function filteredTerms() {
    const query = $("dict-search").value.trim().toLowerCase();
    return window.SIM_TERMS
      .map((term) => ({ term, score: scoreTerm(term, query) }))
      .filter((item) => item.score > 0 && (state.category === "all" || item.term.cat === state.category))
      .sort((a, b) => b.score - a.score || a.term.term.localeCompare(b.term.term))
      .map((item) => item.term);
  }

  function scoreTerm(term, query) {
    if (!query) return 1;
    const termName = term.term.toLowerCase();
    const blob = [term.term, term.ko, term.blurb, term.body, term.usage, term.example, term.exampleKo, ...(term.aliases || [])]
      .join(" ")
      .toLowerCase();
    if (!blob.includes(query)) return 0;
    if (termName === query || term.ko === query) return 100;
    if (termName.startsWith(query) || term.ko.startsWith(query)) return 80;
    if (termName.includes(query) || term.ko.includes(query)) return 60;
    return 30;
  }

  function renderDict() {
    const list = filteredTerms();
    $("dict-count").textContent = `${list.length}개 표현`;
    document.querySelectorAll("#cat-chips .chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.cat === state.category);
    });
    if (!list.length) {
      $("dict-list").innerHTML = `<div class="empty">사전에 없는 검색어입니다. 영어 철자나 한글 뜻을 바꿔 보세요.</div>`;
      return;
    }
    $("dict-list").innerHTML = list.map((term) => `
      <article class="term-card">
        <div class="card-top">
          <span class="cat">${escapeHtml(catLabel(term.cat))}</span>
          ${bookmarkButton(term.id)}
        </div>
        <h3>${escapeHtml(term.term)}</h3>
        <p class="say">${escapeHtml(term.ko)} · ${escapeHtml(term.say)}</p>
        <p class="clamp">${escapeHtml(term.blurb)}</p>
        <button type="button" class="text-btn" data-action="open-term" data-id="${term.id}" style="padding:0.45rem 0.7rem;align-self:flex-start">설명 열기</button>
      </article>`).join("");
  }

  function renderSaved() {
    const items = window.SIM_TERMS.filter((term) => state.saved.has(term.id));
    if (!items.length) {
      $("saved-mount").innerHTML = `
        <div class="saved-empty panel">
          <h2>아직 저장한 표현이 없습니다</h2>
          <p class="lede">사전이나 영상 분석에서 북마크를 누르면 이 기기에 남습니다.</p>
          <button type="button" class="btn btn-primary" data-nav="dict">사전으로 가기</button>
        </div>`;
      return;
    }
    $("saved-mount").innerHTML = `
      <p class="result-count">${items.length}개를 이 브라우저에 저장해 두었습니다.</p>
      <div class="saved-grid">
        ${items.map((term) => `
          <article class="term-card">
            <div class="card-top"><span class="cat">${escapeHtml(catLabel(term.cat))}</span>${bookmarkButton(term.id)}</div>
            <h3>${escapeHtml(term.term)}</h3>
            <p>${escapeHtml(term.blurb)}</p>
            <button type="button" class="text-btn" data-action="open-term" data-id="${term.id}" style="padding:0.45rem 0.7rem;align-self:flex-start">다시 보기</button>
          </article>`).join("")}
      </div>`;
  }

  function openTerm(id) {
    const term = window.SIM.termById(id);
    if (!term) return;
    const related = (term.related || [])
      .map((relatedId) => window.SIM.termById(relatedId))
      .filter(Boolean);
    $("sheet-panel").innerHTML = `
      <div class="sheet-tools">
        <span class="cat">${escapeHtml(catLabel(term.cat))}</span>
        <span>
          ${bookmarkButton(term.id)}
          <button type="button" class="icon-btn" data-action="close-sheet" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
        </span>
      </div>
      <h2 id="sheet-title">${escapeHtml(term.term)}</h2>
      <p class="say">${escapeHtml(term.ko)} · ${escapeHtml(term.say)}</p>
      <div class="row-actions">
        <button type="button" class="btn btn-ghost" data-action="speak-term" data-id="${term.id}"><i class="fa-solid fa-volume-high"></i> 용어 발음</button>
        <button type="button" class="btn btn-ghost" data-action="speak-example" data-id="${term.id}"><i class="fa-solid fa-microphone-lines"></i> 예문 듣기</button>
        <button type="button" class="btn btn-primary" data-action="find-in-sample" data-id="${term.id}"><i class="fa-brands fa-youtube"></i> 예시 중계에서 찾기</button>
      </div>
      <div class="sheet-body">
        <section class="block"><h3>한 줄 뜻</h3><p>${escapeHtml(term.blurb)}</p></section>
        <section class="block"><h3>자세히</h3><p>${escapeHtml(term.body)}</p></section>
        <section class="block"><h3>중계에서 이렇게 들립니다</h3><p>${escapeHtml(term.usage)}</p></section>
        <blockquote class="quote">
          <p>${escapeHtml(term.example)}</p>
          <p class="ko">${escapeHtml(term.exampleKo)}</p>
        </blockquote>
        ${related.length ? `<section class="block"><h3>같이 보면 좋은 표현</h3><div class="related">${related.map((item) => `<button type="button" class="chip term-chip" data-action="open-term" data-id="${item.id}">${escapeHtml(item.term)}</button>`).join("")}</div></section>` : ""}
      </div>`;
    $("sheet").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSheet(silent) {
    if ($("sheet").hidden) return;
    $("sheet").hidden = true;
    document.body.style.overflow = "";
    if (!silent && location.hash.startsWith("#/term/")) history.back();
  }

  function setStatus(message, kind) {
    const node = $("match-status");
    node.textContent = message || "";
    node.className = `status${kind ? ` is-${kind}` : ""}`;
  }

  function updateOpenLink(videoId) {
    const link = $("open-youtube");
    if (!videoId) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = `https://www.youtube.com/watch?v=${videoId}&t=0s`;
  }

  function showEmbedBlocked(show) {
    $("player-blocked").hidden = !show;
  }

  function cueVideo(videoId) {
    if (!videoId) return;
    pendingVideo = videoId;
    updateOpenLink(videoId);
    showEmbedBlocked(false);
    $("player-frame").classList.add("has-video");
    if (player && playerReady && player.cueVideoById) player.cueVideoById(videoId);
    else loadYouTubeApi();
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
      return;
    }
    if (document.getElementById("yt-iframe-api")) return;
    const script = document.createElement("script");
    script.id = "yt-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }

  window.onYouTubeIframeAPIReady = function () {
    if (player) return;
    player = new YT.Player("yt-player", {
      videoId: pendingVideo || undefined,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady() {
          playerReady = true;
          if (pendingVideo) player.cueVideoById(pendingVideo);
        },
        onError(event) {
          const blocked = [101, 150, 153].includes(event.data);
          if (blocked) {
            showEmbedBlocked(true);
            setStatus("이 영상은 사이트 안에 심을 수 없습니다. 표현 찾기는 그대로 되고, 재생은 유튜브에서 열면 됩니다.", "warn");
          }
        }
      }
    });
  };

  function seek(seconds) {
    const time = Number(seconds) || 0;
    const blocked = $("player-blocked") && !$("player-blocked").hidden;
    if (player && player.seekTo && !blocked) {
      player.seekTo(time, true);
      try { player.playVideo(); } catch (error) {}
      return;
    }
    const videoId = window.SIM.parseVideoId($("yt-url").value);
    if (videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(time)}s`, "_blank", "noopener");
      return;
    }
    setStatus("먼저 유튜브 주소를 붙여 주세요.", "warn");
  }

  function activeBroadcast() {
    return state.broadcasts.find((item) => item.id === state.activeVideoId) || null;
  }

  function renderBroadcasts() {
    const tabs = $("video-tabs");
    const filters = $("hit-filters");
    if (filters) {
      filters.hidden = true;
      filters.innerHTML = "";
    }
    const pendingId = state.pendingVideoId;
    const showTabs = state.broadcasts.length > 0 || pendingId;
    tabs.hidden = !showTabs;
    const pendingOnly = pendingId && !state.broadcasts.some((item) => item.id === pendingId);
    tabs.innerHTML = state.broadcasts.map((item) => {
      const selected = item.id === state.activeVideoId;
      const label = item.title || "영상";
      return `<div class="video-tab ${selected ? "is-active" : ""}">
        <button type="button" data-action="show-broadcast" data-id="${escapeHtml(item.id)}">${escapeHtml(label)}</button>
        <button type="button" class="video-tab-close" data-action="close-broadcast" data-id="${escapeHtml(item.id)}" aria-label="이 영상 정리 지우기"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    }).join("") + (pendingOnly ? `<div class="video-tab is-active"><button type="button" disabled>정리 중</button></div>` : "");

    if (pendingId && pendingId === state.activeVideoId) {
      $("hit-summary").textContent = "이 영상을 정리하는 중입니다. 끝나면 이 영상 탭에만 시간순으로 쌓입니다.";
      $("hit-list").innerHTML = `<div class="empty">자막 또는 음성을 읽고 있습니다.</div>`;
      return;
    }

    const current = activeBroadcast();
    if (!current) {
      $("hit-summary").textContent = "주소를 넣고 표현 찾기를 누르면, 그 영상의 표현만 시간 순서로 쌓입니다.";
      $("hit-list").innerHTML = "";
      return;
    }
    const items = current.items || [];
    const title = current.title || "이 영상";
    $("hit-summary").textContent = items.length
      ? `${title} · 사전 ${items.filter((item) => item.dictId).length}개, 이 영상에서 새로 ${items.filter((item) => !item.dictId).length}개. 시각을 누르면 그 장면으로 이동합니다.`
      : `${title}에서 중계 용어를 찾지 못했습니다.`;
    if (!items.length) {
      $("hit-list").innerHTML = `<div class="empty">이 영상에서는 정리된 표현이 없습니다.</div>`;
      return;
    }
    $("hit-list").innerHTML = items.map((item, index) => {
      const local = item.dictId ? window.SIM.termById(item.dictId) : localTermFor(item.term);
      const termTitle = local
        ? `<button type="button" data-action="open-term" data-id="${escapeHtml(local.id)}">${escapeHtml(item.term)}</button>`
        : `<span class="term-plain">${escapeHtml(item.term)}</span>`;
      return `
        <article class="hit" data-video="${escapeHtml(current.id)}">
          <div class="hit-top">
            <button type="button" class="time-btn" data-action="seek" data-time="${Number(item.time) || 0}"><i class="fa-solid fa-play"></i> ${formatTime(item.time)}</button>
            ${local ? bookmarkButton(local.id) : ""}
          </div>
          <h3>${termTitle}${item.dictId ? ` <span class="ko-name">사전</span>` : ""}${item.ko ? ` <span class="ko-name">${escapeHtml(item.ko)}</span>` : ""}</h3>
          ${item.quote ? `<p class="hit-quote">${quoteHtml(item.quote, item.term)}</p>` : ""}
          ${item.explain ? `<p class="hit-blurb">${escapeHtml(item.explain)}</p>` : ""}
          <div class="row-actions">
            ${local ? `<button type="button" class="btn btn-ghost" data-action="open-term" data-id="${escapeHtml(local.id)}">사전 설명</button>` : ""}
            <button type="button" class="btn btn-ghost" data-action="speak-hit" data-index="${index}">예문 듣기</button>
          </div>
        </article>`;
    }).join("");
  }

  function showBroadcast(id) {
    const item = state.broadcasts.find((entry) => entry.id === id);
    if (!item) return;
    state.activeVideoId = id;
    $("yt-url").value = item.url;
    cueVideo(id);
    renderBroadcasts();
    setStatus(`${item.title || "이 영상"}의 표현만 보고 있습니다.`, "ok");
  }

  function closeBroadcast(id) {
    state.broadcasts = state.broadcasts.filter((item) => item.id !== id);
    if (state.activeVideoId === id) {
      const next = state.broadcasts[state.broadcasts.length - 1];
      state.activeVideoId = next ? next.id : "";
      if (next) {
        $("yt-url").value = next.url;
        cueVideo(next.id);
      }
    }
    persistBroadcasts();
    renderBroadcasts();
  }

  function localTermFor(name) {
    const needle = String(name || "").trim().toLowerCase();
    if (!needle) return null;
    return window.SIM_TERMS.find((term) => [term.term, ...(term.aliases || [])].some((alias) => alias.toLowerCase() === needle)) || null;
  }

  const EXTRACT_ERRORS = {
    "missing-url": "유튜브 주소 전체를 먼저 붙여 주세요.",
    "bad-url": "유튜브 주소에서 영상을 찾지 못했습니다.",
    "no-keys": "등록된 API 키를 읽지 못했습니다.",
    "transcript-auth": "자막 서비스 인증에 실패했습니다.",
    "transcript-quota": "자막 서비스 사용량을 모두 썼습니다.",
    "transcript-rate": "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.",
    "transcript-empty": "이 영상에서 말소리를 찾지 못했습니다.",
    "transcript-timeout": "음성을 글로 바꾸는 데 시간이 더 필요합니다. 조금 뒤 다시 시도해 주세요.",
    "transcript-failed": "이 영상의 자막과 음성을 가져오지 못했습니다.",
    "model-failed": "용어와 뜻을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    "model-empty": "이 영상에서 중계 용어를 찾지 못했습니다."
  };

  function quoteHtml(quote, term) {
    const text = String(quote || "");
    const re = new RegExp(`(?<![A-Za-z0-9])${String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "i");
    const match = text.match(re);
    if (!match) return escapeHtml(text);
    const index = match.index;
    return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(match[0])}</mark>${escapeHtml(text.slice(index + match[0].length))}`;
  }

  function dictionaryTimeline(cues) {
    const rows = (Array.isArray(cues) ? cues : (cues ? [cues] : [])).map((cue) => ({
      start: Number(cue.start) || 0,
      text: String(cue.text || "")
    })).filter((cue) => cue.text);
    if (!rows.length || !window.SIM || !window.SIM.findInCues) return [];
    const kept = [];
    const lastAt = new Map();
    window.SIM.findInCues(rows).forEach((hit) => {
      const term = window.SIM.termById(hit.id);
      if (!term) return;
      const previous = lastAt.get(term.id);
      if (previous != null && hit.time - previous < 20) return;
      if (kept.filter((item) => item.dictId === term.id).length >= 4) return;
      lastAt.set(term.id, hit.time);
      kept.push({
        time: hit.time,
        term: term.term,
        quote: hit.quote,
        ko: term.ko,
        explain: term.blurb,
        dictId: term.id
      });
    });
    return kept;
  }

  function mergeTimeline(items, cues) {
    const list = Array.isArray(items) ? items : (items ? [items] : []);
    const dict = dictionaryTimeline(cues);
    const novel = list.filter((item) => item && item.term && item.quote && !localTermFor(item.term)).map((item) => ({
      time: Number(item.time) || 0,
      term: item.term,
      quote: item.quote,
      ko: item.ko || "",
      explain: item.explain || "",
      dictId: ""
    }));
    return dict.concat(novel).sort((a, b) => a.time - b.time);
  }

  async function extractBroadcast() {
    const videoId = window.SIM.parseVideoId($("yt-url").value);
    if (!videoId) {
      setStatus("유튜브 주소 전체를 먼저 붙여 주세요.", "warn");
      return;
    }
    if (state.pendingVideoId) return;
    const button = $("extract-btn");
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    button.disabled = true;
    state.pendingVideoId = videoId;
    state.activeVideoId = videoId;
    $("yt-url").value = url;
    cueVideo(videoId);
    renderBroadcasts();
    setStatus("이 영상의 자막 또는 음성을 읽는 중입니다. 음성이면 1~2분 걸릴 수 있습니다.", "ok");
    try {
      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setStatus(EXTRACT_ERRORS[data.error] || "표현을 정리하지 못했습니다.", "warn");
        return;
      }
      const items = mergeTimeline(data.items, data.cues);
      if (!items.length) {
        setStatus("이 영상에서 중계 용어를 찾지 못했습니다.", "warn");
        return;
      }
      const record = {
        id: videoId,
        url,
        title: (data.title || "").trim() || videoId,
        source: data.source === "speech" ? "speech" : "caption",
        items,
        updatedAt: Date.now()
      };
      const index = state.broadcasts.findIndex((item) => item.id === videoId);
      if (index >= 0) state.broadcasts[index] = record;
      else state.broadcasts.push(record);
      state.activeVideoId = videoId;
      persistBroadcasts();
      const sourceLabel = record.source === "speech" ? "음성" : "자막";
      setStatus(`${record.title} · ${sourceLabel}에서 ${items.length}개를 정리했습니다.`, "ok");
      if (window.matchMedia("(max-width: 1019px)").matches) {
        $("results-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      setStatus("표현을 정리하지 못했습니다. 앱 서버가 켜져 있는지 확인해 주세요.", "warn");
    } finally {
      if (state.pendingVideoId === videoId) state.pendingVideoId = "";
      button.disabled = false;
      renderBroadcasts();
    }
  }

  function openAttached(url) {
    $("yt-url").value = url;
    const videoId = window.SIM.parseVideoId(url);
    if (!videoId) {
      setStatus("유튜브 주소에서 영상을 찾지 못했습니다.", "warn");
      return;
    }
    cueVideo(videoId);
    const existing = state.broadcasts.find((item) => item.id === videoId);
    if (existing) {
      state.activeVideoId = videoId;
      renderBroadcasts();
      setStatus(`${existing.title || "이 영상"}의 표현만 보고 있습니다.`, "ok");
      return;
    }
    state.activeVideoId = "";
    renderBroadcasts();
    setStatus("영상을 열었습니다. 표현 찾기를 누르면 이 영상만 시간순으로 정리합니다.", "ok");
  }
  function findSampleForTerm(id) {
    return (window.SIM_SAMPLES || []).find((sample) => {
      const cues = window.SIM.parseTranscript(sample.transcript);
      return window.SIM.findInCues(cues).some((hit) => hit.id === id);
    }) || window.SIM_SAMPLES[0];
  }

  function bootSamples() {
    const row = $("sample-row");
    if (!row || !window.SIM_SAMPLES) return;
    row.innerHTML = window.SIM_SAMPLES.map((sample) => `
      <button type="button" class="chip" data-action="load-sample" data-id="${sample.id}">${escapeHtml(sample.label)}</button>`).join("");
  }

  function bootCategories() {
    $("cat-chips").innerHTML = window.SIM_CATEGORIES.map((category) => `
      <button type="button" class="chip ${category.id === "all" ? "is-active" : ""}" data-action="filter-cat" data-cat="${category.id}">${escapeHtml(category.label)}</button>`).join("");
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action], [data-nav]");
    if (!target) return;
    if (target.dataset.nav && target.dataset.action !== "open-term") {
      go(target.dataset.nav);
      return;
    }
    const action = target.dataset.action;
    if (action === "open-term") {
      const next = `#/term/${target.dataset.id}`;
      if (location.hash !== next) location.hash = next;
      else openTerm(target.dataset.id);
    } else if (action === "close-sheet") {
      closeSheet(false);
    } else if (action === "toggle-save") {
      const id = target.dataset.id;
      if (state.saved.has(id)) state.saved.delete(id);
      else state.saved.add(id);
      persistSaved();
      refreshBookmarks(id);
      if (state.view === "saved") renderSaved();
      if (state.view === "home") renderHome();
    } else if (action === "speak-term" || action === "speak-example") {
      const term = window.SIM.termById(target.dataset.id);
      speak(action === "speak-term" ? term.term : term.example);
    } else if (action === "speak-hit") {
      const current = activeBroadcast();
      const item = current && current.items[Number(target.dataset.index)];
      if (item) speak(item.quote || item.term);
    } else if (action === "filter-cat") {
      state.category = target.dataset.cat;
      renderDict();
    } else if (action === "seek") {
      seek(target.dataset.time);
    } else if (action === "load-video") {
      const raw = $("yt-url").value.trim();
      if (!window.SIM.parseVideoId(raw)) setStatus("유튜브 주소에서 영상 ID를 찾지 못했습니다.", "warn");
      else openAttached(raw);
    } else if (action === "extract-broadcast") {
      extractBroadcast();
    } else if (action === "show-broadcast") {
      showBroadcast(target.dataset.id);
    } else if (action === "close-broadcast") {
      closeBroadcast(target.dataset.id);
    } else if (action === "find-in-sample") {
      const sample = findSampleForTerm(target.dataset.id);
      closeSheet(true);
      go("match");
      if (sample) setTimeout(() => openAttached(sample.video), 0);
    } else if (action === "set-theme") {
      applyTheme(target.dataset.theme);
    }
  });

  $("dict-search").addEventListener("input", () => {
    if (state.view === "dict") renderDict();
  });

  function searchFromHome(event) {
    if (event) event.preventDefault();
    const query = $("home-search").value.trim();
    $("dict-search").value = query;
    state.category = "all";
    go("dict");
    renderDict();
  }

  $("home-search-form").addEventListener("submit", searchFromHome);

  $("yt-url").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      extractBroadcast();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSheet(false);
  });

  window.addEventListener("hashchange", routeFromHash);

  bootCategories();
  if (state.broadcasts.length) state.activeVideoId = state.broadcasts[state.broadcasts.length - 1].id;
  applyTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
  if (!location.hash) location.replace("#/");
  routeFromHash();
})();
