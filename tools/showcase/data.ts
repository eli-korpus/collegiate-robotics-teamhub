/**
 * Showcase data for the README screenshots: "Riverside Robotics", a made-up program with two made-up teams
 * (numbers far above any real FTC team), in the middle of a busy season. Dates are relative to today so the
 * screenshots always look current. Nothing here is real: names, numbers, sponsors and events are all invented.
 */
import { ME } from '../tests/e2e/mock';

export const A = '11111111-1111-4111-8111-111111111111'; // Circuit Breakers
export const B = '22222222-2222-4222-8222-222222222222'; // Torque Titans
export const SEASON = '2026–27';
export const SEASON_YEAR = 2026;
export const NUM_A = 98012;
export const NUM_B = 98013;
export const QUALIFIER = 'RVQ1';
export const LEAGUE = 'RVLM2';

const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (days: number, hour = 16, min = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  t.setHours(hour, min, 0, 0);
  return t.toISOString();
};
const date = (days: number) => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

// ── People ────────────────────────────────────────────────────────────────
interface P {
  name: string;
  team: string;
  type: 'member' | 'captain' | 'mentor';
  grade?: string;
  subteam: string;
}
const ROSTER: P[] = [
  { name: 'Jordan Reyes', team: A, type: 'captain', grade: '12', subteam: 'programming' },
  { name: 'Priya Nair', team: A, type: 'member', grade: '11', subteam: 'cad' },
  { name: 'Ethan Brooks', team: A, type: 'member', grade: '10', subteam: 'build' },
  { name: 'Sofia Martinez', team: A, type: 'member', grade: '11', subteam: 'outreach' },
  { name: 'Liam Chen', team: A, type: 'member', grade: '9', subteam: 'programming' },
  { name: 'Ava Thompson', team: A, type: 'member', grade: '10', subteam: 'build' },
  { name: 'Noah Kim', team: A, type: 'member', grade: '12', subteam: 'cad' },
  { name: 'Zara Ahmed', team: B, type: 'captain', grade: '12', subteam: 'build' },
  { name: 'Marcus Johnson', team: B, type: 'member', grade: '11', subteam: 'programming' },
  { name: 'Hannah Lee', team: B, type: 'member', grade: '10', subteam: 'outreach' },
  { name: 'Diego Alvarez', team: B, type: 'member', grade: '9', subteam: 'build' },
  { name: 'Emma Wilson', team: B, type: 'member', grade: '11', subteam: 'cad' },
  { name: 'Kai Patel', team: B, type: 'member', grade: '10', subteam: 'programming' },
  { name: 'Grace Okafor', team: B, type: 'member', grade: '9', subteam: 'outreach' },
  { name: 'Dr. Lisa Park', team: A, type: 'mentor', subteam: 'programming' },
  { name: 'Tom Becker', team: B, type: 'mentor', subteam: 'build' },
];
export const PEOPLE = ROSTER.map((p, i) => ({ ...p, id: `bbbbbbbb-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
const who = (name: string) => PEOPLE.find((p) => p.name.startsWith(name))!.id;
const [JORDAN, PRIYA, ETHAN, SOFIA, LIAM, AVA, NOAH, ZARA, MARCUS, HANNAH, DIEGO, EMMA, KAI, GRACE] = PEOPLE.map((p) => p.id);
const PARK = who('Dr. Lisa');
const TOM = who('Tom');
const NEWBIE = 'bbbbbbbb-0000-4000-8000-000000000099';

const DRIVETRAIN = `## Goal
Pick a drivetrain that lets us line up quickly with the scoring area and still hold our ground when defended.

## What we tried
We drove both prototype chassis through the same 10-cycle course on the practice field:

- **Mecanum**: 41 s average, strafes straight into position, gets pushed more easily.
- **Tank**: 52 s average, needs extra turning to line up, very hard to push.

## Decision
Mecanum wins on our weighted matrix. We'll add odometry pods so autonomous can correct for slipping.

## Next steps
1. CAD the final chassis plates (Noah)
2. Order 4 more 96 mm mecanum wheels
3. Tune field-centric drive in TeleOp`;
const INTAKE = `## Problem
Intake v2 jammed when game pieces came in at an angle: 3 jams in 10 cycles at League Meet 2.

## Changes in v3
- Silicone tubing on the rollers for more grip
- Wider mouth (+18 mm) to funnel pieces to the center
- Thicker printed hubs (4 walls, 40% infill)

## Results
0 jams in 30 test cycles, and pickup time dropped from 1.4 s to 0.7 s.`;

/** Maya (the person looking at the dashboard): captain of Circuit Breakers and an admin. */
export const VIEWER = { name: 'Maya Robinson', team: A };

export function tables(opts: { live?: boolean; homePrefs?: unknown } = {}) {
  const now = new Date().toISOString();
  const profiles = [
    { id: ME, display_name: VIEWER.name, avatar_path: null, is_admin: true, status: 'active', details: { grade: '12', subteam: 'build, programming', pronouns: 'she/her' }, home_prefs: opts.homePrefs ?? null, created_at: '2025-09-02T00:00:00Z' },
    ...PEOPLE.map((p) => ({ id: p.id, display_name: p.name, avatar_path: null, is_admin: false, status: 'active', details: { ...(p.grade ? { grade: p.grade } : {}), subteam: p.subteam }, home_prefs: null, created_at: '2025-09-02T00:00:00Z' })),
    { id: NEWBIE, display_name: 'Owen Fischer', avatar_path: null, is_admin: false, status: 'pending', details: { grade: '9' }, home_prefs: null, created_at: ago(300) },
  ];
  const memberships = [
    { user_id: ME, team_id: A, type: 'captain', status: 'active', requested_type: null, note: null, created_at: '2025-09-02T00:00:00Z' },
    ...PEOPLE.map((p) => ({ user_id: p.id, team_id: p.team, type: p.type, status: 'active', requested_type: null, note: null, created_at: '2025-09-02T00:00:00Z' })),
    { user_id: PARK, team_id: B, type: 'mentor', status: 'active', requested_type: null, note: null, created_at: '2025-09-02T00:00:00Z' },
    { user_id: NEWBIE, team_id: B, type: 'member', status: 'pending', requested_type: 'member', note: "I'm a freshman and I'd love to help with building!", created_at: ago(300) },
  ];

  // ── Practices: Tue/Thu/Sat this season, with attendance ─────────────────
  const sessions: Record<string, unknown>[] = [];
  const presence: Record<string, unknown>[] = [];
  let s = 0;
  for (let d = -42; d <= 0; d++) {
    const t = new Date();
    t.setDate(t.getDate() + d);
    if (![2, 4, 6].includes(t.getDay()) && d !== 0) continue;
    {
      const sid = id(1000 + s++);
      const sat = t.getDay() === 6;
      // Practices are on the calendar; each session is linked to its calendar event (Take attendance from the calendar).
      sessions.push({ id: sid, team_id: null, date: date(d), starts_at: at(d, sat ? 10 : 15, 30), ends_at: at(d, sat ? 14 : 18), title: sat ? 'Saturday build day' : 'Practice', season: SEASON, closed: d < 0, calendar_event_id: id(sat ? 33 : 31), occurrence_date: date(d), created_by: ME, created_at: at(d, 15) });
      const members = [ME, ...PEOPLE.filter((p) => p.type !== 'mentor').map((p) => p.id)];
      members.forEach((u, i) => {
        // Most people come most days; today's practice is under way, so some haven't arrived yet.
        if (d === 0 ? i > 9 : (i * 7 + s * 3) % 10 < 2) return;
        presence.push({ session_id: sid, user_id: u, check_in: at(d, sat ? 10 : 15, 30 + (i % 4) * 5), check_out: d === 0 ? null : at(d, sat ? 14 : 18) });
      });
    }
  }

  const t: Record<string, unknown[]> = {
    profiles,
    memberships,
    position_holders: [
      { position_id: 'pos_lead_programmer', user_id: JORDAN, team_id: A },
      { position_id: 'pos_lead_programmer', user_id: MARCUS, team_id: B },
      { position_id: 'pos_3d_print_farm_manager', user_id: NOAH, team_id: null },
      { position_id: 'pos_outreach_lead', user_id: SOFIA, team_id: null },
      { position_id: 'pos_scouting_lead', user_id: HANNAH, team_id: null },
      { position_id: 'pos_inventory_manager', user_id: ETHAN, team_id: null },
      { position_id: 'pos_media_lead', user_id: GRACE, team_id: null },
      { position_id: 'pos_safety_captain', user_id: AVA, team_id: null },
    ],
    links: [
      { id: 'l1', label: 'Discord', url: 'https://discord.com', description: null, slot: 'team_chat', section: null, team_id: null, sort: 0, created_by: null },
      { id: 'l2', label: 'Circuit Breakers code', url: 'https://github.com/example/circuit-breakers', description: null, slot: 'code_repo', section: null, team_id: A, sort: 1, created_by: ME },
      { id: 'l3', label: 'Torque Titans code', url: 'https://github.com/example/torque-titans', description: null, slot: 'code_repo', section: null, team_id: B, sort: 2, created_by: ME },
      { id: 'l4', label: 'Onshape', url: 'https://cad.onshape.com', description: null, slot: 'cad', section: null, team_id: null, sort: 3, created_by: ME },
      { id: 'l5', label: 'Team Drive', url: 'https://drive.google.com', description: 'Season documents, photos and judging materials', slot: 'drive', section: null, team_id: null, sort: 4, created_by: ME },
      { id: 'l6', label: 'Game Manual', url: 'https://www.firstinspires.org/resource-library/ftc/game-and-season-info', description: 'Official rules and updates', slot: null, section: 'Rules', team_id: null, sort: 5, created_by: ME },
      { id: 'l7', label: 'gm0', url: 'https://gm0.org', description: 'Game Manual 0: the community guide to building FTC robots', slot: null, section: 'Learning', team_id: null, sort: 6, created_by: ME },
    ],
    notifications: [
      { id: 1, user_id: ME, type: 'tasks.assigned', ref: 'tasks:task:3', actor: JORDAN, created_at: ago(25), read_at: null },
      { id: 2, user_id: ME, type: 'announcements.must_read', ref: `announcements:post:${id(1)}`, actor: PARK, created_at: ago(120), read_at: null },
      { id: 3, user_id: ME, type: 'tasks.comment', ref: 'tasks:task:1', actor: PRIYA, created_at: ago(240), read_at: ago(200) },
    ],

    // ── Team ──────────────────────────────────────────────────────────────
    ann_posts: [
      { id: id(1), team_id: null, title: 'Qualifier this Saturday: what to bring', body: 'Bus leaves at **6:45 AM** from the front lot.\n\n- Safety glasses and closed-toe shoes\n- Team shirt\n- Lunch money (pizza at noon)\n\nParents are welcome in the stands.', image_path: null, pinned: true, require_ack: true, created_by: PARK, created_at: ago(120), edited_at: null },
      { id: id(2), team_id: A, title: 'New intake is on the robot', body: 'Great work everyone. Drive practice tomorrow at 3:30.', image_path: null, pinned: false, require_ack: false, created_by: JORDAN, created_at: ago(60 * 20), edited_at: null },
      { id: id(3), team_id: null, title: 'Hoodie orders close Friday', body: 'Order in the Merch tab.', image_path: null, pinned: false, require_ack: false, created_by: SOFIA, created_at: ago(60 * 50), edited_at: null },
      { id: id(4), team_id: B, title: 'Torque Titans: shop cleanup Thursday', body: 'Bring gloves.', image_path: null, pinned: false, require_ack: false, created_by: ZARA, created_at: ago(60 * 75), edited_at: null },
    ],
    ann_acks: [{ post_id: id(1), user_id: JORDAN, acked_at: ago(100) }],
    att_sessions: sessions,
    att_presence: presence,
    cal_events: [
      { id: id(30), team_id: null, title: 'Riverside Qualifier', kind: 'competition', starts_at: at(4, 8), ends_at: at(4, 17), all_day: false, location: 'Riverside High School', notes: 'Bus at 6:45 AM.', recurrence: null, event_code: QUALIFIER, created_by: ME, created_at: now },
      { id: id(31), team_id: null, title: 'Practice', kind: 'practice', starts_at: at(-14, 15, 30), ends_at: at(-14, 18), all_day: false, location: 'Room 214', notes: null, recurrence: 'FREQ=WEEKLY;BYDAY=TU,TH', event_code: null, created_by: ME, created_at: now },
      { id: id(33), team_id: null, title: 'Saturday build day', kind: 'practice', starts_at: at(-14, 10), ends_at: at(-14, 14), all_day: false, location: 'Shop', notes: null, recurrence: 'FREQ=WEEKLY;BYDAY=SA', event_code: null, created_by: ME, created_at: now },
      { id: id(34), team_id: null, title: 'STEM night at Lincoln Elementary', kind: 'outreach', starts_at: at(2, 18), ends_at: at(2, 20), all_day: false, location: 'Lincoln Elementary', notes: null, recurrence: null, event_code: null, created_by: ME, created_at: now },
      { id: id(35), team_id: null, title: 'Sponsor thank-you letters due', kind: 'deadline', starts_at: at(6, 0), ends_at: null, all_day: true, location: null, notes: null, recurrence: null, event_code: null, created_by: ME, created_at: now },
      { id: id(36), team_id: null, title: 'Parent meeting', kind: 'meeting', starts_at: at(8, 19), ends_at: at(8, 20), all_day: false, location: 'Library', notes: null, recurrence: null, event_code: null, created_by: ME, created_at: now },
      { id: id(37), team_id: null, title: 'League Meet 2', kind: 'competition', starts_at: at(-10, 9), ends_at: at(-10, 16), all_day: false, location: 'Oak Valley Middle School', notes: null, recurrence: null, event_code: LEAGUE, created_by: ME, created_at: now },
      { id: id(38), team_id: null, title: 'Team pizza night', kind: 'social', starts_at: at(11, 18), ends_at: at(11, 20), all_day: false, location: "Tony's", notes: null, recurrence: null, event_code: null, created_by: ME, created_at: now },
    ],
    task_items: [
      { id: 1, team_id: A, title: 'Finish intake roller CAD and export STLs', description: 'v3 with thicker walls', status: 'doing', assignee: [PRIYA], subteam_id: 'cad', position_id: null, due: date(1), priority: 2, sort: 1, created_by: ME, created_at: at(-6), done_at: null },
      { id: 2, team_id: A, title: 'Tune heading PID for auto', description: null, status: 'doing', assignee: [JORDAN, LIAM], subteam_id: 'programming', position_id: null, due: date(2), priority: 3, sort: 2, created_by: ME, created_at: at(-5), done_at: null },
      { id: 3, team_id: A, title: 'Pack the pit kit for Saturday', description: 'Use the Packing checklist', status: 'todo', assignee: [ME, AVA], subteam_id: 'build', position_id: null, due: date(3), priority: 2, sort: 3, created_by: JORDAN, created_at: at(-1), done_at: null },
      { id: 4, team_id: A, title: 'Write notebook entry for the new intake', description: null, status: 'todo', assignee: [ME], subteam_id: null, position_id: null, due: date(-1), priority: 1, sort: 4, created_by: PARK, created_at: at(-4), done_at: null },
      { id: 5, team_id: A, title: 'Replace frayed lift string', description: null, status: 'review', assignee: [ETHAN], subteam_id: 'build', position_id: null, due: date(0), priority: 3, sort: 5, created_by: ME, created_at: at(-2), done_at: null },
      { id: 6, team_id: B, title: 'Wire the new arm servo', description: null, status: 'doing', assignee: [DIEGO], subteam_id: 'build', position_id: null, due: date(2), priority: 2, sort: 6, created_by: ZARA, created_at: at(-3), done_at: null },
      { id: 7, team_id: null, title: 'Print judging handouts', description: null, status: 'todo', assignee: [SOFIA, ME], subteam_id: 'outreach', position_id: null, due: date(3), priority: 1, sort: 7, created_by: PARK, created_at: at(-2), done_at: null },
      { id: 8, team_id: B, title: 'Practice auto with field setup', description: null, status: 'todo', assignee: [MARCUS, KAI], subteam_id: 'programming', position_id: null, due: date(3), priority: 2, sort: 8, created_by: ZARA, created_at: at(-2), done_at: null },
      { id: 9, team_id: A, title: 'Drive practice: 10 full matches', description: null, status: 'done', assignee: [JORDAN, ME], subteam_id: null, position_id: null, due: date(-2), priority: 1, sort: 9, created_by: ME, created_at: at(-7), done_at: at(-2) },
      { id: 10, team_id: null, title: 'Update sponsor slide in the judging deck', description: null, status: 'done', assignee: [SOFIA], subteam_id: 'outreach', position_id: null, due: date(-3), priority: 1, sort: 10, created_by: PARK, created_at: at(-8), done_at: at(-3) },
      { id: 11, team_id: A, title: 'Add odometry pods to the drivetrain', description: null, status: 'review', assignee: [NOAH, LIAM], subteam_id: 'build', position_id: null, due: date(1), priority: 2, sort: 11, created_by: ME, created_at: at(-6), done_at: null },
      { id: 12, team_id: B, title: 'Design arm v2 in Onshape', description: null, status: 'doing', assignee: [EMMA], subteam_id: 'cad', position_id: null, due: date(5), priority: 1, sort: 12, created_by: ZARA, created_at: at(-4), done_at: null },
      { id: 13, team_id: null, title: 'Plan STEM night activities', description: null, status: 'todo', assignee: [HANNAH, GRACE], subteam_id: 'outreach', position_id: null, due: date(1), priority: 1, sort: 13, created_by: SOFIA, created_at: at(-3), done_at: null },
      { id: 14, team_id: A, title: 'Re-tension intake belt', description: null, status: 'done', assignee: [ETHAN], subteam_id: 'build', position_id: null, due: date(-1), priority: 1, sort: 14, created_by: ME, created_at: at(-3), done_at: at(-1) },
      { id: 15, team_id: B, title: 'Log driver practice scores', description: null, status: 'review', assignee: [KAI], subteam_id: 'programming', position_id: null, due: date(0), priority: 0, sort: 15, created_by: ZARA, created_at: at(-2), done_at: null },
    ],
    poll_polls: [
      { id: id(150), team_id: null, kind: 'choice', question: 'Team shirt color for this season?', options: ['Navy', 'Electric blue', 'Black'], multi: false, visibility: 'public', closes_at: at(2, 21), result: null, ref: null, created_by: SOFIA, created_at: ago(60 * 26) },
      { id: id(151), team_id: null, kind: 'availability', question: 'Extra build session before the qualifier?', options: { dates: [date(1), date(2), date(3)], slots: ['3–5 PM', '5–7 PM'] }, multi: true, visibility: 'public', closes_at: at(1, 21), result: null, ref: null, created_by: ME, created_at: ago(60 * 5) },
    ],
    poll_votes: [
      ...[JORDAN, PRIYA, ETHAN, LIAM, AVA, ZARA, MARCUS, HANNAH, EMMA, KAI].map((u, i) => ({ poll_id: id(150), user_id: u, value: [i % 3 === 2 ? 2 : i % 2], created_at: ago(60 * 20) })),
      ...[JORDAN, PRIYA, ETHAN, AVA, NOAH, ZARA, DIEGO].map((u, i) => ({ poll_id: id(151), user_id: u, value: [0, 1, 2 + (i % 2), 4 + (i % 2)], created_at: ago(60 * 3) })),
    ],
    sign_sheets: [{ id: id(200), team_id: null, title: 'STEM night volunteers', description: 'Help kids drive the robot!', event_ref: null, closes_at: at(2, 12), season: SEASON, created_by: SOFIA, created_at: ago(60 * 48) }],
    sign_slots: [
      { id: id(201), sheet_id: id(200), label: 'Robot driving station', starts_at: at(2, 18), capacity: 3, sort: 0 },
      { id: id(202), sheet_id: id(200), label: 'Welcome table', starts_at: at(2, 18), capacity: 2, sort: 1 },
      { id: id(203), sheet_id: id(200), label: 'Cleanup crew', starts_at: at(2, 19, 45), capacity: 4, sort: 2 },
    ],
    sign_claims: [
      { slot_id: id(201), user_id: ME, claimed_at: ago(600) },
      { slot_id: id(201), user_id: LIAM, claimed_at: ago(500) },
      { slot_id: id(202), user_id: SOFIA, claimed_at: ago(400) },
      { slot_id: id(203), user_id: GRACE, claimed_at: ago(300) },
    ],
    skill_skills: [
      { id: id(210), team_id: null, name: 'Shop safety', category: 'Safety', subteam_id: null, description: 'Required for everyone', url: null, requires: [], created_at: now },
      { id: id(211), team_id: null, name: 'Drill press', category: 'Machining', subteam_id: 'build', description: null, url: null, requires: [id(210)], created_at: now },
      { id: id(212), team_id: null, name: 'Bandsaw', category: 'Machining', subteam_id: 'build', description: null, url: null, requires: [id(210)], created_at: now },
      { id: id(213), team_id: null, name: '3D printer operation', category: 'Fabrication', subteam_id: 'cad', description: null, url: null, requires: [id(210)], created_at: now },
      { id: id(214), team_id: null, name: 'Road Runner tuning', category: 'Programming', subteam_id: 'programming', description: null, url: null, requires: [], created_at: now },
      { id: id(215), team_id: null, name: 'Drive team: driver', category: 'Competition', subteam_id: null, description: null, url: null, requires: [], created_at: now },
    ],
    skill_signoffs: [
      { skill_id: id(210), user_id: ME, signed_by: PARK, signed_at: at(-40) },
      { skill_id: id(211), user_id: ME, signed_by: TOM, signed_at: at(-30) },
      { skill_id: id(215), user_id: ME, signed_by: PARK, signed_at: at(-20) },
      ...PEOPLE.slice(0, 12).map((p) => ({ skill_id: id(210), user_id: p.id, signed_by: PARK, signed_at: at(-40) })),
      { skill_id: id(213), user_id: NOAH, signed_by: PARK, signed_at: at(-30) },
      { skill_id: id(213), user_id: PRIYA, signed_by: NOAH, signed_at: at(-25) },
      { skill_id: id(214), user_id: JORDAN, signed_by: PARK, signed_at: at(-25) },
    ],
    ppr_items: [
      { id: id(140), team_id: null, name: 'FIRST consent and release form', url: 'https://my.firstinspires.org', due: date(3), season: SEASON, applies_to: 'all', created_at: now },
      { id: id(141), team_id: null, name: 'Field trip permission slip (qualifier)', url: null, due: date(2), season: SEASON, applies_to: 'members', created_at: now },
    ],
    ppr_done: [...PEOPLE.slice(0, 9).map((p) => ({ item_id: id(140), user_id: p.id, done_at: at(-5), marked_by: PARK })), { item_id: id(140), user_id: ME, done_at: at(-5), marked_by: PARK }],

    // ── Engineering ───────────────────────────────────────────────────────
    nb_subsystems: [
      { id: id(120), team_id: null, name: 'Intake', sort: 0 },
      { id: id(121), team_id: null, name: 'Drivetrain', sort: 1 },
      { id: id(122), team_id: null, name: 'Lift', sort: 2 },
      { id: id(123), team_id: null, name: 'Autonomous', sort: 3 },
    ],
    nb_entries: [
      { id: id(124), team_id: A, kind: 'iteration', date: date(0), title: 'Intake v3: silicone rollers double our pickup speed', body: INTAKE, subsystem_id: id(120), version_label: 'v3', why: 'v2 jammed on game pieces at an angle', onshape_url: null, decision_matrix: null, tags: ['intake', 'testing'], authors: [PRIYA, ETHAN], season: SEASON, refs: [], created_by: PRIYA, created_at: ago(90) },
      { id: id(125), team_id: A, kind: 'log', date: date(-1), title: 'Auto now scores 3 game pieces reliably', body: 'Tuned the heading PID...', subsystem_id: id(123), version_label: null, why: null, onshape_url: null, decision_matrix: null, tags: ['auto'], authors: [JORDAN, LIAM], season: SEASON, refs: [], created_by: JORDAN, created_at: at(-1, 18) },
      { id: id(126), team_id: B, kind: 'log', date: date(-2), title: 'Arm gearing: switched to 60:1 for more torque', body: 'Stalled at full extension...', subsystem_id: id(122), version_label: null, why: null, onshape_url: null, decision_matrix: null, tags: ['arm'], authors: [ZARA, DIEGO], season: SEASON, refs: [], created_by: ZARA, created_at: at(-2, 18) },
      { id: id(127), team_id: A, kind: 'decision', date: date(-4), title: 'Drivetrain: mecanum vs. tank', body: DRIVETRAIN, subsystem_id: id(121), version_label: null, why: null, onshape_url: null, decision_matrix: { criteria: [{ name: 'Maneuverability', weight: 3 }, { name: 'Pushing power', weight: 2 }, { name: 'Simplicity', weight: 1 }], options: [{ name: 'Mecanum', scores: [5, 2, 3] }, { name: 'Tank', scores: [2, 5, 4] }] }, tags: ['drivetrain'], authors: [ME, NOAH], season: SEASON, refs: [], created_by: ME, created_at: at(-4, 18) },
      { id: id(128), team_id: B, kind: 'log', date: date(-6), title: 'Field-centric drive working', body: '...', subsystem_id: id(121), version_label: null, why: null, onshape_url: null, decision_matrix: null, tags: [], authors: [MARCUS], season: SEASON, refs: [], created_by: MARCUS, created_at: at(-6, 18) },
    ],
    mfg_jobs: [
      { id: id(90), team_id: A, title: 'Intake roller hub v3', method: 'fdm', qty: 4, material: 'PETG', color: 'Black', priority: 2, needed_by: date(2), status: 'in_progress', params: '40% infill, 4 walls', notes: null, onshape_url: null, keep_files: false, requested_by: PRIYA, assigned_to: NOAH, created_at: at(-2), done_at: null, season: SEASON },
      { id: id(91), team_id: A, title: 'Camera mount', method: 'fdm', qty: 1, material: 'PLA', color: 'Blue', priority: 1, needed_by: date(3), status: 'queued', params: null, notes: null, onshape_url: null, keep_files: false, requested_by: ME, assigned_to: NOAH, created_at: at(-1), done_at: null, season: SEASON },
      { id: id(92), team_id: B, title: 'Arm side plates', method: 'cnc', qty: 2, material: '1/8" aluminum', color: null, priority: 2, needed_by: date(2), status: 'submitted', params: null, notes: null, onshape_url: null, keep_files: false, requested_by: EMMA, assigned_to: null, created_at: ago(180), done_at: null, season: SEASON },
      { id: id(93), team_id: null, title: 'Team number plates', method: 'laser', qty: 4, material: 'Acrylic', color: 'Red/Blue', priority: 1, needed_by: date(3), status: 'queued', params: null, notes: null, onshape_url: null, keep_files: false, requested_by: SOFIA, assigned_to: TOM, created_at: at(-3), done_at: null, season: SEASON },
      { id: id(94), team_id: A, title: 'Odometry pod brackets', method: 'fdm', qty: 3, material: 'PETG', color: 'Black', priority: 1, needed_by: date(-2), status: 'done', params: null, notes: null, onshape_url: null, keep_files: false, requested_by: JORDAN, assigned_to: NOAH, created_at: at(-6), done_at: at(-3), season: SEASON },
    ],
    inv_items: [
      { id: id(70), team_id: null, name: 'goBILDA Yellow Jacket motor (312 RPM)', sku: '5203-2402-0019', vendor: 'goBILDA', url: 'https://www.gobilda.com', location: 'Cabinet A', qty: 6, low_at: 2, category: 'Motors', notes: null, updated_at: now },
      { id: id(71), team_id: null, name: 'M4 x 8 mm screws', sku: null, vendor: 'goBILDA', url: null, location: 'Bin 12', qty: 40, low_at: 100, category: 'Hardware', notes: null, updated_at: now },
      { id: id(72), team_id: null, name: 'Smart Robot Servo', sku: 'REV-41-1097', vendor: 'REV', url: null, location: 'Cabinet B', qty: 1, low_at: 3, category: 'Electronics', notes: null, updated_at: now },
      { id: id(73), team_id: null, name: 'PETG filament (black)', sku: null, vendor: 'Prusa', url: null, location: 'Print farm', qty: 1, low_at: 2, category: 'Consumables', notes: null, updated_at: now },
      { id: id(74), team_id: null, name: 'Zip ties (4 in)', sku: null, vendor: null, url: null, location: 'Bin 3', qty: 500, low_at: 100, category: 'Consumables', notes: null, updated_at: now },
      { id: id(75), team_id: null, name: '96 mm mecanum wheel', sku: '3213-3606-0001', vendor: 'goBILDA', url: null, location: 'Cabinet A', qty: 8, low_at: 4, category: 'Drivetrain', notes: null, updated_at: now },
    ],
    pur_requests: [
      { id: id(160), team_id: A, item: 'Spare Control Hub', url: 'https://www.revrobotics.com', qty: 1, est_price: 285, reason: 'Backup for competitions', urgency: 2, status: 'requested', requested_by: JORDAN, handled_by: null, ordered_at: null, received_at: null, note: null, created_at: ago(60 * 7) },
      { id: id(161), team_id: B, item: 'Smart Robot Servo (x4)', url: null, qty: 4, est_price: 120, reason: 'Arm upgrade', urgency: 1, status: 'requested', requested_by: ZARA, handled_by: null, ordered_at: null, received_at: null, note: null, created_at: ago(60 * 30) },
      { id: id(162), team_id: null, item: 'PETG filament (3 rolls)', url: null, qty: 3, est_price: 75, reason: 'Running low', urgency: 1, status: 'ordered', requested_by: NOAH, handled_by: PARK, ordered_at: at(-1), received_at: null, note: null, created_at: at(-2) },
    ],
    bat_batteries: [1, 2, 3, 4, 5, 6].map((n, i) => ({ id: id(20 + i), team_id: i < 4 ? A : B, label: `${i < 4 ? 'CB' : 'TT'}-${n}`, type: 'robot', purchased: date(-400), retired: false, notes: null })),
    bat_logs: [
      { id: 1, battery_id: id(20), kind: 'charged', voltage: 13.5, note: null, at: at(0, 15, 40), by: ETHAN },
      { id: 2, battery_id: id(21), kind: 'used', voltage: 12.2, note: '3 matches', at: at(0, 16, 30), by: JORDAN },
      { id: 3, battery_id: id(22), kind: 'used', voltage: 12.0, note: null, at: at(0, 16, 45), by: JORDAN },
      { id: 4, battery_id: id(23), kind: 'charged', voltage: 13.4, note: null, at: at(0, 15), by: AVA },
      { id: 5, battery_id: id(24), kind: 'charged', voltage: 13.3, note: null, at: at(0, 15), by: DIEGO },
      { id: 6, battery_id: id(25), kind: 'charged', voltage: 13.4, note: null, at: at(0, 15), by: DIEGO },
    ],
    rep_issues: [
      { id: id(170), team_id: A, title: 'Lift string frayed on pulley bracket', subsystem_text: 'Lift', severity: 2, status: 'open', happened_at: at(-1), event_label: 'Practice', cause: 'Sharp edge on the bracket', fix: null, reported_by: ETHAN, fixed_by: null, image_path: null, season: SEASON, created_at: at(-1, 17) },
    ],
    drv_runs: Array.from({ length: 12 }, (_, i) => ({ id: id(60 + i), team_id: A, date: date(-11 + i), driver: i % 3 ? ME : JORDAN, operator: i % 3 ? JORDAN : LIAM, kind: 'full', score: 92 + Math.round(i * 6.5 + Math.sin(i) * 9), auto_score: 24 + i * 2, metrics: {}, notes: null, season: SEASON, created_by: ME, created_at: at(-11 + i, 17) })),
    code_opmodes: [
      { id: id(50), team_id: A, name: 'Auto: 3 pieces + park', kind: 'auto', description: 'Starts on the left', status: 'working', gamepad_map: {}, sort: 0, updated_at: now },
      { id: id(51), team_id: A, name: 'TeleOp: Main', kind: 'teleop', description: 'Field-centric drive', status: 'working', gamepad_map: { gamepad1: { left_stick: 'Drive', right_stick: 'Turn', right_trigger: 'Intake', left_trigger: 'Outtake', a: 'Slow mode' }, gamepad2: { dpad_up: 'Lift up', dpad_down: 'Lift down', a: 'Claw open', b: 'Claw close' } }, sort: 1, updated_at: now },
      { id: id(52), team_id: B, name: 'TeleOp: Torque', kind: 'teleop', description: null, status: 'wip', gamepad_map: {}, sort: 2, updated_at: now },
    ],

    // ── Outreach & business ──────────────────────────────────────────────
    out_events: [
      { id: id(130), team_id: null, title: 'Library robot demo', date: date(-5), starts_at: null, ends_at: null, kind: 'demo', location: 'Public Library', people_reached: 85, description: null, season: SEASON, created_by: SOFIA, created_at: at(-5) },
      { id: id(131), team_id: null, title: 'FLL mentoring night', date: date(-12), starts_at: null, ends_at: null, kind: 'mentoring', location: 'Lincoln Elementary', people_reached: 24, description: null, season: SEASON, created_by: SOFIA, created_at: at(-12) },
      { id: id(132), team_id: null, title: 'Farmers market booth', date: date(-26), starts_at: null, ends_at: null, kind: 'demo', location: 'Downtown', people_reached: 310, description: null, season: SEASON, created_by: HANNAH, created_at: at(-26) },
      { id: id(133), team_id: B, title: 'Girl Scouts robotics badge', date: date(-19), starts_at: null, ends_at: null, kind: 'workshop', location: 'Community center', people_reached: 18, description: null, season: SEASON, created_by: HANNAH, created_at: at(-19) },
    ],
    out_hours: [
      ...[ME, SOFIA, LIAM, HANNAH, GRACE].map((u) => ({ event_id: id(130), user_id: u, hours: 3, approved: true, approved_by: PARK, created_at: at(-5) })),
      ...[SOFIA, AVA, PRIYA].map((u) => ({ event_id: id(131), user_id: u, hours: 2, approved: true, approved_by: PARK, created_at: at(-12) })),
      ...[ME, JORDAN, HANNAH, ZARA, MARCUS, EMMA].map((u) => ({ event_id: id(132), user_id: u, hours: 4, approved: true, approved_by: TOM, created_at: at(-26) })),
      ...[HANNAH, GRACE].map((u) => ({ event_id: id(133), user_id: u, hours: 2.5, approved: false, approved_by: null, created_at: at(-19) })),
    ],
    spn_sponsors: [
      { id: id(230), team_id: null, name: 'Riverbend Machine Works', contact_name: 'Dana Ortiz', contact_email: 'dana@example.com', website: 'https://example.com', status: 'committed', tier: 'Gold', gave: '$2,500', thanked: false, next_step: 'Send thank-you letter with robot photo', next_step_date: date(1), owner: SOFIA, notes: null, season: SEASON, created_at: now, updated_at: now },
      { id: id(231), team_id: null, name: 'Northline Credit Union', contact_name: 'Sam Patel', contact_email: 'sam@example.com', website: null, status: 'asked', tier: null, gave: null, thanked: false, next_step: 'Follow-up call', next_step_date: date(0), owner: ME, notes: null, season: SEASON, created_at: now, updated_at: now },
      { id: id(232), team_id: null, name: 'Bright Path Engineering', contact_name: null, contact_email: null, website: null, status: 'prospect', tier: null, gave: null, thanked: false, next_step: 'Email intro', next_step_date: date(5), owner: SOFIA, notes: null, season: SEASON, created_at: now, updated_at: now },
      { id: id(233), team_id: null, name: 'Cedar Hardware', contact_name: 'Ray Lin', contact_email: null, website: null, status: 'committed', tier: 'In-kind', gave: 'Tools and hardware', thanked: true, next_step: null, next_step_date: null, owner: HANNAH, notes: null, season: SEASON, created_at: now, updated_at: now },
    ],
    soc_posts: [
      { id: id(220), team_id: null, platforms: ['instagram'], caption: 'Qualifier week! Come cheer for both our teams on Saturday.', media_ref: null, status: 'needs_approval', scheduled_for: at(1, 12), posted_url: null, created_by: GRACE, approved_by: null, created_at: ago(200), updated_at: ago(200) },
      { id: id(221), team_id: null, platforms: ['instagram', 'tiktok'], caption: 'Thank you Riverbend Machine Works for sponsoring our season!', media_ref: null, status: 'scheduled', scheduled_for: at(3, 17), posted_url: null, created_by: GRACE, approved_by: PARK, created_at: at(-1), updated_at: at(-1) },
    ],
    mer_drives: [{ id: id(110), team_id: null, title: 'Season hoodies and shirts', description: 'Orders close Friday', items: [{ id: 'i1', name: 'Hoodie', price: '$32', sizes: ['S', 'M', 'L', 'XL'] }, { id: 'i2', name: 'T-shirt', price: '$15', sizes: ['S', 'M', 'L', 'XL'] }], closes_at: at(3, 23), status: 'open', season: SEASON, created_by: SOFIA, created_at: at(-4) }],
    mer_orders: PEOPLE.slice(0, 9).map((p, i) => ({ id: id(300 + i), drive_id: id(110), user_id: p.id, lines: [{ item: i % 2 ? 'i2' : 'i1', size: 'M', qty: 1 }], paid: i % 3 !== 0, delivered: false, created_at: at(-3), updated_at: at(-3) })),
    med_albums: [],
    med_items: [],

    // ── Competition ───────────────────────────────────────────────────────
    chk_lists: [
      { id: id(40), team_id: null, name: 'Pre-match check', kind: 'pre_match', items: [{ id: 'a', text: 'Battery above 13 V' }, { id: 'b', text: 'Wires secured, zip ties trimmed' }, { id: 'c', text: 'Driver Hub charged' }, { id: 'd', text: 'Auto selected' }], sort: 0, created_by: ME },
      { id: id(41), team_id: null, name: 'Packing list', kind: 'packing', items: [{ id: 'a', text: 'Robot cart' }, { id: 'b', text: 'Batteries and charger' }, { id: 'c', text: 'Tool box' }, { id: 'd', text: 'Spare parts bin' }, { id: 'e', text: 'Team banner' }], sort: 1, created_by: ME },
    ],
    chk_runs: [],
    jdg_questions: [
      { id: id(80), team_id: null, question: 'What was your biggest design challenge this season?', notes: 'Intake v1 to v3 story', tags: ['design'], owner: PRIYA },
      { id: id(81), team_id: null, question: 'How does your team share what you learn with the community?', notes: 'Library demo, FLL mentoring', tags: ['outreach'], owner: SOFIA },
    ],
    jdg_criteria: [],
    rule_items: [],
    sct_entries: [],
    comp_active: opts.live ? [{ team_id: A, event_code: QUALIFIER, season: SEASON_YEAR, pit_notes: 'Lift string replaced after Q8. Charge CB-2 before Q14.', updated_by: ME, started_at: at(0, 7), updated_at: ago(20) }] : [],
    comp_history: [],
    evt_notes: [],
  };
  return t;
}

// ── FTCScout (stubbed) ─────────────────────────────────────────────────────
const TEAM_NAMES: Record<number, string> = {
  [NUM_A]: 'Circuit Breakers', [NUM_B]: 'Torque Titans', 98021: 'Gearheads', 98034: 'Quantum Leap', 98047: 'Iron Owls', 98055: 'Byte Me', 98062: 'Robo Raccoons',
  98078: 'Velocity', 98083: 'Spare Parts', 98091: 'Nuts & Bolts', 98104: 'Overclocked', 98117: 'The Wired', 98125: 'Mech Tech', 98139: 'Kinetic', 98146: 'Flux Capacitors', 98152: 'Torque Twist',
};
const NUMS = Object.keys(TEAM_NAMES).map(Number);
const stats = (rank: number, w: number, l: number, opr: number) => ({ rank, rp: w * 2, wins: w, losses: l, ties: 0, qualMatchesPlayed: w + l, opr: { totalPointsNp: opr }, avg: { totalPointsNp: opr * 0.95 } });
const loc = (venue: string) => ({ venue, city: 'Riverside', state: 'CA', country: 'USA' });

function event(code: string, name: string, start: string, end: string, finished: boolean, ongoing: boolean) {
  return { code, name, start, end, type: code === LEAGUE ? 'LeagueMeet' : 'Qualifier', timezone: 'America/Los_Angeles', location: loc(code === LEAGUE ? 'Oak Valley Middle School' : 'Riverside High School'), finished, ongoing };
}

/** Answers the dashboard's FTCScout GraphQL queries with made-up events, rankings and matches. */
export function ftcScout(body: { query: string; variables: Record<string, unknown> }, live: boolean) {
  const q = body.query;
  const v = body.variables;
  if (q.includes('__type')) return { __type: { possibleTypes: [{ name: `${v.n}${SEASON_YEAR}` }] } };
  const qual = event(QUALIFIER, 'Riverside Qualifier', live ? date(0) : date(4), live ? date(0) : date(4), false, live);
  const league = event(LEAGUE, 'Riverside League Meet 2', date(-10), date(-10), true, false);
  if (q.includes('teamByNumber') && q.includes('events')) {
    const n = v.n as number;
    return {
      teamByNumber: {
        events: [
          { eventCode: LEAGUE, event: league, stats: n === NUM_A ? stats(2, 5, 1, 118) : stats(5, 4, 2, 97), awards: n === NUM_A ? [{ type: 'Think', placement: 2 }] : [] },
          { eventCode: QUALIFIER, event: qual, stats: live && n === NUM_A ? stats(3, 5, 3, 122) : null, awards: [] },
        ],
      },
    };
  }
  if (q.includes('teamByNumber')) return { teamByNumber: { number: v.n, name: TEAM_NAMES[v.n as number] ?? 'Team', schoolName: 'Riverside High School', rookieYear: 2019, website: null, location: loc('Riverside High School'), quickStats: null } };
  if (q.includes('eventByCode')) {
    const code = v.c as string;
    const isLive = code === QUALIFIER && live;
    const base = code === QUALIFIER ? qual : league;
    const ranked = [...NUMS].sort((a, b) => (b * 7919) % 97 - (a * 7919) % 97);
    // Ours near the top.
    ranked.splice(ranked.indexOf(NUM_A), 1);
    ranked.splice(2, 0, NUM_A);
    ranked.splice(ranked.indexOf(NUM_B), 1);
    ranked.splice(5, 0, NUM_B);
    const teams = ranked.map((n, i) => ({ teamNumber: n, team: { name: TEAM_NAMES[n] }, stats: isLive && n === NUM_A ? stats(3, 5, 3, 122) : isLive || code === LEAGUE ? stats(i + 1, Math.max(0, 5 - Math.floor(i / 3)), Math.min(5, Math.floor(i / 3)), Math.round(135 - i * 6.5)) : null }));
    const matches = [];
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const played = isLive ? 13 : code === LEAGUE ? 24 : 0;
    for (let m = 1; m <= 24; m++) {
      const four = [0, 1, 2, 3].map((k) => NUMS[(m * 5 + k * 3) % NUMS.length]);
      if (m % 3 === 1) four[m % 4] = NUM_A;
      if (m % 4 === 2) four[(m + 1) % 4] = NUM_B;
      const sched = new Date(start.getTime() + (m - 1) * 7 * 60_000);
      const done = m <= played;
      const red = 80 + ((m * 37) % 70);
      const blue = 75 + ((m * 53) % 70);
      matches.push({
        id: m,
        matchNum: m,
        series: 0,
        tournamentLevel: 'Quals',
        description: null,
        hasBeenPlayed: done,
        scheduledStartTime: isLive ? sched.toISOString() : null,
        actualStartTime: done && isLive ? new Date(sched.getTime() + 9 * 60_000).toISOString() : null,
        teams: four.map((n, k) => ({ teamNumber: n, alliance: k < 2 ? 'Red' : 'Blue', station: `${k < 2 ? 'Red' : 'Blue'}${(k % 2) + 1}`, surrogate: false })),
        scores: done ? { red: { totalPoints: red, totalPointsNp: red - 5 }, blue: { totalPoints: blue, totalPointsNp: blue - 5 } } : null,
      });
    }
    return { eventByCode: { ...base, teams, matches, awards: code === LEAGUE ? [{ type: 'Think', placement: 2, teamNumber: NUM_A }] : [] } };
  }
  if (q.includes('eventsSearch')) return { eventsSearch: [qual, league] };
  return {};
}
