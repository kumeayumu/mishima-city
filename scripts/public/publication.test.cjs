const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.PUBLIC_TEST_BASE_URL || "http://127.0.0.1:3002";
const index = JSON.parse(
  fs.readFileSync(
    "web/src/features/official-records/server/data/2026/minutes-index.json",
    "utf8"
  )
);

test("public pages identify the operator and do not load analytics or external ruby scripts", async () => {
  for (const path of ["/", "/faq", "/privacy", "/terms"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /久米歩/);
    assert.match(html, /mailto:kume@soma-wood.jp/);
    assert.match(html, /テスト公開/);
    assert.match(html, /三島市・三島市議会/);
    assert.doesNotMatch(
      html,
      /googletagmanager\.com|rubyful-v2\.s3|_vercel\/speed-insights/
    );
    assert.doesNotMatch(html, /運営者未設定|福岡市版/);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  }
});

test("all seven meeting pages link to official records without embedding transcript text", async () => {
  assert.equal(index.meetings.length, 7);
  for (const meeting of index.meetings) {
    const response = await fetch(`${base}/minutes/${meeting.id}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /会議録本文はこのサイトには掲載していません/);
    assert.ok(html.includes(meeting.sourceUrl.replaceAll("&", "&amp;")));
    const original = JSON.parse(
      fs.readFileSync(
        `web/src/features/official-records/server/data/2026/minutes/${meeting.id}.json`,
        "utf8"
      )
    );
    const paragraphs = original.minutes
      .flatMap((entry) => entry.text.split(/\r?\n/))
      .filter((text) => text.length > 50);
    assert.ok(paragraphs.length > 0);
    for (const text of paragraphs) {
      assert.ok(
        !html.includes(text.slice(0, 50)),
        `Transcript leaked for ${meeting.id}`
      );
    }
  }
});

test("legacy assets, database APIs and source JSON are not served", async () => {
  for (const path of [
    "/ogp.jpg",
    "/icons/pwa/icon_fukuoka.svg",
    "/api/chat",
    "/committees",
    "/minutes/unknown",
    "/src/features/official-records/server/data/2026/minutes/453-1.json",
  ]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});

test("image optimization endpoint is disabled and crawlers are excluded", async () => {
  const response = await fetch(
    `${base}/_next/image?url=%2Fimg%2Flogo.svg&w=64&q=75`
  );
  assert.ok(response.status >= 400);
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.match(robots, /Disallow: \//);
});
