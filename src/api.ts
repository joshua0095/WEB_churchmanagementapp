import { clearToken, getToken } from "./auth";

export interface User {
  id: string | number;
  /** Computed full legal name (First [Middle] Last) — what every screen besides this
   * person's own profile/edit form should display. */
  name: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  /** Only ever shown on this person's own profile/edit view, never in place of `name`. */
  nickname: string | null;
  email: string;
  isAdmin: boolean;
  isRegistrar: boolean;
  isActive: boolean;
  birthday: string | null;
  ministryIds: number[];
  networkIds: number[];
}

export interface UserFormRequest {
  firstName: string;
  middleName: string | null;
  lastName: string;
  nickname: string | null;
  email: string;
  birthday: string | null;
  ministryIds: number[];
  networkIds: number[];
}

export interface AuthResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
  isAdmin: boolean;
  isRegistrar: boolean;
  moduleAccess: Record<string, boolean>;
}

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is not set. Add it to your .env file.");
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  return res;
}

export interface RegisterRequest {
  firstName: string;
  middleName: string | null;
  lastName: string;
  nickname: string | null;
  email: string;
  password: string;
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text() || `Registration failed (${res.status})`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await res.text() || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/request-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(await res.text() || `Request failed (${res.status})`);
  }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/confirm-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    throw new Error(await res.text() || `Reset failed (${res.status})`);
  }
  return res.json();
}

export interface VerseOfTheDay {
  reference: string;
  text: string;
}

export interface BibleVersion {
  id: string;
  abbreviation: string;
  title: string;
}

export async function getVerseOfTheDay(bibleId?: string | null): Promise<VerseOfTheDay> {
  const query = bibleId ? `?bibleId=${encodeURIComponent(bibleId)}` : "";
  const res = await fetch(`${API_URL}/api/verse-of-the-day${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch verse of the day (${res.status})`);
  }
  return res.json();
}

export async function getBibleVersions(): Promise<BibleVersion[]> {
  const res = await fetch(`${API_URL}/api/verse-of-the-day/versions`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Bible versions (${res.status})`);
  }
  return res.json();
}

export async function getBiblePassage(
  book: string,
  chapter: number,
  verse: number,
  bibleId?: string | null,
  verseEnd?: number,
): Promise<VerseOfTheDay> {
  const params = new URLSearchParams({ book, chapter: String(chapter), verse: String(verse) });
  if (verseEnd && verseEnd !== verse) params.set("verseEnd", String(verseEnd));
  if (bibleId) params.set("bibleId", bibleId);
  const res = await fetch(`${API_URL}/api/verse-of-the-day/passage?${params}`);
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to fetch that passage (${res.status})`);
  }
  return res.json();
}

export async function getChapterVerseCount(
  book: string,
  chapter: number,
  bibleId?: string | null,
): Promise<number> {
  const params = new URLSearchParams({ book, chapter: String(chapter) });
  if (bibleId) params.set("bibleId", bibleId);
  const res = await fetch(`${API_URL}/api/verse-of-the-day/chapter-length?${params}`);
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to fetch that chapter (${res.status})`);
  }
  const data: { verseCount: number } = await res.json();
  return data.verseCount;
}

export async function getMe(): Promise<User> {
  const res = await apiFetch("/api/users/me");
  if (!res.ok) {
    throw new Error(`Failed to fetch your profile (${res.status})`);
  }
  return res.json();
}

export interface UpdateMeRequest {
  firstName: string;
  middleName: string | null;
  lastName: string;
  nickname: string | null;
  email: string;
  birthday: string | null;
}

export async function updateMe(profile: UpdateMeRequest): Promise<User> {
  const res = await apiFetch("/api/users/me", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update your profile (${res.status})`);
  }
  return res.json();
}

export async function getUsers(): Promise<User[]> {
  const res = await apiFetch("/api/users");
  if (!res.ok) {
    throw new Error(`Failed to fetch users (${res.status})`);
  }
  return res.json();
}

export async function createUser(user: UserFormRequest): Promise<{ user: User; temporaryPassword: string }> {
  const res = await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to create user (${res.status})`);
  }
  return res.json();
}

export async function updateUser(id: number | string, user: UserFormRequest): Promise<User> {
  const res = await apiFetch(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update user (${res.status})`);
  }
  return res.json();
}

export async function setUserRegistrar(id: number | string, isRegistrar: boolean): Promise<User> {
  const res = await apiFetch(`/api/users/${id}/registrar`, {
    method: "PUT",
    body: JSON.stringify({ isRegistrar }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update registrar status (${res.status})`);
  }
  return res.json();
}

export async function setUserActive(id: number | string, isActive: boolean): Promise<User> {
  const res = await apiFetch(`/api/users/${id}/active`, {
    method: "PUT",
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update account status (${res.status})`);
  }
  return res.json();
}

export async function resetUserPassword(id: number | string): Promise<{ temporaryPassword: string }> {
  const res = await apiFetch(`/api/users/${id}/reset-password`, { method: "POST" });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to reset password (${res.status})`);
  }
  return res.json();
}

export async function deleteUser(id: number | string): Promise<void> {
  const res = await apiFetch(`/api/users/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to delete user (${res.status})`);
  }
}

// ---------- Ministries / Networks ----------

export interface Network {
  id: number;
  name: string;
  /** Null for a top-level (macro) network; otherwise the id of the macro network this sub-network belongs under. */
  parentNetworkId: number | null;
}

export interface Ministry {
  id: number;
  name: string;
  networkId: number;
}

export interface NetworkRequest {
  name: string;
  parentNetworkId: number | null;
}

export interface MinistryRequest {
  name: string;
  networkId: number;
}

export async function getNetworks(): Promise<Network[]> {
  const res = await apiFetch("/api/networks");
  if (!res.ok) {
    throw new Error(`Failed to fetch networks (${res.status})`);
  }
  return res.json();
}

export async function createNetwork(network: NetworkRequest): Promise<Network> {
  const res = await apiFetch("/api/networks", {
    method: "POST",
    body: JSON.stringify(network),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to add network (${res.status})`);
  }
  return res.json();
}

export async function updateNetwork(id: number, network: NetworkRequest): Promise<Network> {
  const res = await apiFetch(`/api/networks/${id}`, {
    method: "PUT",
    body: JSON.stringify(network),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update network (${res.status})`);
  }
  return res.json();
}

export async function deleteNetwork(id: number): Promise<void> {
  const res = await apiFetch(`/api/networks/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to delete network (${res.status})`);
  }
}

export async function getMinistries(): Promise<Ministry[]> {
  const res = await apiFetch("/api/ministries");
  if (!res.ok) {
    throw new Error(`Failed to fetch ministries (${res.status})`);
  }
  return res.json();
}

export async function createMinistry(ministry: MinistryRequest): Promise<Ministry> {
  const res = await apiFetch("/api/ministries", {
    method: "POST",
    body: JSON.stringify(ministry),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to add ministry (${res.status})`);
  }
  return res.json();
}

export async function updateMinistry(id: number, ministry: MinistryRequest): Promise<Ministry> {
  const res = await apiFetch(`/api/ministries/${id}`, {
    method: "PUT",
    body: JSON.stringify(ministry),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update ministry (${res.status})`);
  }
  return res.json();
}

export async function deleteMinistry(id: number): Promise<void> {
  const res = await apiFetch(`/api/ministries/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to delete ministry (${res.status})`);
  }
}

// ---------- Congregation ----------

export type Gender = "Male" | "Female";

export interface CongregationMember {
  id: number;
  /** Computed full legal name (First [Middle] Last) — what every screen besides this
   * person's own edit form should display. */
  name: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  /** Only ever shown on this person's own edit view, never in place of `name`. */
  nickname: string | null;
  birthday: string | null;
  gender: Gender | null;
  createdAt: string;
  oldCategory: string | null;
  newCategory: string | null;
}

export interface CongregationMemberRequest {
  firstName: string;
  middleName: string | null;
  lastName: string;
  nickname: string | null;
  birthday: string | null;
  gender: Gender | null;
  oldCategory: string | null;
  newCategory: string | null;
}

export async function getCongregation(): Promise<CongregationMember[]> {
  const res = await apiFetch("/api/congregation");
  if (!res.ok) {
    throw new Error(`Failed to fetch congregation (${res.status})`);
  }
  return res.json();
}

export async function createCongregant(member: CongregationMemberRequest): Promise<CongregationMember> {
  const res = await apiFetch("/api/congregation", {
    method: "POST",
    body: JSON.stringify(member),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to add congregation member (${res.status})`);
  }
  return res.json();
}

export async function updateCongregant(id: number, member: CongregationMemberRequest): Promise<CongregationMember> {
  const res = await apiFetch(`/api/congregation/${id}`, {
    method: "PUT",
    body: JSON.stringify(member),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update congregation member (${res.status})`);
  }
  return res.json();
}

export async function deleteCongregant(id: number): Promise<void> {
  const res = await apiFetch(`/api/congregation/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete congregation member (${res.status})`);
  }
}

export interface Announcement {
  id: number;
  eyebrow: string | null;
  title: string | null;
  content: string | null;
  imageDataUrl: string | null;
  createdAt: string;
}

export interface AnnouncementRequest {
  eyebrow: string | null;
  title: string | null;
  content: string | null;
  imageDataUrl: string | null;
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const res = await apiFetch("/api/announcements");
  if (!res.ok) {
    throw new Error(`Failed to fetch announcements (${res.status})`);
  }
  return res.json();
}

export async function createAnnouncement(announcement: AnnouncementRequest): Promise<Announcement> {
  const res = await apiFetch("/api/announcements", {
    method: "POST",
    body: JSON.stringify(announcement),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to create announcement (${res.status})`);
  }
  return res.json();
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const res = await apiFetch(`/api/announcements/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete announcement (${res.status})`);
  }
}

export async function sendAnnouncement(id: number): Promise<{ sentCount: number }> {
  const res = await apiFetch(`/api/announcements/${id}/send`, { method: "POST" });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to send announcement (${res.status})`);
  }
  return res.json();
}

export interface Devotion {
  id: number;
  date: string;
  verse: string;
  scripture: string;
  observation: string;
  application: string;
  prayer: string;
  notes: string;
}

export interface DevotionRequest {
  date: string;
  verse: string;
  scripture: string;
  observation: string;
  application: string;
  prayer: string;
  notes: string;
}

export async function getDevotions(): Promise<Devotion[]> {
  const res = await apiFetch("/api/devotions");
  if (!res.ok) {
    throw new Error(`Failed to fetch devotions (${res.status})`);
  }
  return res.json();
}

export async function createDevotion(devotion: DevotionRequest): Promise<Devotion> {
  const res = await apiFetch("/api/devotions", {
    method: "POST",
    body: JSON.stringify(devotion),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to create devotion (${res.status})`);
  }
  return res.json();
}

export async function updateDevotion(id: number, devotion: DevotionRequest): Promise<Devotion> {
  const res = await apiFetch(`/api/devotions/${id}`, {
    method: "PUT",
    body: JSON.stringify(devotion),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update devotion (${res.status})`);
  }
  return res.json();
}

export async function deleteDevotion(id: number): Promise<void> {
  const res = await apiFetch(`/api/devotions/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete devotion (${res.status})`);
  }
}

// ---------- Attendance (Workers / Congregation) ----------

export type RosterScope = "Both" | "Workers" | "Congregation";

export interface AttendanceEvent {
  id: number;
  name: string;
  /** When true, attendance for this event can only be taken for a Sunday date. */
  sundayOnly: boolean;
  /** Which named check-in roster(s) this event's Roster-tracked sessions accept. */
  rosterScope: RosterScope;
}

export type AttendanceTrackingType = "Headcount" | "Roster";

export interface AttendanceSessionInfo {
  id: number;
  eventId: number;
  date: string;
  trackingType: AttendanceTrackingType;
}

export type PersonType = "Worker" | "Attendee";

export interface AttendancePerson {
  personId: number;
  name: string;
  recordId: number | null;
  checkedInAt: string | null;
}

export interface AttendanceRoster {
  total: number;
  checkedInCount: number;
  people: AttendancePerson[];
}

export async function getAttendanceEvents(): Promise<AttendanceEvent[]> {
  const res = await apiFetch("/api/attendance/events");
  if (!res.ok) {
    throw new Error(`Failed to fetch events (${res.status})`);
  }
  return res.json();
}

export async function setEventSundayOnly(eventId: number, sundayOnly: boolean): Promise<AttendanceEvent> {
  const res = await apiFetch(`/api/attendance/events/${eventId}/sunday-only`, {
    method: "PUT",
    body: JSON.stringify({ sundayOnly }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update event (${res.status})`);
  }
  return res.json();
}

export async function setEventRosterScope(eventId: number, rosterScope: RosterScope): Promise<AttendanceEvent> {
  const res = await apiFetch(`/api/attendance/events/${eventId}/roster-scope`, {
    method: "PUT",
    body: JSON.stringify({ rosterScope }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update event (${res.status})`);
  }
  return res.json();
}

export async function openAttendanceSession(
  eventId: number,
  date: string,
  trackingType?: AttendanceTrackingType,
): Promise<AttendanceSessionInfo> {
  const res = await apiFetch("/api/attendance/sessions", {
    method: "POST",
    body: JSON.stringify({ eventId, date, ...(trackingType ? { trackingType } : {}) }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to open session (${res.status})`);
  }
  return res.json();
}

export async function getWorkerRoster(sessionId: number): Promise<AttendanceRoster> {
  const res = await apiFetch(`/api/attendance/sessions/${sessionId}/workers`);
  if (!res.ok) {
    throw new Error(`Failed to fetch worker roster (${res.status})`);
  }
  return res.json();
}

export async function getCongregationRoster(sessionId: number): Promise<AttendanceRoster> {
  const res = await apiFetch(`/api/attendance/sessions/${sessionId}/congregation`);
  if (!res.ok) {
    throw new Error(`Failed to fetch congregation roster (${res.status})`);
  }
  return res.json();
}

export async function checkInAttendance(
  sessionId: number,
  personType: PersonType,
  personId: number,
): Promise<{ recordId: number; checkedInAt: string }> {
  const res = await apiFetch(`/api/attendance/sessions/${sessionId}/checkin`, {
    method: "POST",
    body: JSON.stringify({ personType, personId }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to check in (${res.status})`);
  }
  return res.json();
}

export async function undoCheckIn(recordId: number): Promise<void> {
  const res = await apiFetch(`/api/attendance/records/${recordId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to remove check-in (${res.status})`);
  }
}

export async function editCheckInTime(
  recordId: number,
  checkedInAt: string,
): Promise<{ recordId: number; checkedInAt: string }> {
  const res = await apiFetch(`/api/attendance/records/${recordId}/time`, {
    method: "PUT",
    body: JSON.stringify({ checkedInAt }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update time (${res.status})`);
  }
  return res.json();
}

export async function addWalkIn(sessionId: number, name: string): Promise<AttendancePerson> {
  const res = await apiFetch(`/api/attendance/sessions/${sessionId}/congregation-members`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to add walk-in (${res.status})`);
  }
  return res.json();
}

export interface AttendanceReport {
  eventId: number;
  date: string;
  workers: AttendanceRoster;
  congregation: AttendanceRoster;
}

export async function getAttendanceReport(eventId: number, date: string): Promise<AttendanceReport> {
  const params = new URLSearchParams({ eventId: String(eventId), date });
  const res = await apiFetch(`/api/attendance/report?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch report (${res.status})`);
  }
  return res.json();
}

export interface AttendanceTrendPoint {
  date: string;
  workerCheckedIn: number;
  workerTotal: number;
  congregationCheckedIn: number;
  congregationTotal: number;
}

export async function getAttendanceTrend(eventId: number): Promise<AttendanceTrendPoint[]> {
  const params = new URLSearchParams({ eventId: String(eventId) });
  const res = await apiFetch(`/api/attendance/report/trend?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch trend (${res.status})`);
  }
  return res.json();
}

// ---------- Headcount ----------

export type HeadcountCategory = "Adults" | "Youth" | "Kids";

export interface HeadcountEntryRow {
  category: HeadcountCategory;
  count: number;
}

export interface HeadcountSummary {
  entries: HeadcountEntryRow[];
  total: number;
}

export async function submitHeadcount(sessionId: number, entries: HeadcountEntryRow[]): Promise<HeadcountSummary> {
  const res = await apiFetch(`/api/attendance/sessions/${sessionId}/headcount`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to submit headcount (${res.status})`);
  }
  return res.json();
}

export async function getHeadcount(sessionId: number): Promise<HeadcountSummary> {
  const res = await apiFetch(`/api/attendance/sessions/${sessionId}/headcount`);
  if (!res.ok) {
    throw new Error(`Failed to fetch headcount (${res.status})`);
  }
  return res.json();
}

// ---------- Visitor classification / retention ----------

export interface PersonAttendanceStatus {
  status: string;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  totalVisits: number;
  visitsLast8Weeks: number;
}

export async function getPersonAttendanceStatus(congregationMemberId: number): Promise<PersonAttendanceStatus> {
  const res = await apiFetch(`/api/attendance/people/${congregationMemberId}/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch attendance status (${res.status})`);
  }
  return res.json();
}

export interface RetentionReport {
  firstTimersInCohort: number;
  returnedWithinWindow: number;
  retentionRatePct: number | null;
}

export async function getRetentionReport(cohortDate: string, windowWeeks: number): Promise<RetentionReport> {
  const params = new URLSearchParams({ cohortDate, windowWeeks: String(windowWeeks) });
  const res = await apiFetch(`/api/attendance/report/retention?${params}`);
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to fetch retention report (${res.status})`);
  }
  return res.json();
}

// ---------- Life Groups ----------

export type LifeGroupCategory = "Church" | "Community";

export interface LifeGroupSummary {
  id: number;
  groupName: string;
  leaderId: number;
  leaderName: string;
  networkId: number | null;
  networkName: string | null;
  category: LifeGroupCategory;
  memberCount: number;
}

export interface LifeGroup {
  id: number;
  leaderId: number;
  groupName: string;
  category: LifeGroupCategory;
}

export interface LifeGroupMember {
  id: number;
  lifeGroupId: number;
  name: string;
}

export interface LifeGroupDetail {
  id: number;
  groupName: string;
  leaderId: number;
  leaderName: string;
  networkId: number | null;
  networkName: string | null;
  category: LifeGroupCategory;
  members: LifeGroupMember[];
}

export interface LifeGroupRequest {
  leaderId: number;
  groupName: string;
  networkId: number | null;
  category: LifeGroupCategory;
}

export interface LifeGroupSessionInfo {
  id: number;
  lifeGroupId: number;
  date: string;
  weekNumber: number;
}

export interface LifeGroupPerson {
  memberId: number;
  name: string;
  recordId: number | null;
}

export interface LifeGroupRoster {
  weekNumber: number;
  date: string;
  total: number;
  checkedInCount: number;
  people: LifeGroupPerson[];
}

export interface LifeGroupTrendPoint {
  weekNumber: number;
  date: string;
  checkedIn: number;
  total: number;
}

// Church Life Groups don't track attendance by a freely-chosen date — it's always framed
// as "the Nth week of this month" (1st..4th/5th), picked from a week dropdown rather than
// a calendar. A Community group instead picks any calendar date directly (see DatePicker).
function ordinalSuffix(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

export function ordinalWeekLabel(week: number): string {
  return `${week}${ordinalSuffix(week)} week`;
}

function daysInCalendarMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

// The day-of-month of every Sunday in the month — a Church Life Group's "week" is
// literally counted by Sundays (a month always has exactly 4 or 5), not by calendar-week
// rows or a plain days/7 count.
function sundaysInMonth(y: number, m: number): number[] {
  const total = daysInCalendarMonth(y, m);
  const days: number[] = [];
  for (let d = 1; d <= total; d++) {
    if (new Date(y, m - 1, d).getDay() === 0) days.push(d);
  }
  return days;
}

// Which Sunday's week a date falls in — a date before the month's first Sunday still
// counts as week 1, and a date after the last Sunday stays in that last week.
export function weekNumberOfMonth(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const sundays = sundaysInMonth(y, m);
  let week = 1;
  for (let i = 0; i < sundays.length; i++) {
    if (sundays[i] <= d) week = i + 1;
  }
  return week;
}

export function weekOfMonthLabel(iso: string): string {
  return ordinalWeekLabel(weekNumberOfMonth(iso));
}

export function formatLifeGroupDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The number of Sundays in the month — always 4 or 5, and genuinely varies month to
// month based on which weekday the 1st lands on.
export function weeksInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return sundaysInMonth(y, m).length;
}

// A week-of-month number maps directly to that Sunday's date — Church attendance is
// always logged for the Sunday itself.
export function dateForWeekOfMonth(iso: string, week: number): string {
  const [y, m] = iso.split("-").map(Number);
  const sundays = sundaysInMonth(y, m);
  const day = sundays[Math.min(Math.max(week, 1), sundays.length) - 1];
  const d = new Date(y, m - 1, day);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Snaps any date to the Sunday of the week it falls in — used so a Church group's
// session is always keyed by that Sunday, even before a leader has touched the picker.
export function currentChurchSessionDate(iso: string): string {
  return dateForWeekOfMonth(iso, weekNumberOfMonth(iso));
}

export function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Moves a reference date to another month, keeping the same week-of-month number
// (clamped to however many weeks the target month has) — this is how a Church group's
// month stepper changes month while the week dropdown's options update to match.
export function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + delta;
  const targetY = Math.floor(totalMonths / 12);
  const targetM = (totalMonths % 12) + 1;
  const targetFirst = `${targetY}-${String(targetM).padStart(2, "0")}-01`;
  const week = Math.min(weekNumberOfMonth(iso), weeksInMonth(targetFirst));
  return dateForWeekOfMonth(targetFirst, week);
}

export async function getLifeGroupsSummary(date: string): Promise<{ total: number; checkedInCount: number }> {
  const params = new URLSearchParams({ date });
  const res = await apiFetch(`/api/lifegroups/summary?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch life groups summary (${res.status})`);
  }
  return res.json();
}

export async function getLifeGroups(): Promise<LifeGroupSummary[]> {
  const res = await apiFetch("/api/lifegroups");
  if (!res.ok) {
    throw new Error(`Failed to fetch life groups (${res.status})`);
  }
  return res.json();
}

export async function createLifeGroup(
  leaderId: number,
  groupName: string,
  options?: { networkId?: number | null; category?: LifeGroupCategory },
): Promise<LifeGroup> {
  const res = await apiFetch("/api/lifegroups", {
    method: "POST",
    body: JSON.stringify({ leaderId, groupName, ...options }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to create life group (${res.status})`);
  }
  return res.json();
}

export async function updateLifeGroup(id: number, request: LifeGroupRequest): Promise<LifeGroup> {
  const res = await apiFetch(`/api/lifegroups/${id}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update life group (${res.status})`);
  }
  return res.json();
}

export async function getMyLifeGroups(): Promise<LifeGroup[]> {
  const res = await apiFetch("/api/lifegroups/mine");
  if (!res.ok) {
    throw new Error(`Failed to fetch your life groups (${res.status})`);
  }
  return res.json();
}

export async function getLifeGroup(id: number): Promise<LifeGroupDetail> {
  const res = await apiFetch(`/api/lifegroups/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch life group (${res.status})`);
  }
  return res.json();
}

export async function addLifeGroupMember(id: number, name: string): Promise<LifeGroupMember> {
  const res = await apiFetch(`/api/lifegroups/${id}/members`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to add member (${res.status})`);
  }
  return res.json();
}

export async function openLifeGroupSession(id: number, date: string): Promise<LifeGroupSessionInfo> {
  const res = await apiFetch(`/api/lifegroups/${id}/sessions`, {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to open session (${res.status})`);
  }
  return res.json();
}

export async function getLifeGroupRoster(sessionId: number): Promise<LifeGroupRoster> {
  const res = await apiFetch(`/api/lifegroups/sessions/${sessionId}/roster`);
  if (!res.ok) {
    throw new Error(`Failed to fetch roster (${res.status})`);
  }
  return res.json();
}

export async function lifeGroupCheckIn(sessionId: number, memberId: number): Promise<{ recordId: number }> {
  const res = await apiFetch(`/api/lifegroups/sessions/${sessionId}/checkin`, {
    method: "POST",
    body: JSON.stringify({ memberId }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to check in (${res.status})`);
  }
  return res.json();
}

export async function undoLifeGroupCheckIn(recordId: number): Promise<void> {
  const res = await apiFetch(`/api/lifegroups/records/${recordId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to remove check-in (${res.status})`);
  }
}

export async function getLifeGroupTrend(id: number): Promise<LifeGroupTrendPoint[]> {
  const res = await apiFetch(`/api/lifegroups/${id}/report/trend`);
  if (!res.ok) {
    throw new Error(`Failed to fetch trend (${res.status})`);
  }
  return res.json();
}

// ---------- Module access (per-network) ----------

export const MODULES = ["Attendance", "Reports", "Announcements", "People"] as const;
export type ModuleName = (typeof MODULES)[number];

export interface ModuleAccessRow {
  networkId: number;
  module: ModuleName;
  isAllowed: boolean;
}

export interface SetModuleAccessRequest {
  networkId: number;
  module: ModuleName;
  isAllowed: boolean;
}

export async function getModuleAccess(): Promise<ModuleAccessRow[]> {
  const res = await apiFetch("/api/module-access");
  if (!res.ok) {
    throw new Error(`Failed to fetch module access (${res.status})`);
  }
  return res.json();
}

export async function setModuleAccessRule(request: SetModuleAccessRequest): Promise<ModuleAccessRow> {
  const res = await apiFetch("/api/module-access", {
    method: "PUT",
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to update module access (${res.status})`);
  }
  return res.json();
}

// ---------- Congregation breakdown report ----------

export interface CongregationBreakdownRow {
  label: string;
  weekCounts: number[];
  average: number;
  actual: number;
}

export interface CongregationBreakdownReport {
  weekDates: string[];
  byLifeGroup: CongregationBreakdownRow[];
  byLifeGroupFirstTimers: CongregationBreakdownRow[];
  byAgeBracket: CongregationBreakdownRow[];
  byAgeBracketFirstTimers: CongregationBreakdownRow[];
}

export async function getCongregationBreakdown(
  eventId: number,
  year: number,
  month: number,
): Promise<CongregationBreakdownReport> {
  const params = new URLSearchParams({ eventId: String(eventId), year: String(year), month: String(month) });
  const res = await apiFetch(`/api/attendance/report/congregation-breakdown?${params}`);
  if (!res.ok) {
    throw new Error((await res.text()) || `Failed to fetch congregation breakdown (${res.status})`);
  }
  return res.json();
}
