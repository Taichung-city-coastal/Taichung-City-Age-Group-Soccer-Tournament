"use strict";

// One-time verification utility for the 2026-11-26 fixed group snapshot.
// The public website never calls this script or downloads the Sheet's group columns.
const assert = require("node:assert/strict");
const { GROUPS } = require("../js/schedule-engine.js");

const sheetId = "1ftHNzPYCmHHl9611hHOHmX5H6WUHiQ8h9PkPhUUlfcc";
const divisions = Object.keys(GROUPS);
const cell = (row, index) => String(row.c?.[index]?.v ?? "").trim();

async function compare(division) {
  const sheet = division.toUpperCase();
  const url = "https://docs.google.com/spreadsheets/d/" + sheetId +
    "/gviz/tq?tqx=out:json&sheet=" + sheet;
  const response = await fetch(url);
  assert.equal(response.status, 200, sheet + " must be publicly readable");
  const raw = await response.text();
  const marker = "google.visualization.Query.setResponse(";
  const start = raw.indexOf(marker);
  assert.ok(start >= 0, "invalid gviz response for " + sheet);
  const payload = JSON.parse(raw.slice(start + marker.length, raw.lastIndexOf(");")));
  assert.equal(payload.status, "ok");
  const rows = payload.table.rows;
  const headers = rows[1];
  const groups = {};
  for (let i = 8; i < payload.table.cols.length; i++) {
    const match = /^([A-Z])組$/.exec(cell(headers, i));
    if (!match) continue;
    const teams = [];
    for (let j = 2; j < rows.length; j++) {
      const name = cell(rows[j], i);
      if (!name) break;
      teams.push(name);
    }
    groups[match[1]] = teams;
  }
  assert.deepEqual(groups, GROUPS[division], sheet + ": local team list differs from the frozen Sheet snapshot");
  const count = Object.values(groups).reduce((total, teams) => total + teams.length, 0);
  console.log(sheet + ": " + Object.keys(groups).length + " 組 / " + count + " 隊，固定名單一致");
  return count;
}

(async () => {
  let count = 0;
  for (const division of divisions) count += await compare(division);
  assert.equal(count, 39);
  console.log("已核對 11 組、39 隊：網站固定分組清單完全一致");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
