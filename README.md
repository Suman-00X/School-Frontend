# School-Frontend

Web app for the School backend (`../School-Backend`, REST `/api/v1`). React 19, TypeScript, Vite, React Router 7, TanStack Query 5. No UI library: the components in `src/common/ui` and the CSS in `src/styles` are the design system.

The page specs are in `../School-Backend/docs/FRONTEND_PAGES.md` (page ids such as AD-06 and PE-03 are used in code comments).

## Run it

```sh
# 1. Backend with throwaway databases and a demo school (in ../School-Backend)
APP_URL=http://localhost:5173 npm run dev:memory
                            # API on :3000. Sign in: school DEMO, admin@demo.school / Admin12345

# 2. This app
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :3000)
```

`APP_URL` makes the backend's signed file links (logo, documents) point at this dev server, which proxies `/files/signed` to the backend. Without it, the browser refuses to show uploaded images, because the backend sends `Cross-Origin-Resource-Policy: same-origin`. Production with S3 storage is not affected.

`npm run build` type-checks and builds. Set `VITE_API_PROXY` to point the dev proxy at another backend.

## Layout

Same shape as the backend: modules → submodules → folders per file type, with an `index` at each level.

```
src/
  app/                 App providers, router, sidebar (navigation.ts)
  common/              Framework only, no business logic
    api/               Client: base URL, bearer token, refresh rotation, academic-year header, ApiError
    auth/              Session, me + access, can(), route guards
    academic-year/     Header year switcher (X-Academic-Year-Id)
    hooks/             useApiList / useApiGet / useApiMutation, useListParams (filters in the URL), useForm
    ui/                Buttons, form fields, DataTable, Drawer, Dialog, confirm(), toasts, tabs, badges…
    components/        Shared feature components (ActivityLog = MA-01)
    layout/            App shell
  modules/
    auth/              sessions (sign-in), credentials (password links, invitations), my-account
    home/
    administration/    settings, imports, audit-logs, access
    users/             accounts, students, parents, teachers, staff, shared
    academics/         academic-years, classes (only the setup that admission needs, so far)
  styles/              tokens.css (light + dark), base, components, layout
```

Each submodule has `pages/`, `components/`, `api/` and an `index.tsx` that exports its `routes`. A module's `index.ts` collects its submodules' routes; `app/router.tsx` mounts the modules.

## Conventions

- **Permissions decide what is shown.** Use `useAuth().can("users.accounts.update")` or `<Can permission=…>` for buttons, and `RequirePermission` on routes. Check permission keys, never role names. The backend still checks every call.
- **API calls** go through `api` from `@/common/api`. Read with `useApiList` / `useApiGet`. Write with `useApiMutation(fn, { invalidate: ["/users"] })`. Query keys start with the API path, so invalidating `"/users"` refreshes every users query.
- **Messages:** show the API's `message` in toasts after writes (`toast.success(res.message)`) and errors as they come (`toast.error(err)`). Map `VALIDATION_ERROR` details onto fields with `form.setServerErrors(err, fieldMap)`.
- **Lists:** pagination and filters live in the URL (`useListParams`). Use `DataTable` with `meta` and `onPageChange`.
- **Destructive actions** use `useConfirm()` with a message that names the record.
- **Generated files** (exports, templates, PDFs) use `api.download(path, query)`, which sends the token. **Uploaded files** use the signed `…/download-url` link.
- Styling uses the existing classes and tokens. Inline styles only for one-off spacing.

## Navigation

- **Left rail:** one icon per module (`MODULES` in `src/app/navigation.ts`).
- **Header:** the active module's submodules as tabs. The header is always the same height.
- **Drill-in header:** a page about one record (student, account, import, role) or an area with its own sections renders `<DrillHeader back title tabs value onChange />` (`@/common/layout/ShellHeader`). It replaces the module tabs with a back arrow, a title and the page's own tabs. Do not render a second row of tabs inside such a page.
- **Many sections:** an area with more sections than fit in the header uses `<SideNavLayout groups>` (`@/common/layout/SideNav`), a grouped list on the left of the content.
- **Right panel:** shortcuts (quick add, my account, text size, day/night). Its actions also live in the account menu, because the panel is hidden on phones.

## Layout stability

Nothing that appears after an action may push existing content around. Concretely:

- **Form fields** always reserve their message line: `Field` renders it empty, and an error replaces the hint in the same line. Pass `error` to `TextInput`/`Select` (even `undefined`, as `form.text()` does) so they keep the same markup when an error arrives.
- **Form-level errors** go in the footer: `Drawer`/`Dialog` `footerStatus`, or `<FormActions error>` under a page form. Never insert an `Alert` above or inside a form on submit.
- **Selection:** the table's "N selected" bar covers the header row (`DataTable` handles it). Don't add bars above tables.
- **Filters:** the filter bar has one height. Filters show no hints or errors (they're hidden by CSS). Say "nothing matches" in the table's empty state, not under a filter. Applied filters are fields in the bar, not an extra row of chips.
- **Conditional notes and banners:** a note that depends on a choice (e.g. a status filter) goes in the empty state or a reserved slot of fixed height. A banner that a page may need (archived year, read-only) is either always present or lives in the header.
- **Buttons** keep their size while loading (`Button loading`). Toggles that change a view swap one region for another of the same place; they never insert above existing content.
- **Async content:** cards that load keep their size with skeletons. Lists keep the previous page while the next loads (`useApiList` does this).
- **Messages after actions** are toasts, which float over the page.
