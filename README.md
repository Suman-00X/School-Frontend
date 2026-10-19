# School-Frontend

Web app for the School backend (`../School-Backend`, REST `/api/v1`). React 19, TypeScript, Vite, React Router 7, TanStack Query 5. No UI library: the components in `src/common/ui` and the CSS in `src/styles` are the design system.

The page specs are in `../School-Backend/docs/FRONTEND_PAGES.md` (page ids such as AD-06 and PE-03 are used in code comments).

## Run it

```sh
# 1. Backend with throwaway databases and a demo school (in ../School-Backend)
npm run dev:memory          # API on :3000. Sign in: school DEMO, admin@demo.school / Admin12345

# 2. This app
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :3000)
```

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
