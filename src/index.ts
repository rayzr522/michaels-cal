import { fail } from "assert";
import { writeFileSync } from "fs";
import got from "got";
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

async function fetchSchedule(opts: { monthYear?: string }) {
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
    month,
    year,
    schedule: dayEls.map((it) => ({
      isVacation: !!it.querySelector(".calendarCellVacation"),
      shiftName:
        it.querySelector(".calendarTextShiftName")?.innerText.trim() ?? "",
    })),
  };
}

try {
  const loginParams = await getLoginParams();
  console.log("loginParams", loginParams);
  await loginToWfm(loginParams);
  console.log("logged in");
  const currentMonthSchedule = await fetchSchedule({});
  console.log("currentMonthSchedule", currentMonthSchedule);
  const currentMonth = new Date(
    `${currentMonthSchedule.month} ${currentMonthSchedule.year}`,
  );
  const nextMonth = currentMonth.getMonth() + 1;
  const nextMonthYear = `${(nextMonth % 12) + 1}/${currentMonth.getFullYear() + Math.floor(nextMonth / 12)}`;
  const nextMonthSchedule = await fetchSchedule({ monthYear: nextMonthYear });
  console.log("nextMonthSchedule", nextMonthSchedule);
} catch (e) {
  console.error("got error:", e);
  process.exit(1);
}
