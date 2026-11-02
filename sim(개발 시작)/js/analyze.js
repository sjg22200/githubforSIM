/* Transcript parsing, dictionary matching, and caption lookup. */
(function () {
  const terms = () => window.SIM_TERMS || [];

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function patterns() {
    const list = [];
    terms().forEach((term) => {
      const aliases = new Set([term.term, ...(term.aliases || [])]);
      aliases.forEach((alias) => {
        const clean = String(alias).trim();
        if (clean.length < 3) return;
        list.push({ id: term.id, alias: clean });
      });
    });
    list.sort((a, b) => b.alias.length - a.alias.length);
    return list;
  }

  let cachedPatterns = null;
  function getPatterns() {
    if (!cachedPatterns) cachedPatterns = patterns();
    return cachedPatterns;
  }

  function parseClock(value) {
    if (value == null) return 0;
    const raw = String(value).trim().replace(",", ".");
    if (/^\d+(\.\d+)?s$/.test(raw)) return parseFloat(raw);
    const parts = raw.split(":");
    if (parts.length === 3) {
      return (+parts[0]) * 3600 + (+parts[1]) * 60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return (+parts[0]) * 60 + parseFloat(parts[1]);
    }
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function decodeEntities(text) {
    return text
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tidyCues(cues) {
    return cues
      .map((cue) => ({
        start: Math.max(0, Number(cue.start) || 0),
        text: decodeEntities(String(cue.text || "")).replace(/\s+/g, " ").trim()
      }))
      .filter((cue) => cue.text && !/^\[(music|applause|laughter|박수|음악)\]$/i.test(cue.text));
  }

  function parseVtt(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const cues = [];
    let current = null;
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "WEBVTT" || trimmed.startsWith("NOTE") || trimmed.startsWith("Kind:") || trimmed.startsWith("Language:")) {
        return;
      }
      if (trimmed.includes("-->")) {
        if (current) cues.push(current);
        current = { start: parseClock(trimmed.split("-->")[0]), text: "" };
        return;
      }
      if (/^\d+$/.test(trimmed)) return;
      if (!current) current = { start: 0, text: "" };
      current.text = `${current.text} ${trimmed}`.trim();
    });
    if (current) cues.push(current);
    return tidyCues(cues);
  }

  function parseJson3(text) {
    const data = JSON.parse(text);
    const cues = [];
    (data.events || []).forEach((event) => {
      if (!event.segs) return;
      const line = event.segs.map((seg) => seg.utf8 || "").join("");
      if (!line.trim() || line.trim() === "\n") return;
      cues.push({ start: (event.tStartMs || 0) / 1000, text: line });
    });
    return tidyCues(cues);
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const nodes = [...doc.getElementsByTagName("p")];
    if (nodes.length) {
      return tidyCues(nodes.map((node) => ({
        start: parseClock(node.getAttribute("begin") || "0"),
        text: node.textContent || ""
      })));
    }
    const texts = [...doc.getElementsByTagName("text")];
    return tidyCues(texts.map((node) => ({
      start: parseFloat(node.getAttribute("start") || "0"),
      text: node.textContent || ""
    })));
  }

  function parseLoose(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const cues = [];
    const timeOnly = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,]\d{1,3})?$/;
    const inline = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,]\d{1,3})?\s+(.+)$/;
    let current = null;
    lines.forEach((original) => {
      const line = original.trim();
      if (!line || /^WEBVTT/.test(line)) return;
      if (/^\d+$/.test(line)) return;
      if (line.includes("-->")) {
        if (current && current.text) cues.push(current);
        current = { start: parseClock(line.split("-->")[0]), text: "" };
        return;
      }
      const inlineMatch = line.match(inline);
      if (inlineMatch && line.length < 240) {
        if (current && current.text) cues.push(current);
        current = { start: parseClock(line), text: inlineMatch[4] };
        return;
      }
      if (timeOnly.test(line)) {
        if (current && current.text) cues.push(current);
        current = { start: parseClock(line), text: "" };
        return;
      }
      if (!current) current = { start: cues.length ? cues[cues.length - 1].start : 0, text: "" };
      current.text = `${current.text} ${line}`.trim();
    });
    if (current && current.text) cues.push(current);
    return tidyCues(cues);
  }

  function maybeMerge(cues) {
    if (cues.length < 8) return cues;
    const average = cues.reduce((sum, cue) => sum + cue.text.split(/\s+/).length, 0) / cues.length;
    if (average > 6) return cues;
    const merged = [];
    let bucket = null;
    cues.forEach((cue) => {
      if (!bucket) {
        bucket = { start: cue.start, text: cue.text };
        return;
      }
      const words = bucket.text.split(/\s+/).length;
      if (cue.start - bucket.start < 8 && words < 26) {
        bucket.text = `${bucket.text} ${cue.text}`.replace(/\s+/g, " ").trim();
      } else {
        merged.push(bucket);
        bucket = { start: cue.start, text: cue.text };
      }
    });
    if (bucket) merged.push(bucket);
    return merged;
  }

  function parseTranscript(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    let cues = [];
    if (raw.startsWith("{") && raw.includes("\"events\"")) {
      try { cues = parseJson3(raw); } catch (error) { cues = []; }
    }
    if (!cues.length && (raw.includes("<transcript") || raw.includes("<tt") || raw.includes("<text "))) {
      cues = parseXml(raw);
    }
    if (!cues.length && (raw.includes("WEBVTT") || raw.includes("-->"))) cues = parseVtt(raw);
    if (!cues.length) cues = parseLoose(raw);
    return maybeMerge(cues);
  }

  function findInText(text) {
    const hits = [];
    const occupied = [];
    getPatterns().forEach((pattern) => {
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(pattern.alias)}(?![A-Za-z0-9])`, "gi");
      let match;
      while ((match = re.exec(text))) {
        const start = match.index;
        const end = start + match[0].length;
        if (occupied.some((span) => start < span.end && end > span.start)) continue;
        occupied.push({ start, end });
        hits.push({ id: pattern.id, start, end, surface: match[0] });
      }
    });
    hits.sort((a, b) => a.start - b.start);
    return hits;
  }

  function findInCues(cues) {
    const hits = [];
    cues.forEach((cue, cueIndex) => {
      findInText(cue.text).forEach((hit) => {
        hits.push({
          ...hit,
          cueIndex,
          time: cue.start,
          quote: cue.text
        });
      });
    });
    return hits;
  }

  function parseVideoId(input) {
    const value = String(input || "").trim();
    if (/^[\w-]{11}$/.test(value)) return value;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0];
        if (id && /^[\w-]{11}$/.test(id)) return id;
      }
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
      const path = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
      if (path) return path[1];
    } catch (error) { /* not a url */ }
    const loose = value.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
    return loose ? loose[1] : null;
  }

  async function fetchText(url, timeoutMs) {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs || 9000) });
    if (!response.ok) throw new Error(`${response.status}`);
    return response.text();
  }

  function cuesFromPayload(text) {
    const cues = parseTranscript(text);
    return cues.length >= 2 ? cues : [];
  }

  async function fetchCaptions(videoId) {
    const failures = [];

    const invidious = ["https://invidious.f5.si"];
    for (const base of invidious) {
      try {
        const listed = await fetchText(`${base}/api/v1/captions/${videoId}`, 8000);
        let tracks = [];
        try { tracks = JSON.parse(listed).captions || []; } catch (error) { tracks = []; }
        const english = tracks.find((track) => /^en/i.test(track.languageCode || "")) || tracks[0];
        if (english) {
          const trackUrl = english.url.startsWith("http") ? english.url : `${base}${english.url}`;
          const body = await fetchText(trackUrl, 8000);
          const cues = cuesFromPayload(body);
          if (cues.length) return { cues, source: english.label || "영어 자막" };
        }
        const direct = await fetchText(`${base}/api/v1/captions/${videoId}?lang=en`, 8000);
        const cues = cuesFromPayload(direct);
        if (cues.length) return { cues, source: "영어 자막" };
      } catch (error) {
        failures.push(error.message);
      }
    }

    const piped = [
      "https://api.piped.private.coffee",
      "https://pipedapi.darkness.services",
      "https://pipedapi.owo.si"
    ];
    for (const base of piped) {
      try {
        const meta = JSON.parse(await fetchText(`${base}/streams/${videoId}`, 9000));
        const subs = meta.subtitles || [];
        const english = subs.find((item) => item.code === "en" && !item.autoGenerated)
          || subs.find((item) => String(item.code || "").startsWith("en"))
          || null;
        if (!english) continue;
        const body = await fetchText(english.url, 9000);
        const cues = cuesFromPayload(body);
        if (cues.length) return { cues, source: english.name || "영어 자막", title: meta.title || "" };
      } catch (error) {
        failures.push(error.message);
      }
    }

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
    const proxies = [
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];
    for (const proxy of proxies) {
      try {
        const html = await fetchText(proxy(watchUrl), 12000);
        const match = html.match(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
        if (!match) continue;
        const captionUrl = `${match[1].replace(/\\u0026/g, "&")}&fmt=json3`;
        const body = await fetchText(proxy(captionUrl), 10000);
        const cues = cuesFromPayload(body);
        if (cues.length) return { cues, source: "자동 생성 자막" };
      } catch (error) {
        failures.push(error.message);
      }
    }

    const error = new Error("자막을 가져오지 못했습니다.");
    error.details = failures;
    throw error;
  }

  window.SIM = {
    parseVideoId,
    parseTranscript,
    findInText,
    findInCues,
    fetchCaptions,
    termById(id) {
      return terms().find((term) => term.id === id) || null;
    }
  };
})();
