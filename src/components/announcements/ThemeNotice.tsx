import { useState } from "react";
import type { MonthlyThemeOverview } from "../../api";
import { monthName } from "../../monthlyTheme";
import { CloseXIcon } from "../dialogs/icons";
import { ImageIcon, UploadIcon } from "./icons";

/** From this day of the month (Manila time) admins are nudged to upload next month's poster. */
const REMIND_FROM_DAY = 25;

export interface ThemeNoticeInfo {
  month: string;
  title: string;
  message: string;
}

/** What the notice should say, or null when there's nothing to nag about. The current month
 * missing a poster wins over next month not being set yet. */
export function themeNoticeFor(overview: MonthlyThemeOverview): ThemeNoticeInfo | null {
  if (!overview.current) {
    return {
      month: overview.currentMonth,
      title: `${monthName(overview.currentMonth)} theme is missing`,
      message: "Upload the poster so it shows on Home.",
    };
  }
  const day = Number(overview.today.slice(8, 10));
  if (day >= REMIND_FROM_DAY && !overview.next) {
    const next = monthName(overview.nextMonth);
    return {
      month: overview.nextMonth,
      title: `${next} theme isn't set yet`,
      message: `Upload the poster before 1 ${next} so it shows on Home.`,
    };
  }
  return null;
}

function storageKey(userKey: string) {
  return `themeNoticeDismissed:${userKey}`;
}

function dismissedToday(userKey: string, today: string): boolean {
  try {
    return localStorage.getItem(storageKey(userKey)) === today;
  } catch {
    return false;
  }
}

interface ThemeNoticeProps {
  notice: ThemeNoticeInfo;
  /** Manila "yyyy-MM-dd" — "Remind me tomorrow" hides the notice until this changes. */
  today: string;
  /** Per-user so a shared device doesn't hide one admin's notice for another. */
  userKey: string;
  onUpload: (month: string) => void;
}

/** Banner at the top of Home for people who manage announcements, when a theme poster is due. */
function ThemeNotice({ notice, today, userKey, onUpload }: ThemeNoticeProps) {
  const [hidden, setHidden] = useState(() => dismissedToday(userKey, today));
  if (hidden) return null;

  const remindTomorrow = () => {
    try {
      localStorage.setItem(storageKey(userKey), today);
    } catch {
      // Storage blocked (private mode) — it just hides for this visit.
    }
    setHidden(true);
  };

  return (
    <div className="theme-notice" role="status">
      <span className="theme-notice-icon" aria-hidden="true">
        <ImageIcon />
      </span>
      <div className="theme-notice-text">
        <p className="theme-notice-title">{notice.title}</p>
        <p className="theme-notice-msg">{notice.message}</p>
      </div>
      <button type="button" className="theme-notice-btn" onClick={() => onUpload(notice.month)}>
        <UploadIcon />
        Upload poster
      </button>
      <button type="button" className="theme-notice-close" onClick={remindTomorrow} aria-label="Remind me tomorrow" title="Remind me tomorrow">
        <CloseXIcon />
      </button>
    </div>
  );
}

export default ThemeNotice;
