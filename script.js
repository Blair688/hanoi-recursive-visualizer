(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PEG_X = [200, 500, 800];
  const PEG_LABEL = ["A", "B", "C"];
  const FLOOR_Y = 450;
  const PEG_TOP = 176;
  const START = 0;
  const AUX = 1;
  const DEST = 2;

  const el = {
    board: document.getElementById("board"),
    diskLayer: document.getElementById("disk-layer"),
    flightLayer: document.getElementById("flight-layer"),
    controls: document.getElementById("controls"),
    modeManual: document.getElementById("mode-manual"),
    modeAuto: document.getElementById("mode-auto"),
    diskCount: document.getElementById("disk-count"),
    btnMinus: document.getElementById("btn-minus"),
    btnPlus: document.getElementById("btn-plus"),
    btnRun: document.getElementById("btn-run"),
    btnStep: document.getElementById("btn-step"),
    btnReset: document.getElementById("btn-reset"),
    runLabel: document.getElementById("run-label"),
    runIconPlay: document.getElementById("run-icon-play"),
    runIconPause: document.getElementById("run-icon-pause"),
    speed: document.getElementById("speed"),
    speedValue: document.getElementById("speed-value"),
    statMove: document.getElementById("stat-move"),
    statTotal: document.getElementById("stat-total"),
    statDepth: document.getElementById("stat-depth"),
    statusDot: document.getElementById("status-dot"),
    statusText: document.getElementById("status-text"),
    statusRule: document.getElementById("status-rule"),
    boardCaption: document.getElementById("board-caption"),
    layout: document.getElementById("layout"),
    boardFrame: document.querySelector(".board-frame"),
    sidebarResizer: document.getElementById("sidebar-resizer"),
    boardResizer: document.getElementById("board-resizer"),
    codeView: document.getElementById("code-view"),
    codeResizer: document.getElementById("code-resizer"),
    stackView: document.getElementById("stack-view"),
    stackNote: document.getElementById("stack-note"),
    pathView: document.getElementById("path-view"),
    pathNote: document.getElementById("path-note"),
    moveLog: document.getElementById("move-log"),
    codeBase: document.getElementById("code-base"),
    codeLeft: document.getElementById("code-left"),
    codeMove: document.getElementById("code-move"),
    codeRight: document.getElementById("code-right"),
    recursionStage: document.getElementById("recursion-stage"),
    recursionCaption: document.getElementById("recursion-caption"),
    btnRecursionReplay: document.getElementById("btn-recursion-replay"),
    sectionNav: document.getElementById("section-nav"),
  };

  let currentN = 4;
  let totalMoves = 0n;
  let moveNumber = 0;
  let moveLog = [];
  let renderedLogCount = -1;
  let rods = [];
  let sim = null;
  let displayMode = "manual";
  let principleTimer = 0;
  let principlePlayed = false;
  const layoutPref = loadLayoutPrefs();

  function makeSvg(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    for (const key in attrs) {
      node.setAttribute(key, attrs[key]);
    }
    return node;
  }

  const LAYOUT_STORAGE_KEY = "hanoi-visual-layout-v1";

  function clampValue(value, min, max) {
    if (max < min) return max;
    return Math.min(Math.max(value, min), max);
  }

  function loadLayoutPrefs() {
    const fallback = {
      sidebarWidth: 370,
      boardHeight:
        Math.round(el.boardFrame.getBoundingClientRect().height) || 500,
      codeHeight: Math.round(el.codeView.getBoundingClientRect().height) || 220,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY));
      if (!saved || typeof saved !== "object") return fallback;
      return {
        sidebarWidth: Number.isFinite(saved.sidebarWidth)
          ? saved.sidebarWidth
          : fallback.sidebarWidth,
        boardHeight: Number.isFinite(saved.boardHeight)
          ? saved.boardHeight
          : fallback.boardHeight,
        codeHeight: Number.isFinite(saved.codeHeight)
          ? saved.codeHeight
          : fallback.codeHeight,
      };
    } catch {
      return fallback;
    }
  }

  function saveLayoutPrefs() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutPref));
    } catch {
      // Local file mode can block storage in some browsers.
    }
  }

  function getLayoutLimits() {
    const stacked = window.matchMedia("(max-width: 920px)").matches;
    const layoutWidth =
      el.layout.getBoundingClientRect().width || Math.max(320, window.innerWidth - 32);
    const minSidebar = 280;
    const maxSidebar = stacked
      ? 720
      : Math.max(
          minSidebar,
          Math.min(720, layoutWidth - 390 - 22)
        );
    const minBoard = Math.min(
      320,
      Math.max(260, window.innerHeight - 300)
    );
    const maxBoard = Math.max(
      minBoard,
      Math.min(900, window.innerHeight - 240)
    );
    const minCode = Math.min(
      120,
      Math.max(100, window.innerHeight - 300)
    );
    const maxCode = Math.max(
      minCode,
      Math.min(720, window.innerHeight - 210)
    );
    return {
      minSidebar,
      maxSidebar,
      minBoard,
      maxBoard,
      minCode,
      maxCode,
    };
  }

  const layoutApplied = {
    sidebarWidth: layoutPref.sidebarWidth,
    boardHeight: layoutPref.boardHeight,
    codeHeight: layoutPref.codeHeight,
  };

  function applyLayoutPrefs() {
    const limits = getLayoutLimits();
    layoutApplied.sidebarWidth = clampValue(
      layoutPref.sidebarWidth,
      limits.minSidebar,
      limits.maxSidebar
    );
    layoutApplied.boardHeight = clampValue(
      layoutPref.boardHeight,
      limits.minBoard,
      limits.maxBoard
    );
    layoutApplied.codeHeight = clampValue(
      layoutPref.codeHeight,
      limits.minCode,
      limits.maxCode
    );

    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${Math.round(layoutApplied.sidebarWidth)}px`
    );
    document.documentElement.style.setProperty(
      "--board-height",
      `${Math.round(layoutApplied.boardHeight)}px`
    );
    document.documentElement.style.setProperty(
      "--code-height",
      `${Math.round(layoutApplied.codeHeight)}px`
    );

    el.sidebarResizer.setAttribute("aria-valuemin", String(limits.minSidebar));
    el.sidebarResizer.setAttribute("aria-valuemax", String(Math.round(limits.maxSidebar)));
    el.sidebarResizer.setAttribute(
      "aria-valuenow",
      String(Math.round(layoutApplied.sidebarWidth))
    );
    el.boardResizer.setAttribute("aria-valuemin", String(Math.round(limits.minBoard)));
    el.boardResizer.setAttribute("aria-valuemax", String(Math.round(limits.maxBoard)));
    el.boardResizer.setAttribute(
      "aria-valuenow",
      String(Math.round(layoutApplied.boardHeight))
    );
    el.codeResizer.setAttribute("aria-valuemin", String(Math.round(limits.minCode)));
    el.codeResizer.setAttribute("aria-valuemax", String(Math.round(limits.maxCode)));
    el.codeResizer.setAttribute(
      "aria-valuenow",
      String(Math.round(layoutApplied.codeHeight))
    );
  }

  function setLayoutValue(key, value) {
    layoutPref[key] = Number.isFinite(value) ? value : layoutPref[key];
    applyLayoutPrefs();
  }

  function attachPointerResize(handle, options) {
    const { axis, key, invert = false } = options;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startPointer = axis === "x" ? event.clientX : event.clientY;
      const startValue = layoutApplied[key];
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("is-dragging");
      document.body.classList.add(
        axis === "x" ? "is-resizing-column" : "is-resizing-row"
      );

      const onMove = (moveEvent) => {
        const current = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const delta = (current - startPointer) * (invert ? -1 : 1);
        setLayoutValue(key, startValue + delta);
      };

      const onEnd = () => {
        handle.classList.remove("is-dragging");
        document.body.classList.remove(
          "is-resizing-column",
          "is-resizing-row"
        );
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onEnd);
        handle.removeEventListener("pointercancel", onEnd);
        saveLayoutPrefs();
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onEnd);
      handle.addEventListener("pointercancel", onEnd);
    });
  }

  function attachKeyboardResize(handle, options) {
    const { key, reverse = false } = options;
    handle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 48 : 16;
      let delta = 0;
      if (reverse) {
        if (event.key === "ArrowLeft") delta = step;
        if (event.key === "ArrowRight") delta = -step;
      } else {
        if (event.key === "ArrowDown") delta = step;
        if (event.key === "ArrowUp") delta = -step;
      }
      if (delta === 0) return;
      event.preventDefault();
      setLayoutValue(key, layoutApplied[key] + delta);
      saveLayoutPrefs();
    });
  }

  function diskGeometry() {
    const available = FLOOR_Y - PEG_TOP - 10;
    return Math.max(2, Math.min(34, available / currentN));
  }

  function diskWidth(rank) {
    const maxWidth = 220;
    const minWidth = 76;
    if (currentN === 1) return (minWidth + maxWidth) / 2;
    const t = (rank - 1) / (currentN - 1);
    return minWidth + (maxWidth - minWidth) * t;
  }

  function diskColor(rank) {
    if (currentN === 1) return "#e0aa3f";
    const hue = 8 + ((rank - 1) / (currentN - 1)) * 272;
    return `hsl(${hue.toFixed(1)} 62% 48%)`;
  }

  function formatBigInt(value) {
    const text = value.toString();
    if (text.length <= 3) return text;
    return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function makeInitialRods() {
    const initial = [];
    for (let rank = currentN; rank >= 1; rank -= 1) initial.push(rank);
    return [initial, [], []];
  }

  function makeFrame(n, from, to, via, depth, side) {
    return { n, from, to, via, depth, side, step: 0 };
  }

  function createSim(auto) {
    rods = makeInitialRods();
    moveNumber = 0;
    moveLog = [];
    sim = {
      auto,
      paused: false,
      done: false,
      singleStep: false,
      pauseAfterMove: false,
      rootEntered: false,
      frames: [],
      pendingMove: null,
      currentMove: null,
      elapsed: 0,
      duration: 144,
      lastTs: null,
      rafId: 0,
    };
  }

  function prepareNextMoveFor(machine) {
    if (!machine.rootEntered) {
      machine.frames.push(makeFrame(currentN, START, DEST, AUX, 0, "root"));
      machine.rootEntered = true;
    }

    while (machine.frames.length > 0) {
      const frame = machine.frames[machine.frames.length - 1];

      if (frame.step === 3) {
        machine.frames.pop();
        continue;
      }

      if (frame.step === 0) {
        if (frame.n === 1) {
          frame.step = 1;
          continue;
        }
        frame.step = 1;
        machine.frames.push(
          makeFrame(
            frame.n - 1,
            frame.from,
            frame.via,
            frame.to,
            frame.depth + 1,
            "left"
          )
        );
        continue;
      }

      if (frame.step === 1) {
        frame.step = 2;
        return { rank: frame.n, from: frame.from, to: frame.to, frame };
      }

      if (frame.step === 2) {
        if (frame.n === 1) {
          frame.step = 3;
          continue;
        }
        frame.step = 3;
        machine.frames.push(
          makeFrame(
            frame.n - 1,
            frame.via,
            frame.to,
            frame.from,
            frame.depth + 1,
            "right"
          )
        );
        continue;
      }
    }

    return null;
  }

  function prepareNextMove() {
    if (!sim) return null;
    return prepareNextMoveFor(sim);
  }

  function takeNextAction() {
    if (sim.pendingMove) {
      const action = sim.pendingMove;
      sim.pendingMove = null;
      return action;
    }
    return prepareNextMove();
  }

  function renderBoard() {
    el.diskLayer.replaceChildren();
    const height = diskGeometry();
    const fragment = document.createDocumentFragment();

    rods.forEach((stack, pegIndex) => {
      stack.forEach((rank, slot) => {
        const width = diskWidth(rank);
        const x = PEG_X[pegIndex] - width / 2;
        const y = FLOOR_Y - height * (slot + 1);
        const color = diskColor(rank);
        const rect = makeSvg("rect", {
          class: "disk",
          x: x.toFixed(2),
          y: y.toFixed(2),
          width: width.toFixed(2),
          height: height.toFixed(2),
          rx: Math.max(2, Math.min(8, height / 2)).toFixed(1),
          fill: color,
        });
        fragment.appendChild(rect);

        if (height >= 13 && width >= 46) {
          const fontSize = Math.max(11, Math.min(16, height - 4));
          const label = makeSvg("text", {
            class: "disk-label",
            x: PEG_X[pegIndex].toFixed(1),
            y: (y + height / 2 + 0.5).toFixed(1),
            "font-size": fontSize.toFixed(1),
          });
          label.textContent = String(rank);
          fragment.appendChild(label);
        }
      });
    });

    el.diskLayer.appendChild(fragment);
  }

  function startMove(move) {
    const source = rods[move.from];
    const target = rods[move.to];
    const rank = source[source.length - 1];
    if (rank !== move.rank) {
      console.error("Invalid move source", move, source);
      return;
    }
    if (move.frame) move.frame.directStep = moveNumber + 1;

    const height = diskGeometry();
    const sourceTopY = FLOOR_Y - height * source.length;
    const startCenter = {
      x: PEG_X[move.from],
      y: sourceTopY + height / 2,
    };

    source.pop();
    const targetTopY = FLOOR_Y - height * (target.length + 1);
    const endCenter = {
      x: PEG_X[move.to],
      y: targetTopY + height / 2,
    };

    const width = diskWidth(rank);
    const rect = makeSvg("rect", {
      class: "flight-disk",
      x: (startCenter.x - width / 2).toFixed(2),
      y: (startCenter.y - height / 2).toFixed(2),
      width: width.toFixed(2),
      height: height.toFixed(2),
      rx: Math.max(2, Math.min(8, height / 2)).toFixed(1),
      fill: diskColor(rank),
    });
    el.flightLayer.replaceChildren(rect);

    sim.currentMove = {
      rank,
      from: move.from,
      to: move.to,
      startCenter,
      endCenter,
      width,
      height,
      elapsed: 0,
    };
    sim.duration =
      displayMode === "manual"
        ? 520
        : 1500 - (Number(el.speed.value) - 1) * 220;
    sim.lastTs = null;

    renderBoard();
    renderStackAndCode();
    updateStatus();
    updateStats();
    updateControls();
  }

  function renderFlight(progress) {
    if (!sim.currentMove) return;
    const move = sim.currentMove;
    const rect = el.flightLayer.firstElementChild;
    if (!rect) return;

    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const lift = 72 * Math.sin(Math.PI * progress);
    const x = move.startCenter.x + (move.endCenter.x - move.startCenter.x) * eased;
    const y =
      move.startCenter.y +
      (move.endCenter.y - move.startCenter.y) * eased -
      lift;

    rect.setAttribute("x", (x - move.width / 2).toFixed(2));
    rect.setAttribute("y", (y - move.height / 2).toFixed(2));
  }

  function finishCurrentMove() {
    if (!sim.currentMove) return;
    const move = sim.currentMove;
    rods[move.to].push(move.rank);
    moveNumber += 1;
    const entry = {
      step: moveNumber,
      disk: move.rank,
      fromIndex: move.from,
      toIndex: move.to,
    };
    const logIndex = moveNumber - 1;
    if (logIndex < moveLog.length) moveLog[logIndex] = entry;
    else moveLog.push(entry);

    sim.currentMove = null;
    el.flightLayer.replaceChildren();
    renderBoard();
    renderLog();
  }

  function frame(ts) {
    if (!sim || sim.paused) return;

    if (sim.lastTs === null) sim.lastTs = ts;
    const delta = Math.min(64, ts - sim.lastTs);
    sim.lastTs = ts;

    if (sim.currentMove) {
      sim.currentMove.elapsed += delta;
      const progress = Math.min(1, sim.currentMove.elapsed / sim.duration);
      if (progress >= 1) {
        finishCurrentMove();
        advanceAfterMove();
      } else {
        renderFlight(progress);
      }
    } else if (sim.singleStep) {
      const action = takeNextAction();
      if (action) {
        startMove(action);
      } else {
        sim.done = true;
      }
    }

    if (sim && !sim.paused && !sim.done) {
      sim.rafId = requestAnimationFrame(frame);
    }
  }

  function advanceAfterMove() {
    if (sim.pauseAfterMove) {
      sim.pauseAfterMove = false;
      sim.singleStep = false;
      sim.paused = true;
      sim.auto = false;
      renderStackAndCode();
      updateStatus();
      updateStats();
      updateControls();
      return;
    }

    if (sim.singleStep) {
      sim.singleStep = false;
      sim.auto = false;
      if (BigInt(moveNumber) === totalMoves) {
        sim.done = true;
        sim.paused = false;
      } else {
        sim.paused = true;
      }
      renderStackAndCode();
      updateStatus();
      updateStats();
      updateControls();
      return;
    }

    const action = prepareNextMove();
    if (action) {
      startMove(action);
    } else {
      sim.done = true;
      renderStackAndCode();
      updateStatus();
      updateStats();
      updateControls();
    }
  }

  function beginAutoRun() {
    createSim(true);
    const action = prepareNextMove();
    if (!action) {
      sim.done = true;
      renderStackAndCode();
      updateStatus();
      updateStats();
      updateControls();
      return;
    }
    startMove(action);
    startFrameLoop();
    updateStatus();
    updateStats();
    updateControls();
  }

  function startFrameLoop() {
    if (sim) cancelAnimationFrame(sim.rafId);
    sim.rafId = requestAnimationFrame(frame);
  }

  function resumeAuto() {
    if (!sim || sim.done) return;
    sim.paused = false;
    sim.auto = true;
    sim.singleStep = false;
    sim.lastTs = null;

    if (!sim.currentMove) {
      const action = takeNextAction();
      if (!action) {
        sim.done = true;
        renderStackAndCode();
        updateStatus();
        updateStats();
        updateControls();
        return;
      }
      startMove(action);
    }
    startFrameLoop();
    updateStatus();
    updateControls();
  }

  function pauseAuto() {
    if (!sim || sim.done) return;
    sim.paused = true;
    cancelAnimationFrame(sim.rafId);
    renderStackAndCode();
    updateStatus();
    updateControls();
  }

  function setDisplayMode(mode) {
    if (mode !== "manual" && mode !== "auto") return;
    if (displayMode === mode) return;
    displayMode = mode;
    el.controls.dataset.displayMode = mode;
    el.modeManual.classList.toggle("is-active", mode === "manual");
    el.modeAuto.classList.toggle("is-active", mode === "auto");
    el.modeManual.setAttribute(
      "aria-pressed",
      String(mode === "manual")
    );
    el.modeAuto.setAttribute("aria-pressed", String(mode === "auto"));

    if (sim && !sim.done) {
      sim.auto = false;
      sim.singleStep = false;
      if (sim.currentMove) {
        sim.pauseAfterMove = true;
      } else {
        sim.paused = true;
        cancelAnimationFrame(sim.rafId);
        renderStackAndCode();
      }
    }

    updateStatus();
    updateControls();
  }

  function seekToStep(step) {
    if (!sim || !(sim.paused || sim.done)) return;
    if (step < 1 || step > moveLog.length || step === moveNumber) return;

    cancelAnimationFrame(sim.rafId);
    sim.currentMove = null;
    el.flightLayer.replaceChildren();

    rods = makeInitialRods();
    for (let index = 0; index < step; index += 1) {
      const entry = moveLog[index];
      if (!entry) break;
      const source = rods[entry.fromIndex];
      if (source[source.length - 1] !== entry.disk) break;
      source.pop();
      rods[entry.toIndex].push(entry.disk);
    }

    const machine = { frames: [], rootEntered: false };
    let pendingAction = null;
    for (let index = 0; index <= step; index += 1) {
      const action = prepareNextMoveFor(machine);
      if (!action) {
        pendingAction = null;
        break;
      }
      action.frame.directStep = index + 1;
      pendingAction = action;
    }

    const isFinal = machine.frames.length === 0;
    moveNumber = step;
    sim.auto = false;
    sim.singleStep = false;
    sim.paused = !isFinal;
    sim.done = isFinal;
    sim.frames = machine.frames;
    sim.rootEntered = machine.rootEntered;
    sim.pendingMove = isFinal ? null : pendingAction;

    renderBoard();
    renderLog();
    renderStackAndCode();
    updateStatus();
    updateStats();
    updateControls();
  }

  function runManualStep() {
    if (displayMode !== "manual") return;
    if (!sim) createSim(false);
    if (sim.done || sim.currentMove) return;
    sim.singleStep = true;
    sim.auto = false;
    sim.paused = false;
    sim.pauseAfterMove = false;
    sim.lastTs = null;
    if (!sim.currentMove) {
      const action = takeNextAction();
      if (!action) {
        sim.done = true;
        renderStackAndCode();
        updateStatus();
        updateStats();
        updateControls();
        return;
      }
      startMove(action);
    }
    startFrameLoop();
    updateStatus();
    updateControls();
  }

  function stopAndReset() {
    if (sim) cancelAnimationFrame(sim.rafId);
    sim = null;
    rods = makeInitialRods();
    moveNumber = 0;
    moveLog = [];
    el.flightLayer.replaceChildren();
    renderBoard();
    renderLog();
    renderStackAndCode();
    updateStatus();
    updateStats();
    updateControls();
  }

  function runAction() {
    if (displayMode !== "auto") return;
    if (!sim || sim.done) {
      beginAutoRun();
      return;
    }
    if (sim.paused) {
      resumeAuto();
    } else if (sim.auto) {
      pauseAuto();
    } else {
      sim.auto = true;
      sim.singleStep = false;
      if (!sim.currentMove) {
        const action = takeNextAction();
        if (!action) {
          sim.done = true;
          renderStackAndCode();
          updateStatus();
          updateStats();
          updateControls();
          return;
        }
        startMove(action);
      }
      startFrameLoop();
      updateStatus();
      updateControls();
    }
  }

  function applyDiskCount(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 64) {
      el.diskCount.value = String(currentN);
      setStatusError("层数需为 1 到 64 的整数");
      return;
    }
    if (parsed === currentN) return;
    currentN = parsed;
    totalMoves = (1n << BigInt(currentN)) - 1n;
    stopAndReset();
  }

  function setStatusError(message) {
    el.statusText.textContent = "输入无效";
    el.statusRule.textContent = message;
    el.statusDot.className = "status-dot is-paused";
  }

  function updateStats() {
    el.statMove.textContent = String(moveNumber);
    el.statTotal.textContent = formatBigInt(totalMoves);
    const depth = sim && !sim.done ? sim.frames.length : 0;
    el.statDepth.textContent = String(depth);
  }

  function updateStatus() {
    let text = displayMode === "manual" ? "手动模式" : "准备就绪";
    let rule =
      displayMode === "manual"
        ? "点击“下一步”移动一个圆盘"
        : `移动 ${currentN} 层塔：起点 A → 目标 C，借助 B`;
    let state = "idle";

    if (sim && sim.done) {
      text = "演示完成";
      rule = `共 ${formatBigInt(totalMoves)} 步，所有圆盘已移动到目标柱 C`;
      state = "done";
    } else if (sim) {
      if (sim.paused) {
        text = displayMode === "manual" ? "等待下一步" : "已暂停";
        state = "paused";
      } else if (sim.singleStep) {
        text = "正在执行一步";
        state = "running";
      } else if (displayMode === "manual") {
        text = "正在执行一步";
        state = "running";
      } else {
        text = "自动演示";
        state = "running";
      }

      if (sim.currentMove) {
        const move = sim.currentMove;
        rule = `${move.rank} 号盘：${PEG_LABEL[move.from]} → ${PEG_LABEL[move.to]}`;
      } else if (sim.paused) {
        rule =
          displayMode === "manual"
            ? "点击“下一步”继续移动"
            : "等待继续播放";
      }
    }

    el.statusText.textContent = text;
    el.statusRule.textContent = rule;
    el.statusDot.className = "status-dot";
    if (state === "running") el.statusDot.classList.add("is-running");
    if (state === "paused") el.statusDot.classList.add("is-paused");
    if (state === "done") el.statusDot.classList.add("is-done");

    if (sim && sim.currentMove) {
      const move = sim.currentMove;
      el.boardCaption.textContent =
        `${moveNumber + 1} / ${formatBigInt(totalMoves)} · ` +
        `${move.rank} 号盘 ${PEG_LABEL[move.from]} → ${PEG_LABEL[move.to]}`;
    } else if (sim && sim.done) {
      el.boardCaption.textContent = `完成 ${formatBigInt(totalMoves)} 步`;
    } else if (sim && sim.paused) {
      el.boardCaption.textContent =
        `${displayMode === "manual" ? "等待下一步" : "已暂停"} · ` +
        `${moveNumber} / ${formatBigInt(totalMoves)}`;
    } else if (!sim) {
      el.boardCaption.textContent =
        `${displayMode === "manual" ? "手动模式" : "自动模式"} · ` +
        `总步数 ${formatBigInt(totalMoves)}`;
    }
  }

  function updateControls() {
    const done = Boolean(sim && sim.done);
    const running = Boolean(sim && !sim.done && !sim.paused);
    const isManual = displayMode === "manual";

    el.controls.dataset.displayMode = displayMode;
    el.modeManual.classList.toggle("is-active", isManual);
    el.modeAuto.classList.toggle("is-active", !isManual);
    el.modeManual.setAttribute("aria-pressed", String(isManual));
    el.modeAuto.setAttribute("aria-pressed", String(!isManual));
    el.btnRun.hidden = isManual;
    el.btnStep.hidden = !isManual;

    if (!sim && isManual) {
      el.runLabel.textContent = "开始演示";
      el.runIconPlay.hidden = false;
      el.runIconPause.hidden = true;
    } else if (!sim) {
      el.runLabel.textContent = "开始演示";
      el.runIconPlay.hidden = false;
      el.runIconPause.hidden = true;
    } else if (done) {
      el.runLabel.textContent = "重新演示";
      el.runIconPlay.hidden = false;
      el.runIconPause.hidden = true;
    } else if (sim.paused || (!sim.auto && !sim.singleStep)) {
      el.runLabel.textContent = "继续";
      el.runIconPlay.hidden = false;
      el.runIconPause.hidden = true;
    } else {
      el.runLabel.textContent = "暂停";
      el.runIconPlay.hidden = true;
      el.runIconPause.hidden = false;
    }

    el.btnStep.disabled = isManual
      ? Boolean(sim && (sim.done || sim.currentMove))
      : true;
    el.btnRun.disabled = false;
    el.btnReset.disabled = false;

    const speed = Number(el.speed.value);
    el.speedValue.textContent = String(speed);
    if (running && isManual) el.btnStep.disabled = true;

    for (const row of el.moveLog.querySelectorAll(".log-btn")) {
      row.disabled = running;
    }
  }

  function callNote(frame, index) {
    if (!sim || sim.done) return "";
    const isTop = index === sim.frames.length - 1;
    if (isTop && frame.step === 2) {
      if (sim.currentMove) {
        return frame.n === 1 ? "正在移动 1 号盘" : `正在移动 ${frame.n} 号盘`;
      }
      return frame.n === 1
        ? "1 号盘已移动，等待返回"
        : `${frame.n} 号盘已移动，等待返回`;
    }
    if (!isTop && frame.n > 1 && frame.step === 1) return "等待左递归返回";
    if (!isTop && frame.n > 1 && frame.step === 3) return "等待右递归返回";
    return "活动帧";
  }

  function renderStackAndCode() {
    el.stackView.replaceChildren();
    for (const line of [
      el.codeBase,
      el.codeLeft,
      el.codeMove,
      el.codeRight,
    ]) {
      line.classList.remove("is-active", "is-running");
    }

    if (!sim) {
      el.stackNote.textContent = "等待运行";
      const empty = document.createElement("div");
      empty.className = "stack-empty";
      empty.textContent = "调用栈会在演示开始时逐层展开";
      el.stackView.appendChild(empty);
      renderPathView();
      return;
    }

    if (sim.done || sim.frames.length === 0) {
      el.stackNote.textContent = "已全部返回";
      const empty = document.createElement("div");
      empty.className = "stack-empty";
      empty.textContent = "递归逐层返回，最终回到 main()";
      el.stackView.appendChild(empty);
      renderPathView();
      return;
    }

    el.stackNote.textContent = `${sim.frames.length} 个活动帧`;
    const fragment = document.createDocumentFragment();

    sim.frames.forEach((frame, index) => {
      const line = document.createElement("button");
      line.type = "button";
      line.className = "call-line";
      line.style.setProperty("--depth", String(frame.depth));
      if (frame.depth === 0) line.classList.add("is-root");
      if (index === sim.frames.length - 1) line.classList.add("is-active");

      const canLocate =
        sim &&
        (sim.paused || sim.done) &&
        frame.directStep &&
        frame.directStep <= moveLog.length &&
        frame.directStep !== moveNumber;
      line.disabled = !canLocate;
      if (canLocate) {
        line.setAttribute(
          "aria-label",
          `定位到第 ${frame.directStep} 步`
        );
        line.addEventListener("click", () => seekToStep(frame.directStep));
      }

      const code = document.createElement("code");
      code.className = "call-code";
      code.innerHTML =
        `move_tower(<b>${frame.n}</b>, ` +
        `${PEG_LABEL[frame.from]}, ${PEG_LABEL[frame.to]}, ` +
        `${PEG_LABEL[frame.via]})`;

      const note = document.createElement("span");
      note.className = "call-note";
      note.textContent = callNote(frame, index);

      const step = document.createElement("span");
      step.className = "call-step";
      step.textContent = canLocate ? `第 ${frame.directStep} 步` : "";

      line.appendChild(code);
      line.appendChild(note);
      line.appendChild(step);
      fragment.appendChild(line);
    });

    el.stackView.appendChild(fragment);
    renderPathView();
    syncCodeHighlight();
  }

  function syncCodeHighlight() {
    if (!sim || sim.done || sim.frames.length === 0) return;
    const top = sim.frames[sim.frames.length - 1];
    if (top.n === 1) {
      el.codeBase.classList.add("is-active");
    } else {
      el.codeMove.classList.add("is-active");
    }
    if (top.side === "left") el.codeLeft.classList.add("is-running");
    if (top.side === "right") el.codeRight.classList.add("is-running");
  }

  function renderPathView() {
    el.pathView.replaceChildren();
    const subtreeSteps = (n) => {
      const value = (1n << BigInt(n - 1)) - 1n;
      if (value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
      return null;
    };
    const empty = () => {
      const item = document.createElement("div");
      item.className = "path-empty";
      item.textContent = "递归展开将跟随每一步演示实时更新";
      return item;
    };

    if (!sim) {
      el.pathNote.textContent = "展开规则";
      el.pathView.appendChild(empty());
      return;
    }

    if (sim.done || sim.frames.length === 0) {
      el.pathNote.textContent = "已返回";
      el.pathView.appendChild(empty());
      return;
    }

    const frame = sim.frames[sim.frames.length - 1];
    el.pathNote.textContent =
      frame.side === "root"
        ? "根调用"
        : frame.side === "left"
          ? "经左递归进入"
          : "经右递归进入";

    const callHead = document.createElement("div");
    callHead.className = "path-call";
    const callCode = document.createElement("code");
    callCode.innerHTML =
      `move_tower(<b>${frame.n}</b>, ${PEG_LABEL[frame.from]}, ` +
      `${PEG_LABEL[frame.to]}, ${PEG_LABEL[frame.via]})`;
    const callMeta = document.createElement("span");
    callMeta.textContent = `深度 ${frame.depth + 1}`;
    callHead.appendChild(callCode);
    callHead.appendChild(callMeta);
    el.pathView.appendChild(callHead);

    const list = document.createElement("ul");
    list.className = "path-list";
    const currentIsMoving = Boolean(sim.currentMove);
    const pathClickable = Boolean(sim && (sim.paused || sim.done));
    const locateTarget = (step) => {
      if (
        pathClickable &&
        step &&
        step >= 1 &&
        step <= moveLog.length &&
        step !== moveNumber
      ) {
        return step;
      }
      return null;
    };

    const makeRow = (
      index,
      codeText,
      statusText,
      stateClass,
      targetStep
    ) => {
      const row = document.createElement("li");
      row.className = `path-row ${stateClass}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "path-btn";
      button.disabled = !targetStep;
      if (targetStep) {
        button.setAttribute("aria-label", `定位到第 ${targetStep} 步`);
        button.addEventListener("click", () => seekToStep(targetStep));
      }
      const idx = document.createElement("span");
      idx.className = "path-idx";
      idx.textContent = index;
      const code = document.createElement("code");
      code.textContent = codeText;
      const state = document.createElement("em");
      state.textContent = statusText;
      const target = document.createElement("span");
      target.className = "path-target";
      target.textContent = targetStep ? `第 ${targetStep} 步` : "";
      button.appendChild(idx);
      button.appendChild(code);
      button.appendChild(state);
      button.appendChild(target);
      row.appendChild(button);
      return row;
    };

    if (frame.n === 1) {
      const directText =
        `直接移动 1 号盘：${PEG_LABEL[frame.from]} → ${PEG_LABEL[frame.to]}`;
      list.appendChild(
        makeRow(
          "●",
          directText,
          currentIsMoving ? "正在执行" : "已移动",
          "is-current",
          locateTarget(frame.directStep)
        )
      );
    } else {
      const leftSpan = subtreeSteps(frame.n);
      const leftText =
        `move_tower(${frame.n - 1}, ${PEG_LABEL[frame.from]}, ` +
        `${PEG_LABEL[frame.via]}, ${PEG_LABEL[frame.to]})`;
      list.appendChild(
        makeRow(
          "1",
          leftText,
          frame.directStep ? "左递归已返回" : "等待左递归",
          "is-done",
          frame.directStep && leftSpan
            ? locateTarget(frame.directStep - leftSpan)
            : null
        )
      );

      const directText =
        `移动 ${frame.n} 号盘：${PEG_LABEL[frame.from]} → ` +
        PEG_LABEL[frame.to];
      const directClass = currentIsMoving ? "is-current" : "is-done";
      list.appendChild(
        makeRow(
          "2",
          directText,
          currentIsMoving ? "正在执行" : "已移动",
          directClass,
          locateTarget(frame.directStep)
        )
      );

      const rightText =
        `move_tower(${frame.n - 1}, ${PEG_LABEL[frame.via]}, ` +
        `${PEG_LABEL[frame.to]}, ${PEG_LABEL[frame.from]})`;
      list.appendChild(
        makeRow(
          "3",
          rightText,
          frame.directStep ? "右递归待执行" : "等待右递归",
          "",
          frame.directStep
            ? locateTarget(frame.directStep + 1)
            : null
        )
      );
    }

    el.pathView.appendChild(list);
  }

  function buildLogRow(entry) {
    const running = Boolean(sim && !sim.done && !sim.paused);
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "log-btn";
    button.disabled = running;
    button.dataset.step = String(entry.step);
    button.setAttribute(
      "aria-label",
      `跳转到第 ${entry.step} 步：${entry.disk} 号盘 ` +
        `${PEG_LABEL[entry.fromIndex]} 到 ${PEG_LABEL[entry.toIndex]}`
    );

    const step = document.createElement("span");
    step.className = "log-step";
    step.textContent = String(entry.step).padStart(4, "0");

    const disk = document.createElement("span");
    disk.className = "disk-no";
    disk.textContent = `${entry.disk} 号盘`;

    const route = document.createElement("span");
    route.className = "log-route";
    route.innerHTML =
      `${PEG_LABEL[entry.fromIndex]} ` +
      `<span class="arrow">→</span> ${PEG_LABEL[entry.toIndex]}`;

    button.appendChild(step);
    button.appendChild(disk);
    button.appendChild(route);
    button.addEventListener("click", () => seekToStep(entry.step));
    item.appendChild(button);
    return item;
  }

  function markCurrentLogRow() {
    for (const row of el.moveLog.querySelectorAll(".log-btn.is-current")) {
      row.classList.remove("is-current");
    }
    const current = el.moveLog.querySelector(
      `.log-btn[data-step="${moveNumber}"]`
    );
    if (current) current.classList.add("is-current");
  }

  function renderLog() {
    const container = el.moveLog;
    const running = Boolean(sim && !sim.done && !sim.paused);

    if (moveLog.length === 0) {
      if (renderedLogCount !== 0) {
        container.replaceChildren();
        const empty = document.createElement("li");
        empty.className = "log-empty";
        empty.textContent = "尚无移动";
        container.appendChild(empty);
        renderedLogCount = 0;
      }
      return;
    }

    if (renderedLogCount === moveLog.length) {
      markCurrentLogRow();
      return;
    }

    if (renderedLogCount < 0 || renderedLogCount > moveLog.length) {
      const fragment = document.createDocumentFragment();
      for (const entry of moveLog) {
        fragment.appendChild(buildLogRow(entry));
      }
      container.replaceChildren(fragment);
      renderedLogCount = moveLog.length;
      markCurrentLogRow();
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let index = renderedLogCount; index < moveLog.length; index += 1) {
      fragment.appendChild(buildLogRow(moveLog[index]));
    }
    container.appendChild(fragment);
    renderedLogCount = moveLog.length;
    markCurrentLogRow();
    if (running) container.scrollTop = container.scrollHeight;
  }

  function setRecursionStep(step) {
    const nextStep = Math.max(0, Math.min(5, step));
    const captions = [
      "从最大的问题开始：把 3 个盘从 A 移到 C。",
      "第一步：先解决左递归，把上面 2 个盘从 A 移到 B。",
      "左递归继续拆分：先移动 1 号盘，再移动 2 号盘，最后移回 1 号盘。",
      "左递归完成后，当前这一层只需要直接移动最大的 3 号盘。",
      "最后解决右递归：把 B 上的 2 个盘移动到目标柱 C。",
      "所有最小问题都直接移动 1 号盘，整棵递归树依次完成。",
    ];
    el.recursionStage.dataset.step = String(nextStep);
    el.recursionCaption.textContent = captions[nextStep];
  }

  function stopPrincipleAnimation() {
    if (principleTimer) {
      clearTimeout(principleTimer);
      principleTimer = 0;
    }
  }

  function startPrincipleAnimation() {
    stopPrincipleAnimation();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) {
      setRecursionStep(5);
      return;
    }

    setRecursionStep(0);
    let step = 0;
    const advance = () => {
      step += 1;
      setRecursionStep(step);
      if (step < 5) {
        principleTimer = setTimeout(advance, 900);
      } else {
        principleTimer = 0;
      }
    };
    principleTimer = setTimeout(advance, 650);
  }

  function initScrollEffects() {
    document.documentElement.classList.add("js");
    const reveals = [...document.querySelectorAll(".reveal")];
    const sections = [...document.querySelectorAll("main .page-section[id]")];
    const navLinks = [...el.sectionNav.querySelectorAll("a")];

    if (!("IntersectionObserver" in window)) {
      reveals.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach((item) => revealObserver.observe(item));

    const navObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((link) => {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === `#${visible.target.id}`
          );
        });
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: [0, 0.2, 0.5] }
    );
    sections.forEach((section) => navObserver.observe(section));

    const principleSection = document.getElementById("principle");
    const principleObserver = new IntersectionObserver(
      (entries) => {
        if (
          !principlePlayed &&
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45
          )
        ) {
          principlePlayed = true;
          startPrincipleAnimation();
          principleObserver.disconnect();
        }
      },
      { threshold: [0.45] }
    );
    principleObserver.observe(principleSection);
  }

  function bindEvents() {
    attachPointerResize(el.sidebarResizer, {
      axis: "x",
      key: "sidebarWidth",
      invert: true,
    });
    attachKeyboardResize(el.sidebarResizer, {
      key: "sidebarWidth",
      reverse: true,
    });
    attachPointerResize(el.boardResizer, {
      axis: "y",
      key: "boardHeight",
    });
    attachKeyboardResize(el.boardResizer, { key: "boardHeight" });
    attachPointerResize(el.codeResizer, {
      axis: "y",
      key: "codeHeight",
    });
    attachKeyboardResize(el.codeResizer, { key: "codeHeight" });

    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(applyLayoutPrefs);
    });

    el.btnMinus.addEventListener("click", () => {
      el.diskCount.stepDown();
      applyDiskCount(el.diskCount.value);
    });

    el.btnPlus.addEventListener("click", () => {
      el.diskCount.stepUp();
      applyDiskCount(el.diskCount.value);
    });

    el.diskCount.addEventListener("change", () => {
      applyDiskCount(el.diskCount.value);
    });

    el.diskCount.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        applyDiskCount(el.diskCount.value);
        el.diskCount.blur();
      }
    });

    el.btnRun.addEventListener("click", runAction);
    el.btnStep.addEventListener("click", runManualStep);
    el.btnReset.addEventListener("click", stopAndReset);
    el.modeManual.addEventListener("click", () => setDisplayMode("manual"));
    el.modeAuto.addEventListener("click", () => setDisplayMode("auto"));
    el.btnRecursionReplay.addEventListener("click", () => {
      principlePlayed = true;
      startPrincipleAnimation();
    });

    el.speed.addEventListener("input", () => {
      el.speedValue.textContent = el.speed.value;
    });
  }

  function init() {
    totalMoves = (1n << BigInt(currentN)) - 1n;
    rods = makeInitialRods();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      principlePlayed = true;
      setRecursionStep(5);
    } else {
      setRecursionStep(0);
    }
    bindEvents();
    initScrollEffects();
    applyLayoutPrefs();
    renderBoard();
    renderLog();
    renderStackAndCode();
    updateStats();
    updateStatus();
    updateControls();
  }

  init();
})();
