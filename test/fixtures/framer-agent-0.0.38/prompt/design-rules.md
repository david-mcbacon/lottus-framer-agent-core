# Design Rules

- Every design should feel detailed and intentionally crafted for its context, not templated or overly simplistic
- Create clear hierarchy through placement, spacing, contrast, scale, or weight, also for minimal designs
- Pick a distinct creative direction and stick to it across multiple sections and layouts
- Reuse consistent section widths or max-widths across the page. Do not pick arbitrary widths per section
- Keep body and prose text aligned to the same content width as the page's headings and surrounding content; its left and right edges should line up with the title and other sections
- When recreating or matching a reference image, maximum visual and layout fidelity to that reference takes precedence over generic design heuristics
- When recreating a layout from a reference image, match its style, spacing, and proportions precisely — do not loosely interpret
- When recreating from a reference image, recreate every visible line, border, stroke, outline, divider, separator, or edge from the reference

## Typography

- Use smart apostrophe (’) and smart quotes (“ ”) in canvas text, not straight ' or " "
- Choose fonts that fit the design's personality. Do not default to generic choices when a stronger fit is needed
- When recreating from a reference image, infer each text block's anchor from its parent bounds and preserve it (e.g. hero title on the section centerline stays centered even if secondary controls are pinned to the bottom)
- When heroes or footers have edge-to-edge typography, use `fontSize="auto-fit(100%)"` — do not set `width="auto"`, set `width="100%"` and let `fontSize` auto-fit scale the text
- Use `fontSize="auto-fit(100%)"` only for static text. If text must be bound to a string variable or component control, use a fixed px/rem `fontSize` instead. For rich text variables, do not use root `fontSize`; use per-tag presets such as `stylePresetHeading1` and `stylePresetParagraph`
- When using `fontSize="auto-fit(100%)"`, use `lineHeight="1"`
- For paragraphs and taglines, use `textWrapBalance`
- Avoid too many unique font sizes for a design, less is more
- Use consistent font weights for similarly sized text
- Use tabular numbers (`openTypeFontFeatures.tnum="on"`) for data, stats, and pricing
- Avoid widows and orphans — tidy up line breaks and rag
- `rootFontSize` on breakpoints controls the base size for `fontSize` rem units (default: 16px). Adjust per breakpoint for responsive type scaling.

## Logos

For logo strings and logo clouds, always use the Logos Vector Set

## Layout

- Use a Stack `layout="stack"` on the page breakpoints
- Set `height="auto"` on the page breakpoints
- Before changing an existing layout, preserve what's already working: only restructure when the current container cannot meet the requested visual behavior
- Don't apply structural changes just to match a preferred pattern; if the current layout already solves the request, keep it as-is
- When switching any element to fixed positioning, keep its visible placement and size stable

## Spacing

- Reuse spacing values for gap and padding. Do not invent new values without a clear reason
- When recreating from an image, preserve spacing proportions (outer margins : section padding : internal gaps) instead of equalizing everything to default spacing
- Match the reference spacing rhythm across sections — keep large/medium/small spacing contrasts in the same relative order and magnitude
- Sections should have consistent vertical `padding` throughout the page

## Colors

- Commit to a dominant color with sharp accents — don't spread colors evenly across the palette
- Designs can either:
- 1. Keep most elements restrained and use accent color only on key elements like buttons, highlights, or calls to action
- 2. Use a dominant color base, with monochromatic layering on top to keep the design consistent and cohesive
- Avoid "color slop": Don't invent unpleasant colors like "gold/warm amber" or "purple", unless asked.

## Surfaces

Differentiate layered surfaces with clear changes in background, border, or elevation so depth feels intentional

## Components

- Keep `radius` consistent — cards, buttons, and inputs share the same scale, and nested elements use a smaller `radius` so radii are concentric
- Navigation should be simple and immediately recognizable as navigation
- Interactive elements (buttons, links, inputs, clickable cards) need appropriate internal `padding` — never leave content flush to edges
