/**
 * Script for Seo Jeong-gwan Portfolio & SIM Interactive Showcase
 */

// --- 1. DICTIONARY DATABASE ---
const dictionaryData = [
  {
    id: "offside-trap",
    term: "Offside Trap",
    category: "defense",
    categoryLabel: "전술 / 수비",
    phonetic: "[ˌɔːf.saɪd ˈtræp] · 오프사이드 트랩",
    desc: "수비 라인을 동시에 앞으로 올리며 공격수를 오프사이드로 만드는 포석. 중계에서는 수비 전술 전환을 알릴 때 씁니다.",
    detail: "수비수들이 약속된 타이밍에 함께 전진해 패스의 수취인을 오프사이드 위치에 남겨두는 조직적인 수비 기법.",
    quote: "“And the whole back line steps up — and that's the offside trap, caught clean!”",
    translation: "“그리고 최종 수비 라인 전체가 전진합니다 — 완벽한 오프사이드 트랩이 걸렸습니다!”"
  },
  {
    id: "screamer",
    term: "Screamer",
    category: "shot",
    categoryLabel: "슈팅 / 득점",
    phonetic: "[ˈskriː.mər] · 스크리머 (대포알 중거리 슛)",
    desc: "골키퍼가 손도 댈 수 없을 정도로 엄청난 파워와 궤적으로 구석에 꽂히는 환상적인 장거리 중거리 슛을 뜻하는 중계 관용구.",
    detail: "관중과 해설진을 비명(Scream) 지르게 만들 만큼 압도적인 골을 칭찬할 때 감탄사로 쓰임.",
    quote: "“Oh what a screamer from thirty yards out! Absolutely unstoppable!”",
    translation: "“30야드 밖에서 터진 엄청난 대포알 슛입니다! 도저히 막을 수 없는 궤적입니다!”"
  },
  {
    id: "clean-sheet",
    term: "Clean Sheet",
    category: "defense",
    categoryLabel: "수비 / 골키퍼",
    phonetic: "[ˌkliːn ˈʃiːt] · 클린 시트 (무실점 경기)",
    desc: "경기 종료까지 상대 팀에게 단 한 점의 실점도 허용하지 않고 0점으로 막아낸 경기 또는 골키퍼의 기록.",
    detail: "과거 기록지에 상대 득점을 적지 않아 종이가 깨끗했다는 유래에서 비롯된 전통적인 중계 표현.",
    quote: "“A masterclass in defending tonight, earning yet another precious clean sheet.”",
    translation: "“오늘 밤 수비의 정석을 보여주며 또 하나의 귀중한 무실점 승리를 거둡니다.”"
  },
  {
    id: "high-press",
    term: "High Press (Gegenpressing)",
    category: "tactic",
    categoryLabel: "전술 / 압박",
    phonetic: "[haɪ pres] · 전방 압박 / 게겐프레싱",
    desc: "상대 진영 깊숙한 곳에서부터 전방 공격수와 미드필더들이 강하게 달라붙어 볼을 즉시 탈취하려는 공격적 수비 전술.",
    detail: "클롭 감독의 리버풀이나 펩 과르디올라의 맨시티 등 현대 축구의 핵심 트렌드.",
    quote: "“They are suffocating the defenders with this relentless high press!”",
    translation: "“이 끈질긴 전방 압박으로 상대 수비수들의 숨통을 틀어막고 있습니다!”"
  },
  {
    id: "brace",
    term: "Brace",
    category: "shot",
    categoryLabel: "슈팅 / 득점",
    phonetic: "[breɪs] · 브레이스 (한 경기 2골)",
    desc: "한 선수가 단일 경기에서 2골을 연달아 기록했을 때 사용하는 클래식한 축구 중계 용어 (3골은 Hat-trick).",
    detail: "사냥에서 2마리의 짐승을 묶는 단위에서 유래하여 축구 2득점을 지칭하게 됨.",
    quote: "“He seals his brace for the afternoon with a composed side-foot finish!”",
    translation: "“침착한 인사이드 마무리로 오늘 오후 자신의 두 번째 골(멀티골)을 완성합니다!”"
  },
  {
    id: "low-block",
    term: "Low Block (Park the bus)",
    category: "defense",
    categoryLabel: "전술 / 수비",
    phonetic: "[loʊ blɑːk] · 딥 로우 블록 (밀집 수비)",
    desc: "페널티 박스 바로 앞까지 수비 라인을 극단적으로 내려 공간을 주지 않고 걸어 잠그는 수비 진형.",
    detail: "강팀을 상대하는 언더독 팀들이 역습 한 방을 노리기 위해 주로 구사하는 전술.",
    quote: "“It's a stubborn low block that is proving almost impossible to break down.”",
    translation: "“도저히 뚫어내기 힘든 완강한 밀집 수비 형태를 유지하고 있습니다.”"
  },
  {
    id: "box-to-box",
    term: "Box-to-Box",
    category: "tactic",
    categoryLabel: "포지션 / 전술",
    phonetic: "[bɑːks tuː bɑːks] · 박스 투 박스",
    desc: "자기 진영 페널티 박스부터 상대 진영 페널티 박스까지 경기장 전체를 왕성한 활동량으로 누비는 중앙 미드필더 유형.",
    detail: "수비 가담과 공격 침투를 90분 내내 높은 체력으로 수행하는 핵심 플레이메이커.",
    quote: "“An energetic box-to-box display, dominating both ends of the pitch today.”",
    translation: "“오늘 경기장 양 끝을 모두 지배하는 왕성한 박스 투 박스 활약상을 보여줍니다.”"
  },
  {
    id: "rabona",
    term: "Rabona",
    category: "shot",
    categoryLabel: "스킬 / 테크닉",
    phonetic: "[rəˈboʊnə] · 라보나 킥",
    desc: "디딤발 뒤쪽으로 차는 다리를 꼬아 차는 고난도의 화려한 개인기 슈팅 또는 크로스 기술.",
    detail: "각도가 안 나오거나 반대 발 사용이 어려울 때 기습적인 궤적을 만들기 위해 시도됨.",
    quote: "“He's pulled off an audacious rabona cross right into the danger area!”",
    translation: "“위험 지역으로 대담한 라보나 크로스를 완벽하게 찔러 넣었습니다!”"
  }
];

// --- 2. MATCH PRESETS FOR ANALYSIS ---
const matchPresets = {
  epl: {
    title: "Premier League: Man City vs Arsenal (High Tension Clash)",
    items: [
      {
        time: "08:24",
        term: "High Press",
        kr: "전방 압박",
        quote: "“Arsenal applying an aggressive high press early on, forcing the error from the backline.”",
        note: "아스날이 경기 초반 맨시티의 후방 빌드업을 끊기 위해 전방 압박을 강하게 가져가는 장면 해설."
      },
      {
        time: "23:45",
        term: "Offside Trap",
        kr: "오프사이드 트랩",
        quote: "“Look at the timing of that defensive line — classic offside trap executed to perfection.”",
        note: "맨시티 수비수들이 완벽한 호흡으로 라인을 올려 상대 침투 공격수를 오프사이드에 빠뜨림."
      },
      {
        time: "41:12",
        term: "Screamer",
        kr: "환상적인 중거리 슛",
        quote: "“De Bruyne with absolute venom in that strike — WHAT A SCREAMER into the top corner!”",
        note: "더 브라위너의 전매특허 대포알 중거리 골 순간 해설진의 격렬한 리액션."
      },
      {
        time: "67:30",
        term: "Low Block",
        kr: "밀집 수비 진형",
        quote: "“They've dropped into a compact low block now, defending this narrow one-goal cushion.”",
        note: "리드를 지키기 위해 후반전 수비 라인을 깊게 내려 공간을 틀어막는 전술적 변화 설명."
      },
      {
        time: "89:15",
        term: "Clean Sheet",
        kr: "무실점 경기 달성",
        quote: "“The final whistle blows! A hard-fought victory and a well-deserved clean sheet.”",
        note: "끝까지 집중력을 잃지 않고 1-0 무실점으로 경기를 마친 수비진을 극찬하는 코멘트."
      }
    ]
  },
  ucl: {
    title: "UEFA Champions League Final: Real Madrid vs Dortmund",
    items: [
      {
        time: "14:10",
        term: "Box-to-Box",
        kr: "박스 투 박스 기동력",
        quote: "“Bellingham covering every blade of grass with that textbook box-to-box movement.”",
        note: "수비 지원 후 상대 박스 안까지 빠르게 쇄도하는 미드필더의 폭넓은 기동력 묘사."
      },
      {
        time: "55:02",
        term: "Counter-Attack (Breakaway)",
        kr: "역습 전개",
        quote: "“In the blink of an eye, Madrid turn defense into an electric counter-attack!”",
        note: "상대 공격을 차단하자마자 세 번의 원터치 패스로 상대 골문 앞까지 도달하는 전격 역습."
      },
      {
        time: "74:20",
        term: "Near Post Header",
        kr: "니어 포스트 헤더",
        quote: "“Carvajal darts to the near post and glances it home! Set-piece magic!”",
        note: "코너킥 세트피스 상황에서 니어 포스트로 쇄도해 머리로 방향을 바꾸는 득점."
      },
      {
        time: "83:40",
        term: "Brace",
        kr: "멀티골 (2득점)",
        quote: "“Vinicius doubles the lead! That's his brace on the biggest European night!”",
        note: "챔피언스리그 결승전에서 승부에 쐐기를 박는 두 번째 골을 넣은 공격수 찬사."
      }
    ]
  },
  son: {
    title: "Son Heung-min Wonder Goal & Masterclass Highlights",
    items: [
      {
        time: "12:05",
        term: "Curler (Bender)",
        kr: "감아차기 (손흥민 존 슈팅)",
        quote: "“Son bends it with pure artistry into the far side-netting! Signature finish!”",
        note: "페널티 박스 좌측 모서리에서 파포스트를 향해 감아 차는 전매특허 슈팅 해설."
      },
      {
        time: "38:40",
        term: "Solo Sprint (Coast to Coast)",
        kr: "단독 드리블 질주",
        quote: "“He's running through the entire team — 70 yards of pure electric pace and composure!”",
        note: "자기 진영에서부터 단독 질주로 상대 수비진 5명을 제치고 골을 넣는 번리전 푸스카스골 스타일 해설."
      },
      {
        time: "79:15",
        term: "Tap-in Assist",
        kr: "원터치 탭인 어시스트",
        quote: "“Selfless play by the captain, serving it on a silver platter for a simple tap-in.”",
        note: "욕심부리지 않고 동료에게 완벽한 찬스를 찔러주어 쉽게 발만 대는 득점을 만들어준 플레이."
      }
    ]
  }
};

// --- 3. DOM LOAD & INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initDictionary();
  initAnalysisPreset();
  initSpeechSynthesis();
  initResumeModal();
});

// --- 4. NAVIGATION & SMOOTH SCROLL ---
function initNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const scrollButtons = document.querySelectorAll(".scroll-to-btn");
  const sections = document.querySelectorAll("section[id]");

  // Navigation click
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Hero CTA buttons
  scrollButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const scrollTarget = btn.getAttribute("data-scroll");
      const section = document.getElementById(scrollTarget);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Scroll spy with IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navButtons.forEach(btn => {
          if (btn.getAttribute("data-target") === id) {
            btn.classList.add("active");
          } else {
            btn.classList.remove("active");
          }
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(sec => observer.observe(sec));
}

// --- 5. SIM VIRTUAL TABS SWITCHING ---
const tabButtons = document.querySelectorAll(".sim-tab-btn");
const pageViews = document.querySelectorAll(".sim-page-view");
const simNavLinks = document.querySelectorAll(".sim-nav-link");

function switchSimTab(tabId) {
  // Update mock browser top tab buttons
  tabButtons.forEach(btn => {
    if (btn.getAttribute("data-sim-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update virtual SIM navbar active link
  simNavLinks.forEach((link, idx) => {
    const tabs = ["home-tab", "dict-tab", "analysis-tab"];
    if (tabs[idx] === tabId) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Show corresponding view
  pageViews.forEach(view => {
    if (view.id === tabId) {
      view.classList.add("active");
    } else {
      view.classList.remove("active");
    }
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-sim-tab");
    switchSimTab(target);
  });
});

// --- 6. DICTIONARY RENDERING & SEARCH ---
function initDictionary() {
  const grid = document.getElementById("dictCardsGrid");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const inlineSearch = document.getElementById("dictInlineSearch");
  const homeSearchInput = document.getElementById("simHomeSearchInput");
  const homeSearchBtn = document.getElementById("simSearchTriggerBtn");

  function renderDictionary(filter = "all", query = "") {
    grid.innerHTML = "";
    const cleanQuery = query.toLowerCase().trim();

    const filtered = dictionaryData.filter(item => {
      const matchFilter = (filter === "all") || (item.category === filter);
      const matchQuery = cleanQuery === "" || 
        item.term.toLowerCase().includes(cleanQuery) || 
        item.desc.toLowerCase().includes(cleanQuery) || 
        item.translation.toLowerCase().includes(cleanQuery);
      return matchFilter && matchQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: #94a3b8;">
          <i class="fa-solid fa-face-meh" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          검색된 중계 용어가 없습니다. 다른 검색어를 입력해 보세요.
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement("div");
      card.className = "dict-item-card";
      card.innerHTML = `
        <div class="dict-card-top">
          <span class="dict-card-cat">${item.categoryLabel}</span>
          <button class="btn-audio" onclick="speakText('${escapeQuotes(item.term)}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
            <i class="fa-solid fa-volume-high"></i> 듣기
          </button>
        </div>
        <div>
          <h4 class="dict-card-title">${item.term}</h4>
          <span class="dict-card-kr">${item.phonetic}</span>
        </div>
        <p class="dict-card-desc">${item.desc}</p>
        <div class="dict-card-quote">
          ${item.quote}
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // Initial render
  renderDictionary();

  // Filter click
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.getAttribute("data-filter");
      renderDictionary(filter, inlineSearch.value);
    });
  });

  // Search input in dictionary tab
  if (inlineSearch) {
    inlineSearch.addEventListener("input", (e) => {
      const activeFilter = document.querySelector(".filter-btn.active")?.getAttribute("data-filter") || "all";
      renderDictionary(activeFilter, e.target.value);
    });
  }

  // Home search bar handler
  if (homeSearchBtn && homeSearchInput) {
    homeSearchBtn.addEventListener("click", () => {
      handleHomeSearch(homeSearchInput.value);
    });

    homeSearchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleHomeSearch(homeSearchInput.value);
      }
    });
  }
}

// Search & update featured card on Home Tab
function searchSimWord(wordName) {
  const input = document.getElementById("simHomeSearchInput");
  if (input) input.value = wordName;
  handleHomeSearch(wordName);
}

function handleHomeSearch(query) {
  const q = query.trim().toLowerCase();
  const matched = dictionaryData.find(item => 
    item.term.toLowerCase().includes(q) || 
    item.desc.toLowerCase().includes(q)
  );

  if (matched) {
    document.getElementById("featuredTitle").innerText = matched.term;
    document.getElementById("featuredPhonetic").innerText = matched.phonetic;
    document.getElementById("featuredDesc").innerHTML = `<strong>개념 요약:</strong> ${matched.desc}`;
    document.getElementById("featuredDetail").innerText = matched.detail;
    document.getElementById("featuredQuote").innerText = matched.quote;
    document.getElementById("featuredTrans").innerText = matched.translation;

    // Flash animation
    const card = document.getElementById("featuredWordCard");
    card.style.transform = "scale(1.02)";
    card.style.borderColor = "var(--accent-green)";
    setTimeout(() => {
      card.style.transform = "scale(1)";
    }, 250);
  } else {
    // If not found in featured list, switch to dictionary tab and search
    switchSimTab("dict-tab");
    const inlineSearch = document.getElementById("dictInlineSearch");
    if (inlineSearch) {
      inlineSearch.value = query;
      inlineSearch.dispatchEvent(new Event("input"));
    }
  }
}

// --- 7. ANALYSIS PRESETS & SIMULATION ---
function initAnalysisPreset() {
  const presetBtns = document.querySelectorAll(".preset-btn");
  const analyzeBtn = document.getElementById("btnRunAnalysis");
  const ytInput = document.getElementById("ytUrlInput");

  function loadMatchTimeline(key) {
    const data = matchPresets[key] || matchPresets.epl;
    const titleEl = document.getElementById("currentMatchTitle");
    const countEl = document.getElementById("extractedCount");
    const listEl = document.getElementById("timelineList");

    titleEl.innerText = data.title;
    countEl.innerText = `${data.items.length}개 표현 추출됨`;
    listEl.innerHTML = "";

    data.items.forEach(item => {
      const card = document.createElement("div");
      card.className = "timeline-card";
      card.innerHTML = `
        <div class="time-badge">
          <i class="fa-solid fa-clock"></i> ${item.time}
        </div>
        <div class="timeline-body">
          <div class="timeline-word-head">
            <span class="timeline-word">${item.term}</span>
            <span class="timeline-word-kr">${item.kr}</span>
            <button class="btn-audio" onclick="speakText('${escapeQuotes(item.term)}')" style="margin-left: auto; padding: 0.2rem 0.5rem; font-size: 0.72rem;">
              <i class="fa-solid fa-volume-high"></i> 발음
            </button>
          </div>
          <div class="timeline-quote">${item.quote}</div>
          <div class="timeline-note"><i class="fa-solid fa-circle-info"></i> ${item.note}</div>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  // Load EPL by default
  loadMatchTimeline("epl");

  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const matchKey = btn.getAttribute("data-match");
      if (matchKey === "epl") {
        ytInput.value = "https://www.youtube.com/watch?v=PL-ManCity-vs-Arsenal-2024";
      } else if (matchKey === "ucl") {
        ytInput.value = "https://www.youtube.com/watch?v=UCL-Final-Real-vs-Dortmund";
      } else if (matchKey === "son") {
        ytInput.value = "https://www.youtube.com/watch?v=Son-Heung-Min-Wonder-Goals-All";
      }
      runAnalysisAnimation(matchKey);
    });
  });

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", () => {
      runAnalysisAnimation("epl");
    });
  }

  function runAnalysisAnimation(matchKey) {
    const listEl = document.getElementById("timelineList");
    listEl.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; color: #34d399;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 0.75rem; display: block;"></i>
        <span>유튜브 중계 영상 음성 및 코멘터리 타임라인 분석 중...</span>
      </div>
    `;

    setTimeout(() => {
      loadMatchTimeline(matchKey);
    }, 700);
  }
}

// --- 8. WEB SPEECH API (ENGLISH PRONUNCIATION) ---
function initSpeechSynthesis() {
  const featuredBtn = document.getElementById("featuredSpeechBtn");
  if (featuredBtn) {
    featuredBtn.addEventListener("click", () => {
      const title = document.getElementById("featuredTitle").innerText;
      speakText(title);
    });
  }
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    alert("현재 브라우저는 음성 듣기 기능을 지원하지 않습니다.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'");
}

// --- 9. RESUME FULL TEXT MODAL INTERACTION ---
function initResumeModal() {
  const modal = document.getElementById("resumeModal");
  const openBtnHero = document.getElementById("btnOpenResumeModal");
  const openBtnProfile = document.getElementById("btnTriggerResumeInline");
  const closeBtnX = document.getElementById("btnCloseResumeModal");
  const closeBtnBottom = document.getElementById("btnCloseResumeModalBottom");

  function openModal() {
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden"; // prevent background scrolling
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  if (openBtnHero) openBtnHero.addEventListener("click", openModal);
  if (openBtnProfile) openBtnProfile.addEventListener("click", openModal);
  if (closeBtnX) closeBtnX.addEventListener("click", closeModal);
  if (closeBtnBottom) closeBtnBottom.addEventListener("click", closeModal);

  // Close when clicking outside of dialog
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Close on ESC key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeModal();
    }
  });
}

