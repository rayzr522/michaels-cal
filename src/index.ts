import { fail } from "assert";
import { writeFileSync } from "fs";
import got from "got";
import ics, { EventAttributes } from "ics";
import { parse } from "node-html-parser";
import { CookieJar } from "tough-cookie";

const cookieJar = new CookieJar();
const michaelsClient = got.extend({
  cookieJar,
  prefixUrl: "https://worksmart.michaels.com/etm",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Encoding": "identity",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    Connection: "keep-alive",
    DNT: "1",
    Host: "worksmart.michaels.com",
    Origin: "https://worksmart.michaels.com",
    Referer:
      "https://worksmart.michaels.com/etm/login.jsp?config=false&locale=EN",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua":
      '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  },
});

async function getLoginParams() {
  const res = await michaelsClient.get("login.jsp").text();
  writeFileSync("./out/login.html", res);
  const html = parse(res);

  return {
    wbat:
      html.querySelector("input[name='wbat']")?.getAttribute("value") ??
      fail("missing wbat"),
    url_login_token:
      html
        .querySelector("input[name='url_login_token']")
        ?.getAttribute("value") ?? fail("missing url_login_token"),
  };
}

async function loginToWfm(opts: { wbat: string; url_login_token: string }) {
  await michaelsClient.post("login.jsp", {
    form: {
      login: process.env.MICHAELS_USER,
      password: process.env.MICHAELS_PASS,
      pageAction: "login",
      wbXpos: -1,
      wbYpos: -1,
      localeSelected: false,
      wbat: opts.wbat,
      url_login_token: opts.url_login_token,
    },
    followRedirect: false,
  });
}

async function fetchSchedule(opts: {
  monthYear?: string;
}): Promise<MonthlySchedule> {
  const res = await michaelsClient
    .get("time/timesheet/etmTnsMonth.jsp", {
      searchParams: {
        NEW_MONTH_YEAR: opts.monthYear,
      },
    })
    .text();
  writeFileSync("./out/schedule.html", res);
  const html = parse(res);

  const [month, year] =
    html
      .querySelector("#htmlHeaderTable td")
      ?.innerText.trim()
      ?.split("&nbsp;") ?? fail("missing current month");

  const dayEls = [
    ...html.querySelectorAll(
      // in browser, this was the correct query, but apparently its not wrapped with a tbody until JS executes
      // ".etmScheduleTable > tbody > tr > td:not(.calTD-OutOfScope)",
      ".etmScheduleTable > tr > td:not(.calTD-OutOfScope)",
    ),
  ];

  return {
    date: new Date(`${month} ${year}`),
    schedule: dayEls.map((it, i) => ({
      isVacation: !!it.querySelector(".calendarCellVacation"),
      shiftName:
        it.querySelector(".calendarTextShiftName")?.innerText.trim() ?? "",
      date: new Date(`${month} ${i + 1} ${year}`),
    })),
  };
}

type MonthlySchedule = {
  date: Date;
  schedule: ScheduleEntry[];
};

type ScheduleEntry = {
  isVacation: boolean;
  shiftName: string;
  date: Date;
};

function getNextMonthYear(date: Date) {
  const nextMonth = date.getMonth() + 1;
  return `${(nextMonth % 12) + 1}/${date.getFullYear() + Math.floor(nextMonth / 12)}`;
}

type NormalizedScheduleEntry =
  | {
      type: "vacation";
      date: Date;
      days: number;
    }
  | {
      type: "scheduled";
      date: Date;
      start: Date;
      end: Date;
    };

function normalizeScheduleEntries(
  entries: ScheduleEntry[],
): NormalizedScheduleEntry[] {
  return entries.reduce((acc, next) => {
    if (next.isVacation) {
      const previous = acc[acc.length - 1];
      if (previous?.type === "vacation") {
        previous.days++;
      } else {
        acc.push({ type: "vacation", date: next.date, days: 1 });
      }
    } else if (next.shiftName) {
      const [shiftStartTime, shiftEndTime] = next.shiftName.split(" - ");
      acc.push({
        type: "scheduled",
        date: next.date,
        start: new Date(`${next.date.toDateString()} ${shiftStartTime}`),
        end: new Date(`${next.date.toDateString()} ${shiftEndTime}`),
      });
    }
    return acc;
  }, [] as NormalizedScheduleEntry[]);
}

try {
  const loginParams = await getLoginParams();
  console.log("loginParams", loginParams);

  await loginToWfm(loginParams);
  console.log("logged in");

  const currentMonthSchedule = await fetchSchedule({});
  writeFileSync(
    "./out/current-month-schedule.json",
    JSON.stringify(currentMonthSchedule, null, 2),
  );

  const nextMonthYear = getNextMonthYear(currentMonthSchedule.date);
  const nextMonthSchedule = await fetchSchedule({ monthYear: nextMonthYear });
  writeFileSync(
    "./out/next-month-schedule.json",
    JSON.stringify(nextMonthSchedule, null, 2),
  );

  const now = Date.now();
  const sequence = Math.floor(now / 60_000);

  const normalizedEntries = normalizeScheduleEntries([
    ...currentMonthSchedule.schedule,
    ...nextMonthSchedule.schedule,
  ]);

  const cal = ics.createEvents(
    normalizedEntries.reduce((acc, next) => {
      const partialAttributes = {
        uid: `michaels-${next.date.getTime()}`,
        sequence,
        created: currentMonthSchedule.date.getTime(),
        lastModified: now,
        calName: "Michaels Work Schedule",
      } satisfies Partial<EventAttributes>;

      if (next.type === "vacation") {
        acc.push({
          ...partialAttributes,
          start: next.date.getTime(),
          duration: { days: next.days },
          title: "Vacation",
          busyStatus: "FREE",
          transp: "TRANSPARENT",
        });
      } else if (next.type === "scheduled") {
        acc.push({
          ...partialAttributes,
          start: next.start.getTime(),
          end: next.end.getTime(),
          title: "Work shift",
          location: process.env.MICHAELS_ADDRESS || undefined,
          busyStatus: "BUSY",
          transp: "OPAQUE",
        });
      }
      return acc;
    }, [] as EventAttributes[]),
  );
  if (!cal.value || cal.error) {
    throw new Error(`error generating ics: ${cal.error?.message ?? "unknown"}`);
  }
  writeFileSync("./out/michaels-cal.ics", cal.value);
} catch (e) {
  console.error("got error:", e);
  process.exit(1);
}
