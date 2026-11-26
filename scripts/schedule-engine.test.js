"use strict";

const assert = require("node:assert/strict");
const engine = require("../js/schedule-engine.js");

function match(matchNo, division, teamA, score, teamB) {
  return {
    type: "match",
    matchNo,
    division,
    date: "2026/12/05",
    time: "13:00",
    field: "A",
    teamA,
    score,
    result: engine.parseResult(score),
    teamB
  };
}

function gvizRow(values) {
  return { c: values.map((value) => value == null ? null : { v: value }) };
}

// 比分：正規、加時、PK 都要能判讀；不合法的 PK 不得硬猜勝方。
{
  const regular = engine.parseResult("３：０");
  assert.deepEqual(regular.goals, [3, 0]);
  assert.equal(regular.winnerSide, 0);

  const overtime = engine.parseResult("2:2 OT 3:2");
  assert.deepEqual(overtime.regular, [2, 2]);
  assert.deepEqual(overtime.overtime, [3, 2]);
  assert.equal(overtime.winnerSide, 0);

  const trailingOt = engine.parseResult("2:1 加時賽");
  assert.equal(trailingOt.overtimePlayed, true);
  assert.equal(trailingOt.winnerSide, 0);

  const penalties = engine.parseResult("1:1 點球 4:5");
  assert.deepEqual(penalties.penalties, [4, 5]);
  assert.equal(penalties.winnerSide, 1);

  const impossiblePenalties = engine.parseResult("1:0 PK 4:3");
  assert.equal(impossiblePenalties.winnerSide, null);
  assert.equal(impossiblePenalties.isDecisive, false);
}

// Google gviz 8 欄資料：略過標題/表頭、日期可向下沿用，特殊開幕列保留為 event。
{
  const payload = {
    table: {
      rows: [
        gvizRow(["U10 賽程表"]),
        gvizRow(["日期", "時間", "場地", "場次", "歲組", "隊名", "成績", "隊名"]),
        gvizRow(["2026/12/12", "12:50", "開幕", "", "", "", "", ""]),
        gvizRow(["2026/12/12", "13:00", "A", "1", "U10", "ORIGINAL", "3:0", "海線"]),
        gvizRow(["", "13:30", "A", "2", "U10", "埔里小獅王", "1:1", "ORIGINAL"])
      ]
    }
  };
  const rows = engine.normalizeData(payload, "u10");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].type, "event");
  assert.equal(rows[0].field, "開幕");
  assert.equal(rows[0].division, "u10");
  assert.equal(rows[1].type, "match");
  assert.equal(rows[1].matchNo, 1);
  assert.equal(rows[1].number, 1);
  assert.deepEqual(rows[1].result.goals, [3, 0]);
  assert.equal(rows[2].date, "2026/12/12");
  assert.equal(rows[2].teamA, "埔里小獅王");
}

// 已知分組必須內建，並接受常見正式隊名別名但不任意模糊配對。
{
  assert.deepEqual(engine.GROUPS.u6.A, ["東勢幼兒園（閃電疾風）", "U-Kicker", "ORIGINAL"]);
  assert.deepEqual(engine.GROUPS.u6.B, ["LOBO", "海線", "HIKARI", "灣島黑狼"]);
  assert.equal(engine.canonicalTeam("u6", "LOBO FC"), "LOBO");
  assert.equal(engine.groupLetterForTeam("u6", "LOBO"), "B");
  assert.equal(engine.groupLetterForTeam("u6", "東勢幼兒園（閃電疾風）"), "A");
  assert.equal(engine.canonicalTeam("u8", "台中藍鯨"), "藍鯨");
  assert.equal(engine.canonicalTeam("u12", "KICKSTART Football Club"), "KICKSTART(捷克/美國)");
}

// U6 交換後，兩組積分及準決賽 A1/A2/B1/B2 必須一起更新。
{
  const rows = [
    match(1, "u6", "東勢幼兒園（閃電疾風）", "2:0", "U-Kicker"),
    match(2, "u6", "LOBO", "3:0", "海線"),
    match(3, "u6", "HIKARI", "1:0", "灣島黑狼"),
    match(4, "u6", "東勢幼兒園（閃電疾風）", "2:0", "ORIGINAL"),
    match(5, "u6", "HIKARI", "0:3", "LOBO"),
    match(6, "u6", "海線", "2:0", "灣島黑狼"),
    match(7, "u6", "U-Kicker", "1:0", "ORIGINAL"),
    match(8, "u6", "LOBO", "3:0", "灣島黑狼"),
    match(9, "u6", "海線", "2:0", "HIKARI")
  ];
  const groups = engine.computeAllGroupStandings("u6", rows);
  assert.equal(groups.A.complete, true);
  assert.equal(groups.B.complete, true);
  assert.equal(groups.A.completedMatches, 3);
  assert.equal(groups.B.completedMatches, 6);
  assert.deepEqual(groups.A.qualifiers, { A1: "東勢幼兒園（閃電疾風）", A2: "U-Kicker" });
  assert.deepEqual(groups.B.qualifiers, { B1: "LOBO", B2: "海線" });
  const bracket = engine.buildFixedBracket("u6", rows);
  assert.deepEqual(bracket.byMatch.get(10).participants, ["東勢幼兒園（閃電疾風）", "海線"]);
  assert.deepEqual(bracket.byMatch.get(11).participants, ["U-Kicker", "LOBO"]);
}

// 同積分先看相關隊伍勝負關係；兩個不同積分群都必須分得出直接對戰順位。
{
  const rows = [
    match(1, "u8", "藍鯨", "1:0", "永隆"),
    match(2, "u8", "山海屯", "1:0", "藍鯨"),
    match(3, "u8", "TRAVELER", "1:0", "藍鯨"),
    match(4, "u8", "永隆", "1:0", "山海屯"),
    match(5, "u8", "TRAVELER", "1:0", "永隆"),
    match(6, "u8", "山海屯", "1:0", "TRAVELER")
  ];
  const standings = engine.computeGroupStandings("u8", rows, "A");
  assert.equal(standings.complete, true);
  assert.deepEqual(standings.ranking, ["山海屯", "TRAVELER", "藍鯨", "永隆"]);
  assert.deepEqual(standings.qualifiers, { A1: "山海屯", A2: "TRAVELER" });
}

// 三隊同積分時建立相關隊伍 mini-table，依相關淨勝球/進球往下判定。
{
  const rows = [
    match(1, "u8", "藍鯨", "1:0", "永隆"),
    match(2, "u8", "永隆", "3:0", "山海屯"),
    match(3, "u8", "山海屯", "1:0", "藍鯨"),
    match(4, "u8", "藍鯨", "1:0", "TRAVELER"),
    match(5, "u8", "永隆", "1:0", "TRAVELER"),
    match(6, "u8", "山海屯", "1:0", "TRAVELER")
  ];
  const standings = engine.computeGroupStandings("u8", rows, "A");
  assert.deepEqual(standings.ranking, ["永隆", "藍鯨", "山海屯", "TRAVELER"]);
  assert.deepEqual(standings.qualifiers, { A1: "永隆", A2: "藍鯨" });
}

// 小組未完成不得產生 A1/A2；公平競賽無資料時也必須保持未決。
{
  const incomplete = [
    match(1, "u10", "ORIGINAL", "1:0", "海線"),
    match(2, "u10", "ORIGINAL", "1:0", "埔里小獅王")
  ];
  const incompleteStandings = engine.computeGroupStandings("u10", incomplete, "A");
  assert.equal(incompleteStandings.complete, false);
  assert.deepEqual(incompleteStandings.qualifiers, {});

  const unresolved = [
    match(1, "u10", "ORIGINAL", "0:0", "海線"),
    match(2, "u10", "ORIGINAL", "0:0", "埔里小獅王"),
    match(3, "u10", "海線", "0:0", "埔里小獅王")
  ];
  const unresolvedStandings = engine.computeGroupStandings("u10", unresolved, "A");
  assert.equal(unresolvedStandings.complete, true);
  assert.equal(unresolvedStandings.ranking, null);
  assert.deepEqual(unresolvedStandings.qualifiers, {});
  assert.equal(unresolvedStandings.reason, "公平競賽積分待確認");
}

// 小組圖積分表與勝／和／敗欄位使用相同比分判定，尚未踢完仍能顯示目前積分。
{
  const rows = [
    match(1, "u10", "ORIGINAL", "2:1", "海線"),
    match(2, "u10", "ORIGINAL", "0:0", "埔里小獅王")
  ];
  const group = engine.computeGroupStandings("u10", rows, "A");
  const original = group.entries.find((team) => team.name === "ORIGINAL");
  const harbor = group.entries.find((team) => team.name === "海線");
  assert.equal(original.points, 4);
  assert.deepEqual([original.played, original.wins, original.draws, original.losses], [2, 1, 1, 0]);
  assert.deepEqual([original.goalsFor, original.goalsAgainst, original.goalDifference], [2, 1, 1]);
  assert.equal(harbor.points, 0);
  assert.deepEqual([harbor.played, harbor.wins, harbor.draws, harbor.losses], [1, 0, 0, 1]);
  assert.deepEqual(group.qualifiers, {});
}

// 第一名若仍是兩隊同分群，後面的單一隊伍實際是第三名，不能誤標成 A2。
{
  const unresolvedTop = [
    match(1, "u10", "ORIGINAL", "1:1", "海線"),
    match(2, "u10", "ORIGINAL", "1:0", "埔里小獅王"),
    match(3, "u10", "海線", "1:0", "埔里小獅王")
  ];
  const standings = engine.computeGroupStandings("u10", unresolvedTop, "A");
  assert.equal(standings.complete, true);
  assert.deepEqual(standings.qualifiers, {});
}

// 括號賽完全由 A1 / B2 / (10)勝敗等來源籤位串接；平手無 PK 時不猜勝方。
{
  const groupRows = [
    match(1, "u10", "ORIGINAL", "2:0", "海線"),
    match(2, "u10", "ORIGINAL", "1:0", "埔里小獅王"),
    match(3, "u10", "海線", "1:0", "埔里小獅王"),
    match(4, "u10", "山海屯", "3:0", "苗栗海洋"),
    match(5, "u10", "山海屯", "1:0", "TRAVELER"),
    match(6, "u10", "苗栗海洋", "2:0", "TRAVELER")
  ];
  const bracketRows = [
    match(10, "u10", "A1", "1:1 PK 4:3", "B2"),
    match(11, "u10", "B1", "2:1 OT", "A2"),
    match(12, "u10", "(10)勝", "0:0", "(11)勝"),
    match(13, "u10", "(10)敗", "1:0", "(11)敗")
  ];
  const bracket = engine.buildBracketLadder("u10", groupRows.concat(bracketRows));
  assert.deepEqual(bracket.seeds, { A1: "ORIGINAL", A2: "海線", B1: "山海屯", B2: "苗栗海洋" });

  const m10 = bracket.byMatch.get(10);
  assert.deepEqual(m10.participants, ["ORIGINAL", "苗栗海洋"]);
  assert.equal(m10.winner, "ORIGINAL");
  assert.equal(m10.loser, "苗栗海洋");

  const m11 = bracket.byMatch.get(11);
  assert.deepEqual(m11.participants, ["山海屯", "海線"]);
  assert.equal(m11.winner, "山海屯");

  const final = bracket.byMatch.get(12);
  assert.deepEqual(final.participants, ["ORIGINAL", "山海屯"]);
  assert.equal(final.winner, null);
  assert.equal(final.status, "tied-unresolved");

  const consolation = bracket.byMatch.get(13);
  assert.deepEqual(consolation.participants, ["苗栗海洋", "海線"]);
  assert.equal(consolation.winner, "苗栗海洋");
  assert.equal(consolation.depth, 1);
  assert.equal(bracket.rounds.length, 2);
}

// 即使淘汰賽已有比分，只要來源小組尚未完成，仍不能把未知 A1 當成勝方。
{
  const rows = [
    match(1, "u10", "ORIGINAL", "1:0", "海線"),
    match(10, "u10", "A1", "3:0", "B2")
  ];
  const bracket = engine.buildBracketLadder("u10", rows);
  const m10 = bracket.byMatch.get(10);
  assert.deepEqual(m10.participants, [null, null]);
  assert.equal(m10.winner, null);
  assert.equal(m10.status, "waiting-seeds");
}

// 固定階梯圖五組配置必須完全依手繪，沒有任何賽程資料也要保留所有固定場次與籤位。
{
  const expected = {
    u6: [[10, ["A1", "B2"], "semi"], [11, ["A2", "B1"], "semi"], [12, ["敗10", "敗11"], "bronze"], [13, ["勝10", "勝11"], "final"]],
    u8: [[16, ["C1", "B2"], "prelim"], [17, ["A2", "C2"], "prelim"], [18, ["A1", "勝16"], "semi"], [19, ["勝17", "B1"], "semi"], [20, ["敗18", "敗19"], "bronze"], [21, ["勝18", "勝19"], "final"]],
    u10: [[7, ["A1", "B2"], "semi"], [8, ["A2", "B1"], "semi"], [9, ["敗7", "敗8"], "bronze"], [10, ["勝7", "勝8"], "final"]],
    u12: [[13, ["A1", "B2"], "semi"], [14, ["A2", "B1"], "semi"], [15, ["敗13", "敗14"], "bronze"], [16, ["勝13", "勝14"], "final"]],
    u15: [[10, ["A1", "B2"], "semi"], [11, ["A2", "B1"], "semi"], [12, ["敗10", "敗11"], "bronze"], [13, ["勝10", "勝11"], "final"]]
  };
  Object.entries(expected).forEach(([division, matches]) => {
    assert.deepEqual(engine.BRACKET_CONFIG[division].matches.map((item) => [item.id, item.refs, item.kind]), matches);
    const bracket = engine.buildFixedBracket(division, []);
    assert.equal(bracket.matches.length, matches.length);
    assert.equal(bracket.byMatch.size, matches.length);
    matches.forEach(([id, refs]) => {
      const state = bracket.byMatch.get(id);
      assert.deepEqual(state.seeds, refs);
      assert.deepEqual(state.participants, [null, null]);
      assert.deepEqual(state.sourceSides, [null, null]);
      assert.equal(state.winner, null);
      assert.equal(state.status, "waiting-seeds");
    });
  });
}

// U10 第 8 場試算表是 B1×A2；固定手繪是 A2×B1，因此比分、PK 與勝方都要反向回固定左右。
{
  const seeds = { A1: "ORIGINAL", A2: "海線", B1: "山海屯", B2: "苗栗海洋" };
  const rows = [
    match(7, "u10", "苗栗海洋", "0:2", "ORIGINAL"),
    match(8, "u10", "B1", "1:1 PK 5:4", "A2"),
    match(9, "u10", "敗7", "", "敗8"),
    match(10, "u10", "山海屯", "0:1", "ORIGINAL")
  ];
  const bracket = engine.buildFixedBracket("u10", rows, { seeds });
  const m7 = bracket.byMatch.get(7);
  assert.deepEqual(m7.sourceSides, [1, 0]);
  assert.deepEqual(m7.result.goals, [2, 0]);
  assert.equal(m7.score, "2:0");
  assert.equal(m7.winner, "ORIGINAL");

  const m8 = bracket.byMatch.get(8);
  assert.deepEqual(m8.sourceSides, [1, 0]);
  assert.deepEqual(m8.result.penalties, [4, 5]);
  assert.equal(m8.result.winnerSide, 1);
  assert.equal(m8.winnerSide, 1);
  assert.equal(m8.winner, "山海屯");
  assert.equal(m8.loser, "海線");
  assert.equal(m8.score, "1:1 PK 4:5");

  const bronze = bracket.byMatch.get(9);
  assert.deepEqual(bronze.participants, ["苗栗海洋", "海線"]);
  assert.equal(bronze.status, "waiting-result");

  const final = bracket.byMatch.get(10);
  assert.deepEqual(final.participants, ["ORIGINAL", "山海屯"]);
  assert.deepEqual(final.sourceSides, [1, 0]);
  assert.equal(final.winner, "ORIGINAL");
}

// U6/U12/U15 的第二場 Google Sheet 都是 B1×A2；固定 API 必須一律映射成 A2×B1。
{
  const cases = [
    ["u6", 11, { A2: "U-Kicker", B1: "LOBO" }],
    ["u12", 14, { A2: "肯尼獅", B1: "KICKSTART(捷克/美國)" }],
    ["u15", 11, { A2: "肯尼獅", B1: "藍鯨" }]
  ];
  cases.forEach(([division, number, seeds]) => {
    const row = match(number, division, "B1", "3:1", "A2");
    const bracket = engine.buildFixedBracket(division, [row], { seeds });
    const state = bracket.byMatch.get(number);
    assert.deepEqual(state.participants, [seeds.A2, seeds.B1]);
    assert.deepEqual(state.sourceSides, [1, 0]);
    assert.deepEqual(state.result.goals, [1, 3]);
    assert.equal(state.winnerSide, 1);
    assert.equal(state.winner, seeds.B1);
  });
}

// U8 兩場首輪能以 bracket 代號進入固定階梯；未完賽只顯示已知參賽者，不猜晉級隊伍。
{
  const seeds = { A1: "藍鯨", A2: "永隆", B1: "SAKURA(日本)", B2: "埔里小獅王", C1: "Taichung Lions", C2: "肯尼獅" };
  const rows = [
    match(16, "u8", "C1", "2:1", "B2"),
    match(17, "u8", "A2", "", "C2"),
    match(18, "u8", "A1", "", "(16)勝")
  ];
  const bracket = engine.buildFixedBracket("u8", rows, { seeds });
  assert.equal(bracket.byMatch.get(16).winner, "Taichung Lions");
  assert.deepEqual(bracket.byMatch.get(18).participants, ["藍鯨", "Taichung Lions"]);
  assert.equal(bracket.byMatch.get(17).winner, null);
  assert.equal(bracket.byMatch.get(19).participants[0], null);
  assert.equal(bracket.byMatch.get(21).winner, null);
}

// 固定階梯即使已看到 bracket 代號與比分，小組籤位尚未確定時也不得先宣告勝隊。
{
  const bracket = engine.buildFixedBracket("u10", [match(7, "u10", "A1", "3:0", "B2")]);
  const state = bracket.byMatch.get(7);
  assert.deepEqual(state.sourceSides, [0, 1]);
  assert.deepEqual(state.result.goals, [3, 0]);
  assert.deepEqual(state.participants, [null, null]);
  assert.equal(state.winnerSide, null);
  assert.equal(state.winner, null);
  assert.equal(state.status, "waiting-seeds");
}

console.log("schedule-engine: all assertions passed");
