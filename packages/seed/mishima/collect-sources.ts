import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  isInFiscalYear,
  meetingMonth,
  parseBills,
  parseJapaneseDate,
  parseJsonp,
  plainText,
  sourceLinks,
} from "./utils/source-utils";

const fiscalYear = 2026;
const output = resolve(import.meta.dirname, "../../../artifacts/mishima/2026");
const city = "https://www.city.mishima.shizuoka.jp";
const billIndexUrl = city + "/site/gikai/list216-519.html";
const minutesBase = "https://ssp.kaigiroku.net/tenant/mishima/";
const refresh = process.argv.includes("--refresh");

async function save(name: string, value: unknown) {
  const path = resolve(output, name);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path + ".tmp", JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(path + ".tmp", path);
}

async function cached<T>(name: string, load: () => Promise<T>): Promise<T> {
  if (!refresh) {
    try {
      return JSON.parse(await readFile(resolve(output, name), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const value = await load();
  await save(name, value);
  return value;
}

async function request(url: string, init?: RequestInit): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await delay(300);
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status + ": " + url);
      return await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await delay(1000 * (attempt + 1));
    }
  }
  throw new Error("到達しない処理");
}

async function api<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const body = new URLSearchParams({
    tenant_id: "406",
    power_user: "false",
    ...params,
  });
  const text = await request(
    "https://ssp.kaigiroku.net/dnp/search/" + endpoint + "?callback=callback",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );
  return parseJsonp(text) as T;
}

interface Council {
  council_id: number;
  name: string;
}
interface CouncilIndex {
  councils: {
    view_years: {
      view_year: string;
      council_type: {
        council_type_name2: string;
        councils: Council[];
      }[];
    }[];
  }[];
}
interface Schedule {
  schedule_id: number;
  name: string;
  member_list: string;
}
interface Minute {
  minute_id: number;
  title: string;
  body: string;
  speaker?: string;
}

async function main() {
  await mkdir(output, { recursive: true });
  const index = await cached("raw/bills-index.json", () =>
    request(billIndexUrl)
  );
  const links = sourceLinks(index, billIndexUrl).filter((link) => {
    if (new URL(link.url).origin !== city || !link.title.includes("提出議案"))
      return false;
    const year = link.title.normalize("NFKC").match(/(\d{4})年/);
    const month = meetingMonth(link.title);
    return year && month && isInFiscalYear(Number(year[1]), month, fiscalYear);
  });
  if (!links.length) throw new Error("2026年度の議案一覧が見つかりません");
  const billSessions = [];
  for (const link of links) {
    const id = new URL(link.url).pathname
      .split("/")
      .at(-1)
      ?.replace(".html", "");
    const html = await cached("raw/bills-" + id + ".json", () =>
      request(link.url)
    );
    const bills = parseBills(html, link.url);
    billSessions.push({ title: link.title, sourceUrl: link.url, bills });
    console.log(link.title + ": " + bills.length + "件");
  }
  await save("bills.json", { fiscalYear, sessions: billSessions });

  const indexData = await cached("raw/councils.json", () =>
    api<CouncilIndex>("councils/index")
  );
  if (!Array.isArray(indexData.councils))
    throw new Error("会議一覧の応答が不正です");
  const councils = indexData.councils.flatMap((group) =>
    group.view_years.flatMap((year) =>
      year.council_type.flatMap((type) =>
        type.councils.flatMap((council) => {
          const month = meetingMonth(council.name);
          if (
            !month ||
            !isInFiscalYear(Number(year.view_year), month, fiscalYear)
          )
            return [];
          return [
            {
              ...council,
              year: Number(year.view_year),
              kind: type.council_type_name2,
            },
          ];
        })
      )
    )
  );
  const meetings = [];
  for (const council of councils) {
    const schedules = await cached(
      "raw/schedules-" + council.council_id + ".json",
      () =>
        api<{ council_schedules: Schedule[] }>("minutes/get_schedule", {
          council_id: String(council.council_id),
        })
    );
    if (!Array.isArray(schedules.council_schedules))
      throw new Error("会議日程の応答が不正です");
    for (const schedule of schedules.council_schedules) {
      const date = parseJapaneseDate(plainText(schedule.member_list));
      if (!date)
        throw new Error(
          "開催日を特定できません: " + council.name + schedule.name
        );
      const [year, month] = date.split("-").map(Number);
      if (!isInFiscalYear(year, month, fiscalYear)) continue;
      const file =
        "minutes/" + council.council_id + "-" + schedule.schedule_id + ".json";
      const data = await cached(file, async () => {
        const result = await api<{ tenant_minutes: Minute[] }>(
          "minutes/get_minute",
          {
            council_id: String(council.council_id),
            schedule_id: String(schedule.schedule_id),
          }
        );
        if (
          !Array.isArray(result.tenant_minutes) ||
          !result.tenant_minutes.length
        )
          throw new Error("会議録本文が空です: " + file);
        return {
          ...council,
          date,
          scheduleId: schedule.schedule_id,
          scheduleName: schedule.name,
          sourceUrl:
            minutesBase +
            "SpMinuteView.html?council_id=" +
            council.council_id +
            "&schedule_id=" +
            schedule.schedule_id +
            "&tenant_id=406",
          minutes: result.tenant_minutes.map((minute) => ({
            ...minute,
            text: plainText(minute.body),
          })),
        };
      });
      meetings.push({
        id: council.council_id + "-" + schedule.schedule_id,
        name: council.name,
        kind: council.kind,
        date,
        sourceUrl: data.sourceUrl,
        entryCount: data.minutes.length,
      });
    }
    console.log(
      council.name + ": " + schedules.council_schedules.length + "日分"
    );
  }
  if (!meetings.length) throw new Error("対象の会議録が取得できませんでした");
  await save("minutes-index.json", { fiscalYear, meetings });
  const manifest = {
    fiscalYear,
    from: "2026-04-01",
    through: "2027-03-31",
    collectedAt: new Date().toISOString(),
    billIndexUrl,
    minutesIndexUrl: minutesBase + "SpTop.html",
    billSessions: billSessions.length,
    bills: billSessions.reduce((sum, s) => sum + s.bills.length, 0),
    meetings: meetings.length,
    minuteEntries: meetings.reduce((sum, m) => sum + m.entryCount, 0),
    aiGeneratedContent: false,
  };
  await save("manifest.json", manifest);
  const snapshot = resolve(
    import.meta.dirname,
    "../../../web/src/features/official-records/server/data/2026"
  );
  await mkdir(resolve(snapshot, "minutes"), { recursive: true });
  for (const file of ["bills.json", "minutes-index.json", "manifest.json"]) {
    await writeFile(
      resolve(snapshot, file),
      await readFile(resolve(output, file))
    );
  }
  for (const meeting of meetings) {
    const raw = JSON.parse(
      await readFile(resolve(output, "minutes/" + meeting.id + ".json"), "utf8")
    );
    raw.minutes = raw.minutes.map(
      (minute: { minute_id: number; title: string; text: string }) => ({
        id: minute.minute_id,
        title: minute.title,
        text: minute.text,
      })
    );
    await writeFile(
      resolve(snapshot, "minutes/" + meeting.id + ".json"),
      JSON.stringify(raw, null, 2) + "\n"
    );
  }
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
