/* 小組圖：隊伍名單固定在 schedule-engine.js 的 GROUPS。
   各條比分僅由比賽賽程 A-H 欄更新；不讀取工作表右側的分組欄。 */
(() => {
  "use strict";
  const engine = window.TaichungScheduleEngine || window.ScheduleEngine;
  if (!engine) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const EDGES = Object.freeze({
    3: [
      { sides: [0, 1], number: [38, 71], goals: [[73, 44], [42, 108]] },
      { sides: [0, 2], number: [164, 71], goals: [[127, 44], [158, 108]] },
      { sides: [1, 2], number: [100, 152], goals: [[64, 132], [136, 132]] }
    ],
    4: [
      { sides: [0, 1], number: [100, 9], goals: [[70, 16], [130, 16]] },
      { sides: [2, 3], number: [100, 152], goals: [[70, 141], [130, 141]] },
      { sides: [0, 2], number: [13, 78], goals: [[24, 51], [24, 110]] },
      { sides: [1, 3], number: [188, 78], goals: [[176, 51], [176, 110]] },
      { sides: [0, 3], number: [73, 62], goals: [[59, 39], [143, 106]] },
      { sides: [1, 2], number: [128, 62], goals: [[141, 39], [57, 106]] }
    ]
  });

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function svg(tag, attributes, text) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join("-");

  function findGroupMatches(division, letter, teams, matches) {
    const records = new Map();
    for (const row of matches) {
      if (row.type !== "match" || (row.division && row.division !== division)) continue;
      const home = teams.indexOf(engine.canonicalTeam(division, row.teamA));
      const away = teams.indexOf(engine.canonicalTeam(division, row.teamB));
      if (home < 0 || away < 0 || home === away) continue;
      const key = pairKey(home, away);
      if (records.has(key)) continue;
      records.set(key, { row, indices: [home, away] });
    }
    return records;
  }

  function lineDiagram(teams, records, letter) {
    const count = teams.length;
    const graphic = svg("svg", {
      viewBox: "0 0 200 155",
      class: "fixed-group-svg",
      "aria-hidden": "true",
      focusable: "false"
    });
    if (count === 3) {
      graphic.append(svg("polygon", {
        points: "100,12 18,136 182,136",
        class: "fixed-group-outline"
      }));
    } else {
      graphic.append(svg("rect", {
        x: "24", y: "12", width: "152", height: "124",
        class: "fixed-group-outline"
      }));
      for (const [x1, y1, x2, y2] of [[24, 12, 176, 136], [176, 12, 24, 136]]) {
        graphic.append(svg("line", {
          x1, y1, x2, y2, class: "fixed-group-diagonal"
        }));
      }
    }
    for (const edge of EDGES[count]) {
      const match = records.get(pairKey(...edge.sides));
      if (!match) continue;
      const { row, indices } = match;
      const group = svg("g", {
        class: "fixed-group-edge",
        "data-match-number": row.matchNo ?? ""
      });
      if (row.matchNo != null) {
        group.append(svg("text", {
          x: edge.number[0],
          y: edge.number[1] - 3,
          class: "fixed-group-game-number"
        }, "(" + row.matchNo + ")"));
      }
      const result = row.result || engine.parseResult(row.score);
      if (result) {
        edge.sides.forEach((teamIndex, side) => {
          const scoreIndex = indices.indexOf(teamIndex);
          const [x, y] = edge.goals[side];
          group.append(svg("text", {
            x, y, class: "fixed-group-game-score"
          }, result.goals[scoreIndex]));
        });
        if (result.penalties) {
          group.append(svg("text", {
            x: edge.number[0],
            y: edge.number[1] + 13,
            class: "fixed-group-game-pk"
          }, "PK"));
        } else if (result.overtimePlayed) {
          group.append(svg("text", {
            x: edge.number[0],
            y: edge.number[1] + 13,
            class: "fixed-group-game-pk"
          }, "OT"));
        }
      }
      graphic.append(group);
    }
    graphic.append(svg("text", {
      x: 100, y: count === 3 ? 103 : 113,
      class: "fixed-group-letter"
    }, letter));
    return graphic;
  }

  function getGamesSummary(teams, records) {
    const total = teams.length * (teams.length - 1) / 2;
    const completed = [...records.values()].filter(({ row }) =>
      !!(row.result || engine.parseResult(row.score))
    ).length;
    return { total, completed };
  }

  function standingsTable(standings) {
    const section = node("div", "fixed-group-table-wrap");
    const table = node("table", "fixed-group-table");
    table.setAttribute("aria-label", standings.letter + " 組積分表");
    const thead = document.createElement("thead");
    const headers = [
      ["球隊", "name"], ["賽", "played"], ["勝", "wins"],
      ["和", "draws"], ["敗", "losses"], ["進", "goalsFor"],
      ["失", "goalsAgainst"], ["積分", "points"]
    ];
    const head = node("tr");
    headers.forEach(([label, id]) => {
      const cell = node("th", "fixed-group-col-" + id, label);
      cell.scope = "col";
      head.append(cell);
    });
    thead.append(head);
    table.append(thead);

    const ranked = standings.ranking;
    const list = ranked
      ? ranked.map((name) => standings.entries.find((entry) => entry.name === name))
      : standings.entries;
    const tbody = document.createElement("tbody");
    for (const entry of list) {
      const tr = node("tr");
      if (ranked && ranked.indexOf(entry.name) === 0) tr.classList.add("is-first");
      const rank = ranked ? ranked.indexOf(entry.name) + 1 : null;
      headers.forEach(([, field]) => {
        const cell = node(field === "name" ? "th" : "td",
          "fixed-group-col-" + field,
          field === "name" ? entry.name : entry[field]);
        if (field === "name") {
          cell.scope = "row";
          if (rank !== null) cell.prepend(node("span", "fixed-group-rank", String(rank)));
        }
        tr.append(cell);
      });
      tbody.append(tr);
    }
    table.append(tbody);
    section.append(table);
    return section;
  }

  function scoreLabel(row) {
    const result = row.result || engine.parseResult(row.score);
    return result ? result.label : "VS";
  }

  function fixturesDetails(teams, records) {
    const details = node("details", "fixed-group-fixtures");
    details.append(node("summary", "", "查看小組對戰與比分"));
    const list = node("div", "fixed-group-fixtures-list");
    const sorted = [...records.values()].sort((first, second) =>
      (first.row.matchNo ?? Infinity) - (second.row.matchNo ?? Infinity));
    for (const { row } of sorted) {
      const record = node("div", "fixed-group-fixture");
      record.append(
        node("small", "", row.matchNo != null ? "#" + row.matchNo : "場次"),
        node("span", "", row.teamA),
        node("strong", "", scoreLabel(row)),
        node("span", "", row.teamB)
      );
      list.append(record);
    }
    if (!sorted.length) list.append(node("p", "fixed-group-fixture-none", "尚未取得各場次資料"));
    details.append(list);
    return details;
  }

  function card(division, letter, teams, matches) {
    const records = findGroupMatches(division, letter, teams, matches);
    const standings = engine.computeGroupStandings(division, matches, letter);
    const games = getGamesSummary(teams, records);
    const wrapper = node("article", "fixed-group-card");
    wrapper.dataset.group = letter;
    const heading = node("div", "fixed-group-heading");
    heading.append(
      node("h3", "", letter + " 組"),
      node("span", "", teams.length + " 隊 · 已賽 " + games.completed + " / " + games.total + " 場")
    );
    wrapper.append(heading);

    const figure = node("div", "fixed-group-figure fixed-group-figure--" + teams.length);
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-label", letter + " 組三角／方形對戰圖：" + teams.join("、"));
    figure.append(lineDiagram(teams, records, letter));
    const spots = teams.length === 3
      ? ["top", "bottom-left", "bottom-right"]
      : ["top-left", "top-right", "bottom-left", "bottom-right"];
    teams.forEach((team, index) => {
      const entry = standings.entries.find((item) => item.name === team);
      const slot = node("div", "fixed-group-team fixed-group-team--" + spots[index]);
      slot.append(
        node("span", "fixed-group-team-name", team),
        node("span", "fixed-group-team-points", (entry?.points ?? 0) + " 分")
      );
      const first = standings.qualifiers[letter + "1"] === team;
      const second = standings.qualifiers[letter + "2"] === team;
      if (first || second) {
        slot.classList.add(first ? "is-first" : "is-second");
        slot.append(node("span", "fixed-group-qualifier", letter + (first ? "1" : "2")));
      }
      figure.append(slot);
    });
    wrapper.append(figure);
    const note = node("p", "fixed-group-note");
    if (!matches.length) note.textContent = "分組名單已固定，等待比賽成績同步。";
    else if (standings.complete && standings.reason) note.textContent = "已完成小組賽；" + standings.reason + "，須由大會確認名次。";
    else if (standings.complete) note.textContent = "小組賽已完成，依積分及同分判定規則確定名次。";
    if (note.textContent) wrapper.append(note);
    wrapper.append(standingsTable(standings), fixturesDetails(teams, records));
    return wrapper;
  }

  function render(division, matches = []) {
    const fixed = engine.GROUPS[division];
    const container = document.createDocumentFragment();
    if (!fixed) return container;
    const grid = node("div", "fixed-groups-grid");
    Object.entries(fixed).forEach(([letter, teams]) =>
      grid.append(card(division, letter, teams, matches)));
    container.append(grid);
    return container;
  }

  window.TaichungGroupView = { render };
})();
