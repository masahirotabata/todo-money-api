// src/lib/localNotifications.ts
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

type ReminderType =
  | "none"
  | "sameDayMorning"
  | "previousDay20"
  | "threeDays20"
  | "oneWeek20"
  | "dailyMorningNight";

export type NotifyEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  weekdays?: boolean[];
  oneShot?: boolean;
  reminderType?: ReminderType;
};

const DAILY_SUMMARY_PREFIX = "taskmoney:dailySummary";

function hashId(text: string) {
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return Math.abs(hash % 2_147_483_647);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function parseYMD(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function ymdToNum(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return year * 10000 + month * 100 + day;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date: Date, hour: number, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function isFuture(date: Date) {
  return date.getTime() > Date.now() + 10_000;
}

function occursOnDate(event: NotifyEvent, dateStr: string) {
  if (event.oneShot || !event.weekdays || event.weekdays.length === 0) {
    return event.startDate === dateStr;
  }

  const endDate = event.endDate ?? event.startDate;

  if (ymdToNum(dateStr) < ymdToNum(event.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(endDate)) return false;

  const date = parseYMD(dateStr);
  return !!event.weekdays[date.getDay()];
}

function buildBody(event: NotifyEvent) {
  const timeText = event.startTime ? `${event.startTime} ` : "";
  return `${timeText}${event.title}`;
}

function getTimeText(event: NotifyEvent) {
  return event.startTime ? `${event.startTime} ` : "終日 ";
}

export async function requestNotificationPermission() {
  console.log("[Notification] request start");

  if (!Capacitor.isNativePlatform()) {
    console.log("[Notification] not native");
    return false;
  }

  const current = await LocalNotifications.checkPermissions();
  console.log("[Notification] current", current);

  if (current.display === "granted") {
    console.log("[Notification] already granted");
    return true;
  }

  const requested = await LocalNotifications.requestPermissions();
  console.log("[Notification] requested", requested);

  return requested.display === "granted";
}

export async function cancelScheduleNotifications(scheduleId: string) {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();

  const notifications = pending.notifications
    .filter((notification) => notification.extra?.scheduleId === scheduleId)
    .map((notification) => ({ id: notification.id }));

  const fallbackIds = [
    "sameDayMorning",
    "previousDay20",
    "threeDays20",
    "oneWeek20",
    "dailyMorning",
    "dailyNight",
  ].map((key) => ({ id: hashId(`${scheduleId}:${key}`) }));

  const merged = [...notifications, ...fallbackIds];
  const unique = Array.from(new Map(merged.map((item) => [item.id, item])).values());

  if (unique.length === 0) return;

  console.log("[Notification] cancel schedule", scheduleId, unique.length);

  await LocalNotifications.cancel({
    notifications: unique,
  });
}

export async function cancelDailySummaryNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();

  const notifications = pending.notifications
    .filter((notification) => notification.extra?.kind === DAILY_SUMMARY_PREFIX)
    .map((notification) => ({ id: notification.id }));

  const fallbackIds = Array.from({ length: 60 }).map((_, index) => ({
    id: hashId(`${DAILY_SUMMARY_PREFIX}:${index}`),
  }));

  const merged = [...notifications, ...fallbackIds];
  const unique = Array.from(new Map(merged.map((item) => [item.id, item])).values());

  if (unique.length === 0) return;

  console.log("[Notification] cancel daily summaries", unique.length);

  await LocalNotifications.cancel({
    notifications: unique,
  });
}

export async function scheduleEventNotifications(event: NotifyEvent) {
  console.log(
    "[Notification] scheduleEventNotifications",
    event.title,
    event.reminderType
  );

  if (!Capacitor.isNativePlatform()) {
    console.log("[Notification] skip event: not native");
    return;
  }

  await cancelScheduleNotifications(event.id);

  if (!event.reminderType || event.reminderType === "none") {
    console.log("[Notification] skip event: reminder none", event.title);
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    console.log("[Notification] skip event: permission denied", event.title);
    return;
  }

  const eventDate = parseYMD(event.startDate);
  const body = buildBody(event);

  const notifications: Parameters<
    typeof LocalNotifications.schedule
  >[0]["notifications"] = [];

  const addNotification = (
    key: string,
    at: Date,
    title: string,
    notificationBody = body
  ) => {
    if (!isFuture(at)) {
      console.log(
        "[Notification] skip past notification",
        event.title,
        key,
        at.toLocaleString()
      );
      return;
    }

    notifications.push({
      id: hashId(`${event.id}:${key}`),
      title,
      body: notificationBody,
      schedule: { at },
      sound: "default",
      extra: {
        scheduleId: event.id,
        startDate: event.startDate,
      },
    });
  };

  if (event.reminderType === "sameDayMorning") {
    addNotification("sameDayMorning", setTime(eventDate, 8), "今日の予定");
  }

  if (event.reminderType === "previousDay20") {
    addNotification(
      "previousDay20",
      setTime(addDays(eventDate, -1), 20),
      "明日の予定"
    );
  }

  if (event.reminderType === "threeDays20") {
    addNotification(
      "threeDays20",
      setTime(addDays(eventDate, -3), 20),
      "3日前の予定"
    );
  }

  if (event.reminderType === "oneWeek20") {
    addNotification(
      "oneWeek20",
      setTime(addDays(eventDate, -7), 20),
      "1週間後の予定"
    );
  }

  if (event.reminderType === "dailyMorningNight") {
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= eventDate) {
      const ymd = toYMD(cursor);

      addNotification(
        `dailyMorning:${ymd}`,
        setTime(cursor, 8),
        "今日の予定",
        body
      );

      addNotification(
        `dailyNight:${ymd}`,
        setTime(cursor, 20),
        "予定の確認",
        body
      );

      cursor = addDays(cursor, 1);
    }
  }

  console.log("[Notification] event schedule count", event.title, notifications.length);

  if (notifications.length === 0) return;

  await LocalNotifications.schedule({ notifications });
}

export async function rescheduleAllEventNotifications(events: NotifyEvent[]) {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Promise.all(events.map((event) => scheduleEventNotifications(event)));
}

export async function scheduleDailySummaryNotifications(
  events: NotifyEvent[],
  days = 30
) {
  console.log("[Notification] scheduleDailySummaryNotifications", events.length, days);

  if (!Capacitor.isNativePlatform()) {
    console.log("[Notification] skip summary: not native");
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    console.log("[Notification] skip summary: permission denied");
    return;
  }

  await cancelDailySummaryNotifications();

  const notifications: Parameters<
    typeof LocalNotifications.schedule
  >[0]["notifications"] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const targetDate = addDays(today, index);
    const ymd = toYMD(targetDate);

    const dayEvents = events
      .filter((event) => occursOnDate(event, ymd))
      .sort((a, b) =>
        (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")
      );

    if (dayEvents.length === 0) continue;

    const at = setTime(targetDate, 8);
    if (!isFuture(at)) {
      console.log("[Notification] skip past summary", ymd, at.toLocaleString());
      continue;
    }

    const preview = dayEvents
      .slice(0, 3)
      .map((event) => `${getTimeText(event)}${event.title}`)
      .join(" / ");

    const restCount =
      dayEvents.length > 3 ? ` ほか${dayEvents.length - 3}件` : "";

    notifications.push({
      id: hashId(`${DAILY_SUMMARY_PREFIX}:${index}`),
      title: `今日の予定 ${dayEvents.length}件`,
      body: `${preview}${restCount}`,
      schedule: { at },
      sound: "default",
      extra: {
        kind: DAILY_SUMMARY_PREFIX,
        date: ymd,
      },
    });
  }

  console.log("[Notification] daily summary schedule count", notifications.length);

  if (notifications.length === 0) return;

  await LocalNotifications.schedule({ notifications });
}

export async function refreshAllNotifications(events: NotifyEvent[]) {
  console.log("[Notification] refreshAllNotifications", events.length);

  if (!Capacitor.isNativePlatform()) {
    console.log("[Notification] skip refresh: not native");
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    console.log("[Notification] skip refresh: permission denied");
    return;
  }

  await Promise.all(events.map((event) => scheduleEventNotifications(event)));
  await scheduleDailySummaryNotifications(events);
}
