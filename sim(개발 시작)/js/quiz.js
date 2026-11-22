/* Situation pictures for the commentary quiz. */
(function () {
  const SCENE_OF = {
    offside: "offside",
    "offside-trap": "offside",
    "high-line": "highline",
    penalty: "penalty",
    panenka: "penalty",
    stonewall: "penalty",
    "free-kick": "freekick",
    corner: "corner",
    "near-post": "nearpost",
    "far-post": "farpost",
    inswinging: "corner",
    delivery: "corner",
    "set-piece": "corner",
    "six-yard": "box",
    goalmouth: "box",
    handball: "handball",
    "yellow-card": "yellow",
    "red-card": "red",
    "added-time": "board",
    "time-wasting": "board",
    advantage: "advantage",
    var: "var",
    equalizer: "goal",
    brace: "goal",
    "hat-trick": "goal",
    screamer: "shot",
    worldie: "shot",
    volley: "volley",
    "bicycle-kick": "bicycle",
    chip: "chip",
    curler: "curler",
    rabona: "rabona",
    "tap-in": "tapin",
    clinical: "tapin",
    "on-a-plate": "tapin",
    "one-touch": "pass",
    "through-ball": "through",
    "threaded-pass": "through",
    "in-behind": "through",
    "whipped-cross": "cross",
    cutback: "cutback",
    byline: "byline",
    "cut-inside": "cutinside",
    nutmeg: "nutmeg",
    "high-press": "press",
    gegenpress: "press",
    "pressing-trigger": "press",
    "low-block": "lowblock",
    "park-the-bus": "lowblock",
    "counter-attack": "counter",
    transition: "counter",
    "build-up": "buildup",
    "switch-of-play": "switchplay",
    overlap: "overlap",
    underlap: "underlap",
    "half-space": "halfspace",
    "rest-defence": "rest",
    "third-man": "third",
    "clean-sheet": "clean",
    "last-ditch": "tackle",
    "sliding-tackle": "tackle",
    "professional-foul": "foul",
    "fingertip-save": "save",
    "one-on-one": "oneonone",
    "big-chance": "oneonone",
    "sweeper-keeper": "sweeper",
    "off-the-line": "line",
    "false-nine": "false9",
    "box-to-box": "boxbox",
    "target-man": "target",
    playmaker: "playmaker",
    "holding-mid": "holding",
    "wing-back": "wingback",
    howler: "howler"
  };

  const CAT_SCENE = {
    law: "yellow",
    tactic: "press",
    attack: "shot",
    defense: "tackle",
    setpiece: "corner",
    keeper: "save",
    player: "playmaker",
    slang: "shot"
  };

  function pixelSprite(x, y, rows, colors, unit) {
    const width = rows[0].length * unit;
    const height = rows.length * unit;
    const left = Math.round(x - width / 2);
    const top = Math.round(y - height / 2);
    let body = "";
    rows.forEach((row, rowIndex) => {
      [...row].forEach((cell, column) => {
        const fill = colors[cell];
        if (!fill) return;
        body += `<rect x="${left + column * unit}" y="${top + rowIndex * unit}" width="${unit}" height="${unit}" fill="${fill}"/>`;
      });
    });
    return body;
  }

  function player(x, y, fill) {
    return pixelSprite(x, y, [
      "..hhh..",
      ".sssss.",
      ".s.s.s.",
      ".ccccc.",
      "ccccccc",
      ".pp.pp.",
      "..p.p..",
      ".bb.bb."
    ], {
      h: "#1c1917",
      s: "#f3c7a1",
      c: fill,
      p: "#1e293b",
      b: "#0f172a"
    }, 4);
  }

  function ball(x, y) {
    return pixelSprite(x, y, [
      "..ww..",
      ".wwww.",
      "wwbbww",
      "wwwwww",
      ".wwww.",
      "..ww.."
    ], {
      w: "#f8fafc",
      b: "#0f172a"
    }, 3);
  }

  function arrow(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f8fafc" stroke-width="3" marker-end="url(#quiz-arrow)"/>`;
  }

  function card(x, y, fill) {
    return `<rect x="${x}" y="${y}" width="18" height="26" rx="3" fill="${fill}" stroke="#052014" stroke-width="1.5" transform="rotate(-8 ${x + 9} ${y + 13})"/>`;
  }

  const ATTACK = "#7dd3fc";
  const DEFEND = "#f8fafc";
  const KEEP = "#fbbf24";

  const SCENES = {
    offside() {
      return `${player(168, 180, DEFEND)}${player(250, 100, ATTACK)}${ball(120, 210)}${arrow(128, 206, 230, 118)}<line x1="210" y1="48" x2="210" y2="312" stroke="#fbbf24" stroke-width="3" stroke-dasharray="8 6"/>`;
    },
    highline() {
      return `${player(230, 90, DEFEND)}${player(230, 150, DEFEND)}${player(230, 210, DEFEND)}${player(230, 270, DEFEND)}${player(360, 140, ATTACK)}${ball(300, 180)}${arrow(300, 180, 470, 160)}`;
    },
    penalty() {
      return `<circle cx="548" cy="180" r="4" fill="#f8fafc"/>${player(470, 180, ATTACK)}${player(590, 180, KEEP)}${ball(500, 180)}${arrow(508, 180, 560, 168)}`;
    },
    freekick() {
      return `${player(300, 150, DEFEND)}${player(300, 180, DEFEND)}${player(300, 210, DEFEND)}${player(300, 240, DEFEND)}${player(210, 200, ATTACK)}${ball(250, 190)}${arrow(258, 186, 520, 150)}`;
    },
    corner() {
      return `${ball(590, 46)}${player(520, 70, ATTACK)}${player(500, 140, ATTACK)}${player(540, 180, DEFEND)}${player(500, 210, DEFEND)}${arrow(560, 62, 520, 150)}`;
    },
    nearpost() {
      return `${ball(430, 80)}${player(560, 130, ATTACK)}${player(590, 170, KEEP)}${arrow(438, 88, 548, 138)}`;
    },
    farpost() {
      return `${ball(430, 70)}${player(545, 250, ATTACK)}${player(590, 160, KEEP)}${arrow(438, 78, 536, 236)}`;
    },
    box() {
      return `${player(500, 140, ATTACK)}${player(530, 190, ATTACK)}${player(500, 230, DEFEND)}${player(590, 180, KEEP)}${ball(520, 170)}`;
    },
    handball() {
      return `${player(430, 170, DEFEND)}<rect x="448" y="150" width="22" height="8" rx="3" fill="#fb7185" transform="rotate(-30 459 154)"/>${ball(468, 146)}${arrow(360, 120, 450, 148)}`;
    },
    yellow() {
      return `${player(300, 190, DEFEND)}${card(330, 150, "#fbbf24")}`;
    },
    red() {
      return `${player(300, 190, DEFEND)}${card(330, 150, "#fb7185")}`;
    },
    board() {
      return `<rect x="250" y="120" width="140" height="90" rx="8" fill="#0f172a" stroke="#f8fafc" stroke-width="3"/><text x="320" y="178" text-anchor="middle" fill="#f8fafc" font-size="42" font-family="sans-serif">+4</text>`;
    },
    advantage() {
      return `${player(220, 200, DEFEND)}${player(300, 160, ATTACK)}${ball(340, 150)}${arrow(348, 146, 500, 170)}`;
    },
    var() {
      return `<rect x="230" y="110" width="180" height="110" rx="10" fill="#0f172a" stroke="#67e8f9" stroke-width="3"/>${player(280, 170, ATTACK)}${ball(330, 165)}<polyline points="250,200 290,155 330,175 390,140" fill="none" stroke="#67e8f9" stroke-width="3"/>`;
    },
    goal() {
      return `${player(430, 180, ATTACK)}${ball(575, 150)}${player(590, 190, KEEP)}<rect x="560" y="130" width="48" height="100" fill="none" stroke="#f8fafc" stroke-width="3"/>`;
    },
    shot() {
      return `${player(360, 190, ATTACK)}${ball(470, 110)}${arrow(390, 175, 530, 145)}`;
    },
    volley() {
      return `${player(400, 190, ATTACK)}<line x1="392" y1="176" x2="418" y2="150" stroke="#052014" stroke-width="4"/>${ball(430, 140)}`;
    },
    bicycle() {
      return `${player(390, 200, ATTACK)}<line x1="378" y1="188" x2="360" y2="150" stroke="#052014" stroke-width="4"/><line x1="400" y1="188" x2="424" y2="158" stroke="#052014" stroke-width="4"/>${ball(430, 145)}`;
    },
    chip() {
      return `${player(340, 200, ATTACK)}${player(500, 180, KEEP)}${ball(430, 90)}<path d="M360 190 Q430 70 520 160" fill="none" stroke="#f8fafc" stroke-width="3"/>`;
    },
    curler() {
      return `${player(300, 220, ATTACK)}${ball(470, 120)}<path d="M320 210 Q420 220 500 140" fill="none" stroke="#f8fafc" stroke-width="3" marker-end="url(#quiz-arrow)"/>`;
    },
    rabona() {
      return `${player(360, 190, ATTACK)}<line x1="348" y1="188" x2="390" y2="160" stroke="#052014" stroke-width="4"/>${ball(410, 150)}${arrow(418, 146, 520, 160)}`;
    },
    tapin() {
      return `${player(520, 190, ATTACK)}${ball(548, 180)}${arrow(430, 160, 530, 176)}`;
    },
    pass() {
      return `${player(180, 200, ATTACK)}${player(340, 140, ATTACK)}${ball(250, 170)}${arrow(190, 190, 320, 150)}`;
    },
    through() {
      return `${player(200, 210, ATTACK)}${player(280, 150, DEFEND)}${player(430, 120, ATTACK)}${ball(250, 180)}${arrow(210, 200, 410, 130)}`;
    },
    cross() {
      return `${player(520, 70, ATTACK)}${player(470, 190, ATTACK)}${ball(500, 100)}${arrow(520, 86, 478, 172)}`;
    },
    cutback() {
      return `${player(560, 250, ATTACK)}${player(470, 180, ATTACK)}${ball(520, 220)}${arrow(548, 240, 486, 196)}`;
    },
    byline() {
      return `<line x1="560" y1="40" x2="560" y2="320" stroke="#fbbf24" stroke-width="3"/>${player(530, 250, ATTACK)}${ball(548, 270)}`;
    },
    cutinside() {
      return `${player(500, 80, ATTACK)}${ball(430, 140)}${arrow(490, 90, 430, 150)}`;
    },
    nutmeg() {
      return `${player(340, 180, DEFEND)}<line x1="328" y1="188" x2="316" y2="214" stroke="#052014" stroke-width="4"/><line x1="352" y1="188" x2="364" y2="214" stroke="#052014" stroke-width="4"/>${ball(340, 206)}${arrow(250, 180, 330, 200)}`;
    },
    press() {
      return `${player(180, 120, DEFEND)}${player(250, 100, ATTACK)}${player(250, 150, ATTACK)}${player(210, 170, ATTACK)}${ball(190, 130)}`;
    },
    lowblock() {
      return `${player(470, 90, DEFEND)}${player(500, 140, DEFEND)}${player(500, 190, DEFEND)}${player(500, 240, DEFEND)}${player(470, 280, DEFEND)}${player(250, 180, ATTACK)}${ball(300, 180)}`;
    },
    counter() {
      return `${player(160, 200, ATTACK)}${player(280, 150, ATTACK)}${player(420, 120, ATTACK)}${ball(250, 175)}${arrow(180, 190, 400, 130)}`;
    },
    buildup() {
      return `${player(90, 180, KEEP)}${player(180, 120, DEFEND)}${player(180, 240, DEFEND)}${player(280, 180, ATTACK)}${ball(150, 170)}${arrow(100, 175, 260, 180)}`;
    },
    switchplay() {
      return `${player(160, 80, ATTACK)}${player(160, 280, ATTACK)}${ball(180, 100)}${arrow(180, 110, 180, 250)}`;
    },
    overlap() {
      return `${player(300, 120, ATTACK)}${player(250, 90, ATTACK)}${ball(310, 130)}${arrow(270, 100, 430, 70)}`;
    },
    underlap() {
      return `${player(320, 100, ATTACK)}${player(300, 150, ATTACK)}${ball(310, 145)}${arrow(320, 140, 450, 120)}`;
    },
    halfspace() {
      return `<rect x="250" y="70" width="70" height="220" fill="rgba(251,191,36,.18)"/>${player(285, 170, ATTACK)}${ball(300, 180)}`;
    },
    rest() {
      return `${player(420, 120, ATTACK)}${player(460, 160, ATTACK)}${ball(450, 140)}${player(180, 200, DEFEND)}${player(180, 250, DEFEND)}${player(220, 230, DEFEND)}`;
    },
    third() {
      return `${player(180, 200, ATTACK)}${player(300, 120, ATTACK)}${player(430, 180, ATTACK)}${ball(240, 170)}${arrow(190, 190, 280, 140)}${arrow(310, 130, 410, 170)}`;
    },
    clean() {
      return `<rect x="548" y="120" width="60" height="120" fill="none" stroke="#f8fafc" stroke-width="3"/>${player(590, 180, KEEP)}<text x="300" y="190" fill="#f8fafc" font-size="54" font-family="sans-serif">0</text>`;
    },
    tackle() {
      return `${player(360, 170, ATTACK)}${ball(390, 185)}${player(400, 210, DEFEND)}<line x1="390" y1="205" x2="430" y2="230" stroke="#052014" stroke-width="4"/>`;
    },
    foul() {
      return `${player(340, 160, ATTACK)}${player(370, 200, DEFEND)}${ball(400, 145)}<path d="M350 175 L390 210" stroke="#fb7185" stroke-width="4"/>`;
    },
    save() {
      return `${player(470, 160, ATTACK)}${player(575, 200, KEEP)}<line x1="560" y1="190" x2="530" y2="150" stroke="#052014" stroke-width="4"/>${ball(520, 145)}`;
    },
    oneonone() {
      return `${player(400, 180, ATTACK)}${player(560, 180, KEEP)}${ball(450, 180)}${arrow(420, 175, 500, 170)}`;
    },
    sweeper() {
      return `${player(430, 180, KEEP)}${ball(360, 160)}${arrow(400, 175, 330, 155)}`;
    },
    line() {
      return `<line x1="560" y1="130" x2="560" y2="230" stroke="#f8fafc" stroke-width="4"/>${player(545, 180, KEEP)}${ball(555, 160)}`;
    },
    false9() {
      return `${player(300, 180, ATTACK)}${player(470, 110, DEFEND)}${player(470, 250, DEFEND)}${ball(320, 180)}`;
    },
    boxbox() {
      return `${player(160, 240, ATTACK)}${player(460, 100, ATTACK)}${arrow(180, 220, 430, 120)}`;
    },
    target() {
      return `${player(460, 170, ATTACK)}${player(250, 120, ATTACK)}${player(250, 240, ATTACK)}${ball(400, 165)}${arrow(270, 130, 430, 165)}`;
    },
    playmaker() {
      return `${player(280, 180, ATTACK)}${player(420, 100, ATTACK)}${player(450, 180, ATTACK)}${player(420, 250, ATTACK)}${ball(300, 180)}${arrow(300, 170, 410, 110)}`;
    },
    holding() {
      return `${player(240, 180, DEFEND)}${player(180, 120, ATTACK)}${player(180, 240, ATTACK)}${ball(230, 180)}`;
    },
    wingback() {
      return `${player(160, 70, ATTACK)}${player(430, 70, ATTACK)}${arrow(180, 70, 400, 70)}`;
    },
    howler() {
      return `${player(560, 200, KEEP)}${ball(500, 250)}${arrow(545, 205, 490, 245)}`;
    }
  };

  // 퀴즈의 모든 상황은 경기 사진이다. 점수·추가시간처럼 전광판이 정의인 용어는 그 보드를 함께 보여 준다.
  // 슈팅·패스는 등의 뒤에서 보고, 발에 닿는 공만 선명하다. 이후 궤적은 흐리게, 설명이 말하는 방향으로 간다.
  // 수비는 공 하나로 경합한다. 자세가 용어 설명과 다르면 넣지 않는다.
  const SKILL_IMAGE = {
    offside: "assets/quiz/offside.jpg?v=1",
    "offside-trap": "assets/quiz/offside-trap.jpg?v=1",
    "high-line": "assets/quiz/high-line.jpg?v=1",
    penalty: "assets/quiz/penalty.jpg?v=2",
    stonewall: "assets/quiz/stonewall.jpg?v=1",
    panenka: "assets/quiz/panenka.jpg?v=4",
    "free-kick": "assets/quiz/free-kick.jpg?v=2",
    "set-piece": "assets/quiz/free-kick.jpg?v=2",
    corner: "assets/quiz/corner.jpg?v=2",
    inswinging: "assets/quiz/inswinging.jpg?v=1",
    handball: "assets/quiz/handball.jpg?v=1",
    "yellow-card": "assets/quiz/yellow-card.jpg?v=1",
    "red-card": "assets/quiz/red-card.jpg?v=1",
    "added-time": "assets/quiz/added-time.jpg?v=2",
    "time-wasting": "assets/quiz/time-wasting.jpg?v=1",
    advantage: "assets/quiz/advantage.jpg?v=1",
    var: "assets/quiz/var.jpg?v=1",
    equalizer: "assets/quiz/equalizer.jpg?v=1",
    brace: "assets/quiz/brace.jpg?v=1",
    "hat-trick": "assets/quiz/hat-trick.jpg?v=1",
    "high-press": "assets/quiz/high-press.jpg?v=1",
    gegenpress: "assets/quiz/gegenpress.jpg?v=1",
    "pressing-trigger": "assets/quiz/high-press.jpg?v=1",
    "low-block": "assets/quiz/low-block.jpg?v=1",
    "park-the-bus": "assets/quiz/low-block.jpg?v=1",
    "counter-attack": "assets/quiz/counter.jpg?v=1",
    transition: "assets/quiz/counter.jpg?v=1",
    "build-up": "assets/quiz/buildup.jpg?v=1",
    "switch-of-play": "assets/quiz/switch.jpg?v=1",
    overlap: "assets/quiz/overlap.jpg?v=1",
    underlap: "assets/quiz/underlap.jpg?v=1",
    "half-space": "assets/quiz/halfspace.jpg?v=1",
    "in-behind": "assets/quiz/through-ball.jpg?v=5",
    "rest-defence": "assets/quiz/rest-defence.jpg?v=1",
    "third-man": "assets/quiz/third-man.jpg?v=1",
    "through-ball": "assets/quiz/through-ball.jpg?v=5",
    "threaded-pass": "assets/quiz/through-ball.jpg?v=5",
    screamer: "assets/quiz/screamer.jpg?v=4",
    worldie: "assets/quiz/screamer.jpg?v=4",
    curler: "assets/quiz/curler.jpg?v=4",
    volley: "assets/quiz/volley.jpg?v=4",
    "tap-in": "assets/quiz/tap-in.jpg?v=4",
    clinical: "assets/quiz/tap-in.jpg?v=4",
    "on-a-plate": "assets/quiz/tap-in.jpg?v=4",
    chip: "assets/quiz/chip.jpg?v=4",
    rabona: "assets/quiz/rabona.jpg?v=4",
    "bicycle-kick": "assets/quiz/bicycle-kick.jpg?v=7",
    "one-touch": "assets/quiz/one-touch.jpg?v=5",
    "whipped-cross": "assets/quiz/whipped-cross.jpg?v=5",
    delivery: "assets/quiz/whipped-cross.jpg?v=5",
    cutback: "assets/quiz/cutback.jpg?v=4",
    byline: "assets/quiz/byline.jpg?v=1",
    "cut-inside": "assets/quiz/cut-inside.jpg?v=5",
    "near-post": "assets/quiz/near-post.jpg?v=1",
    "far-post": "assets/quiz/far-post.jpg?v=1",
    "six-yard": "assets/quiz/six-yard.jpg?v=1",
    goalmouth: "assets/quiz/six-yard.jpg?v=1",
    "clean-sheet": "assets/quiz/clean-sheet.jpg?v=2",
    "last-ditch": "assets/quiz/sliding-tackle.jpg?v=4",
    "sliding-tackle": "assets/quiz/sliding-tackle.jpg?v=4",
    "professional-foul": "assets/quiz/professional-foul.jpg?v=1",
    "fingertip-save": "assets/quiz/fingertip-save.jpg?v=4",
    "one-on-one": "assets/quiz/one-on-one.jpg?v=1",
    "big-chance": "assets/quiz/one-on-one.jpg?v=1",
    "sweeper-keeper": "assets/quiz/sweeper-keeper.jpg?v=1",
    "off-the-line": "assets/quiz/off-the-line.jpg?v=1",
    "false-nine": "assets/quiz/false-nine.jpg?v=1",
    "box-to-box": "assets/quiz/box-to-box.jpg?v=1",
    "target-man": "assets/quiz/target-man.jpg?v=1",
    playmaker: "assets/quiz/playmaker.jpg?v=1",
    "holding-mid": "assets/quiz/holding-mid.jpg?v=1",
    "wing-back": "assets/quiz/wing-back.jpg?v=1",
    howler: "assets/quiz/howler.jpg?v=1",
    nutmeg: "assets/quiz/nutmeg.jpg?v=4"
  };

  const CAT_PHOTO = {
    law: "assets/quiz/yellow-card.jpg?v=1",
    tactic: "assets/quiz/high-press.jpg?v=1",
    attack: "assets/quiz/screamer.jpg?v=4",
    defense: "assets/quiz/sliding-tackle.jpg?v=4",
    setpiece: "assets/quiz/corner.jpg?v=2",
    keeper: "assets/quiz/fingertip-save.jpg?v=4",
    player: "assets/quiz/playmaker.jpg?v=1",
    slang: "assets/quiz/screamer.jpg?v=4"
  };

  function sceneFor(term) {
    const photo = (term && SKILL_IMAGE[term.id]) || CAT_PHOTO[term && term.cat] || CAT_PHOTO.attack;
    if (photo) {
      return `<img class="quiz-scene quiz-photo" src="${photo}" alt="경기 중 선수의 동작">`;
    }
    const key = SCENE_OF[term && term.id] || CAT_SCENE[term && term.cat] || "shot";
    const draw = SCENES[key] || SCENES.shot;
    return `<svg class="quiz-scene" viewBox="0 0 640 360" role="img" aria-label="경기 상황" shape-rendering="crispEdges">
      <defs>
        <marker id="quiz-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="#f8fafc"/>
        </marker>
      </defs>
      <rect width="640" height="360" rx="20" fill="#0c7a43"/>
      <rect x="28" y="24" width="584" height="312" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="2"/>
      <line x1="320" y1="24" x2="320" y2="336" stroke="rgba(255,255,255,.82)" stroke-width="2"/>
      <circle cx="320" cy="180" r="46" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="2"/>
      <circle cx="320" cy="180" r="3" fill="#f8fafc"/>
      <rect x="500" y="108" width="112" height="144" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="2"/>
      <rect x="28" y="108" width="112" height="144" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="2"/>
      <rect x="568" y="146" width="44" height="68" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
      <rect x="28" y="146" width="44" height="68" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
      ${draw()}
    </svg>`;
  }

  window.SIM_QUIZ = { sceneFor };
})();
