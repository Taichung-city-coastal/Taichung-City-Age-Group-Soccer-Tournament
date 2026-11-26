"use strict";

// Run from /115: node scripts/check-live-schedule.js
// Uses read-only access to the tournament's public Google Sheet.
const assert = require("node:assert/strict");
const engine = require("../js/schedule-engine.js");

const id = "1ftHNzPYCmHHl9611hHOHmX5H6WUHiQ8h9PkPhUUlfcc";
const names = { u6: "U6", u8: "U8", u10: "U10", u12: "U12", u15: "U15" };
const expectedMatches = { u6: 13, u8: 21, u10: 10, u12: 16, u15: 13 };

async function load(group) {
  const url = "https://docs.google.com/spreadsheets/d/" + id +
    "/gviz/tq?tqx=out:json&sheet=" + encodeURIComponent(names[group]);
  const response = await fetch(url);
  assert.equal(response.status, 200, "Google Sheet " + names[group] + " should be public");
  const text = await response.text();
  const marker = "google.visualization.Query.setResponse(";
  const begin = text.indexOf(marker);
  assert.ok(begin >= 0, group + " must return Google visualization data");
  const end = text.lastIndexOf(");");
  assert.ok(end > begin, group + " must contain a valid payload");
  const payload = JSON.parse(text.slice(begin + marker.length, end));
  assert.equal(payload.status, "ok");
  const rows = engine.normalizeData(payload, { division: group });
  const matches = rows.filter((item) => item.type === "match");
  const events = rows.filter((item) => item.type === "event");
  assert.equal(matches.length, expectedMatches[group], group + " match count changed; verify the sheet and update this check");
  assert.ok(matches.every((item) => item.matchNo > 0 && item.date && item.teamA && item.teamB),
    group + " should have valid numbered fixtures and dates");
  assert.equal(events.length, ["u6", "u8", "u15"].includes(group) ? 1 : 0,
    group + " should preserve any opening ceremony");
  const ladder = engine.buildBracketLadder(group, rows);
  assert.ok(ladder.matches.length > 0, group + " should define a knockout bracket");
  if (group === "u6") {
    const groupMatches = matches.filter((match) => match.matchNo <= 9);
    const grouped = { A: new Set(), B: new Set() };
    for (const match of groupMatches) {
      const a = engine.groupLetterForTeam(group, match.teamA);
      const b = engine.groupLetterForTeam(group, match.teamB);
      assert.ok(a && a === b, "U6 場次 " + match.matchNo + " 有跨組或未知隊伍：" +
        match.teamA + " vs " + match.teamB);
      grouped[a].add([match.teamA, match.teamB].sort().join("|"));
    }
    assert.equal(grouped.A.size, 3, "U6 A 組 3 場對戰應完整");
    assert.equal(grouped.B.size, 6, "U6 B 組 6 場對戰應完整");
    assert.equal(engine.canonicalTeam("u6", matches.find((m) => m.matchNo === 1).teamA),
      "東勢幼兒園（閃電疾風）");
    assert.equal(engine.canonicalTeam("u6", matches.find((m) => m.matchNo === 2).teamA),
      "LOBO");
  }
  console.log(names[group] + ": " + matches.length + " 場比賽, " + events.length +
    " 筆大會活動, " + ladder.matches.length + " 場淘汰賽路線");
}

(async () => {
  for (const group of Object.keys(names)) await load(group);
  console.log("公開 Google 賽程核對完成");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
