(function () {
  const SAVE_KEY = "sim.saved.v1";
  const THEME_KEY = "sim.theme";
  const BROADCAST_KEY = "sim.broadcasts.v1";
  const LEXICON_KEY = "sim.lexicon.v1";
  const MIGRATED_KEY = "sim.migrated.v1";
  const BASE_TERMS = (window.SIM_TERMS || []).slice();
  let officialTerms = BASE_TERMS.slice();
  const ENTRY_CATS = new Set(["law", "tactic", "attack", "defense", "setpiece", "keeper", "player", "slang"]);
  const TITLES = {
    home: "축구 중계 속 영어",
    dict: "중계 영어 사전",
    match: "영상 속 표현",
    quiz: "퀴즈",
    saved: "저장한 표현",
    settings: "설정"
  };

  const state = {
    view: "home",
    category: "all",
    saved: loadSaved(),
    broadcasts: loadBroadcasts(),
    activeVideoId: "",
    pendingVideoId: "",
    quizRound: null,
    quizSeen: new Set()
  };

  let player = null;
  let playerReady = false;
  let pendingVideo = "";
  let accountSession = null;
  let personalUserId = null;
  let remoteLexicon = [];
  let personalChain = Promise.resolve();
  let broadcastGeneration = 0;
  let personalError = "";
  let savedAt = new Map();
  const translateStarted = new Set();

  const $ = (id) => document.getElementById(id);

  function loadSaved() {
    try {
      return new Set(JSON.parse(localStorage.getItem(SAVE_KEY)) || []);
    } catch (error) {
      return new Set();
    }
  }

  function stampSaved(ids, times) {
    savedAt = new Map();
    ids.forEach((id, index) => {
      const time = times && times.get(id);
      savedAt.set(id, time || index + 1);
    });
    state.saved = new Set(ids.filter(Boolean));
  }

  function savedTerms() {
    return [...state.saved]
      .map((id) => window.SIM.termById(id))
      .filter(Boolean)
      .sort((a, b) => (savedAt.get(b.id) || 0) - (savedAt.get(a.id) || 0) || a.term.localeCompare(b.term));
  }

  function sortBroadcastsNewest() {
    state.broadcasts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function useNewestBroadcast() {
    if (state.broadcasts.some((item) => item.id === state.activeVideoId)) return;
    const next = state.broadcasts[0];
    state.activeVideoId = next ? next.id : "";
  }

  function signedInUser() {
    return accountSession && accountSession.user ? accountSession.user : null;
  }

  function cloudReady() {
    const user = signedInUser();
    return Boolean(user && personalUserId === user.id);
  }

  function persistSaved() {
    const user = signedInUser();
    if (!user) {
    localStorage.setItem(SAVE_KEY, JSON.stringify([...state.saved]));
      return Promise.resolve(true);
    }
    const userId = user.id;
    const run = personalChain.then(() => {
      if (!cloudReady() || signedInUser().id !== userId) return false;
      return saveBookmarks(userId, [...state.saved]);
    });
    personalChain = run.then(() => {}, () => {});
    return run;
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
    const user = signedInUser();
    if (!user) {
      localStorage.setItem(BROADCAST_KEY, JSON.stringify(state.broadcasts));
      return Promise.resolve(true);
    }
    const userId = user.id;
    const generation = ++broadcastGeneration;
    const run = personalChain.then(() => {
      if (generation !== broadcastGeneration || !cloudReady() || signedInUser().id !== userId) return true;
      return saveBroadcasts(userId, state.broadcasts, generation);
    });
    personalChain = run.then(() => {}, () => {});
    return run;
  }

  function loadLexicon() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEXICON_KEY));
      return Array.isArray(parsed) ? parsed.filter((term) => term && term.id && term.term) : [];
    } catch (error) {
      return [];
    }
  }

  function aliasKey(name) {
    return String(name || "").trim().toLowerCase();
  }

  function applyLexicon(extra) {
    const taken = new Set();
    officialTerms.forEach((term) => {
      taken.add(aliasKey(term.id));
      taken.add(aliasKey(term.term));
      (term.aliases || []).forEach((alias) => taken.add(aliasKey(alias)));
    });
    const merged = officialTerms.slice();
    extra.forEach((term) => {
      const aliases = [term.term, ...(term.aliases || [])].map(aliasKey).filter((alias) => alias.length >= 3);
      if (!aliases.length || aliases.some((alias) => taken.has(alias)) || taken.has(aliasKey(term.id))) return;
      aliases.forEach((alias) => taken.add(alias));
      taken.add(aliasKey(term.id));
      merged.push(term);
    });
    window.SIM_TERMS = merged;
    if (window.SIM && window.SIM.refreshPatterns) window.SIM.refreshPatterns();
  }

  function termFromRow(row, learned) {
    if (!row || typeof row.id !== "string" || !row.term) return null;
    const aliases = Array.isArray(row.aliases) ? row.aliases.filter((alias) => typeof alias === "string") : [];
    const related = Array.isArray(row.related) ? row.related.filter((alias) => typeof alias === "string") : [];
    const term = {
      id: row.id,
      term: String(row.term),
      ko: row.ko || "",
      say: row.say || "",
      cat: ENTRY_CATS.has(row.cat) ? row.cat : "slang",
      blurb: row.blurb || "",
      body: row.body || "",
      usage: row.usage || "",
      example: row.example || "",
      exampleKo: row.example_ko || "",
      aliases,
      related
    };
    if (learned) term.learned = true;
    return term;
  }

  function lexiconExtras() {
    return personalUserId ? remoteLexicon : loadLexicon();
  }

  function termsSignature() {
    return (window.SIM_TERMS || []).map((term) => [term.id, term.term, term.ko, term.blurb, term.example].join("\u0001")).join("\u0002");
  }

  function refreshOpenView() {
    const sheet = $("sheet");
    if (sheet && !sheet.hidden) return;
    if (state.view === "home") renderHome();
    else if (state.view === "dict") renderDict();
    else if (state.view === "saved") renderSaved();
  }

  async function loadPublishedTerms() {
    if (!window.SIM_SUPABASE || !window.SIM_SUPABASE.publishedTerms) return;
    try {
      const rows = await window.SIM_SUPABASE.publishedTerms();
      const remote = new Map();
      rows.forEach((row) => {
        const term = termFromRow(row);
        if (term) remote.set(term.id, term);
      });
      if (!remote.size) return;
      const merged = BASE_TERMS.map((term) => remote.get(term.id) || term);
      const known = new Set(merged.map((term) => term.id));
      remote.forEach((term) => {
        if (!known.has(term.id)) merged.push(term);
      });
      const before = termsSignature();
      officialTerms = merged;
      applyLexicon(lexiconExtras());
      if (termsSignature() !== before) refreshOpenView();
    } catch (error) {}
  }

  function learnedId(name) {
    const slug = aliasKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return `learned-${slug || "term"}`;
  }

  function registerLearned(items) {
    const stored = new Map(lexiconExtras().map((term) => [term.id, term]));
    const fresh = [];
    items.forEach((item) => {
      if (!item || !item.fresh || !item.term || !item.ko || !(item.blurb || item.explain)) return;
      const id = learnedId(item.term);
      const blurb = item.blurb || item.explain;
      const entry = {
        id,
        term: item.term,
        ko: item.ko,
        say: item.say || "",
        cat: ENTRY_CATS.has(item.cat) ? item.cat : "slang",
        blurb,
        body: item.body || blurb,
        usage: item.usage || "",
        example: item.quote || "",
        exampleKo: item.exampleKo || "",
        aliases: [aliasKey(item.term)],
        related: [],
        learned: true
      };
      stored.set(id, entry);
      fresh.push(entry);
      item.dictId = id;
    });
    const extra = [...stored.values()];
    const user = signedInUser();
    if (!user) {
      localStorage.setItem(LEXICON_KEY, JSON.stringify(extra));
      applyLexicon(extra);
      clearMissingTerms(items);
      return Promise.resolve(extra);
    }
    const userId = user.id;
    const run = personalChain.then(async () => {
      if (!signedInUser() || signedInUser().id !== userId) return extra;
      const saved = await saveDrafts(userId, fresh);
      const merged = new Map(remoteLexicon.map((term) => [term.id, term]));
      fresh.forEach((term) => {
        if (saved) merged.set(term.id, term);
        else {
          items.forEach((item) => {
            if (item && item.dictId === term.id) item.dictId = "";
          });
        }
      });
      remoteLexicon = [...merged.values()];
      applyLexicon(remoteLexicon);
      clearMissingTerms(items);
      return extra;
    });
    personalChain = run.then(() => {}, () => {});
    return run;
  }

  function clearMissingTerms(items) {
    items.forEach((item) => {
      if (item && item.dictId && !window.SIM.termById(item.dictId)) item.dictId = "";
    });
  }

  function draftRow(userId, term) {
    return {
      id: term.id,
      owner_id: userId,
      status: "draft",
      learned: true,
      term: term.term,
      ko: term.ko || "",
      say: term.say || "",
      cat: ENTRY_CATS.has(term.cat) ? term.cat : "slang",
      blurb: term.blurb || "",
      body: term.body || "",
      usage: term.usage || "",
      example: term.example || "",
      example_ko: term.exampleKo || "",
      aliases: term.aliases || [],
      related: term.related || []
    };
  }

  async function saveDrafts(userId, terms) {
    if (!terms.length) return true;
    const client = await window.SIM_SUPABASE.getClient();
    const { error } = await client.from("terms").upsert(terms.map((term) => draftRow(userId, term)), { onConflict: "id" });
    return !error;
  }

  async function saveBookmarks(userId, ids) {
    const client = await window.SIM_SUPABASE.getClient();
    const { data, error } = await client.from("bookmarks").select("term_id").eq("user_id", userId);
    if (error) return false;
    const remote = new Set((data || []).map((row) => row.term_id));
    const wanted = new Set(ids);
    const remove = [...remote].filter((id) => !wanted.has(id));
    const add = [...wanted].filter((id) => !remote.has(id));
    if (remove.length) {
      const removed = await client.from("bookmarks").delete().eq("user_id", userId).in("term_id", remove);
      if (removed.error) return false;
    }
    if (add.length) {
      const inserted = await client.from("bookmarks").insert(add.map((term_id) => ({ user_id: userId, term_id })));
      if (inserted.error) return false;
    }
    return true;
  }

  function linkableTermId(id) {
    if (!id) return null;
    if (officialTerms.some((term) => term.id === id) || BASE_TERMS.some((term) => term.id === id)) return id;
    if (remoteLexicon.some((term) => term.id === id)) return id;
    return null;
  }

  async function saveBroadcasts(userId, records, generation) {
    if (generation !== broadcastGeneration) return true;
    const client = await window.SIM_SUPABASE.getClient();
    const { data: existing, error } = await client.from("broadcasts").select("id,video_id").eq("user_id", userId);
    if (error || generation !== broadcastGeneration) return !error;
    const byVideo = new Map((existing || []).map((row) => [row.video_id, row.id]));
    const keep = new Set(records.map((record) => record.id));
    const removeIds = [...byVideo.entries()].filter(([videoId]) => !keep.has(videoId)).map(([, id]) => id);
    if (removeIds.length) {
      const removed = await client.from("broadcasts").delete().in("id", removeIds);
      if (removed.error) return false;
    }
    for (const record of records) {
      if (generation !== broadcastGeneration) return true;
      const source = record.source === "caption" ? "caption" : "speech";
      let dbId = byVideo.get(record.id);
      if (dbId) {
        const updated = await client.from("broadcasts").update({
          url: record.url,
          title: record.title || "",
          source
        }).eq("id", dbId).eq("user_id", userId);
        if (updated.error) return false;
      } else {
        const inserted = await client.from("broadcasts").insert({
          user_id: userId,
          video_id: record.id,
          url: record.url,
          title: record.title || "",
          source
        }).select("id").single();
        if (inserted.error || !inserted.data) return false;
        dbId = inserted.data.id;
        byVideo.set(record.id, dbId);
      }
      const cleared = await client.from("broadcast_hits").delete().eq("broadcast_id", dbId);
      if (cleared.error) return false;
      const hits = (record.items || []).filter((item) => item && item.term).map((item, position) => ({
        broadcast_id: dbId,
        position,
        time_sec: Math.round((Number(item.time) || 0) * 10) / 10,
        term_id: linkableTermId(item.dictId),
        term: String(item.term),
        surface: String(item.surface || ""),
        ko: String(item.ko || ""),
        quote: String(item.quote || ""),
        quote_ko: String(item.quoteKo || ""),
        fresh: Boolean(item.fresh)
      }));
      if (!hits.length) continue;
      let hitInsert = await client.from("broadcast_hits").insert(hits);
      if (hitInsert.error) {
        hits.forEach((hit) => { hit.term_id = null; });
        hitInsert = await client.from("broadcast_hits").insert(hits);
        if (hitInsert.error) return false;
      }
    }
    return true;
  }

  async function loadHits(client, ids) {
    if (!ids.length) return [];
    const { data, error } = await client.from("broadcast_hits").select("broadcast_id,position,time_sec,term_id,term,surface,ko,quote,quote_ko,fresh").in("broadcast_id", ids).order("position", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function mapBroadcasts(rows, hits) {
    const grouped = new Map();
    hits.forEach((hit) => {
      if (!grouped.has(hit.broadcast_id)) grouped.set(hit.broadcast_id, []);
      grouped.get(hit.broadcast_id).push({
        time: Number(hit.time_sec) || 0,
        term: hit.term,
        surface: hit.surface || "",
        quote: hit.quote || "",
        ko: hit.ko || "",
        quoteKo: hit.quote_ko || "",
        dictId: hit.term_id || "",
        fresh: Boolean(hit.fresh)
      });
    });
    return rows.filter((row) => row && row.video_id).map((row) => ({
      id: row.video_id,
      dbId: row.id,
      url: row.url,
      title: row.title || row.video_id,
      source: row.source === "caption" ? "caption" : "speech",
      items: grouped.get(row.id) || [],
      updatedAt: Date.parse(row.updated_at) || Date.now()
    }));
  }

  function refreshPersonalViews() {
    const sheet = $("sheet");
    if (sheet && !sheet.hidden) closeSheet(true);
    if (state.view === "home") renderHome();
    else if (state.view === "dict") renderDict();
    else if (state.view === "saved") renderSaved();
    else if (state.view === "quiz") renderQuiz();
    else if (state.view === "match") renderBroadcasts();
  }

  function migratedUsers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MIGRATED_KEY));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function markMigrated(userId) {
    const users = migratedUsers();
    users[userId] = true;
    localStorage.setItem(MIGRATED_KEY, JSON.stringify(users));
  }

  async function importLocalOnce(userId) {
    if (migratedUsers()[userId]) return;
    const localSaved = loadSaved();
    const localBroadcasts = loadBroadcasts();
    const needed = new Set(localSaved);
    localBroadcasts.forEach((record) => {
      (record.items || []).forEach((item) => {
        if (item && item.dictId) needed.add(item.dictId);
      });
    });
    const drafts = loadLexicon().filter((term) => term.id && needed.has(term.id) && !remoteLexicon.some((row) => row.id === term.id));
    let draftsReady = true;
    if (drafts.length) {
      draftsReady = await saveDrafts(userId, drafts);
      if (draftsReady) remoteLexicon = remoteLexicon.concat(drafts.map((term) => ({ ...term, learned: true })));
    }
    [...localSaved].filter((id) => linkableTermId(id)).forEach((id) => {
      state.saved.add(id);
      if (!savedAt.has(id)) savedAt.set(id, Date.now());
    });
    const have = new Set(state.broadcasts.map((item) => item.id));
    localBroadcasts.forEach((record) => {
      if (!have.has(record.id)) state.broadcasts.push(record);
    });
    sortBroadcastsNewest();
    const bookmarksOk = await saveBookmarks(userId, [...state.saved]);
    const generation = ++broadcastGeneration;
    const broadcastsOk = await saveBroadcasts(userId, state.broadcasts, generation);
    if (draftsReady && bookmarksOk && broadcastsOk) markMigrated(userId);
    applyLexicon(remoteLexicon);
  }

  async function loadPersonal(userId) {
    if (!userId) {
      personalError = "";
      remoteLexicon = [];
      stampSaved([...loadSaved()]);
      state.broadcasts = loadBroadcasts();
      sortBroadcastsNewest();
      useNewestBroadcast();
      applyLexicon(loadLexicon());
      refreshPersonalViews();
      return;
    }
    const client = await window.SIM_SUPABASE.getClient();
    const [bookmarkRes, broadcastRes, draftRes] = await Promise.all([
      client.from("bookmarks").select("term_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      client.from("broadcasts").select("id,video_id,url,title,source,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
      client.from("terms").select("id,term,ko,say,cat,blurb,body,usage,example,example_ko,aliases,related,updated_at").eq("owner_id", userId).eq("learned", true).order("updated_at", { ascending: false })
    ]);
    if (bookmarkRes.error || broadcastRes.error || draftRes.error) throw bookmarkRes.error || broadcastRes.error || draftRes.error;
    const hits = await loadHits(client, (broadcastRes.data || []).map((row) => row.id));
    if (!signedInUser() || signedInUser().id !== userId) return;
    const bookmarkRows = bookmarkRes.data || [];
    const times = new Map(bookmarkRows.map((row) => [row.term_id, Date.parse(row.created_at) || 0]));
    stampSaved(bookmarkRows.map((row) => row.term_id), times);
    remoteLexicon = (draftRes.data || []).map((row) => termFromRow(row, true)).filter(Boolean);
    state.broadcasts = mapBroadcasts(broadcastRes.data || [], hits);
    sortBroadcastsNewest();
    useNewestBroadcast();
    personalError = "";
    applyLexicon(remoteLexicon);
    await importLocalOnce(userId);
    if (!signedInUser() || signedInUser().id !== userId) return;
    refreshPersonalViews();
  }

  function applyPersonal(session) {
    const userId = session && session.user ? session.user.id : "";
    if (userId === personalUserId) return personalChain;
    personalUserId = userId;
    const run = personalChain.then(() => loadPersonal(userId)).catch(() => {
      if (!userId) return;
      personalError = "계정에 저장된 기록을 불러오지 못했습니다.";
      savedAt = new Map();
      state.saved = new Set();
      state.broadcasts = [];
      state.activeVideoId = "";
      remoteLexicon = [];
      applyLexicon([]);
      refreshPersonalViews();
      if (personalUserId === userId) personalUserId = null;
    });
    personalChain = run.then(() => {}, () => {});
    return run;
  }

  function glossLine(term) {
    return term.say ? `${term.ko} · ${term.say}` : term.ko;
  }

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function savedThemeChoice() {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
  }

  function applyTheme(theme) {
    const choice = theme === "light" || theme === "system" ? theme : "dark";
    const next = choice === "system" ? systemTheme() : choice;
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, choice);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === "light" ? "#ffffff" : "#071018";
    document.querySelectorAll('[data-action="set-theme"]').forEach((button) => {
      const on = button.dataset.theme === choice;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    });
  }

  function watchSystemTheme() {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const follow = () => {
      if (localStorage.getItem(THEME_KEY) === "system") applyTheme("system");
    };
    if (query.addEventListener) query.addEventListener("change", follow);
    else query.addListener(follow);
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
    if (state.view === "quiz") renderQuiz();
    if (state.view === "settings") applyTheme(savedThemeChoice());
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
        <p class="say">${escapeHtml(term.say ? `${term.say} · ${term.ko}` : term.ko)}</p>
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
        <h3>${escapeHtml(term.term)}${term.learned ? ` <span class="ko-name">영상에서 추가</span>` : ""}</h3>
        <p class="say">${escapeHtml(glossLine(term))}</p>
        <p class="clamp">${escapeHtml(term.blurb)}</p>
        <button type="button" class="text-btn" data-action="open-term" data-id="${term.id}" style="padding:0.45rem 0.7rem;align-self:flex-start">설명 열기</button>
      </article>`).join("");
  }

  function shuffleItems(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      const item = copy[index];
      copy[index] = copy[swap];
      copy[swap] = item;
    }
    return copy;
  }

  function quizPool() {
    const byId = new Map();
    (window.SIM_TERMS || []).forEach((term) => {
      if (term && term.id && term.term && term.ko) byId.set(term.id, term);
    });
    state.broadcasts.forEach((record) => {
      (record.items || []).forEach((item) => {
        if (!item || !item.term || !item.ko) return;
        const id = item.dictId || learnedId(item.term);
        if (!id || byId.has(id)) return;
        byId.set(id, {
          id,
          term: item.term,
          ko: item.ko,
          blurb: item.blurb || item.explain || item.quoteKo || "",
          cat: ENTRY_CATS.has(item.cat) ? item.cat : "slang",
          aliases: [item.surface, item.term].filter(Boolean),
          learned: true
        });
      });
    });
    return [...byId.values()];
  }

  function situationText(term) {
    let text = String(term.blurb || "");
    [term.term, ...(term.aliases || [])].forEach((word) => {
      const clean = String(word || "").trim();
      if (clean.length < 2) return;
      text = text.replace(new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    });
    text = text.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
    return text || "그림 속 경기 상황에 맞는 영어 표현을 고르세요.";
  }

  function makeQuizItem(answer, pool) {
    const name = answer.term.toLowerCase();
    const others = pool.filter((term) => term.id !== answer.id && term.term.toLowerCase() !== name);
    const same = others.filter((term) => term.cat === answer.cat);
    const distractors = shuffleItems(same.length >= 3 ? same : others).slice(0, 3);
    return {
      answer,
      choices: shuffleItems([answer, ...distractors]),
      picked: ""
    };
  }

  function startQuizRound() {
    const pool = quizPool();
    if (pool.length < 4) {
      state.quizRound = { empty: true, items: [], index: 0, phase: "play" };
      return;
    }
    const items = [];
    const used = new Set();
    const limit = Math.min(10, pool.length);
    while (items.length < limit) {
      let fresh = pool.filter((term) => !used.has(term.id) && !state.quizSeen.has(term.id));
      if (!fresh.length) {
        state.quizSeen.clear();
        fresh = pool.filter((term) => !used.has(term.id));
      }
      if (!fresh.length) break;
      const answer = fresh[Math.floor(Math.random() * fresh.length)];
      used.add(answer.id);
      state.quizSeen.add(answer.id);
      items.push(makeQuizItem(answer, pool));
    }
    state.quizRound = { empty: false, items, index: 0, phase: "play" };
  }

  function quizFinished(round) {
    return round.items.length > 0 && round.items.every((item) => item.picked);
  }

  function quizNav(delta) {
    const round = state.quizRound;
    if (!round || round.empty || round.phase === "review") return;
    const next = round.index + delta;
    if (next < 0 || next >= round.items.length) return;
    round.index = next;
    renderQuiz();
  }

  function renderQuizReview(round) {
    const correct = round.items.filter((item) => item.picked === item.answer.id);
    const wrong = round.items.filter((item) => item.picked && item.picked !== item.answer.id);
    const section = (title, list, kind) => {
      if (!list.length) return "";
      return `<h3>${title}</h3><div class="quiz-review-list">${list.map((item) => {
        const chosen = item.choices.find((choice) => choice.id === item.picked);
        return `<article class="quiz-review-item">
          <div>
            <strong>${escapeHtml(item.answer.term)}</strong>
            <p>${escapeHtml(item.answer.ko)}</p>
            ${kind === "wrong" && chosen ? `<p>고른 답 ${escapeHtml(chosen.term)}</p>` : ""}
          </div>
          ${bookmarkButton(item.answer.id)}
        </article>`;
      }).join("")}</div>`;
    };
    return `
      <article class="panel quiz-card quiz-review">
        <div class="quiz-top">
          <p>결과 확인</p>
          <p>맞음 ${correct.length} · 틀림 ${wrong.length}</p>
        </div>
        ${section("맞은 단어", correct, "right")}
        ${section("틀린 단어", wrong, "wrong")}
        <div class="row-actions">
          <button type="button" class="btn btn-primary" data-action="quiz-restart">새 10문제</button>
        </div>
      </article>`;
  }

  function renderQuiz() {
    const mount = $("quiz-mount");
    if (!mount) return;
    if (!state.quizRound) startQuizRound();
    const round = state.quizRound;
    if (!round || round.empty) {
      mount.innerHTML = `
        <div class="saved-empty panel">
          <h2>아직 퀴즈를 낼 표현이 부족합니다</h2>
          <p class="lede">사전에 있는 표현이나, 영상에서 찾은 표현이 4개 이상 모이면 상황 퀴즈가 열립니다.</p>
        </div>`;
      return;
    }
    if (round.phase === "review") {
      mount.innerHTML = renderQuizReview(round);
      return;
    }
    const item = round.items[round.index];
    const picked = item.picked;
    const answer = item.answer;
    const scene = window.SIM_QUIZ ? window.SIM_QUIZ.sceneFor(answer) : "";
    const done = quizFinished(round);
    mount.innerHTML = `
      <article class="panel quiz-card">
        <div class="quiz-top">
          <p>그림 속 상황에 맞는 표현을 고르세요.</p>
          <p>${round.index + 1} / ${round.items.length}</p>
        </div>
        ${scene}
        <p class="quiz-prompt">${escapeHtml(situationText(answer))}</p>
        <div class="quiz-choices">
          ${item.choices.map((choice) => {
            const mine = picked && choice.id === picked;
            const right = mine && choice.id === answer.id;
            const wrong = mine && choice.id !== answer.id;
            return `<button type="button" class="quiz-choice${right ? " is-right" : ""}${wrong ? " is-wrong" : ""}" data-action="quiz-choice" data-id="${escapeHtml(choice.id)}" ${picked ? "disabled" : ""}>${escapeHtml(choice.term)}</button>`;
          }).join("")}
        </div>
        ${picked ? `<p class="quiz-result">${picked === answer.id ? "정답입니다" : "오답입니다."}</p>` : ""}
        <div class="row-actions">
          <button type="button" class="btn btn-ghost" data-action="quiz-prev" ${round.index === 0 ? "disabled" : ""}>이전 문제</button>
          <button type="button" class="btn btn-ghost" data-action="quiz-next" ${round.index === round.items.length - 1 ? "disabled" : ""}>다음 문제</button>
          <button type="button" class="btn btn-primary" data-action="quiz-result" ${done ? "" : "disabled"}>결과 확인</button>
        </div>
      </article>`;
  }

  function answerQuiz(id) {
    const round = state.quizRound;
    if (!round || round.empty || round.phase !== "play") return;
    const item = round.items[round.index];
    if (!item || item.picked) return;
    item.picked = id;
    renderQuiz();
  }

  function renderSaved() {
    const items = savedTerms();
    if (!items.length) {
      const lede = personalError
        ? personalError
        : (signedInUser() ? "사전이나 영상 분석에서 북마크를 누르면 이 계정에 남습니다." : "사전이나 영상 분석에서 북마크를 누르면 이 기기에 남습니다.");
      $("saved-mount").innerHTML = `
        <div class="saved-empty panel">
          <h2>${personalError ? "기록을 불러오지 못했습니다" : "아직 저장한 표현이 없습니다"}</h2>
          <p class="lede">${lede}</p>
          <button type="button" class="btn btn-primary" data-nav="dict">사전으로 가기</button>
        </div>`;
      return;
    }
    $("saved-mount").innerHTML = `
      <p class="result-count">${items.length}개를 ${signedInUser() ? "이 계정" : "이 브라우저"}에 저장해 두었습니다.</p>
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
      <p class="say">${escapeHtml(glossLine(term))}</p>
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
      $("hit-list").innerHTML = `<div class="empty">영상 전체를 받아쓰고 있습니다.</div>`;
      return;
    }

    const current = activeBroadcast();
    if (!current) {
      $("hit-summary").textContent = personalError || "주소를 넣고 표현 찾기를 누르면, 그 영상의 표현만 시간 순서로 쌓입니다.";
      $("hit-list").innerHTML = personalError ? `<div class="empty">${escapeHtml(personalError)}</div>` : "";
      return;
    }
    const items = onceEach(current.items || []);
    const title = current.title || "이 영상";
    const freshCount = items.filter((item) => item.fresh).length;
    $("hit-summary").textContent = items.length
      ? `${title} · 사전 ${items.length - freshCount}개, 새로 등록 ${freshCount}개. 시각을 누르면 그 장면으로 이동합니다.`
      : `${title}에서 중계 용어를 찾지 못했습니다.`;
    if (!items.length) {
      $("hit-list").innerHTML = `<div class="empty">이 영상에서는 정리된 표현이 없습니다.</div>`;
      return;
    }
    $("hit-list").innerHTML = items.map((item, index) => {
      const local = item.dictId ? window.SIM.termById(item.dictId) : localTermFor(item.term);
      const meaning = item.ko || (local && local.ko) || "";
      const termTitle = local
        ? `<button type="button" data-action="open-term" data-id="${escapeHtml(local.id)}">${escapeHtml(item.term)}</button>`
        : `<span class="term-plain">${escapeHtml(item.term)}</span>`;
      const aliases = [item.surface, item.term, ...(local ? [local.term, ...(local.aliases || [])] : [])];
      return `
        <article class="hit" data-video="${escapeHtml(current.id)}">
          <div class="hit-top">
            <button type="button" class="time-btn" data-action="seek" data-time="${Number(item.time) || 0}"><i class="fa-solid fa-play"></i> ${formatTime(item.time)}</button>
            ${local ? bookmarkButton(local.id) : ""}
          </div>
          <h3>${termTitle}</h3>
          ${meaning ? `<p class="hit-meaning">${escapeHtml(meaning)}</p>` : ""}
          ${item.quote ? `<p class="hit-quote">${emphasize(item.quote, aliases, true)}</p>` : ""}
          ${item.quoteKo ? `<p class="hit-ko">${emphasize(item.quoteKo, [meaning], false)}</p>` : ""}
          <div class="row-actions">
            ${local ? `<button type="button" class="btn btn-ghost" data-action="open-term" data-id="${escapeHtml(local.id)}">${item.fresh ? "표현 설명" : "사전 설명"}</button>` : ""}
            <button type="button" class="btn btn-ghost" data-action="speak-hit" data-index="${index}">예문 듣기</button>
          </div>
        </article>`;
    }).join("");
    ensureQuoteTranslations(current);
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
    sortBroadcastsNewest();
    if (state.activeVideoId === id) {
      const next = state.broadcasts[0];
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

  function onceEach(items) {
    const sorted = [...items].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
    const seen = new Set();
    return sorted.filter((item) => {
      const key = String(item.dictId || item.term || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function emphasize(text, phrases, english) {
    const raw = String(text || "");
    const names = [...new Set((phrases || []).map((phrase) => String(phrase || "").trim()).filter((phrase) => phrase.length >= 2))]
      .sort((a, b) => b.length - a.length);
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = english
        ? new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i")
        : new RegExp(escaped);
      const match = raw.match(re);
      if (!match) continue;
      const index = match.index;
      return `${escapeHtml(raw.slice(0, index))}<mark>${escapeHtml(match[0])}</mark>${escapeHtml(raw.slice(index + match[0].length))}`;
    }
    return escapeHtml(raw);
  }

  async function translateQuotes(items) {
    const missing = items.filter((item) => item && item.quote && !item.quoteKo);
    const step = 8;
    for (let offset = 0; offset < missing.length; offset += step) {
      const batch = missing.slice(offset, offset + step);
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: batch.map((item) => item.quote) })
      });
      const data = await response.json();
      if (!response.ok || data.error) return;
      const lines = Array.isArray(data.lines) ? data.lines : (data.lines ? [data.lines] : []);
      batch.forEach((item, index) => {
        if (lines[index]) item.quoteKo = String(lines[index]);
      });
    }
  }

  function ensureQuoteTranslations(record) {
    if (!record || translateStarted.has(record.id)) return;
    const visible = onceEach(record.items || []);
    if (!visible.some((item) => item.quote && !item.quoteKo)) return;
    translateStarted.add(record.id);
    translateQuotes(visible).then(() => {
      record.items = onceEach(record.items || []);
      persistBroadcasts();
      if (state.activeVideoId === record.id && state.view === "match") renderBroadcasts();
    }).catch(() => {
      translateStarted.delete(record.id);
    });
  }

  function dictionaryTimeline(cues) {
    const rows = (Array.isArray(cues) ? cues : (cues ? [cues] : [])).map((cue) => ({
      start: Number(cue.start) || 0,
      text: String(cue.text || "")
    })).filter((cue) => cue.text).sort((a, b) => a.start - b.start);
    if (!rows.length || !window.SIM || !window.SIM.findInCues) return [];
    const kept = [];
    const seen = new Set();
    window.SIM.findInCues(rows).forEach((hit) => {
      if (seen.has(hit.id)) return;
      const term = window.SIM.termById(hit.id);
      if (!term) return;
      seen.add(hit.id);
      kept.push({
        time: hit.time,
        term: term.term,
        surface: hit.surface,
        quote: hit.quote,
        ko: term.ko,
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
      explain: item.blurb || item.explain || "",
      say: item.say || "",
      cat: item.cat || "slang",
      blurb: item.blurb || item.explain || "",
      body: item.body || "",
      usage: item.usage || "",
      exampleKo: item.exampleKo || "",
      dictId: "",
      fresh: true
    }));
    return onceEach(dict.concat(novel));
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
    setStatus("영상 전체를 받아쓰고 표현을 찾는 중입니다. 길면 몇 분 걸릴 수 있습니다.", "ok");
    try {
      const known = [];
      window.SIM_TERMS.forEach((term) => {
        [term.term, ...(term.aliases || [])].forEach((alias) => {
          const clean = String(alias || "").trim();
          if (clean.length >= 3) known.push(clean);
        });
      });
      const response = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, known })
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setStatus(EXTRACT_ERRORS[data.error] || "표현을 정리하지 못했습니다.", "warn");
      return;
    }
      const items = mergeTimeline(data.items, data.cues);
      await registerLearned(items);
      await translateQuotes(items);
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
      sortBroadcastsNewest();
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
      toggleSaved(target.dataset.id);
    } else if (action === "quiz-choice") {
      answerQuiz(target.dataset.id);
    } else if (action === "quiz-next") {
      quizNav(1);
    } else if (action === "quiz-prev") {
      quizNav(-1);
    } else if (action === "quiz-result") {
      const round = state.quizRound;
      if (round && quizFinished(round)) {
        round.phase = "review";
        renderQuiz();
      }
    } else if (action === "quiz-restart") {
      state.quizSeen.clear();
      startQuizRound();
      renderQuiz();
    } else if (action === "speak-term" || action === "speak-example") {
      const term = window.SIM.termById(target.dataset.id);
      speak(action === "speak-term" ? term.term : term.example);
    } else if (action === "speak-hit") {
      const current = activeBroadcast();
      const item = current && onceEach(current.items)[Number(target.dataset.index)];
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
    } else if (action === "open-auth") {
      openAuth();
    } else if (action === "close-auth") {
      closeAuth();
    } else if (action === "sign-up") {
      submitAccount(false);
    } else if (action === "sign-out") {
      signOutAccount();
    }
  });

  async function toggleSaved(id) {
    const had = state.saved.has(id);
    const previous = savedAt.get(id) || 0;
    if (had) {
      state.saved.delete(id);
      savedAt.delete(id);
    } else {
      state.saved.add(id);
      savedAt.set(id, Date.now());
    }
    refreshBookmarks(id);
    if (state.view === "saved") renderSaved();
    if (state.view === "home") renderHome();
    const ok = await persistSaved();
    if (ok !== false) return;
    if (had) {
      state.saved.add(id);
      savedAt.set(id, previous);
    } else {
      state.saved.delete(id);
      savedAt.delete(id);
    }
    refreshBookmarks(id);
    if (state.view === "saved") renderSaved();
    if (state.view === "home") renderHome();
  }

  function authMessage(text) {
    const node = $("auth-message");
    if (node) node.textContent = text;
  }

  function openAuth() {
    if (accountSession && accountSession.user) {
      go("settings");
      return;
    }
    authMessage("회원가입을 하면 확인 메일이 갑니다. 메일의 링크를 누른 뒤 같은 이메일과 비밀번호로 로그인하세요.");
    $("auth-dialog").hidden = false;
    const email = $("account-email-input");
    if (email) email.focus();
  }

  function closeAuth() {
    const dialog = $("auth-dialog");
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    clearAccountPassword();
  }

  function authErrorText(error) {
    const message = String((error && error.message) || "");
    if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호가 맞지 않습니다.";
    if (/email not confirmed/i.test(message)) return "이메일 인증이 필요합니다. 받은 메일의 확인 링크를 눌러 주세요.";
    if (/already registered|already been registered/i.test(message)) return "이미 가입된 이메일입니다. 로그인해 주세요.";
    if (/password/i.test(message) && /at least|weak|short/i.test(message)) return "비밀번호는 6자 이상이어야 합니다.";
    if (error && error.code === "missing-config") return "Supabase 연결 정보가 없습니다. .env에 주소와 Publishable Key를 넣어 주세요.";
    return "로그인에 실패했습니다. 이메일과 비밀번호를 다시 확인해 주세요.";
  }

  function renderAccount(session) {
    accountSession = session || null;
    const panel = $("account-panel");
    const chip = $("account-chip");
    const user = accountSession && accountSession.user;
    if (chip) chip.textContent = user ? user.email : "로그인";
    if (panel) panel.hidden = !user;
    applyPersonal(accountSession);
    if (!user) return;
    $("account-email").textContent = user.email || "";
    const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
    $("account-verify-note").hidden = confirmed;
    closeAuth();
  }

  function readAccount() {
    const email = $("account-email-input").value.trim();
    const password = $("account-password-input").value;
    return { email, password };
  }

  function clearAccountPassword() {
    const input = $("account-password-input");
    if (input) input.value = "";
  }

  async function submitAccount(signingIn) {
    const { email, password } = readAccount();
    if (!email || password.length < 6) {
      authMessage("이메일과 6자 이상의 비밀번호를 입력해 주세요.");
      return;
    }
    authMessage(signingIn ? "로그인하는 중입니다." : "가입 메일을 보내는 중입니다.");
    try {
      const result = signingIn
        ? await window.SIM_SUPABASE.signIn(email, password)
        : await window.SIM_SUPABASE.signUp(email, password);
      clearAccountPassword();
      if (result.error) {
        authMessage(authErrorText(result.error));
        return;
      }
      const identities = result.data && result.data.user && result.data.user.identities;
      if (!signingIn && Array.isArray(identities) && identities.length === 0) {
        authMessage("이미 가입된 이메일입니다. 로그인해 주세요.");
        return;
      }
      if (!signingIn && !(result.data && result.data.session)) {
        authMessage("확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 같은 이메일과 비밀번호로 로그인하세요.");
        return;
      }
      renderAccount(result.data && result.data.session);
    } catch (error) {
      clearAccountPassword();
      authMessage(authErrorText(error));
    }
  }

  async function signOutAccount() {
    try {
      const result = await window.SIM_SUPABASE.signOut();
      if (result.error) return;
      renderAccount(null);
    } catch (error) {}
  }

  function hasAuthReturn() {
    const params = new URLSearchParams(location.search);
    return params.has("code") || /access_token|type=signup|type=recovery|type=magiclink/.test(location.hash);
  }

  async function restoreAccount() {
    const returned = hasAuthReturn();
    try {
      await window.SIM_SUPABASE.onAuthChange((event, session) => {
        renderAccount(session);
      });
      const { session } = await window.SIM_SUPABASE.currentSession();
      renderAccount(session);
      if (returned) {
        history.replaceState(null, "", `${location.pathname}#/settings`);
        routeFromHash();
      }
    } catch (error) {
      renderAccount(null);
    }
  }

  $("dict-search").addEventListener("input", () => {
    if (state.view === "dict") renderDict();
  });
  $("dict-search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    renderDict();
  });
  $("dict-search").addEventListener("search", () => {
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

  $("account-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitAccount(true);
  });

  $("home-search-form").addEventListener("submit", searchFromHome);
  $("home-search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    searchFromHome(event);
  });
  $("home-search").addEventListener("search", () => {
    if ($("home-search").value.trim()) searchFromHome();
  });

  $("yt-url").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      extractBroadcast();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const auth = $("auth-dialog");
      if (auth && !auth.hidden) closeAuth();
      else closeSheet(false);
    }
  });

  window.addEventListener("hashchange", routeFromHash);

  applyLexicon(loadLexicon());
  bootCategories();
  sortBroadcastsNewest();
  if (state.broadcasts.length) state.activeVideoId = state.broadcasts[0].id;
  applyTheme(savedThemeChoice());
  watchSystemTheme();
  if (!location.hash) location.replace("#/");
  if (!hasAuthReturn()) routeFromHash();
  restoreAccount();
  loadPublishedTerms();
})();
