# UI Styling Guide for Backend-Generated HTML

## The Problem

When the backend (`qinhang`) generates UI resources (like buttons, forms, etc.) as HTML strings, these are rendered in **sandboxed iframes** in the frontend (`ccpiano`). The iframes are isolated from the frontend's React context, which means:

❌ **Cannot use shadcn React components directly** - Backend generates HTML strings, not React JSX  
❌ **No access to frontend CSS** - Iframes are isolated by the MCP-UI protocol  
❌ **Inconsistent styling** - Original implementation used hard-coded colors instead of theme variables

## The Solution

We've implemented a **CSS variable bridge** that allows backend-generated HTML to use the same design tokens as your shadcn/ui frontend.

### How It Works

```
Frontend (ccpiano)          Backend (qinhang)
┌─────────────────┐        ┌──────────────────────┐
│  shadcn theme   │        │  shadcn-variables.ts │
│  CSS variables  │  <───  │  (copies variables)  │
│  components.json│        │                      │
└─────────────────┘        └──────────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │  Generated HTML      │
                           │  with CSS classes    │
                           │  (btn, btn-primary)  │
                           └──────────────────────┘
```

### Key Files

1. **`qinhang/src/shared/ui-resources/shadcn-variables.ts`**
   - Contains CSS variables that match your shadcn theme
   - Provides button/card styles that mimic shadcn components
   - Export `generateShadcnStyles()` to inject into HTML

2. **`qinhang/src/shared/ui-resources/factory.ts`**
   - Updated to use `generateShadcnStyles()`
   - Uses shadcn-compatible class names (`btn`, `btn-primary`, etc.)

## Usage

### Creating New UI Resources with Shadcn Styling

```typescript
import { generateShadcnStyles } from './shadcn-variables.js'

createMyNewUI(options: UIResourceOptions = {}) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* Inject shadcn variables and button styles */
        ${generateShadcnStyles(true, false)}
        
        /* Your custom styles (use HSL variables) */
        .my-custom-container {
          background: hsl(var(--color-card));
          border: 1px solid hsl(var(--color-border));
          padding: 1rem;
          border-radius: var(--radius-lg);
        }
      </style>
    </head>
    <body>
      <!-- Use shadcn button classes -->
      <button class="btn btn-primary btn-md" onclick="handleClick()">
        Click Me
      </button>
      
      <!-- Or use custom classes with shadcn variables -->
      <div class="my-custom-container">
        <h3 style="color: hsl(var(--color-foreground))">Hello</h3>
      </div>
    </body>
    </html>
  `
  
  return createUIResource({
    uri: 'ui://my-new-ui',
    content: { type: 'rawHtml', htmlString: htmlContent },
    encoding: 'text'
  })
}
```

### Available Shadcn Classes

**Buttons:**
- `.btn` - Base button class
- `.btn-primary` - Primary button (uses `--color-primary`)
- `.btn-secondary` - Secondary button
- `.btn-outline` - Outline button
- `.btn-ghost` - Ghost button
- `.btn-destructive` - Destructive/danger button

**Button Sizes:**
- `.btn-sm` - Small
- `.btn-md` - Medium (default)
- `.btn-lg` - Large

**Cards:**
- `.card` - Card container
- `.card-header` - Card header
- `.card-title` - Card title
- `.card-description` - Card description
- `.card-content` - Card content area
- `.card-footer` - Card footer

### Available CSS Variables

**Colors (use with `hsl()`):**
```css
--color-background
--color-foreground
--color-primary
--color-primary-foreground
--color-secondary
--color-secondary-foreground
--color-muted
--color-muted-foreground
--color-accent
--color-accent-foreground
--color-destructive
--color-destructive-foreground
--color-border
--color-input
--color-ring
```

**Radius:**
```css
--radius-sm    /* 0.375rem */
--radius-md    /* 0.5rem */
--radius-lg    /* 0.75rem */
--radius-xl    /* 1rem */
```

**Shadows:**
```css
--shadow-sm
--shadow-md
--shadow-lg
--shadow-xl
```

## Examples

### Primary Button
```html
<button class="btn btn-primary btn-md" onclick="doSomething()">
  Click Me
</button>
```

### Secondary Button
```html
<button class="btn btn-secondary btn-lg">
  Secondary Action
</button>
```

### Custom Styled Element
```html
<div style="
  background: hsl(var(--color-card));
  border: 1px solid hsl(var(--color-border));
  padding: 1rem;
  border-radius: var(--radius-lg);
  color: hsl(var(--color-foreground));
">
  Custom styled content
</div>
```

### Card Component
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Title</h3>
    <p class="card-description">Description text</p>
  </div>
  <div class="card-content">
    Card content goes here
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

## Keeping Styles in Sync

When you update your frontend shadcn theme in `ccpiano`:

1. **Update `ccpiano/src/index.css`** (or your theme files)
2. **Update `qinhang/src/shared/ui-resources/shadcn-variables.ts`** to match
3. Rebuild backend: `cd qinhang && npm run build`

### Automation Idea (Future Enhancement)

Consider creating a script that:
- Reads CSS variables from `ccpiano/src/index.css`
- Automatically updates `shadcn-variables.ts`
- Runs as part of build process

## Why Not Use Actual shadcn Components?

**You cannot use shadcn React components directly because:**

1. **Different execution contexts** - Backend generates HTML strings, frontend renders React
2. **Iframe isolation** - MCP-UI renders content in sandboxed iframes
3. **No shared React context** - Iframes can't access parent's React tree
4. **Build-time vs runtime** - Backend generates static HTML, frontend needs compiled React

**This CSS variable approach provides:**
- ✅ Consistent visual appearance
- ✅ Maintainable design system
- ✅ Works within MCP-UI constraints
- ✅ Matches shadcn aesthetics

## Alternative Approaches (Not Recommended)

### 1. External URLs
Instead of `rawHtml`, serve components from a separate frontend:

```typescript
createUIResource({
  uri: 'ui://contact',
  content: {
    type: 'externalUrl',
    iframeUrl: 'https://your-frontend.com/widgets/contact'
  }
})
```

**Pros:** Can use full React/shadcn stack  
**Cons:** Requires separate hosting, more complexity, network dependency

### 2. Remote DOM (Advanced)
Use MCP-UI's Remote DOM feature with custom component library:

```typescript
content: {
  type: 'remoteDom',
  script: '/* Remote DOM script */',
  framework: 'react'
}
```

**Pros:** More dynamic, can use components  
**Cons:** Complex setup, limited component support, experimental

### 3. Inline All Styles
Copy shadcn component CSS directly:

**Pros:** No variables needed  
**Cons:** Massive HTML bloat, hard to maintain

## Recommended Workflow

For new UI resources:

1. **Design in shadcn first** - Create in `ccpiano` to see how it should look
2. **Extract styles** - Note which components/variables you're using
3. **Recreate in HTML** - Use `shadcn-variables.ts` utilities in backend
4. **Test in chat** - Verify in ChatWidget that styling matches

## Troubleshooting

**Buttons don't look right?**
- Check you're using `class="btn btn-primary"` not just `class="primary"`
- Verify `generateShadcnStyles(true, false)` is in your `<style>` tag

**Colors don't match?**
- Ensure you're using `hsl(var(--color-name))` not just hex colors
- Check `shadcn-variables.ts` matches your theme in `ccpiano`

**Layout issues?**
- Iframes have default padding/margin - reset with base styles
- Check `ui-preferred-frame-size` metadata in your `createUIResource()` call

## Reference

- [MCP-UI Documentation](https://mcpui.dev)
- [shadcn/ui](https://ui.shadcn.com)
- Frontend theme: `ccpiano/src/themes/`
- Backend factory: `qinhang/src/shared/ui-resources/factory.ts`
