# UX Contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select | UX-CONTRACT.md | native | keyboard and browser popup |
| Form | Shared field styles and Zod schemas | src/app/globals.css and API route schemas | create and edit | validation and browser flow |
| Scrollbar | Global application stylesheet | src/app/globals.css | default and bounded panel | browser computed style |
| Toast | ToastProvider | src/components/ui.tsx | success, error and info | mutation browser flow |
| CRUD | Feature APIs with shared feedback and Dialog | src/app/api and src/components/ui.tsx | FAQ and Lead status | browser full flow |

- Thai is the primary interface language; dates and numbers use `th-TH` with `Asia/Bangkok`.
- Create/edit success keeps users in the owning screen and shows a shared success toast.
- Destructive actions always name the object in an app-owned confirmation dialog; focus starts on cancel.
- Loading uses stable inline spinners or reserved rows. Empty and no-result states explain the next action.
- Search clears immediately, is IME-safe and persists committed query/filter state in the URL where practical.
- Desktop data lists use bounded pagination; mobile renders labeled cards without hiding required fields.
- All errors are visible near the failed operation and preserve entered values.
- Login redirects to `/dashboard`; logout redirects to `/login`.
- Demo chat changes persistent local data, so Dashboard, Inbox and Leads reflect the same state on next navigation.
- Keyboard focus is visible; interactive controls use native elements and 44px touch targets.
