(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.ScheduleEngine = api;
    root.TaichungScheduleEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // 固定分組快照：2026-11-26 依大會 Google 試算表更正 U6，
  // 將「東勢幼兒園（閃電疾風）」與「LOBO」互換 A/B 組。
  // U6: L/M、U8: K/L/M、U10/U12/U15: J/K。
  // 網站只從賽程 A-H 欄更新比分，絕不在執行時重抓或覆蓋這份分組隊名。
  const GROUPS = Object.freeze({
    u6: Object.freeze({
      A: Object.freeze(["東勢幼兒園（閃電疾風）", "U-Kicker", "ORIGINAL"]),
      B: Object.freeze(["LOBO", "海線", "HIKARI", "灣島黑狼"])
    }),
    u8: Object.freeze({
      A: Object.freeze(["藍鯨", "永隆", "山海屯", "TRAVELER"]),
      B: Object.freeze(["SAKURA(日本)", "埔里小獅王", "兒協老鷹隊", "海線"]),
      C: Object.freeze(["Taichung Lions", "肯尼獅", "南光熊讚"])
    }),
    u10: Object.freeze({
      A: Object.freeze(["ORIGINAL", "海線", "埔里小獅王"]),
      B: Object.freeze(["山海屯", "苗栗海洋", "TRAVELER"])
    }),
    u12: Object.freeze({
      A: Object.freeze(["TRAVELER", "肯尼獅", "南光熊讚", "BEST"]),
      B: Object.freeze(["KICKSTART(捷克/美國)", "惠文", "海線", "苗栗海洋"])
    }),
    u15: Object.freeze({
      A: Object.freeze(["BEST", "肯尼獅", "THUFC"]),
      B: Object.freeze(["藍鯨", "海線", "TRAVELER", "KICKSTART"])
    })
  });

  const BRACKET_CONFIG = Object.freeze({
    u6: Object.freeze({ matches: Object.freeze([
      Object.freeze({ id: 10, refs: Object.freeze(["A1", "B2"]), kind: "semi" }),
      Object.freeze({ id: 11, refs: Object.freeze(["A2", "B1"]), kind: "semi" }),
      Object.freeze({ id: 12, refs: Object.freeze(["敗10", "敗11"]), kind: "bronze" }),
      Object.freeze({ id: 13, refs: Object.freeze(["勝10", "勝11"]), kind: "final" })
    ]) }),
    u8: Object.freeze({ matches: Object.freeze([
      Object.freeze({ id: 16, refs: Object.freeze(["C1", "B2"]), kind: "prelim" }),
      Object.freeze({ id: 17, refs: Object.freeze(["A2", "C2"]), kind: "prelim" }),
      Object.freeze({ id: 18, refs: Object.freeze(["A1", "勝16"]), kind: "semi" }),
      Object.freeze({ id: 19, refs: Object.freeze(["勝17", "B1"]), kind: "semi" }),
      Object.freeze({ id: 20, refs: Object.freeze(["敗18", "敗19"]), kind: "bronze" }),
      Object.freeze({ id: 21, refs: Object.freeze(["勝18", "勝19"]), kind: "final" })
    ]) }),
    u10: Object.freeze({ matches: Object.freeze([
      Object.freeze({ id: 7, refs: Object.freeze(["A1", "B2"]), kind: "semi" }),
      Object.freeze({ id: 8, refs: Object.freeze(["A2", "B1"]), kind: "semi" }),
      Object.freeze({ id: 9, refs: Object.freeze(["敗7", "敗8"]), kind: "bronze" }),
      Object.freeze({ id: 10, refs: Object.freeze(["勝7", "勝8"]), kind: "final" })
    ]) }),
    u12: Object.freeze({ matches: Object.freeze([
      Object.freeze({ id: 13, refs: Object.freeze(["A1", "B2"]), kind: "semi" }),
      Object.freeze({ id: 14, refs: Object.freeze(["A2", "B1"]), kind: "semi" }),
      Object.freeze({ id: 15, refs: Object.freeze(["敗13", "敗14"]), kind: "bronze" }),
      Object.freeze({ id: 16, refs: Object.freeze(["勝13", "勝14"]), kind: "final" })
    ]) }),
    u15: Object.freeze({ matches: Object.freeze([
      Object.freeze({ id: 10, refs: Object.freeze(["A1", "B2"]), kind: "semi" }),
      Object.freeze({ id: 11, refs: Object.freeze(["A2", "B1"]), kind: "semi" }),
      Object.freeze({ id: 12, refs: Object.freeze(["敗10", "敗11"]), kind: "bronze" }),
      Object.freeze({ id: 13, refs: Object.freeze(["勝10", "勝11"]), kind: "final" })
    ]) })
  });

  const TEAM_ALIASES = Object.freeze({
    "lobofc": "LOBO",
    "originalfc": "ORIGINAL",
    "ukickerfootballclub": "U-Kicker",
    "sakurafc": "SAKURA(日本)",
    "台中藍鯨": "藍鯨",
    "taichunglionsfc": "Taichung Lions",
    "肯尼獅足球俱樂部": "肯尼獅",
    "旅人": "TRAVELER",
    "travelerfootballclub": "TRAVELER",
    "bestfc": "BEST",
    "kickstartfootballclub": "KICKSTART",
    "灣島黑狼fc": "灣島黑狼"
  });

  function normalizeText(value) {
    return String(value == null ? "" : value).normalize("NFKC").trim();
  }

  function teamKey(value) {
    return normalizeText(value).toLowerCase().replace(/臺/g, "台").replace(/[\s\p{P}\p{S}]/gu, "");
  }

  function looseTeamKey(value) {
    return teamKey(value)
      .replace(/footballclub/g, "")
      .replace(/足球俱樂部/g, "")
      .replace(/(?:捷克|美國|日本)/g, "")
      .replace(/fc$/g, "");
  }

  function normalizeDivision(value) {
    const match = normalizeText(value).toUpperCase().match(/U\s*(6|8|10|12|15)\b/);
    return match ? "u" + match[1] : "";
  }

  function canonicalTeam(division, value) {
    const text = normalizeText(value);
    if (!text || !GROUPS[division]) return text;
    const teams = Object.values(GROUPS[division]).flat();
    const exactKey = teamKey(text);
    const exact = teams.filter((team) => teamKey(team) === exactKey);
    if (exact.length === 1) return exact[0];

    const alias = TEAM_ALIASES[exactKey];
    if (alias) {
      const aliased = teams.find((team) => teamKey(team) === teamKey(alias) || looseTeamKey(team) === looseTeamKey(alias));
      if (aliased) return aliased;
    }

    const loose = looseTeamKey(text);
    if (!loose) return text;
    const candidates = teams.filter((team) => looseTeamKey(team) === loose);
    return candidates.length === 1 ? candidates[0] : text;
  }

  function parseResult(input) {
    let cleaned = normalizeText(input)
      .replace(/[：﹕∶]/g, ":")
      .replace(/[－—–-]/g, ":")
      .replace(/（/g, "(").replace(/）/g, ")")
      .replace(/點球大戰|点球大战|點球|点球|十二碼/g, "PK")
      .replace(/加時賽|加时赛|延長賽|延长赛|加時|加时|延長|延长/g, "OT")
      .toUpperCase()
      .replace(/P\s*\.?\s*K\.?/g, "PK")
      .replace(/O\s*\.?\s*T\.?/g, "OT")
      .replace(/比分/g, "")
      .replace(/\s+/g, "")
      .replace(/[()[\]{}，,、;；/／｜|=＝]/g, "");

    if (!cleaned) return null;
    const match = cleaned.match(/^(?:(\d+):(\d+))?(?:OT(?:(\d+):(\d+))?)?(?:PK(\d+):(\d+))?$/);
    if (!match || (match[1] == null && match[3] == null)) return null;

    const hasRegular = match[1] != null;
    const overtimePlayed = cleaned.includes("OT");
    const hasOvertimeScore = match[3] != null;
    const hasPenalties = match[5] != null;
    const regular = hasRegular ? [Number(match[1]), Number(match[2])] : null;
    const overtime = hasOvertimeScore ? [Number(match[3]), Number(match[4])] : null;
    const goals = regular || overtime;
    const penalties = hasPenalties ? [Number(match[5]), Number(match[6])] : null;
    const numbers = [...(goals || []), ...(overtime || []), ...(penalties || [])];
    if (!goals || !numbers.every(Number.isSafeInteger)) return null;

    const decisive = overtime || goals;
    let winnerSide = null;
    if (penalties) {
      if (decisive[0] === decisive[1] && penalties[0] !== penalties[1]) {
        winnerSide = penalties[0] > penalties[1] ? 0 : 1;
      }
    } else if (decisive[0] !== decisive[1]) {
      winnerSide = decisive[0] > decisive[1] ? 0 : 1;
    }

    let label = goals.join(":");
    if (overtimePlayed) label += " OT" + (overtime && regular ? " " + overtime.join(":") : "");
    if (penalties) label += " PK " + penalties.join(":");
    return {
      label,
      goals,
      regular,
      overtime,
      overtimePlayed,
      overtimeOnly: !!overtime && !regular,
      penalties,
      winnerSide,
      isCompleted: true,
      isDecisive: winnerSide !== null
    };
  }

  function cellText(cell) {
    if (cell == null) return "";
    if (typeof cell !== "object") return normalizeText(cell);
    if (cell.f != null && String(cell.f).trim() !== "") return normalizeText(cell.f);
    if (cell.v == null) return "";
    if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
      return [cell.v.getFullYear(), String(cell.v.getMonth() + 1).padStart(2, "0"), String(cell.v.getDate()).padStart(2, "0")].join("-");
    }
    return normalizeText(cell.v);
  }

  function rowCells(row) {
    const source = Array.isArray(row) ? row : (row && Array.isArray(row.c) ? row.c : []);
    return Array.from({ length: 8 }, (_, index) => cellText(source[index]));
  }

  function extractMatchNo(value) {
    const text = normalizeText(value);
    if (!text) return null;
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function isHeaderOrTitle(cols) {
    const joined = cols.join(" ");
    const headerHits = ["日期", "時間", "場地", "場次", "歲組", "隊名", "成績"].filter((word) => joined.includes(word)).length;
    if (headerHits >= 3) return true;
    const nonEmpty = cols.filter(Boolean);
    return nonEmpty.length <= 2 && /賽程表|賽程|對戰表/.test(joined) && !/開幕|閉幕/.test(joined);
  }

  function normalizeData(source, options) {
    const input = source && source.table && Array.isArray(source.table.rows)
      ? source.table.rows
      : (source && Array.isArray(source.rows) ? source.rows : source);
    if (!Array.isArray(input)) return [];
    const defaultDivision = normalizeDivision(typeof options === "string" ? options : (options && options.division));
    let currentDate = "";
    const output = [];

    input.forEach((row, sourceIndex) => {
      const cols = rowCells(row);
      if (!cols.some(Boolean) || isHeaderOrTitle(cols)) return;
      if (cols[0] && !/日期/.test(cols[0])) currentDate = cols[0];

      const matchNo = extractMatchNo(cols[3]);
      const division = normalizeDivision(cols[4]) || defaultDivision;
      const teamA = cols[5];
      const score = cols[6];
      const teamB = cols[7];
      const result = parseResult(score);
      const hasMatchSides = !!(teamA || teamB || score);

      if (matchNo !== null || (teamA && teamB)) {
        output.push({
          type: "match",
          sourceIndex,
          date: currentDate,
          time: cols[1],
          field: cols[2],
          matchNo,
          number: matchNo,
          matchLabel: cols[3],
          division,
          divisionLabel: cols[4],
          teamA,
          score,
          result,
          teamB
        });
        return;
      }

      const joined = cols.slice(2).filter(Boolean).join(" ");
      const eventLike = /開幕|閉幕|典禮|表演|頒獎|報到|休息|中場|活動/.test(joined);
      if (!eventLike && !hasMatchSides && !cols[3] && !cols[4]) return;
      const label = cols.slice(3).filter(Boolean).join(" · ") || (eventLike ? cols[2] : "");
      if (!label) return;
      output.push({
        type: "event",
        sourceIndex,
        date: currentDate,
        time: cols[1],
        field: cols[2],
        division,
        divisionLabel: cols[4],
        title: label,
        event: label,
        raw: cols
      });
    });
    return output;
  }

  function ensureNormalized(rows, division) {
    if (!Array.isArray(rows)) return normalizeData(rows, { division });
    const first = rows.find(Boolean);
    return first && typeof first === "object" && (first.type === "match" || first.type === "event")
      ? rows
      : normalizeData(rows, { division });
  }

  function groupLetterForTeam(division, team) {
    const canonical = canonicalTeam(division, team);
    const groups = GROUPS[division] || {};
    const found = Object.entries(groups).filter(([, teams]) => teams.includes(canonical));
    return found.length === 1 ? found[0][0] : "";
  }

  function collectGroupGames(division, rows, letter) {
    const teams = GROUPS[division] && GROUPS[division][letter];
    if (!teams) return { games: [], complete: false, expected: 0 };
    const expected = teams.length * (teams.length - 1) / 2;
    const byPair = new Map();

    ensureNormalized(rows, division).forEach((row) => {
      if (!row || row.type !== "match") return;
      if (row.division && row.division !== division) return;
      const first = canonicalTeam(division, row.teamA);
      const second = canonicalTeam(division, row.teamB);
      const firstIndex = teams.indexOf(first);
      const secondIndex = teams.indexOf(second);
      if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return;
      const result = row.result || parseResult(row.score);
      if (!result) return;
      const pair = [firstIndex, secondIndex].sort((a, b) => a - b).join("-");
      if (byPair.has(pair)) return;
      byPair.set(pair, { row, sides: [firstIndex, secondIndex], goals: result.goals.slice() });
    });

    return { games: [...byPair.values()], complete: byPair.size === expected, expected };
  }

  function fairPlayValue(fairPlay, division, letter, team) {
    if (!fairPlay) return undefined;
    const candidates = [
      fairPlay[division] && fairPlay[division][letter] && fairPlay[division][letter][team],
      fairPlay[letter] && fairPlay[letter][team],
      fairPlay[team]
    ];
    return candidates.find((value) => typeof value === "number" && Number.isFinite(value));
  }

  function rankTiedTeams(indices, games, entries, division, letter, fairPlay, criterion) {
    criterion = criterion || 0;
    if (indices.length === 1) return [{ indices: indices.slice() }];
    if (criterion > 5) return [{ indices: indices.slice(), reason: "同分待確認" }];

    const involved = new Set(indices);
    const related = new Map(indices.map((index) => [index, { points: 0, goalsFor: 0, goalsAgainst: 0 }]));
    games.forEach((game) => {
      if (!involved.has(game.sides[0]) || !involved.has(game.sides[1])) return;
      const first = related.get(game.sides[0]);
      const second = related.get(game.sides[1]);
      const goals = game.goals;
      first.goalsFor += goals[0];
      first.goalsAgainst += goals[1];
      second.goalsFor += goals[1];
      second.goalsAgainst += goals[0];
      if (goals[0] === goals[1]) {
        first.points += 1;
        second.points += 1;
      } else {
        (goals[0] > goals[1] ? first : second).points += 3;
      }
    });

    function metric(index) {
      const mini = related.get(index);
      const full = entries[index];
      switch (criterion) {
        case 0: return mini.points;
        case 1: return mini.goalsFor - mini.goalsAgainst;
        case 2: return mini.goalsFor;
        case 3: return full.goalsFor - full.goalsAgainst;
        case 4: return full.goalsFor;
        case 5: return fairPlayValue(fairPlay, division, letter, full.name);
        default: return undefined;
      }
    }

    const scores = indices.map((index) => ({ index, value: metric(index) }));
    if (scores.some((score) => typeof score.value !== "number" || !Number.isFinite(score.value))) {
      return [{ indices: indices.slice(), reason: criterion === 5 ? "公平競賽積分待確認" : "同分待確認" }];
    }
    const values = [...new Set(scores.map((score) => score.value))].sort((a, b) => b - a);
    if (values.length === 1) return rankTiedTeams(indices, games, entries, division, letter, fairPlay, criterion + 1);

    return values.flatMap((value) => {
      const tied = scores.filter((score) => score.value === value).map((score) => score.index);
      return rankTiedTeams(tied, games, entries, division, letter, fairPlay, 0);
    });
  }

  function computeGroupStandings(divisionInput, rows, letterInput, options) {
    const division = normalizeDivision(divisionInput) || normalizeText(divisionInput).toLowerCase();
    const letter = normalizeText(letterInput).toUpperCase();
    const teams = GROUPS[division] && GROUPS[division][letter];
    if (!teams) return null;
    const collected = collectGroupGames(division, rows, letter);
    const entries = teams.map((name) => ({
      name, points: 0, played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0
    }));

    collected.games.forEach((game) => {
      const [home, away] = game.goals;
      const outcome = home === away ? [1, 1] : (home > away ? [3, 0] : [0, 3]);
      game.sides.forEach((sideIndex, side) => {
        const entry = entries[sideIndex];
        entry.points += outcome[side];
        entry.played += 1;
        if (home === away) entry.draws += 1;
        else if (outcome[side] === 3) entry.wins += 1;
        else entry.losses += 1;
        entry.goalsFor += side === 0 ? home : away;
        entry.goalsAgainst += side === 0 ? away : home;
        entry.goalDifference = entry.goalsFor - entry.goalsAgainst;
      });
    });

    if (!collected.complete || entries.some((entry) => entry.played !== teams.length - 1)) {
      return {
        division, letter, complete: false, expectedMatches: collected.expected,
        completedMatches: collected.games.length, entries, places: [], qualifiers: {}, reason: "小組賽尚未完成"
      };
    }

    const fairPlay = options && options.fairPlay;
    const indices = entries.map((_, index) => index);
    const points = [...new Set(entries.map((entry) => entry.points))].sort((a, b) => b - a);
    const places = points.flatMap((point) => {
      const tied = indices.filter((index) => entries[index].points === point);
      return rankTiedTeams(tied, collected.games, entries, division, letter, fairPlay, 0);
    });
    const qualifiers = {};
    let position = 1;
    places.forEach((place) => {
      if (position <= 2 && place.indices.length === 1) {
        qualifiers[letter + position] = entries[place.indices[0]].name;
      }
      position += place.indices.length;
    });
    const unresolved = places.find((place) => place.indices.length > 1);
    const allUnique = !unresolved;
    const ranking = allUnique ? places.map((place) => entries[place.indices[0]].name) : null;

    return {
      division,
      letter,
      complete: true,
      expectedMatches: collected.expected,
      completedMatches: collected.games.length,
      entries,
      places: places.map((place) => ({
        teams: place.indices.map((index) => entries[index].name),
        reason: place.reason || ""
      })),
      qualifiers,
      ranking,
      reason: unresolved ? (unresolved.reason || "同分待確認") : ""
    };
  }

  function computeAllGroupStandings(divisionInput, rows, options) {
    const division = normalizeDivision(divisionInput) || normalizeText(divisionInput).toLowerCase();
    const groups = GROUPS[division] || {};
    return Object.keys(groups).reduce((result, letter) => {
      result[letter] = computeGroupStandings(division, rows, letter, options);
      return result;
    }, {});
  }

  function resolveGroupSeeds(divisionInput, rows, options) {
    const standings = computeAllGroupStandings(divisionInput, rows, options);
    return Object.values(standings).reduce((seeds, group) => Object.assign(seeds, group ? group.qualifiers : {}), {});
  }

  function parseSeed(value) {
    const raw = normalizeText(value);
    if (!raw) return null;
    let match = raw.match(/^([A-G])\s*([1-4])/i);
    if (match) {
      return { type: "group", group: match[1].toUpperCase(), rank: Number(match[2]), token: match[1].toUpperCase() + match[2], raw };
    }
    match = raw.match(/^\(\s*(\d+)\s*\)\s*(勝|敗)/u) || raw.match(/^(\d+)\s*(勝|敗)/u);
    if (match) {
      return { type: "match", matchNo: Number(match[1]), outcome: match[2] === "勝" ? "winner" : "loser", token: (match[2] === "勝" ? "勝" : "敗") + match[1], raw };
    }
    match = raw.match(/^(勝|敗)\s*\(?\s*(\d+)\s*\)?/u);
    if (match) {
      return { type: "match", matchNo: Number(match[2]), outcome: match[1] === "勝" ? "winner" : "loser", token: match[1] + match[2], raw };
    }
    return { type: "team", team: raw, token: raw, raw };
  }

  function orientedResult(sourceResult, sourceSides) {
    if (!sourceResult || !Array.isArray(sourceSides) || sourceSides.length !== 2 ||
        sourceSides.some((side) => side !== 0 && side !== 1) || sourceSides[0] === sourceSides[1]) return null;
    const pick = (values) => Array.isArray(values) ? sourceSides.map((side) => values[side]) : null;
    const goals = pick(sourceResult.goals);
    const regular = pick(sourceResult.regular);
    const overtime = pick(sourceResult.overtime);
    const penalties = pick(sourceResult.penalties);
    const winnerSide = sourceResult.winnerSide == null ? null : sourceSides.indexOf(sourceResult.winnerSide);
    let label = goals ? goals.join(":") : "";
    if (sourceResult.overtimePlayed) label += " OT" + (overtime && regular ? " " + overtime.join(":") : "");
    if (penalties) label += " PK " + penalties.join(":");
    return {
      ...sourceResult,
      label,
      goals,
      regular,
      overtime,
      penalties,
      winnerSide,
      isDecisive: winnerSide !== null
    };
  }

  function fixedSourceSides(division, refs, participants, row) {
    if (!row) return [null, null];
    const sourceValues = [row.teamA, row.teamB];
    const sourceRefs = sourceValues.map(parseSeed);

    function pairingScore(fixedSide, sourceSide) {
      const fixed = refs[fixedSide];
      const source = sourceRefs[sourceSide];
      if (!fixed || !source) return -1000;
      if (fixed.token === source.token) return 100;

      const participant = participants[fixedSide];
      if (participant && source.type === "team" &&
          teamKey(canonicalTeam(division, source.team)) === teamKey(participant)) return 90;

      if (fixed.type === "group" && source.type === "team") {
        const sourceTeam = canonicalTeam(division, source.team);
        if (groupLetterForTeam(division, sourceTeam) === fixed.group) return 30;
      }

      if (fixed.type === "team" && source.type === "team" &&
          teamKey(canonicalTeam(division, fixed.team)) === teamKey(canonicalTeam(division, source.team))) return 100;
      return 0;
    }

    const forward = pairingScore(0, 0) + pairingScore(1, 1);
    const reverse = pairingScore(0, 1) + pairingScore(1, 0);
    if (forward > reverse && forward > 0) return [0, 1];
    if (reverse > forward && reverse > 0) return [1, 0];
    return [null, null];
  }

  function buildFixedBracket(divisionInput, rows, options) {
    const division = normalizeDivision(divisionInput) || normalizeText(divisionInput).toLowerCase();
    const config = BRACKET_CONFIG[division];
    if (!config) return { division, seeds: {}, matches: [], rounds: [], byMatch: new Map(), config: null };

    const normalized = ensureNormalized(rows || [], division);
    const seeds = Object.assign({}, resolveGroupSeeds(division, normalized, options), options && options.seeds);
    const sourceRows = new Map();
    normalized.forEach((row) => {
      if (!row || row.type !== "match") return;
      if (row.division && row.division !== division) return;
      const number = row.matchNo != null ? row.matchNo : row.number;
      if (number != null && !sourceRows.has(number)) sourceRows.set(number, row);
    });

    const definitions = new Map(config.matches.map((match) => [match.id, match]));
    const cache = new Map();

    function resolve(number, path) {
      if (cache.has(number)) return cache.get(number);
      const definition = definitions.get(number);
      if (!definition) return null;
      path = path || new Set();
      if (path.has(number)) return null;
      const nextPath = new Set(path);
      nextPath.add(number);
      const refs = definition.refs.map(parseSeed);
      const participants = refs.map((ref) => {
        if (!ref) return null;
        if (ref.type === "group") return seeds[ref.token] || null;
        if (ref.type === "team") return canonicalTeam(division, ref.team) || null;
        const previous = resolve(ref.matchNo, nextPath);
        if (!previous || previous.winnerSide == null) return null;
        return ref.outcome === "winner" ? previous.winner : previous.loser;
      });

      const row = sourceRows.get(number) || null;
      const sourceSides = fixedSourceSides(division, refs, participants, row);
      const sourceResult = row && (row.result || parseResult(row.score));
      const result = orientedResult(sourceResult, sourceSides);
      const canNameWinner = participants.every(Boolean) && result && result.winnerSide !== null;
      const winnerSide = canNameWinner ? result.winnerSide : null;
      let status = "waiting-result";
      if (participants.some((team) => !team)) status = "waiting-seeds";
      else if (!row || !sourceResult) status = "waiting-result";
      else if (sourceSides.some((side) => side == null)) status = "source-unresolved";
      else if (!result || result.winnerSide == null) status = "tied-unresolved";
      else status = "complete";

      const state = {
        matchNo: number,
        seeds: definition.refs.slice(),
        participants,
        winnerSide,
        winner: winnerSide == null ? null : participants[winnerSide],
        loser: winnerSide == null ? null : participants[1 - winnerSide],
        result,
        score: result ? result.label : (row ? normalizeText(row.score) : ""),
        sourceSides,
        status,
        kind: definition.kind,
        date: row ? row.date : "",
        time: row ? row.time : "",
        field: row ? row.field : ""
      };
      cache.set(number, state);
      return state;
    }

    config.matches.forEach((match) => resolve(match.id));
    const matches = config.matches.map((match) => cache.get(match.id));
    const rounds = [];
    const byKind = new Map();
    matches.forEach((match) => {
      if (!byKind.has(match.kind)) {
        const round = { kind: match.kind, matches: [] };
        byKind.set(match.kind, round);
        rounds.push(round);
      }
      byKind.get(match.kind).matches.push(match);
    });
    return { division, seeds, matches, rounds, byMatch: cache, config };
  }

  function buildBracketLadder(divisionInput, rows, options) {
    const division = normalizeDivision(divisionInput) || normalizeText(divisionInput).toLowerCase();
    const normalized = ensureNormalized(rows, division);
    const seeds = Object.assign({}, resolveGroupSeeds(division, normalized, options), options && options.seeds);
    const definitions = new Map();

    normalized.forEach((row) => {
      if (!row || row.type !== "match" || row.matchNo == null) return;
      if (row.division && row.division !== division) return;
      const left = parseSeed(row.teamA);
      const right = parseSeed(row.teamB);
      if (!left || !right || (left.type === "team" && right.type === "team")) return;
      if (!definitions.has(row.matchNo)) definitions.set(row.matchNo, { row, refs: [left, right] });
    });

    const cache = new Map();
    function resolve(number, path) {
      if (cache.has(number)) return cache.get(number);
      const definition = definitions.get(number);
      if (!definition) return null;
      path = path || new Set();
      if (path.has(number)) {
        const cyclic = { matchNo: number, participants: [null, null], winner: null, loser: null, winnerSide: null, depth: 0, status: "invalid-cycle" };
        cache.set(number, cyclic);
        return cyclic;
      }
      const nextPath = new Set(path);
      nextPath.add(number);
      let depth = 0;
      const participants = definition.refs.map((ref) => {
        if (ref.type === "group") return seeds[ref.token] || null;
        if (ref.type === "team") return canonicalTeam(division, ref.team) || null;
        const previous = resolve(ref.matchNo, nextPath);
        if (previous) depth = Math.max(depth, previous.depth + 1);
        if (!previous || previous.winnerSide == null) return null;
        return ref.outcome === "winner" ? previous.winner : previous.loser;
      });
      const result = definition.row.result || parseResult(definition.row.score);
      let winnerSide = null;
      if (participants.every(Boolean) && result && result.winnerSide !== null) winnerSide = result.winnerSide;
      let status = "waiting-result";
      if (participants.some((team) => !team)) status = "waiting-seeds";
      else if (!result) status = "waiting-result";
      else if (winnerSide == null) status = "tied-unresolved";
      else status = "complete";
      const state = {
        matchNo: number,
        date: definition.row.date,
        time: definition.row.time,
        field: definition.row.field,
        seeds: definition.refs.map((ref) => ref.token),
        participants,
        score: definition.row.score,
        result,
        winnerSide,
        winner: winnerSide == null ? null : participants[winnerSide],
        loser: winnerSide == null ? null : participants[1 - winnerSide],
        depth,
        status
      };
      cache.set(number, state);
      return state;
    }

    [...definitions.keys()].forEach((number) => resolve(number));
    const matches = [...cache.values()].sort((a, b) => a.depth - b.depth || a.matchNo - b.matchNo);
    const roundsByDepth = new Map();
    matches.forEach((match) => {
      if (!roundsByDepth.has(match.depth)) roundsByDepth.set(match.depth, []);
      roundsByDepth.get(match.depth).push(match);
    });
    const rounds = [...roundsByDepth.entries()].sort((a, b) => a[0] - b[0]).map(([depthValue, roundMatches]) => ({ depth: depthValue, matches: roundMatches }));
    return { division, seeds, matches, rounds, byMatch: cache };
  }

  return Object.freeze({
    GROUPS,
    BRACKET_CONFIG,
    parseResult,
    normalizeData,
    normalizeDivision,
    canonicalTeam,
    groupLetterForTeam,
    computeGroupStandings,
    computeAllGroupStandings,
    resolveGroupSeeds,
    parseSeed,
    buildFixedBracket,
    buildBracketLadder,
    resolveBracket: buildBracketLadder
  });
});
