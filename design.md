# UI Design System & Style Guide

## 1. Core Tech Stack
- Styling: Tailwind CSS v3 (via CDN) + custom `styles.css` for overrides
- Font: Inter (Google Fonts, weights 300–900)
- Dark mode: class-based (`darkMode: 'class'`), persisted in `localStorage`

## 2. Design Tokens

### Colors
- **Brand / Primary**: `#3b82f6` → `brand-500` (blue)
- **Brand Hover**: `#2563eb` → `brand-600`
- **Brand Accent**: `#60a5fa` → `brand-400` (icons, highlights)
- **Success**: `#10b981` (emerald)
- **Warning**: `#f59e0b` (amber)
- **Danger**: `#ef4444` (red)
- **Secondary Accent**: `#a855f7` (purple, for alternative data category)

Custom Tailwind color extensions required in every project:
```js
colors: {
  brand: { 50:'#eff6ff', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8' },
  dark:  { 900:'#0f172a', 800:'#1e293b', 700:'#334155', 600:'#475569' }
}
```

### Surfaces
| Role | Light | Dark |
|---|---|---|
| Page background | `bg-gray-50` | `dark:bg-dark-900` |
| Card / panel | `bg-white` | `dark:bg-dark-800` |
| Input / filter | `bg-gray-100` | `dark:bg-dark-700` |
| Border (subtle) | `border-gray-200` | `dark:border-white/5` |
| Border (standard) | `border-gray-200` | `dark:border-white/10` |
| Text primary | `text-gray-900` | `dark:text-white` |
| Text muted | `text-gray-500` | `dark:text-gray-400` |

### Spacing & Grid
- Base unit: 4px (Tailwind default). Stick to the 4px scale.
- Breakpoints: `sm` 640px, `md` 768px, `lg` 1024px
- Section padding: `px-4 sm:px-6 lg:px-8`
- Card padding: `p-4 sm:p-6`
- Gap between cards: `gap-3 sm:gap-4`

## 3. Typography
- Font: **Inter**, loaded from Google Fonts
- Base body: `text-base text-gray-600 dark:text-gray-400`

| Role | Classes |
|---|---|
| Hero heading | `text-3xl sm:text-5xl font-black` |
| Page title | `text-2xl sm:text-3xl font-black` |
| Card title | `text-base sm:text-lg font-semibold` |
| Stat value | `text-lg sm:text-xl font-bold` |
| Helper / caption | `text-xs text-gray-400 dark:text-gray-500` |
| Table cell | `text-sm` |
| Badge | `text-xs font-medium` |

Hero gradient heading pattern:
```
bg-gradient-to-r from-gray-900 via-brand-500 to-brand-600
dark:from-white dark:via-brand-200 dark:to-brand-400
bg-clip-text text-transparent
```

## 4. Component Rules

### Cards
- Standard: `bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-6 shadow-xl shadow-gray-200/50 dark:shadow-black/50`
- Compact stat: `rounded-xl` (not `rounded-2xl`), same surface + border
- Tinted accent: replace `bg-white` with `bg-{color}-50 dark:bg-dark-800/50` and border with `border-{color}-200 dark:border-{color}-500/20`

### Buttons
- **Primary (CTA)**: gradient `from-brand-600 to-brand-500`, `rounded-xl`, `font-bold`, `shadow-lg shadow-brand-500/25`, scale on hover/active (`hover:scale-[1.01] active:scale-[0.99]`), always `disabled:opacity-50`
- **Secondary**: `bg-gray-100 dark:bg-dark-700`, `border-gray-200 dark:border-white/10`, `rounded-xl`, hover: `border-brand-500/50`
- **Ghost / icon**: `p-2 rounded-lg`, same surface + border as secondary
- **Toggle (multi-select)**: inactive = secondary style; active = `background: linear-gradient(135deg,#2563eb,#3b82f6)`, `border-brand-500`, white text, `box-shadow: 0 0 12px rgba(59,130,246,0.3)`
- **Floating Action Button (mobile only)**: `fixed bottom-6 right-4 rounded-full bg-brand-500`, `shadow-lg shadow-brand-500/40`, hidden on `sm:` and above, account for safe area: `calc(1.5rem + env(safe-area-inset-bottom, 0px))`

### Inputs & Selects
- Background: `bg-gray-100 dark:bg-dark-700`
- Border: `border border-gray-200 dark:border-white/10 rounded-xl`
- Focus: `focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`
- Padding: `px-4 py-3` (standard), `pl-12` when a leading icon is present
- Selects use `rounded-lg` (not `rounded-xl`) and `cursor-pointer`
- Always remove default number input arrows via CSS

### Badges
```css
.badge-success { background: rgba(16,185,129,0.1); color: #10b981; }
.badge-danger  { background: rgba(239,68,68,0.1);  color: #ef4444; }
.badge-warning { background: rgba(245,158,11,0.1); color: #f59e0b; }
.badge-neutral { background: rgba(100,116,139,0.1);color: #94a3b8; }
/* Apply to inline elements: border-radius 6px, padding 2px 8px, font-size 0.75rem, font-weight 600 */
```

### Navigation
- Fixed top, `z-40`, height `h-14 sm:h-16`
- Glassmorphism: `bg-white/80 dark:bg-dark-900/80 backdrop-blur-lg`
- Bottom border: `border-b border-gray-200 dark:border-white/5`

### Tables (desktop) + Cards (mobile)
- Table: `hidden sm:block`, sticky header, `table-layout: fixed`, max-height 700px with thin scrollbar
- Cards: `sm:hidden`, `border-radius: 12px`, use CSS variables `--card-bg`, `--card-border`, `--card-hover`
- Row hover: `background: var(--row-hover)`

## 5. Dark Mode Implementation
- Strategy: toggle `.dark` class on `<html>`; persist to `localStorage('theme')`; default to `prefers-color-scheme`
- Anti-FOUC inline script must be the **first script** in `<head>`:
```html
<script>
  (function(){var t=localStorage.getItem('theme');
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark');})();
</script>
```
- Body: `bg-gray-50 dark:bg-dark-900 text-gray-900 dark:text-white transition-colors duration-300`
- Define CSS variables in both `:root` and `.dark` for anything Tailwind cannot reach (third-party popups, scrollbars, canvas-based components)

## 6. Mobile Patterns
- **Section jump bar**: `sm:hidden sticky top-14 z-30`, glassmorphism bg, pill links to page anchors
- **Scroll targets**: `scroll-margin-top: 105px` mobile (nav + jump bar), `64px` desktop
- **Horizontal scroll fade hint**: `mask-image: linear-gradient(to right, black 82%, transparent 100%)` at `max-width: 639px`
- **Safe area insets**: always apply `env(safe-area-inset-bottom, 0px)` to bottom-fixed elements and footer

## 7. Engineering Principles
- **No raw hex codes in HTML/JS**: use Tailwind tokens or CSS variables
- **No emojis** in UI copy or code
- **Mobile-first**: write base styles for mobile, use `sm:` / `lg:` to scale up
- **Dark mode on every element**: every component must have a `dark:` variant — never leave an element unthemed
- **Tables on desktop, cards on mobile**: never show a data table on mobile; always provide a card-based alternative
- **CSS variables for third-party components**: any library that renders outside the DOM (canvas, popups, overlays) cannot use Tailwind — define `--var` tokens in `:root` / `.dark` and use them
- **Entrance animation on dynamic sections**: use `fadeInUp` (opacity 0→1, translateY 20px→0, 0.5s ease-out) when a results/data section appears
