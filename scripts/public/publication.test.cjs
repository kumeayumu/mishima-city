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

// Parse real production responses rather than mocking Server Components.
const { createRequire } = require("node:module");
const path = require("node:path");
const { JSDOM } = createRequire(path.resolve("web/package.json"))("jsdom");

async function searchDocument(params = {}) {
  const response = await fetch(`${base}/?${new URLSearchParams(params)}`);
  assert.equal(response.status, 200);
  return new JSDOM(await response.text(), { url: response.url }).window
    .document;
}

test("bill search starts with all bills and uses an accessible GET form", async () => {
  const doc = await searchDocument();
  assert.equal(
    doc.getElementById("bill-search-count").textContent,
    "該当62件／全62件"
  );
  const form = doc.querySelector('form[aria-label="議案検索"]');
  assert.equal(form.method, "get");
  assert.equal(new URL(form.action).pathname, "/");
  assert.equal(new URL(form.action).hash, "#official-bills");
  for (const name of ["q", "session", "result"]) {
    const field = form.elements.namedItem(name);
    assert.ok(field.labels.length, `${name} has a visible label`);
  }
  assert.equal(
    doc.getElementById("official-bills").parentElement.querySelectorAll("li")
      .length,
    62
  );
});

test("bill search restores combined URL conditions and official source links", async () => {
  const session = "https://www.city.mishima.shizuoka.jp/site/gikai/38814.html";
  const params = { q: "６８　一般会計", session, result: "unpublished" };
  for (let reload = 0; reload < 2; reload++) {
    const doc = await searchDocument(params);
    assert.equal(
      doc.getElementById("bill-search-count").textContent,
      "該当1件／全62件（絞り込み中）"
    );
    assert.equal(doc.getElementById("bill-query").value, "68 一般会計");
    assert.equal(doc.getElementById("bill-session").value, session);
    assert.equal(doc.getElementById("bill-result").value, "unpublished");
    const list = doc.getElementById("official-bills").parentElement;
    assert.equal(list.querySelectorAll("li").length, 1);
    assert.match(list.textContent, /議第68号/);
    assert.match(list.textContent, /議決結果は公式資料に未掲載/);
    assert.ok(
      list.querySelector(
        'a[href="https://www.city.mishima.shizuoka.jp/uploaded/attachment/17869.pdf"]'
      )
    );
    assert.equal(doc.querySelectorAll('a[href^="/minutes/"]').length, 7);
  }
});

test("zero results can be cleared without losing meeting navigation", async () => {
  const doc = await searchDocument({ q: "存在しない検索語", result: "可決" });
  assert.equal(
    doc.getElementById("bill-search-count").textContent,
    "該当0件／全62件（絞り込み中）"
  );
  assert.match(doc.body.textContent, /該当する議案はありません/);
  const clear = [...doc.querySelectorAll("a")].find(
    (a) => a.textContent === "条件をすべて解除"
  );
  assert.ok(clear);
  const response = await fetch(clear.href);
  const restored = new JSDOM(await response.text()).window.document;
  assert.equal(
    restored.getElementById("bill-search-count").textContent,
    "該当62件／全62件"
  );
});

test("member directory and every member page expose source-dated facts without invented activity totals", async () => {
  const members = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/members.json",
      "utf8"
    )
  );
  const memberCoverage = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/2026/coverage.json",
      "utf8"
    )
  );
  const memberSources = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/sources.json",
      "utf8"
    )
  );
  const expectedReviewLabel =
    memberCoverage.operatorReview === "approved" &&
    memberSources.every((source) => source.review.operatorReview === "approved")
      ? "運営者確認済み"
      : "運営者による確認前";
  assert.equal(members.length, 22);
  const directory = await fetch(`${base}/members`);
  assert.equal(directory.status, 200);
  const list = await directory.text();
  assert.match(list, /該当(?:<!-- -->)?22/);
  for (const member of members) {
    const path = `/members/${member.id}`;
    assert.ok(list.includes(path));
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const text of [
      member.name,
      member.kana,
      "2026-05-15",
      "2026-05-20",
      "データ整備中",
      "個人の就任日・途中異動は未確認",
      "公式の議員紹介・名簿",
      expectedReviewLabel,
      "三島市・三島市議会",
    ]) {
      assert.ok(html.includes(text), `${path}: ${text}`);
    }
    assert.ok(
      html.includes("https://www.city.mishima.shizuoka.jp/site/gikai/4585.html")
    );
    assert.doesNotMatch(
      html,
      /賛成0件|反対0件|登壇0回|活動スコア|googletagmanager\.com|rubyful-v2\.s3|_vercel\/speed-insights/
    );
    assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  }
  assert.equal((await fetch(`${base}/members/not-a-member`)).status, 404);
});
