# LINE Sales Assistant Design System

## Direction

An operations console for Thai shop owners: calm, legible and approachable. The visual language combines Shopify Admin clarity with Linear-level restraint. The memorable device is a thin conversation pulse line that connects live activity with work requiring attention.

## Tokens

- Canvas: `#F7F8FA`; surface: `#FFFFFF`; strong ink: `#111827`; muted ink: `#667085`.
- Border: `#E4E7EC`; LINE green: `#06C755`; green hover: `#05A847`.
- Waiting: `#B54708` on `#FFF4E5`; danger: `#B42318`; info: `#175CD3`.
- Radius: 10px controls, 14px panels. Shadows are limited to dialogs and mobile navigation.
- Typography: Geist with Thai system fallbacks; 14px UI body, 12px metadata, 28–32px page title.
- Motion: 160ms state transitions; disabled when reduced motion is requested.

## Layout

- Desktop uses a 248px fixed sidebar, a compact top bar and an open content canvas.
- Metrics use a ruled strip, not four floating cards.
- Tables remain tables on desktop and become labeled rows/cards on small screens.
- Inbox is a three-column workspace; mobile shows one pane at a time with an explicit back path.
- All primary touch targets are at least 44px.

## Components

- Buttons: solid/outline/ghost emphasis with brand, neutral and danger intent.
- Status labels are compact semantic markers with text, never color alone.
- Forms own validation and reserve error space.
- Toasts use one bottom-right live region. Destructive operations use an app-owned dialog.
- Icons use Lucide at 1.75px stroke.

## Runtime mapping

These values map to CSS custom properties in `src/app/globals.css`. Shared behavior lives in `src/components/ui.tsx`, `src/components/app-shell.tsx`, and feature components.
