/**
 * Shadcn CSS Variables
 * 
 * These variables match the frontend shadcn theme configuration.
 * Import these into backend-generated HTML to maintain consistent styling.
 */

export const shadcnCSSVariables = `
  :root {
    /* Colors - using HSL values that match frontend */
    --color-background: 0 0% 100%;
    --color-foreground: 20 14.3% 4.1%;
    --color-card: 0 0% 100%;
    --color-card-foreground: 20 14.3% 4.1%;
    --color-popover: 0 0% 100%;
    --color-popover-foreground: 20 14.3% 4.1%;
    --color-primary: 24 9.8% 10%;
    --color-primary-foreground: 60 9.1% 97.8%;
    --color-secondary: 60 4.8% 95.9%;
    --color-secondary-foreground: 24 9.8% 10%;
    --color-muted: 60 4.8% 95.9%;
    --color-muted-foreground: 25 5.3% 44.7%;
    --color-accent: 60 4.8% 95.9%;
    --color-accent-foreground: 24 9.8% 10%;
    --color-destructive: 0 84.2% 60.2%;
    --color-destructive-foreground: 60 9.1% 97.8%;
    --color-border: 20 5.9% 90%;
    --color-input: 20 5.9% 90%;
    --color-ring: 20 14.3% 4.1%;
    
    /* Radius */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    
    /* Shadows - matching shadcn/ui */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  }
`

/**
 * Base styles that match shadcn/ui button component
 */
export const shadcnButtonStyles = `
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    border: none;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .btn:focus-visible {
    outline: 2px solid hsl(var(--color-ring));
    outline-offset: 2px;
  }

  .btn:disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  /* Button variants - matching shadcn/ui */
  .btn-primary {
    background-color: hsl(var(--color-primary));
    color: hsl(var(--color-primary-foreground));
    padding: 0.5rem 1rem;
  }

  .btn-primary:hover {
    background-color: hsl(var(--color-primary) / 0.9);
  }

  .btn-secondary {
    background-color: hsl(var(--color-secondary));
    color: hsl(var(--color-secondary-foreground));
    padding: 0.5rem 1rem;
  }

  .btn-secondary:hover {
    background-color: hsl(var(--color-secondary) / 0.8);
  }

  .btn-outline {
    border: 1px solid hsl(var(--color-border));
    background-color: transparent;
    color: hsl(var(--color-foreground));
    padding: 0.5rem 1rem;
  }

  .btn-outline:hover {
    background-color: hsl(var(--color-accent));
    color: hsl(var(--color-accent-foreground));
  }

  .btn-ghost {
    background-color: transparent;
    color: hsl(var(--color-foreground));
    padding: 0.5rem 1rem;
  }

  .btn-ghost:hover {
    background-color: hsl(var(--color-accent));
    color: hsl(var(--color-accent-foreground));
  }

  .btn-destructive {
    background-color: hsl(var(--color-destructive));
    color: hsl(var(--color-destructive-foreground));
    padding: 0.5rem 1rem;
  }

  .btn-destructive:hover {
    background-color: hsl(var(--color-destructive) / 0.9);
  }

  /* Size variants */
  .btn-sm {
    height: 2.25rem;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  .btn-md {
    height: 2.5rem;
    padding: 0.5rem 1rem;
  }

  .btn-lg {
    height: 2.75rem;
    padding: 0.5rem 2rem;
  }
`

/**
 * Card styles matching shadcn/ui
 */
export const shadcnCardStyles = `
  .card {
    border-radius: var(--radius-lg);
    border: 1px solid hsl(var(--color-border));
    background-color: hsl(var(--color-card));
    color: hsl(var(--color-card-foreground));
    box-shadow: var(--shadow-sm);
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1.5rem;
  }

  .card-title {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.025em;
  }

  .card-description {
    font-size: 0.875rem;
    color: hsl(var(--color-muted-foreground));
  }

  .card-content {
    padding: 1.5rem;
    padding-top: 0;
  }

  .card-footer {
    display: flex;
    align-items: center;
    padding: 1.5rem;
    padding-top: 0;
  }
`

/**
 * Base reset and typography
 */
export const shadcnBaseStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: transparent;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.2;
    color: hsl(var(--color-foreground));
  }

  p {
    line-height: 1.5;
    color: hsl(var(--color-foreground));
  }

  a {
    color: hsl(var(--color-primary));
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`

/**
 * Generate a complete <style> tag with all shadcn variables and utilities
 */
export function generateShadcnStyles(includeButtons = true, includeCards = false): string {
  let styles = shadcnCSSVariables + '\n' + shadcnBaseStyles

  if (includeButtons) {
    styles += '\n' + shadcnButtonStyles
  }

  if (includeCards) {
    styles += '\n' + shadcnCardStyles
  }

  return styles
}
