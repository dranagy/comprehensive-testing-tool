---
name: Testing Tool Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  data-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  container-max: 1440px
  gutter: 1.5rem
---

## Brand & Style
This design system is built on the principles of **Corporate Modernism** with a heavy lean toward **Minimalism**. The objective is to facilitate high-velocity technical workflows by reducing cognitive load. The aesthetic is "Engineering-Grade"—precise, reliable, and utilitarian, yet refined through generous white space and a rigorous mathematical approach to alignment. 

The target audience consists of QA engineers and developers who require a tool that feels like a professional instrument. The UI evokes a sense of "controlled complexity," where dense information is organized into digestible, high-contrast modules.

## Colors
The palette is anchored by the primary blue, used strategically for core actions and active states. To ensure the dashboard doesn't become overwhelming, a neutral Slate secondary palette is used for non-critical interface elements. 

Status indicators utilize highly saturated Success Green and Danger Red to ensure critical test results are immediately identifiable. Backgrounds use a cool-toned off-white to reduce glare during long sessions, while cards and surface elements remain pure white to provide maximum contrast for data points.

## Typography
The typographic system uses a dual-font approach. **Manrope** is used for headlines and dashboard titles to provide a modern, refined character. **Inter** is the workhorse font for all body text, data tables, and labels due to its exceptional legibility at small sizes and its "systematic" feel.

Data tables should prioritize the `data-tabular` style, which emphasizes clarity. All labels for status indicators or table headers use `label-caps` to distinguish meta-information from the actual data content.

## Layout & Spacing
The layout follows a **Fixed Grid** model for the main content area to ensure consistent data visualization across different screen sizes. A 12-column grid is utilized with a 1.5rem (24px) gutter.

The spacing rhythm is based on a 4px baseline, ensuring that all padding and margins are multiples of 4. For dashboard widgets, use `xl` spacing for external margins and `md` spacing for internal content groupings. This creates a clear hierarchy where the relationship between data points is defined by their proximity.

## Elevation & Depth
This design system utilizes **Tonal Layers** combined with **Ambient Shadows** to create a subtle sense of hierarchy. The primary dashboard background is the lowest level. Content containers (cards) are elevated slightly using a very soft, diffused shadow (0px 4px 6px rgba(0, 0, 0, 0.05)).

Interactive elements like dropdowns or modals use a higher elevation with a more pronounced shadow to indicate they are "floating" above the workspace. Borders are used sparingly; instead, slight shifts in background color (e.g., a light gray header for a white card) define internal sections of a component.

## Shapes
A **Soft** (Level 1) roundedness is applied throughout the system. This provides a professional appearance that is more approachable than sharp corners but remains more "serious" than highly rounded UI styles. 

- Standard components (buttons, inputs): 0.25rem (4px)
- Containers (cards, modals): 0.5rem (8px)
- Status chips: 1rem (16px) or fully pill-shaped to contrast against the rectangular nature of data tables.

## Components

### Buttons
Primary buttons use the solid Primary Blue with white text. Secondary buttons use a light slate ghost-style border. Ghost buttons are reserved for tertiary actions to keep the focus on the primary flow.

### Data Tables
Tables are the heart of this design system. They must use "Zebra Striping" (light slate vs. white) only on hover to maintain a clean look. Row height should be a comfortable 48px. Headers must be sticky and use the `label-caps` typography style with a subtle bottom border.

### Status Indicators
Status indicators are styled as "Pills." They use a light background tint of the status color (Success Green, Danger Red, or Warning Orange) with high-contrast bold text of the same color. For example, a "Passed" status uses a 10% opacity Green background with 100% opacity Green text.

### Input Fields
Inputs use a 1px border (#E2E8F0) that transitions to Primary Blue on focus. Error states are indicated by a Danger Red border and a small supporting icon.

### Cards & Widgets
Dashboard widgets must have a consistent padding of `lg`. Each widget should have a clear title in `headline-md` and an optional "More" action icon in the top right corner.