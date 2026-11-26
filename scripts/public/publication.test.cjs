const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.PUBLIC_TEST_BASE_URL || "http://127.0.0.1:3002";

const currentVoteReview = JSON.parse(
  fs.readFileSync(
    "web/src/features/council-activity/server/data/2026/vote-verifications.json",
    "utf8"
  )
);
function expectedVoteReviewLabel() {
  if (
    currentVoteReview.independentReview === "approved" &&
    currentVoteReview.operatorReview === "approved"
  )
    return "別AI独立照合受入・本人目視最終承認済み";
  if (currentVoteReview.independentReview === "approved")
    return "別AI独立照合受入済み・本人目視最終承認待ち";
  return "機械・画像照合値・別AI照合受入／本人目視最終承認待ち";
}

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
    assert.match(list.textContent, /議決結果は保存済み議案一覧に未掲載/);
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
    (memberCoverage.activities.votes !== "partial" ||
      memberCoverage.voteIndependentReview === "approved") &&
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

test("voting pages preserve real cells, unknown coverage and every official bill link", async () => {
  const refs = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/2026/bill-references.json",
      "utf8"
    )
  );
  const events = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/2026/voting-events.json",
      "utf8"
    )
  );
  for (const ref of refs) {
    const response = await fetch(`${base}/bills/${ref.id}`);
    assert.equal(response.status, 200, ref.id);
    const html = await response.text();
    assert.ok(html.includes(ref.number));
    assert.ok(html.includes(expectedVoteReviewLabel()));
    assert.ok(html.includes("www.city.mishima.shizuoka.jp"));
    if (ref.availability === "result_unreported")
      assert.ok(html.includes("議決結果の掲載確認日："));
    if (ref.availability === "recorded") {
      const event = events.find((e) => e.billId === ref.id);
      for (const memberId of event.memberIds)
        assert.ok(html.includes(`id="vote-${memberId}"`));
    } else {
      assert.ok(html.includes("個人別賛否"));
      assert.doesNotMatch(html, /賛成0人|反対0人/);
    }
  }
  assert.equal((await fetch(`${base}/bills/not-a-bill`)).status, 404);
});

test("vote matrix represents all 62 bills without synthesizing votes", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const response = await fetch(`${base}/votes?coverage=all&view=matrix`);
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text()).window.document;
  assert.equal(dom.querySelectorAll("table tbody tr").length, 22);
  assert.equal(
    dom
      .querySelector('[aria-label="賛否マトリクス・縦横スクロール"]')
      .getAttribute("tabindex"),
    "0"
  );
  assert.equal(dom.querySelectorAll("table thead th").length, 63);
  const cells = [...dom.querySelectorAll("table tbody td")];
  assert.equal(cells.length, 1364);
  assert.equal(cells.filter((c) => c.textContent === "未").length, 770);
  assert.equal(cells.filter((c) => c.textContent === "結").length, 396);
  const recorded = await fetch(`${base}/votes?view=matrix`);
  const only = new JSDOM(await recorded.text()).window.document;
  assert.equal(only.querySelectorAll("table tbody td").length, 198);
  const divided = new JSDOM(
    await (await fetch(`${base}/votes?coverage=all&divided=1`)).text()
  ).window.document;
  assert.ok(
    divided.querySelector('[role="status"]').textContent.includes("表示9議案")
  );
});

test("historical faction filter separates out-of-scope votes from unavailable affiliations", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const members = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/members.json",
      "utf8"
    )
  );
  const id = members.find((m) => m.name === "土屋利絵").id;
  const url = `${base}/votes?view=matrix&member=${id}&faction=${encodeURIComponent("新風会")}`;
  const doc = new JSDOM(await (await fetch(url)).text()).window.document;
  const cells = [...doc.querySelectorAll("tbody td")];
  assert.equal(cells.length, 9);
  assert.equal(cells.filter((c) => c.textContent === "外").length, 1);
  assert.equal(cells.filter((c) => c.textContent === "○").length, 8);
  const may = new JSDOM(await (await fetch(`${url}&session=5`)).text()).window
    .document;
  assert.equal(may.querySelectorAll("tbody tr").length, 1);
  assert.equal(may.querySelector("tbody td").textContent, "外");
  const unknown = new JSDOM(
    await (await fetch(`${url}&coverage=all&session=11`)).text()
  ).window.document;
  assert.equal(unknown.querySelectorAll("tbody td").length, 18);
  assert.ok(
    [...unknown.querySelectorAll("tbody td a")].every((a) =>
      a.getAttribute("aria-label").includes("会派未確認")
    )
  );
});

test("May correction binds the two named members to the original source cells", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const okada = "msh-9c4f751d-9ffa-4169-85c8-a2b5eb6657a4",
    horie = "msh-9a91fd31-771d-499b-a653-61a08a4fb7b8",
    bill = "msh-2026-5-sho-5";
  const doc = new JSDOM(await (await fetch(`${base}/bills/${bill}`)).text())
    .window.document;
  assert.ok(doc.getElementById(`vote-${okada}`).textContent.includes("○ 賛成"));
  assert.ok(
    doc
      .getElementById(`vote-${horie}`)
      .textContent.includes("議 議長による採決不参加")
  );
  assert.ok(
    [...doc.querySelectorAll("a")].some(
      (a) =>
        a.href.includes("council_id=452") && a.href.includes("schedule_id=1")
    )
  );
  assert.ok(
    doc.body.textContent.includes("旧「198一致・不一致0」の報告は撤回")
  );
  const matrix = new JSDOM(
    await (await fetch(`${base}/votes?view=matrix`)).text()
  ).window.document;
  for (const [id, symbol] of [
    [okada, "○"],
    [horie, "議"],
  ]) {
    const row = [...matrix.querySelectorAll("tbody tr")].find(
      (r) => r.querySelector("th a")?.getAttribute("href") === `/members/${id}`
    );
    const cell = [...row.querySelectorAll("td a")].find(
      (a) => a.getAttribute("href") === `/bills/${bill}#vote-${id}`
    );
    assert.equal(cell.textContent, symbol);
  }
});

test("corrected May votes appear in each member's history without changing other events", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  for (const [id, label] of [
    ["msh-9c4f751d-9ffa-4169-85c8-a2b5eb6657a4", "○ 賛成"],
    ["msh-9a91fd31-771d-499b-a653-61a08a4fb7b8", "議 議長による採決不参加"],
  ]) {
    const doc = new JSDOM(await (await fetch(`${base}/members/${id}`)).text())
      .window.document;
    const section = doc.getElementById("member-votes").closest("section");
    assert.equal(section.querySelectorAll("li").length, 9);
    const link = [...section.querySelectorAll("li a")].find(
      (a) => a.getAttribute("href") === `/bills/msh-2026-5-sho-5#vote-${id}`
    );
    assert.ok(link.closest("li").textContent.includes(label));
  }
});

test("matrix provides upper scrolling, a separate legend and complete bill names", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const doc = new JSDOM(await (await fetch(`${base}/votes?view=matrix`)).text())
    .window.document;
  const lower = doc.querySelector(
      '[aria-label="賛否マトリクス・縦横スクロール"]'
    ),
    upper = doc.querySelector('[aria-label="表上部の横スクロール"]');
  assert.ok(lower);
  assert.ok(upper);
  assert.equal(upper.getAttribute("tabindex"), "0");
  assert.ok(!lower.contains(doc.getElementById("matrix-legend")));
  assert.equal(doc.querySelectorAll("thead details").length, 9);
  for (const d of doc.querySelectorAll("thead details")) {
    assert.ok(d.querySelector("summary"));
    assert.ok(d.querySelector("p").textContent.length > 5);
  }
  const members = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/members.json",
      "utf8"
    )
  );
  const rows = [...doc.querySelectorAll('tbody th[scope="row"]')];
  assert.equal(rows.length, 22);
  for (const m of members)
    assert.ok(
      rows.some(
        (r) =>
          r.textContent.trim() === m.name &&
          r.classList.contains("whitespace-nowrap")
      )
    );
  assert.equal(doc.querySelectorAll("tbody td").length, 198);
});

test("AI recheck completion is reported separately from human approval", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const doc = new JSDOM(await (await fetch(`${base}/votes`)).text()).window
    .document;
  assert.ok(
    doc.body.textContent.includes("訂正後の別AI再比較報告：198一致・0不一致")
  );
  const verification = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/2026/vote-verifications.json",
      "utf8"
    )
  );
  const expected =
    verification.independentReview === "approved"
      ? verification.operatorReview === "approved"
        ? "別AI独立照合受入・本人目視最終承認済み"
        : "別AI独立照合受入済み・本人目視最終承認待ち"
      : "別AI照合受入／本人目視最終承認待ち";
  assert.ok(doc.body.textContent.includes(expected));
  assert.ok(!doc.body.textContent.includes("訂正後の別AI再比較は未完了"));
});

test("faction-filtered cards retain unknown historical affiliation", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const doc = new JSDOM(
    await (
      await fetch(
        `${base}/votes?coverage=all&session=11&faction=${encodeURIComponent("新風会")}&view=list`
      )
    ).text()
  ).window.document;
  assert.equal(
    [...doc.querySelectorAll("li")].filter((li) =>
      li.textContent.includes("採決当時の会派は未確認です")
    ).length,
    18
  );
});

test("unknown faction does not replace unpublished vote/result markers", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const doc = new JSDOM(
    await (
      await fetch(
        `${base}/votes?coverage=all&view=matrix&faction=${encodeURIComponent("新風会")}`
      )
    ).text()
  ).window.document;
  const cells = [...doc.querySelectorAll("tbody td")];
  assert.equal(
    cells.filter(
      (c) => c.textContent.includes("未") && c.textContent.includes("会派?")
    ).length,
    770
  );
  assert.equal(
    cells.filter(
      (c) => c.textContent.includes("結") && c.textContent.includes("会派?")
    ).length,
    396
  );
});

test("November source notes preserve saved results and the actual review method", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const sources = JSON.parse(
    fs.readFileSync(
      "web/src/features/council-activity/server/data/sources.json",
      "utf8"
    )
  );
  const notice = sources.find((source) => source.id === "nov-bills")?.notice;
  for (const path of ["/", "/votes", "/bills/msh-2026-11-gi-68"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    const doc = new JSDOM(await response.text()).window.document,
      node = doc.querySelector('[data-source-notice="nov-bills"]');
    if (notice) {
      assert.ok(node);
      for (const fact of [
        notice.asOf,
        notice.context,
        notice.decisionDate,
        notice.limitations,
      ])
        assert.ok(node.textContent.includes(fact));
      assert.ok(
        node.textContent.includes(
          `${notice.passed}件可決・${notice.consented}件同意`
        )
      );
      assert.ok(
        Array.from(node.querySelectorAll("a")).some(
          (a) => a.href === notice.reportUrl
        )
      );
    } else assert.equal(node, null);
    if (path !== "/") {
      assert.ok(doc.body.textContent.includes(expectedVoteReviewLabel()));
      if (currentVoteReview.operatorReview === "approved")
        assert.match(doc.body.textContent, /盲検独立抽出ではありません/);
      assert.doesNotMatch(doc.body.textContent, /人による独立二次照合待ち/);
    }
  }
});

test("member directory reports the validated vote review state", async () => {
  const { JSDOM } = require("../../web/node_modules/jsdom");
  const response = await fetch(`${base}/members`);
  assert.equal(response.status, 200);
  const doc = new JSDOM(await response.text()).window.document;
  const notice = doc.querySelector('[aria-label="掲載範囲と確認状況"]');
  assert.ok(notice);
  assert.ok(notice.textContent.includes(expectedVoteReviewLabel()));
  assert.doesNotMatch(notice.textContent, /人による独立二次照合済み/);
});
