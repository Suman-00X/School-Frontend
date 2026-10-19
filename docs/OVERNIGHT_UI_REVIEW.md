# Overnight UI build: review (2026-10-20)

All the pages that were left in `FRONTEND_PAGES.md` are built and committed. That is 88 pages, from Academics through Inventory. The whole app type-checks, and `vite build` succeeds.

**Not looked at in a browser yet.** Chrome wasn't available. Each page was checked two ways: by the type-checker, and by calling the API it uses against a seeded demo school, signed in as the roles that use it. Layout, dark mode and phone width still need a look.

## How to look at it

- **http://localhost:5174**: the app, running against a seeded in-memory demo school on :3100.
  - Sign in as `admin@demo.school` / `Admin12345`.
  - Every role has a demo account with the same password; they are listed in `../School-Backend/docs/DEMO_ACCOUNTS.md`. Useful ones: a teacher (anita.sharma), a parent, a student, the librarian (kavita.joshi), the HR owner (sanjay.mehta), the accountant (rakesh.gupta).
  - The demo backend is in-memory: restarting it re-seeds with new ids.
- Your usual setup (:5173 against :3000) is untouched. It runs the same code.

## What was built

| Module | Pages | Where |
|---|---|---|
| Academics | AC-03 to AC-17 | Header tabs Setup (side list: years, classes, subjects, teacher assignments, calendar, grading, attendance policy), Enrollments, Timetable, Attendance (register, cover, missing registers), Exams & results (exams, marks, report cards), Homework, Activity |
| Finance | FI-01 to FI-14 | Collect, Invoices, Payments (payments, refunds, settlements), Ledger, Setup (fee heads, structures, plans, late fees, concessions, settings), Activity. Student fee account at `/finance/students/:id` |
| Messages | SH-06, CO-01, CO-02 | Announcements, Send message, Activity. The inbox is at `/me/notifications`, with an unread bell in the header |
| Reports | RP-01, RP-02 | Dashboards (overview, attendance, fees, academics), Exports |
| Files | FL-01 | Documents (student, staff, general), Activity |
| My school (portal) | PO-01 to PO-11 | Families: Student (child switcher, then a side list of overview, timetable, attendance, homework, results, fees, transport & hostel), Library, Calendar. Employees: My sections, My timetable, My attendance, My leave, My payslips |
| Library | LB-01 to LB-08 | Desk, Loans & fines, Holds, Catalogue, Stock checks, Reports, Setup (policy, rules, closures, activity) |
| Transport | TR-01 to TR-04 | Vehicles, Routes, Seat assignments, Rosters, Activity |
| Hostel | HO-01 to HO-04 | Hostels, Bed allocations (board, list, availability, roll-over), Resources, Resource assignments, Activity |
| HR | HR-01 to HR-06 | Attendance, Leave, Payroll, Salaries, Leave types, Activity |
| Inventory | IN-01 to IN-05 | Items, Stock movements, Reports, Vendors, Categories, Activity |

**New shared UI pieces** in `src/common/ui`:
- `Charts`: column, line and bar lists, stacked bar, stat tiles, chart colour tokens.
- `GridEditor`: keyboard-first grid for attendance-style entry.
- `MonthCalendar`, `MultiSelect`, `TagInput`.

**New shared pickers:**
- `StudentSelect` (from `@/modules/users`)
- `SectionSelect` (from `@/modules/academics`)
- `PersonPicker` (now exported from `@/modules/administration`)

**Also finished from earlier pages:**
- **Section drawer (AC-02):** the drawer now has Subjects, Teachers, Students and Timetable tabs, each linking to its full page.
- **Year-end checklist (AC-01):** a card on the academic years page with three steps: promote, make the next year current, archive.
- **"Preview on an exam":** a link on each result policy.
- **"Fee account" button:** on the student profile.

**Not built:**
- **Counter card/UPI checkout (FI-08):** staff record card machine payments with their reference instead.
- **Inventory "transfer" movements:** the API has no transfer type.

## Decisions to review

**Navigation**
1. **Academics Setup:** the year and class pages moved from header tabs into the Setup side list. Their routes are unchanged.
2. **Portal "Student" tab:** families see one "Student" tab, with the child's pages in a side list. The label is the same word for students and parents. `/me/school/<page>` opens the child last viewed.
3. **Library page for families:** families use one library page, `/library/my-loans`, with a child filter. The spec has one per child, but every library permission is also held by families, so per-child pages couldn't be told apart from staff ones.
4. **Self-service tabs:** teachers' and employees' own pages (sections, timetable, attendance, leave, payslips) are tabs under "My school".
5. **Quick add:** the panel now has 21 actions. An admin sees all of them, which may be too many. Consider grouping them by module, or trimming.

**Academics**
6. **Attendance modes:** the forenoon/afternoon and per-period flows (register chips, cover steps 2–3, free periods) are built from the backend code only. The demo school takes attendance once a day.
7. **Missing registers lock:** whether a register is locked is worked out on the client from the policy, because the rows have no lock state.
8. **Changing a teacher:** done as remove, then add. If the add fails, the old teacher is put back.
9. **Marks grid:** saved marks load one student at a time. Saves send only the cells that changed.
10. **Class sheet:** one column per subject (parts added together), not one per paper.
11. **Promotion:** a successful bulk promotion was not run, because it would mark demo students as left. Only its refusals were checked.

**Finance**
12. **Locked plans and structures:** they are worked out from the invoice list. People who can't read invoices only find out when the server refuses the save.
13. **Date filters:** a range with one end filled gets the other end filled in (today, or 2000-01-01). The API filters only when both ends are sent.
14. **Refunds page:** opens on "Waiting for approval" for every role.
15. **Fee account button:** "Fee account" (`StudentAccountLink`) is added to the student profile.

**Other modules**
16. **Header bell:** lives in the communication module, and the app shell imports it.
17. **Exports year:** exports follow the header's year, with no year picker per card.
18. **Library borrowers:** the borrower list comes from the inactive-borrowers report (with a date of tomorrow), because there is no borrower search. This is a workaround.
19. **Transport roster:** lives at `/transport/rosters?routeId=` so it can be a header tab; the spec's path redirects there.
20. **Hostel resources:** one tab per resource type (7).
21. **Bed allocations:** they aren't tied to an academic year, so they stay editable when an archived year is picked.
22. **HR leave requests:** listed newest first. The spec wants oldest first, but the API has no sort.
23. **Payroll picker:** accountants pick employees only from those who already have a salary, or paste a user id.

## Backend gaps found

Grouped by kind. Each page works around its gap; nothing in the backend was changed.

**No names, only ids.** These fields return a user id only, so the UI shows "Staff member" or "you":
- `takenBy` / `markedBy` (attendance)
- `receivedBy`, "assigned by", "granted by", "updated by" (finance)
- `uploadedBy` (files)

**PATCH can't clear a field.** Once set, these can't be emptied:
- timetable room
- homework `maxMarks`
- exam and paper dates, times, room and scale
- hostel phone, room floor
- vendor phone, email and tax id
- book category and published year

**No search, sort or filter.**
- No search on students, borrowers or payslips.
- No sort on leave requests.
- Marks can't be read per paper or section.
- Files can't be filtered by category.
- Payments can't be filtered by invoice or by who received them.
- `/me/students` has no `userId`.
- The library `my-*` endpoints have no borrower filter.

**Missing summaries.**
- No grant count on concessions.
- Nothing says whether a plan, structure or ledger account has been used.
- No "reversed by" on journal entries.
- No current salary.
- No route on vehicles.
- No room on hostel resource assignments.
- Missing-register rows have no lock state.
- Homework submissions have no attachment ids, so staff can't open what students attached.

**Behaviour.**
- An attendance mark can't be removed once saved.
- The bulk marks save stops at the first bad entry.
- Exams and marks can't be deleted.
- Deleting a fee head or grade scale that is still in use is allowed.
- Calendar event PATCH skips the year check.
- Bed availability ignores the boys/girls rule.
- Cancelling a booking made by a transfer doesn't restore the old bed.
- A duplicate roll number gives a generic database message.

**Family access.**
- Families can only see the current academic year.
- The fee statement has no currency.
- There is no self-renewal of library books.

**Docs that disagree with the code.**
- `POST /library/books/:id/copies` returns an array of copies, not `{ book, copies }`.

## Test data left in the demo school

The demo school is in-memory, so all of this goes when it restarts:
- an exam "Builder Check Test" with a withdrawn version
- about 10 extra Class 6 invoices, one of them cancelled
- a ₹100 payment with refunds
- a manual journal entry and its reversal
- a book "The Night Sky" with 3 copies, and a closed stock check
- one published announcement, one message, and a `t.csv` file
- a cancelled leave request

## Housekeeping

- **Bundle size:** the JavaScript bundle is over 500 kB. Loading each module's routes lazily would split it.
- **No ESLint config:** the repo has none, so only `tsc` ran (and oxlint, by some builders).
- **Commits:** all local; nothing is pushed.
- **Earlier session's work:** the dropdown and roll-number work that an earlier session left uncommitted (custom `Select`, `FormTabs`, roll-number rule) is now committed, unchanged, as `1f9fb17`. Three files held parts of it alongside tonight's edits (ClassesPage, SectionDrawer, AcademicYearsPage); they are in the final wiring commit. So `1f9fb17` on its own may not build, but the commit after it does.
- **Section drawer:** it is now always wide. The Timetable tab was added there because the spec lists one too.
- **Year-end checklist:** its "Promote sections" step switches the header's year to the closing year before it opens the wizard.
