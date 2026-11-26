/* 「學童盃」式淘汰賽：底部小組籤位往上晉級，直角連線、比分與勝隊亮線。
   場次配對固定依大會手繪，分組排名及比分使用 schedule-engine 的同一份邏輯。 */
(() => {
  "use strict";
  const engine = window.TaichungScheduleEngine || window.ScheduleEngine;
  if (!engine) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const WIDTH = 1180;
  const HEIGHT = 810;
  const zoomHistory = new Map();
  let activeSession = null;

  function cleanup() {
    if (!activeSession) return;
    zoomHistory.set(activeSession.division, activeSession.zoom.capture());
    activeSession.stopAnimation();
    activeSession.zoom.cleanup();
    activeSession = null;
  }

  function element(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = String(value);
    return el;
  }

  function svgNode(tag, attributes) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function svgPath(d, klass, stage, number, side) {
    return svgNode("path", {
      d,
      class: klass,
      "data-to-match": number,
      "data-route-side": side,
      "data-stage": stage
    });
  }

  function chineseMatchNo(number) {
    const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (number < 10) return digits[number] || String(number);
    if (number < 20) return "十" + (digits[number % 10] || "");
    if (number < 100) return digits[Math.floor(number / 10)] + "十" + (digits[number % 10] || "");
    return String(number);
  }

  function parseRef(value) {
    return engine.parseSeed(value);
  }

  function geometry(division) {
    const isSix = division === "u8";
    const seedY = 710;
    if (isSix) {
      return {
        seedY,
        seeds: { A1: 135, C1: 323, B2: 455, A2: 725, C2: 857, B1: 1045 },
        pre: [[382, 548], [795, 548]],
        semi: [[247, 369], [931, 369]],
        bronze: [590, 234],
        final: [590, 99]
      };
    }
    return {
      seedY,
      seeds: { A1: 140, B2: 420, A2: 760, B1: 1040 },
      pre: [],
      semi: [[278, 424], [902, 424]],
      bronze: [590, 235],
      final: [590, 100]
    };
  }

  function structure(config, positions) {
    const nodes = new Map();
    const semis = config.matches.filter((item) => item.kind === "semi");
    const pre = config.matches.filter((item) => item.kind === "prelim");
    pre.forEach((match, i) => nodes.set(match.id, { x: positions.pre[i][0], y: positions.pre[i][1] }));
    semis.forEach((match, i) => nodes.set(match.id, { x: positions.semi[i][0], y: positions.semi[i][1] }));
    for (const match of config.matches) {
      if (match.kind === "final") nodes.set(match.id, { x: positions.final[0], y: positions.final[1] });
      else if (match.kind === "bronze") nodes.set(match.id, { x: positions.bronze[0], y: positions.bronze[1] });
    }
    return nodes;
  }

  function inputPosition(ref, positions, nodes) {
    const parsed = parseRef(ref);
    if (parsed?.type === "group") {
      const x = positions.seeds[parsed.token];
      return Number.isFinite(x) ? { x, y: positions.seedY } : null;
    }
    if (parsed?.type === "match") return nodes.get(parsed.matchNo) || null;
    return null;
  }

  function labelForRef(ref) {
    const parsed = parseRef(ref);
    if (parsed?.type === "match") return "第 " + parsed.matchNo + " 場" + (parsed.outcome === "winner" ? "勝隊" : "敗隊");
    return ref;
  }

  function pathToMatch(from, to, kind, side) {
    if (kind === "bronze") {
      const offset = side === 0 ? 26 : -26;
      return "M " + from.x + " " + from.y +
        " H " + (from.x + offset) + " V " + to.y + " H " + to.x;
    }
    return "M " + from.x + " " + from.y +
      " V " + to.y + " H " + to.x;
  }

  function scoreForMatch(state) {
    // Engine has already reordered scores into the hand-drawn left/right sides.
    if (!state?.result) return null;
    const result = state.result;
    const points = result.goals;
    if (!points) return null;
    return {
      goals: points[0] + " : " + points[1],
      extra: result.overtime
        ? "加時賽" + (result.overtimeOnly ? "" :
          " " + result.overtime[0] + " : " + result.overtime[1])
        : result.overtimePlayed ? "加時賽" : "",
      pk: result.penalties ? "PK " + result.penalties[0] + " : " + result.penalties[1] : ""
    };
  }

  function matchMarker(match, position, state) {
    const holder = element("div", "cup-bracket-node cup-bracket-node--" + match.kind);
    holder.dataset.matchNumber = String(match.id);
    holder.style.left = position.x + "px";
    const scores = scoreForMatch(state);
    holder.style.top = (match.kind === "final" ? position.y - (scores ? 91 : 52) :
      match.kind === "bronze" ? position.y + 7 : position.y + 16) + "px";
    holder.setAttribute("aria-label", "第 " + match.id + " 場" +
      (match.kind === "final" ? " 冠軍戰" : match.kind === "bronze" ? " 季軍戰" : ""));
    if (match.kind === "final" || match.kind === "bronze") {
      holder.append(element("span", "cup-bracket-stage", match.kind === "final" ? "冠軍戰" : "季軍戰"));
    }
    holder.append(element("strong", "cup-bracket-match-number", "(" + chineseMatchNo(match.id) + ")"));
    if (scores) {
      const block = element("div", "cup-bracket-score");
      block.append(element("strong", "cup-bracket-match-goals", scores.goals));
      if (scores.extra) block.append(element("small", "cup-bracket-overtime", scores.extra));
      if (scores.pk) block.append(element("small", "cup-bracket-pk", scores.pk));
      holder.append(block);
    }
    const names = match.refs.map((ref, i) =>
      state?.participants?.[i] || labelForRef(ref)
    );
    holder.title = "第 " + match.id + " 場｜" + names.join(" vs ") +
      (scores ? "｜" + scores.goals + (scores.pk ? " " + scores.pk : "") : "");
    return holder;
  }

  function seedCard(token, x, y, seeds, used) {
    const card = element("div", "cup-bracket-seed");
    card.dataset.seed = token;
    card.style.left = x + "px";
    card.style.top = y + "px";
    card.append(element("strong", "cup-bracket-seed-code", token));
    const team = seeds[token];
    if (team) card.append(element("small", "cup-bracket-seed-name", team));
    else card.append(element("small", "cup-bracket-seed-name is-pending", "待定"));
    if (used) card.classList.add("is-seed-highlight");
    return card;
  }

  function rowStageTitle(stage, y, text) {
    const label = element("span", "cup-bracket-row-label", text);
    label.style.top = y + "px";
    label.dataset.bracketStage = stage;
    return label;
  }

  function bottomUpLightRace(config, positions, nodes, resolved, speed = 170) {
    const definitions = new Map(config.matches.map((match) => [match.id, match]));
    const finalMatch = config.matches.find((match) => match.kind === "final");
    const leaves = [];
    const paths = [];
    const meetings = new Map();
    const semifinalLosers = new Map();
    let bronzeRevealAt = null;

    // Reconstruct the same winning tree used by the 學童盃 implementation.
    function expandMatch(number) {
      const match = definitions.get(number);
      const point = nodes.get(number);
      if (!match || !point) return null;
      return {
        type: "match", number, kind: match.kind, ...point,
        children: match.refs.map((ref) => {
          const source = parseRef(ref);
          if (source?.type === "match" && source.outcome === "winner") {
            return expandMatch(source.matchNo);
          }
          const x = positions.seeds[source?.token];
          if (!Number.isFinite(x)) return null;
          const leaf = { type: "seed", token: source.token, x, y: positions.seedY };
          leaves.push(leaf);
          return leaf;
        })
      };
    }

    function seedPath(leaf) {
      const line = {
        leaf, d: "M " + leaf.x + " " + leaf.y, length: 0,
        time: 0, x: leaf.x, y: leaf.y, segments: [],
        fadeAt: null, isBronze: false
      };
      paths.push(line);
      return line;
    }

    function addSegment(line, x, y) {
      const distance = Math.abs(line.y - y) + Math.abs(line.x - x);
      const start = line.time;
      const end = start + distance / speed * 1000;
      line.segments.push({
        start, end, from: line.length, to: line.length + distance
      });
      line.d += " V " + y + " H " + x;
      line.length += distance;
      line.x = x;
      line.y = y;
      return end;
    }

    function advance(node) {
      if (!node) return null;
      if (node.type === "seed") return seedPath(node);
      const contenders = node.children.map(advance);
      const match = resolved.byMatch.get(node.number);
      // 未登錄本場成績時，只保留白色靜態路線。已完賽的前一輪
      // 仍可各自播放，但光點不會預先進入尚未比賽的下一輪。
      if (!match?.result?.goals) return null;
      if (contenders.some((line) => !line)) return null;
      const arrivals = contenders.map((line) => addSegment(line, node.x, node.y));
      const encounter = Math.max(...arrivals);
      contenders.forEach((line) => { line.time = encounter; });
      meetings.set(node.number, encounter);
      // 已有比分但未分勝負（例如淘汰賽 0:0、PK 待補）時，
      // 兩條光線只到本場交會點，比分揭露後不推定晉級隊伍。
      if (match.winnerSide == null) return null;
      const loser = contenders[1 - match.winnerSide];
      loser.fadeAt = encounter;
      if (node.kind === "semi") {
        semifinalLosers.set(node.number, {
          leaf: loser.leaf, x: node.x, y: node.y, time: encounter
        });
      }
      return contenders[match.winnerSide];
    }

    if (finalMatch) advance(expandMatch(finalMatch.id));

    const bronze = config.matches.find((match) => match.kind === "bronze");
    const bronzeState = bronze && resolved.byMatch.get(bronze.id);
    const bronzePosition = bronze && nodes.get(bronze.id);
    if (bronze && bronzePosition) {
      const contenders = bronze.refs.map((ref) => {
        const parsed = parseRef(ref);
        return parsed?.type === "match" && parsed.outcome === "loser"
          ? semifinalLosers.get(parsed.matchNo) : null;
      });
      if (contenders.every(Boolean)) {
        bronzeRevealAt = Math.max(...contenders.map((line) => line.time));
        // 季軍戰需兩支敗隊確定才顯示藍色靜態支線；等季軍戰
        // 有正式比分後，才會啟動這兩條藍色光線。
        if (bronzeState?.result?.goals) {
          const bronzePaths = contenders.map((line, side) => {
            const offsetX = line.x + (side === 0 ? 26 : -26);
            const distance = Math.abs(line.x - offsetX) +
              Math.abs(line.y - bronzePosition.y) + Math.abs(offsetX - bronzePosition.x);
            const duration = distance / speed * 1000;
            const path = {
              leaf: line.leaf,
              d: pathToMatch(line, bronzePosition, "bronze", side),
              length: distance, x: bronzePosition.x, y: bronzePosition.y,
              time: bronzeRevealAt + duration,
              segments: [{
                start: bronzeRevealAt, end: bronzeRevealAt + duration,
                from: 0, to: distance
              }],
              fadeAt: null, isBronze: true
            };
            paths.push(path);
            return path;
          });
          const encounter = Math.max(...bronzePaths.map((line) => line.time));
          meetings.set(bronze.id, encounter);
          if (bronzeState.winnerSide != null) {
            bronzePaths[1 - bronzeState.winnerSide].fadeAt = encounter;
          }
          bronzePaths.forEach((line) => { line.time = encounter; });
        }
      }
    }
    return { paths: paths.filter((line) => line.length > 0),
      meetings, bronzeRevealAt, leaves };
  }

  function buildCanvas(division, resolved) {
    const config = engine.BRACKET_CONFIG[division];
    const positions = geometry(division);
    const nodes = structure(config, positions);
    const semifinalMatches = config.matches.filter((match) => match.kind === "semi");
    const semifinalsComplete = semifinalMatches.length === 2 &&
      semifinalMatches.every((match) => resolved.byMatch.get(match.id)?.winnerSide != null);
    const race = bottomUpLightRace(config, positions, nodes, resolved);
    const canvas = element("div", "cup-bracket-canvas");
    canvas.style.width = WIDTH + "px";
    canvas.style.height = HEIGHT + "px";
    const diagram = svgNode("svg", {
      class: "cup-bracket-lines", viewBox: "0 0 " + WIDTH + " " + HEIGHT,
      "aria-hidden": "true", focusable: "false"
    });
    const lights = svgNode("g", { class: "cup-bracket-lights" });
    const scoreNodes = new Map();
    const seedNodes = new Map();
    const routeLines = new Map();

    for (const match of config.matches) {
      if (match.kind === "bronze" && !semifinalsComplete) continue;
      const to = nodes.get(match.id);
      if (!to) continue;
      match.refs.forEach((ref, side) => {
        const from = inputPosition(ref, positions, nodes);
        if (!from) return;
        const d = pathToMatch(from, to, match.kind, side);
        const baseClass = "cup-bracket-route" + (match.kind === "bronze" ? " is-bronze" : "");
        const path = svgPath(d, baseClass, match.kind, match.id, side);
        diagram.append(path);
        if (!routeLines.has(match.id)) routeLines.set(match.id, []);
        routeLines.get(match.id)[side] = path;
      });
    }
    diagram.append(lights);
    canvas.append(diagram);

    const isSix = division === "u8";
    if (isSix) canvas.append(rowStageTitle("prelim", positions.pre[0][1] - 8, "附加賽"));
    canvas.append(
      rowStageTitle("semi", positions.semi[0][1] - 8, "準決賽"),
      rowStageTitle("seeds", 757, "小組排名")
    );
    for (const match of config.matches) {
      if (match.kind === "bronze" && !semifinalsComplete) continue;
      const position = nodes.get(match.id);
      if (!position) continue;
      const marker = matchMarker(match, position, resolved.byMatch.get(match.id));
      const score = marker.querySelector(".cup-bracket-score");
      if (score && race.meetings.has(match.id)) {
        score.classList.add("is-score-pending");
        score.setAttribute("aria-hidden", "true");
        scoreNodes.set(match.id, score);
      }
      canvas.append(marker);
    }
    for (const leaf of race.leaves) {
      const card = seedCard(leaf.token, leaf.x, positions.seedY + 5,
        resolved.seeds, !!resolved.seeds[leaf.token]);
      seedNodes.set(leaf, card);
      canvas.append(card);
    }
    if (race.bronzeRevealAt != null) canvas.classList.add("has-staged-bronze");
    return { canvas, lights, race, scoreNodes, seedNodes, routeLines };
  }

  function animateLightRace(board) {
    const { canvas, lights, race, scoreNodes, seedNodes, routeLines } = board;
    const moving = [];
    const delay = 220;
    const fadeDuration = 420;
    let frameId = null;
    let startTime = null;
    let stopped = false;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const ns = SVG_NS;

    for (const path of race.paths) {
      const trace = document.createElementNS(ns, "path");
      trace.setAttribute("d", path.d);
      trace.setAttribute("class", "cup-bracket-route-light" +
        (path.isBronze ? " is-bronze" : ""));
      trace.style.strokeDasharray = path.length + " " + path.length;
      trace.style.strokeDashoffset = String(path.length);
      lights.append(trace);
      const spark = document.createElementNS(ns, "circle");
      spark.setAttribute("r", "6.5");
      spark.setAttribute("cx", "0");
      spark.setAttribute("cy", "0");
      spark.setAttribute("class", "cup-bracket-route-spark" +
        (path.isBronze ? " is-bronze" : ""));
      lights.append(spark);
      moving.push({
        trace, spark, ...path, seed: path.isBronze ? null : seedNodes.get(path.leaf)
      });
    }

    function revealScore(number) {
      const score = scoreNodes.get(number);
      if (score?.classList.contains("is-score-pending")) {
        score.classList.remove("is-score-pending");
        score.classList.add("is-score-revealed");
        score.removeAttribute("aria-hidden");
      }
      const result = [...engine.BRACKET_CONFIG[board.division].matches]
        .find((match) => match.id === number);
      const winnerSide = board.resolved.byMatch.get(number)?.winnerSide;
      if (result && winnerSide != null) {
        routeLines.get(number)?.[1 - winnerSide]?.classList.add("is-collided");
      }
    }

    function reset() {
      if (frameId !== null) window.clearTimeout(frameId);
      frameId = null;
      startTime = null;
      canvas.classList.remove("is-bronze-unlocked");
      moving.forEach(({ trace, spark, length }) => {
        trace.style.strokeDashoffset = String(length);
        trace.style.opacity = "0";
        spark.style.opacity = "0";
      });
      seedNodes.forEach((seed) => seed.classList.remove("is-collided", "is-finished"));
      scoreNodes.forEach((score) => {
        score.classList.add("is-score-pending");
        score.classList.remove("is-score-revealed");
        score.setAttribute("aria-hidden", "true");
      });
      routeLines.forEach((lines) => lines.forEach((line) =>
        line?.classList.remove("is-collided")));
    }

    const lastEvent = Math.max(0, ...moving.map((path) =>
      Math.max(path.segments[path.segments.length - 1].end,
        (path.fadeAt ?? 0) + fadeDuration)));

    function tick(now) {
      if (stopped) return;
      if (startTime === null) startTime = now;
      const elapsed = now - startTime - delay;
      if (race.bronzeRevealAt != null && elapsed >= race.bronzeRevealAt) {
        canvas.classList.add("is-bronze-unlocked");
      }
      for (const { trace, spark, length, segments, fadeAt, time, seed } of moving) {
        let distance = 0;
        for (const segment of segments) {
          if (elapsed < segment.start) break;
          if (elapsed >= segment.end) distance = segment.to;
          else {
            distance = segment.from + (segment.to - segment.from) *
              (elapsed - segment.start) / (segment.end - segment.start);
            break;
          }
        }
        const faded = fadeAt == null ? 0 :
          Math.min(1, Math.max(0, (elapsed - fadeAt) / fadeDuration));
        const visible = elapsed >= 0 && distance > 0;
        trace.style.strokeDashoffset = String(length - distance);
        trace.style.opacity = visible ? String(1 - faded) : "0";
        const point = trace.getPointAtLength(Math.max(0, Math.min(length, distance)));
        spark.setAttribute("cx", String(point.x));
        spark.setAttribute("cy", String(point.y));
        spark.style.opacity = visible && elapsed <= time && faded < 1 ? "1" : "0";
        if (seed && fadeAt !== null && elapsed >= fadeAt) seed.classList.add("is-collided");
        if (seed && fadeAt === null &&
          elapsed >= segments[segments.length - 1].end) seed.classList.add("is-finished");
      }
      race.meetings.forEach((encounter, number) => {
        if (elapsed >= encounter) revealScore(number);
      });
      if (elapsed < lastEvent + 50) {
        frameId = window.setTimeout(() => tick(window.performance.now()), 30);
      } else {
        frameId = null;
      }
    }

    function start() {
      reset();
      if (reduced) {
        canvas.classList.add("is-bronze-unlocked");
        race.meetings.forEach((_, number) => revealScore(number));
        moving.forEach(({ trace, spark, length, fadeAt, seed }) => {
          trace.style.strokeDashoffset = "0";
          trace.style.opacity = fadeAt === null ? "1" : "0";
          spark.style.opacity = "0";
          if (seed) seed.classList.add(fadeAt === null ? "is-finished" : "is-collided");
        });
        return;
      }
      if (moving.length) frameId = window.setTimeout(() => tick(window.performance.now()), 0);
    }
    start();
    return () => {
      stopped = true;
      if (frameId !== null) window.clearTimeout(frameId);
    };
  }

  // Same fit, 20–240%, focal-point pinch and Ctrl+wheel zoom as /2026/live-draws.js.
  function setupZoom(scroll, viewport, canvas, controls, previous) {
    const minScale = .2;
    const maxScale = 2.4;
    let scale = previous?.scale || 1;
    let manualZoom = previous?.manualZoom || false;
    const percent = controls.querySelector("[data-bracket-zoom-percent]");
    const controller = new AbortController();
    const signal = controller.signal;
    const clamp = (value) => Math.min(maxScale, Math.max(minScale, value));
    const renderScale = () => {
      viewport.style.width = Math.round(WIDTH * scale) + "px";
      viewport.style.height = Math.round(HEIGHT * scale) + "px";
      viewport.dataset.scale = String(scale);
      viewport.dataset.manualZoom = String(manualZoom);
      canvas.style.transform = "scale(" + scale + ")";
      percent.textContent = Math.round(scale * 100) + "%";
    };
    const horizontalInset = () => Math.max(0, (scroll.clientWidth - WIDTH * scale) / 2);
    const centerDiagram = () => {
      scroll.scrollLeft = Math.max(0, (WIDTH * scale - scroll.clientWidth) / 2);
    };
    const fitToScreen = () => {
      if (manualZoom || scroll.clientWidth <= 0) return;
      // Desktop: leave some breathing room around the complete bracket.
      // Keep the mobile fit and all manual zoom gestures unchanged.
      const desktop = window.matchMedia("(min-width: 900px)").matches;
      const fitFactor = desktop ? .9 : 1;
      scale = clamp(Math.min(1, (scroll.clientWidth - 16) / WIDTH) * fitFactor);
      renderScale();
      centerDiagram();
    };
    const zoom = (nextScale, anchorX, anchorY, contentPoint) => {
      const origin = contentPoint || {
        x: (scroll.scrollLeft + anchorX - horizontalInset()) / scale,
        y: (scroll.scrollTop + anchorY) / scale
      };
      manualZoom = true;
      scale = clamp(nextScale);
      renderScale();
      scroll.scrollLeft = origin.x * scale + horizontalInset() - anchorX;
      scroll.scrollTop = origin.y * scale - anchorY;
    };
    const center = () => ({ x: scroll.clientWidth / 2, y: scroll.clientHeight / 2 });
    controls.querySelector("[data-bracket-zoom-out]").addEventListener("click", () => {
      const point = center();
      zoom(scale / 1.25, point.x, point.y);
    }, { signal });
    controls.querySelector("[data-bracket-zoom-in]").addEventListener("click", () => {
      const point = center();
      zoom(scale * 1.25, point.x, point.y);
    }, { signal });
    controls.querySelector("[data-bracket-zoom-reset]").addEventListener("click", () => {
      manualZoom = false;
      fitToScreen();
    }, { signal });

    let gesture = null;
    const touchPoint = (touch) => {
      const box = scroll.getBoundingClientRect();
      return { x: touch.clientX - box.left, y: touch.clientY - box.top };
    };
    const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    function startGesture(touches) {
      if (touches.length >= 2) {
        const a = touchPoint(touches[0]);
        const b = touchPoint(touches[1]);
        const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture = {
          type: "pinch", distance: Math.max(1, distance(touches[0], touches[1])),
          scale, world: {
            x: (scroll.scrollLeft + middle.x - horizontalInset()) / scale,
            y: (scroll.scrollTop + middle.y) / scale
          }
        };
      } else if (touches.length === 1) {
        gesture = {
          type: "pan", start: touchPoint(touches[0]),
          left: scroll.scrollLeft, top: scroll.scrollTop
        };
      } else gesture = null;
    }
    scroll.addEventListener("touchstart", (event) => startGesture(event.touches),
      { passive: true, signal });
    scroll.addEventListener("touchmove", (event) => {
      if (!gesture) return;
      if (event.cancelable) event.preventDefault();
      if (event.touches.length >= 2) {
        if (gesture.type !== "pinch") startGesture(event.touches);
        const a = touchPoint(event.touches[0]);
        const b = touchPoint(event.touches[1]);
        zoom(gesture.scale * distance(event.touches[0], event.touches[1]) /
          gesture.distance, (a.x + b.x) / 2, (a.y + b.y) / 2, gesture.world);
      } else if (event.touches.length === 1) {
        if (gesture.type !== "pan") startGesture(event.touches);
        const point = touchPoint(event.touches[0]);
        scroll.scrollLeft = gesture.left + gesture.start.x - point.x;
        scroll.scrollTop = gesture.top + gesture.start.y - point.y;
      }
    }, { passive: false, signal });
    scroll.addEventListener("touchend", (event) => startGesture(event.touches),
      { passive: true, signal });
    scroll.addEventListener("touchcancel", () => { gesture = null; },
      { passive: true, signal });
    scroll.addEventListener("wheel", (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const box = scroll.getBoundingClientRect();
      zoom(scale * Math.exp(-event.deltaY * .01),
        event.clientX - box.left, event.clientY - box.top);
    }, { passive: false, signal });

    // Mouse panning is an additional desktop convenience. Mobile uses the
    // original touchstart/touchmove behaviour above.
    let dragging = null;
    scroll.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = { x: event.clientX, y: event.clientY,
        left: scroll.scrollLeft, top: scroll.scrollTop };
      scroll.classList.add("is-dragging");
      scroll.setPointerCapture(event.pointerId);
    }, { signal });
    scroll.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerType !== "mouse") return;
      scroll.scrollLeft = dragging.left + dragging.x - event.clientX;
      scroll.scrollTop = dragging.top + dragging.y - event.clientY;
    }, { signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      scroll.addEventListener(name, () => {
        dragging = null;
        scroll.classList.remove("is-dragging");
      }, { signal });
    }

    renderScale();
    if (previous && manualZoom) {
      scroll.scrollLeft = previous.left;
      scroll.scrollTop = previous.top;
    } else fitToScreen();
    const observer = typeof ResizeObserver === "function" ?
      new ResizeObserver(fitToScreen) : null;
    if (observer) observer.observe(scroll);
    else window.addEventListener("resize", fitToScreen, { signal });
    return {
      capture: () => ({ scale, manualZoom, left: scroll.scrollLeft, top: scroll.scrollTop }),
      cleanup: () => {
        observer?.disconnect();
        controller.abort();
      }
    };
  }

  function render(division, matches = []) {
    cleanup();
    const fragment = document.createDocumentFragment();
    const config = engine.BRACKET_CONFIG?.[division];
    if (!config) return { content: fragment, activate: () => {} };
    const resolved = engine.buildFixedBracket(division, matches);
    const heading = element("div", "cup-bracket-intro");
    heading.append(
      element("h2", "", division.toUpperCase() + " · 淘汰賽階梯圖"),
      element("p", "", "各隊光線由底部出發，碰面後依正式比分決定晉級；季軍戰藍線在準決賽後顯示。")
    );
    fragment.append(heading);
    const board = element("div", "cup-bracket-panel");
    const toolbar = element("div", "cup-bracket-toolbar");
    toolbar.append(element("span", "cup-bracket-gesture-tip",
      "光線由下往上晉級 · 雙指縮放 · 單指拖曳"));
    const buttons = [
      ["−", "縮小對戰階梯圖", "data-bracket-zoom-out"],
      ["適合", "調整為最佳大小", "data-bracket-zoom-reset"],
      ["+", "放大對戰階梯圖", "data-bracket-zoom-in"]
    ];
    buttons.forEach(([name, label, attribute]) => {
      const button = element("button", "cup-bracket-zoom-button", name);
      button.type = "button";
      button.setAttribute(attribute, "");
      button.setAttribute("aria-label", label);
      if (attribute === "data-bracket-zoom-reset") {
        button.setAttribute("data-bracket-zoom-percent", "");
      }
      toolbar.append(button);
    });
    const scroll = element("div", "cup-bracket-scroll");
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "由下往上的 " + division.toUpperCase() + " 淘汰賽晉級圖；可以拖曳和縮放");
    const viewport = element("div", "cup-bracket-viewport");
    const built = buildCanvas(division, resolved);
    viewport.append(built.canvas);
    scroll.append(viewport);
    board.append(toolbar, scroll);
    fragment.append(board);
    // Must initialize after the fragment's nodes have been attached to the page.
    const activate = () => {
      const zoom = setupZoom(scroll, viewport, built.canvas, toolbar,
        zoomHistory.get(division));
      const stopAnimation = animateLightRace({ ...built, division, resolved });
      activeSession = { division, zoom, stopAnimation };
    };
    return { content: fragment, activate };
  }

  window.TaichungBracketView = { render, cleanup };
})();
