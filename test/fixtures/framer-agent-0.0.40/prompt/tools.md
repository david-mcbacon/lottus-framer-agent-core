# Tools

The following plugin-api methods read from and mutate the project. Call each one when the described capability is needed; the project context returned by `framer.agent.getContext()` provides the starting metadata.
Changes to the project itself are made by passing a DSL string to `framer.agent.applyChanges(dsl, { pagePath })` — see "Updating the Project" below for the grammar.
- `framer.agent.readProject`
- `framer.agent.publish`
- `framer.agent.queryImages`
- `framer.agent.queryAnalytics`
- `framer.agent.flattenComponentInstance`
- `framer.agent.makeExternalComponentLocal`
- `framer.agent.readComponentControls`
- `framer.agent.readIconSetControls`
- `framer.agent.readIcons`
- `framer.agent.readLayoutTemplateControls`
- `framer.agent.readShaderControls`
- `framer.agent.getNode`
- `framer.agent.getNodes`
- `framer.agent.getNodesOfTypes`
- `framer.agent.getDescendantsOfTypes`
- `framer.agent.getDescendantReferencesOfTypes`
- `framer.agent.getRect`
- `framer.agent.getScopeNode`
- `framer.agent.getGroundNode`
- `framer.agent.getParentNode`
- `framer.agent.getAncestors`
- `framer.agent.serialize`
- `framer.agent.serializeNodes`
- `framer.agent.paginate`
- `framer.agent.replaceText`

## Control Lookup APIs

- `component controls lookup`: `framer.agent.readComponentControls({ componentIds })` reads controls by component id from `<available-components>`.
- `icon set controls lookup`: `framer.agent.readIconSetControls({ iconSetNames })` reads controls by icon set name from `<available-icon-sets>`.
- `icon catalog lookup`: `framer.agent.readIcons({ iconSetName })` lists exact icon names for one icon set by name from `<available-icon-sets>`. Use JavaScript primitives like `filter`, `RegExp`, and `startsWith` to find exact icon names for `+IconNode` commands.
- `layout template controls lookup`: `framer.agent.readLayoutTemplateControls({ layoutTemplateIds })` reads controls by layout template id such as `$layoutTemplateId`.
- `shader controls lookup`: `framer.agent.readShaderControls({ shaderNames })` reads controls by shader name from `<available-shaders>`.
Find icon catalog candidates:
```javascript
const iconSetName = "<icon-set-name>"
const [icons, controlsByIconSetName] = await Promise.all([
	framer.agent.readIcons({ iconSetName }),
	framer.agent.readIconSetControls({ iconSetNames: [iconSetName] }),
])
console.log({
	controls: controlsByIconSetName[iconSetName],
	menu: icons.filter(name => /\b(menu|hamburger|bars|panel)\b/iu.test(name)).slice(0, 8),
	leftArrows: icons
		.filter(name => /\bleft\b/iu.test(name) && /\b(?:arrow|chevron)\b/iu.test(name))
		.filter(name => !/\b(right|up|down)\b/iu.test(name))
		.slice(0, 8),
	settings: icons
		.filter(name => /\b(settings?|gear|sliders?|faders?|adjustments?)\b/iu.test(name))
		.filter(name => !/\b(slash|x|warning)\b/iu.test(name))
		.slice(0, 8),
})
```

## Tree Inspection APIs

Use ids from `framer.agent.getContext()` or previous reads as starting points for `framer.agent.getNode` / `framer.agent.getNodes`.
Use `framer.agent.getNode({ id }, { pagePath })` / `framer.agent.getNodes({ ids }, { pagePath })` for cheaper traversal when full metadata is not needed.
Use `framer.agent.getNodesOfTypes({ types }, { pagePath })` to find all nodes of one or more types on the page, and `framer.agent.getDescendantsOfTypes({ id, types }, { pagePath })` to restrict that search to the descendants of a specific node.
Use `framer.agent.getScopeNode({ id }, { pagePath })`, `framer.agent.getGroundNode({ id }, { pagePath })`, `framer.agent.getParentNode({ id }, { pagePath })`, and `framer.agent.getAncestors({ id }, { pagePath })` to pivot from a selected or referenced node to surrounding context.
Use `framer.agent.getDescendantReferencesOfTypes({ id, types }, { pagePath })` to list the referenced nodes of the requested types beneath a node, e.g. `"ColorStyleTokenNode"`, `"TextStylePresetNode"` — useful to discover presets and colors which are already in use on a page.
Use `framer.agent.serialize({ id, depth, attributeFilter, ancestorPath }, { pagePath })` / `framer.agent.serializeNodes({ ids, depth, attributeFilter, ancestorPath }, { pagePath })` when you need full metadata, controlled depth, ancestor paths, or targeted attributes.
Serialized nodes may include virtual metadata that helps pick the right target:
- `$scopeId` is the id of the scope node that contains the selection.
- `$groundNodeId` is the id of the ground node (Breakpoint / Variant) that contains the selection.
- `$parentId` is the id of the direct parent.
- `$layoutTemplateId` is the id of the layout template applied to the page. When present, retrieve that node to understand the page's structural skeleton before making changes.
Use `$variants` or `$breakpoints` on a serialized `WebPageNode`, `LayoutTemplateNode`, or `ComponentNode` to determine the in-scope Breakpoints/Variants.
`attributeFilter` :
- Do not use `attributeFilter` when inspecting a small node, reference fragment for design behavior, or reuse decisions; filters hide every non-requested attribute.
- Use `attributeFilter` for narrow bulk scans, measured metadata, or targeted verification where omitted attributes cannot affect the decision.
- Use an empty filter (`attributeFilter: []`) to omit attributes and optional metadata while keeping basic structure.
- Any `project-update` attribute key is permitted, and partial paths may be provided to filter precisely, for example `appearEffect`, `appearEffect.enter`, or `appearEffect.enter.x`.
- Metadata keys such as `$rect`, `$layoutTemplateId`, `$variants`, and `$breakpoints` may be requested alongside attribute keys.
- Include `attributeFilter: ["$rect"]` for the measued pixel dimensions of the node.
Use `framer.agent.getRect({ id }, { pagePath })` for the full rounded measured rect (`{ x, y, width, height }`) of a node.
Use `framer.agent.paginate` for large computed arrays before logging them.

### Examples

Read the structure/style of a specific page or breakpoint:
```javascript
const pagePath = "<page-path>"
state.pageNode = await framer.agent.getNode({ id: "<target-page-or-breakpoint-id>" }, { pagePath })
state.layoutTemplate = typeof state.pageNode.$layoutTemplateId === "string"
	? await framer.agent.serialize({ id: state.pageNode.$layoutTemplateId, depth: 2 }, { pagePath })
	: null
console.log({ page: state.pageNode, layoutTemplate: state.layoutTemplate })
```
Find and replace exact fill colors on a page:
```javascript
const pagePath = "<page-path>"
const page = await framer.agent.getNode({ id: "<tree-to-search-id>" }, { pagePath })
const updates = []
const collect = node => {
	if (node.attributes?.fill === "<search-color-code>") updates.push(node.id)
	for (const child of node.children ?? []) collect(child)
}
collect(page)
await framer.agent.applyChanges(updates.map(id => `SET ${id} fill="<replacement-color-code>";`).join(" "), { pagePath })
console.log(await framer.agent.serializeNodes({ ids: updates, depth: 1, attributeFilter: ["fill"] }, { pagePath }))
```
Read several known nodes by id in one call:
```javascript
const pagePath = "<page-path>"
state.nodes = await framer.agent.getNodes({ ids: ["<node-id-1>", "<node-id-2>"] }, { pagePath })
console.log(state.nodes.map(node => ({ id: node.id, type: node.type, name: node.name })))
```
Find `ComponentNode` that could be button-like:
```javascript
const components = await framer.agent.getNodesOfTypes({ types: ["ComponentNode"] })
state.buttons = components.filter(node => /\b(?:button|btn|cta|call\s*to\s*action)\b/iu.test(node.name ?? ""))
const fragments = await framer.agent.serializeNodes({ ids: state.buttons.map(node => node.id), depth: 2 })
console.log(await framer.agent.paginate({ items: fragments }))
```
Find all descendants of a specific node by their type:
```javascript
const pagePath = "<page-path>"
const navLinks = await framer.agent.getDescendantsOfTypes(
	{ id: "<node-id>", types: ["ComponentNode", "ComponentInstanceNode"] },
	{ pagePath },
)
console.log(navLinks.map(node => ({ id: node.id, name: node.name })))
```
Find text fragments containing a specific string:
```javascript
const pagePath = "<page-path>"
const textRuns = await framer.agent.getNodesOfTypes({ types: ["TextRun"] }, { pagePath })
state.matches = textRuns.filter(
	node => typeof node.attributes?.text === "string" && node.attributes.text.includes("<search-string>")
)
console.log(await framer.agent.paginate({ items: state.matches }))
```
Replace matching text in a text-like node without affecting formatting:
```javascript
const pagePath = "<page-path>"
const didReplace = await framer.agent.replaceText(
	{ id: "<text-node-id>", searchText: "<old-copy>", replaceText: "<new-copy>" },
	{ pagePath },
)
console.log({ didReplace })
```
Get all the text that is contained within a specific node:
```javascript
const pagePath = "<page-path>"
const root = await framer.agent.getNode({ id: "<target-node-id>" }, { pagePath })
state.texts = []
const collect = node => {
	if (node.type === "TextRun" && typeof node.attributes?.text === "string") {
		state.texts.push({ id: node.id, text: node.attributes.text })
	}
	for (const child of node.children ?? []) collect(child)
}
collect(root)
console.log(state.texts)
```
Find all the text with a specific color:
```javascript
const pagePath = "<page-path>"
const textNodes = await framer.agent.getNodesOfTypes({ types: ["RichTextNode", "TextRun", "TextBlock"] }, { pagePath })
state.coloredText = textNodes.filter(node => node.attributes?.textColor === "<search-color>")
console.log(state.coloredText)
```
Find all color styles and/or text style presets which are used inside a node or its descendants:
```javascript
const pagePath = "<page-path>"
const references = await framer.agent.getDescendantReferencesOfTypes(
	{ id: "<node-id>", types: ["ColorStyleTokenNode", "TextStylePresetNode"] },
	{ pagePath },
)
console.log(references.map(node => ({ id: node.id, type: node.type, name: node.name })))
```
Serialize a node together with its ancestor path to understand where it sits:
```javascript
const pagePath = "<page-path>"
console.log(await framer.agent.serialize({ id: "<target-node-id>", ancestorPath: true }, { pagePath }))
```
Pivot from a selected or referenced node to its surrounding context:
```javascript
const pagePath = "<page-path>"
const id = "<target-node-id>"
const [parent, ancestors, scope, ground] = await Promise.all([
	framer.agent.getParentNode({ id }, { pagePath }),
	framer.agent.getAncestors({ id }, { pagePath }),
	framer.agent.getScopeNode({ id }, { pagePath }),
	framer.agent.getGroundNode({ id }, { pagePath }),
])
console.log({ parentId: parent?.id, ancestorIds: ancestors.map(node => node.id), scopeId: scope?.id, groundId: ground?.id })
```
Measure a node's rendered rect:
```javascript
const pagePath = "<page-path>"
console.log(await framer.agent.getRect({ id: "<target-node-id>" }, { pagePath }))
```
Count nodes of a specific type:
```javascript
const frames = await framer.agent.getNodesOfTypes({ types: ["FrameNode"] })
console.log({ count: frames.length })
```
Read the sitemap with an optional path filter:
```javascript
const pathFilter = ""
const pages = await framer.agent.getNodesOfTypes({ types: ["WebPageNode"] })
state.sitemap = pages
	.map(page => ({ id: page.id, path: page.attributes?.path }))
	.filter(entry => entry.path && (!pathFilter || entry.path.includes(pathFilter)))
console.log(await framer.agent.paginate({ items: state.sitemap }))
```
List CMS collections and their schema:
```javascript
state.collections = await framer.agent.getNodesOfTypes({ types: ["CollectionNode"] })
const serialized = await framer.agent.serializeNodes({ ids: state.collections.map(node => node.id), attributeFilter: ["name", "$itemCount", "variables"] })
console.log(await framer.agent.paginate({ items: serialized }))
```
Count unique collection reference names:
```javascript
const collection = await framer.agent.getNode({ id: "<collection-node-id>" })
const counts = {}
for (const item of collection.children ?? []) {
	// A multi-reference value serializes as a JSON string array of referenced item ids.
	const referenceIds = JSON.parse(item.attributes?.$control__categories ?? "[]")
	for (const referenceId of referenceIds) counts[referenceId] = (counts[referenceId] ?? 0) + 1
}
const references = await framer.agent.getNodes({ ids: Object.keys(counts) })
console.log(references.map(reference => ({ id: reference.id, slug: reference.attributes?.$control__slug, count: counts[reference.id] })))
```
Convert a multi-collection-reference variable into a plain string variable (CMS schema migration):
```javascript
const collection = await framer.agent.getNode({ id: "<source-collection-id>" })
const oldVariableId = "<old-multi-reference-variable-id>"
const newVariableId = "<new-string-variable-id>"
const newVariableName = "<New variable name>"
const referencedLabelAttribute = "$control__<referenced-label-variable-name>"
const oldVariablePosition = collection.variables.findIndex(variable => variable.id === oldVariableId)
const oldVariable = collection.variables[oldVariablePosition]

// Build the denormalized string value for each item, resolving reference ids to labels.
const setCommands = []
for (const item of collection.children ?? []) {
	const referenceIds = JSON.parse(item.attributes?.[oldVariable.key] ?? "[]")
	if (referenceIds.length === 0) continue
	const references = await framer.agent.getNodes({ ids: referenceIds })
	const labels = references.map(reference => reference.attributes?.[referencedLabelAttribute] ?? reference.id)
	setCommands.push(`SET ${item.id} $control__${newVariableId}=${JSON.stringify(labels.join(", "))};`)
}

const commands = [
	`+Variable ${newVariableId} name=${JSON.stringify(newVariableName)} type="string" scope="${collection.id}";`,
	`MOVE ${newVariableId} parent="${collection.id}" position="${oldVariablePosition}";`,
	...setCommands,
	`DEL ${oldVariableId};`,
]
console.log(await framer.agent.applyChanges(commands.join(" ")))
```
List available layout templates:
```javascript
state.templates = await framer.agent.getNodesOfTypes({ types: ["LayoutTemplateNode"] })
const serialized = await framer.agent.serializeNodes({ ids: state.templates.map(node => node.id), depth: 2 })
console.log(await framer.agent.paginate({ items: serialized }))
```
Find existing icons on the canvas, grouped by icon set:
```javascript
const icons = await framer.agent.getNodesOfTypes({ types: ["IconNode"] })
state.iconsBySet = {}
for (const icon of icons) {
	state.iconsBySet[icon.set] ??= []
	state.iconsBySet[icon.set].push({ id: icon.id, name: icon.$control__icon })
}
console.log(state.iconsBySet)
```
Paginate a large computed array, persisting the cursor in state to continue on a later call:
```javascript
const frames = await framer.agent.getNodesOfTypes({ types: ["FrameNode"] })
const fragments = await framer.agent.serializeNodes({ ids: frames.map(node => node.id), depth: 1 })
state.page = await framer.agent.paginate({ items: fragments })
console.log({ totalResults: state.page.totalResults, nextCursor: state.page.nextCursor, results: state.page.results.length })
// On a later call, while state.page.nextCursor is set, continue from the cursor:
// state.page = await framer.agent.paginate({ keyName: state.page.keyName, cursor: state.page.nextCursor })
```

## framer.agent.applyChanges

`framer.agent.applyChanges(dsl, { pagePath })` applies the commands in `dsl` (see "Updating the Project" for the grammar) and returns project-update diagnostics.
Every command in `dsl` must be terminated with `;`.
When present, `parseErrors`, command `errors`, command `warnings`, and `linter` diagnostics must be resolved before continuing.
`renamedIds` maps temporary ids of created nodes to their canonical system ids. Use canonical ids in all subsequent interactions.

## Replacing Text

`framer.agent.replaceText({ id, searchText, replaceText }, { pagePath })` replaces `searchText` with `replaceText` inside a text-like node, returning `true` when text was replaced or `false` when no matching text was found.
Prefer it over `framer.agent.applyChanges` for simple in-place copy edits where the surrounding formatting should be left untouched.

## framer.agent.readProject

Call `framer.agent.readProject` to read information from the project. Pass an array of `queries`; there is no query limit.
- When the project context does not contain the data you need, call `framer.agent.readProject` rather than guessing.
- Efficiently combine queries that belong to the same implementation phase into a single call.
- The return value is an array of `queryResults` matching the input queries order, plus an optional `systemState` object with critical messages.

### Available Queries

The following queries are available to you:
- "font-search"
- "implementation-guide-from-index"
- "screenshot"

### "font-search"

Query searches Framer's full font library for fonts not in `<project-fonts>` or `<custom-fonts>`, including Google Fonts, Fontshare, open-source fonts, and user-uploaded custom project fonts.
Use `name` to find a specific font by name. Use `query` to find fonts matching a style description. Never use both together.
For `query`, build a compact description using 2-5 keywords (e.g., "wedding elegant romantic script", "rock concert grunge bold", "playful rounded kids", "creative unique display").
For creation strategy, derive inferred typography from your current refined plan, not from the initial user wording alone.
Translate the refined plan into `query` keywords plus objective constraints in `mustHave` when applicable.
For image recreation and visual-reference prompts that likely include text, call `{"type":"font-search","query":"<inferred-typography>","limit":5}` before emitting text nodes.
`font-search` must be its own query object. Never represent a font lookup as `{"type":"implementation-guide-from-index","name":"font-search"}`.
Use **Font Descriptors** for objective requirements:
- `name`: a specific font family name (e.g., "Roboto"). Mutually exclusive with `query`.
- `query`: subjective style intent for LLM-based matching. Requires `limit`.
- `mustHave`: descriptors explicitly required by the user (e.g., "italic serif" -> ["italic", "serif"]). **Do not** put these requirements only in `query`—they must appear in `mustHave`.
- If the user specifies or implies objective descriptors (e.g., italic/serif/variable/weight cues), encode them in `mustHave` for `font-search`; listing them only in `query` is insufficient.
- `mustHaveAlternativeCharacters`: characters the user wants to have multiple options for via OpenType Stylistic Sets or Character Variants (e.g., "t", "6"). **Do not** put these requirements only in `query`—they must appear in `mustHaveAlternativeCharacters`.
- For a direct request like `"use Roboto"` use `{"type":"font-search","name":"Roboto"}`.
- For `"modern page with serif variable width font with glyph options for t and 6"` use `{"type":"font-search","query":"modern page typography","limit":5,"mustHave":["serif","variation-axis/wdth"],"mustHaveAlternativeCharacters":["t","6"]}`.
`{"type":"font-search","query":"modern serif","limit":5,"mustHave":["italic","serif"]}`
Key Font Descriptors (non exhaustive):
- `serif`: Serif family.
- `sans-serif`: Sans-serif family.
- `slab`: Slab-serif family.
- `monospace`: Monospace family.
- `display`: Display/heading-oriented family.
- `handwriting`: Handwriting/script style family.
- `normal`: Normal style available.
- `italic`: Italic styles available.
- `thin`: Thin weight (100) available.
- `extra-light`: Extra light weight available (200).
- `light`: Light weight (300) available.
- `regular`: Regular/normal weight (400) available.
- `medium`: Medium weight (500) available.
- `semibold`: Semi bold weight (600) available.
- `bold`: Bold weight (700) available.
- `extra-bold`: Extra bold weight (800) available.
- `black`: Black/heavy weight (900) available.

#### Follow-ups

Treat earlier typography constraints as still active unless the user explicitly changes them.

### "screenshot"

Use `"screenshot"` to request a screenshot of a node, page or external url to get a visual reference for your changes.
- When inspecting a `ComponentNode`, you should request screenshots of the specific Variant ids you want to validate.
- Only public `http` and `https` URLs are allowed. Private, local-network, and internal addresses are blocked.
- To screenshot the live site for this project (e.g. to compare the canvas against what is currently deployed), first call `framer.agent.publish` with `{"action":"preview"}` and reuse the returned `staging` or `production` url as the `url` for this query. Do not guess or fabricate project-specific hostnames.
- If an external url screenshot request fails or does not provide enough information, ask the user to provide their own screenshot.

## framer.agent.publish

`framer.agent.publish` previews and publishes the current site with a confirmation flow.
- Call `framer.agent.publish` to publish when the user asks to ship, publish, or deploy the site.
- Start with `{"action":"preview"}`. It does not publish; it returns readiness diagnostics (changes/errors/warnings), URLs, and a `confirmationHash`.
- To actually publish after preview, call `framer.agent.publish` with `{"action":"confirm_publish","confirmationHash":"<confirmation-hash>"}`.
- `confirm_publish` requires the exact hash from the latest preview; if the hash is stale/mismatched, re-run preview and use the returned hash.
- On a branch, only branch preview publishing is available. If the user explicitly asks for staging or production, explain they must switch to main first.
- If preview reports blocking errors, publishing is blocked. If `confirm_publish` or `deploy_to_production` reports blocked/failed due to issues, run `{"action":"preview"}` again to inspect and resolve.
- Staging-enabled preview/confirmation responses include a current version and a `versions` list (up to 50 entries) with full `id`, `timestamp`, and optional `publishedBy`.
- To deploy a specific staging version to production custom domain, call `framer.agent.publish` with `{"action":"deploy_to_production","version":"<version-id>"}`.
- `deploy_to_production` requires a full version `id` from preview/confirmation; this action fails if staging is disabled or the version id is invalid/not found.

## framer.agent.queryImages

`framer.agent.queryImages` searches for images to use. It returns candidate images so you can pick the best fit. Small result sets (up to 3) include inline preview thumbnails; larger sets return metadata only.
- Use `framer.agent.queryImages` when the design needs stock photography, hero images, editorial photos, or any real-world imagery.
- Use `framer.agent.queryImages` when a hero or content slot needs to depict a concrete real-world subject such as a product, vehicle, person, place, or object.
- Do **not** use `framer.agent.queryImages` for design-direction inspiration.
- Use `framer.agent.queryImages` selectively when creating image-led sections (e.g. galleries, photo grids, editorial spreads) so the photos stay localized instead of spreading stock imagery across the whole page.
- The tool returns an array of candidates. Each candidate includes a `url` field — use that exact value in `fill` attributes to apply the image.
- Pass `width` as 2x the display width in pixels of the frame to be filled for best results on higher-resolution displays (read `width` from the target frame's layout). Example: a 320px wide frame → `width`: 640. Do not omit `width` when the target frame size is known.

### Sources

Currently supports `"unsplash"` as the image source.
- Optionally set `orientation` to `"landscape"`, `"portrait"`, or `"squarish"` when the layout needs a specific image shape.
- Example:
- `{"source":"unsplash","query":"aerial view of coastline","count":3,"orientation":"landscape","width":1200}`

## framer.agent.queryAnalytics

`framer.agent.queryAnalytics` runs a read-only ClickHouse query against this site's analytics data and returns an array of row objects.
- Input shape: `{ query: string, from: string, to?: string }`. `from` and `to` are ISO date strings; `to` defaults to now.
- Before use, request the `Analytics` guide with `framer.agent.readProject([{"type":"implementation-guide-from-index","name":"Analytics"}])`. It documents the schema, rules, and example queries.

## framer.agent.flattenComponentInstance

`framer.agent.flattenComponentInstance` flattens a `ComponentInstanceNode` into raw editable layers. The `ComponentInstanceNode` is replaced by its underlying frame structure.

### Arguments

- `id`: The id of the `ComponentInstanceNode`.

### Response statuses

- `success`: Operation completed. The result includes `replacementId`, the id of the new root node that replaced the `ComponentInstanceNode`.
- `blocked`: The operation cannot be performed. The `message` explains why.

### Guidelines

- Only works on local `ComponentInstanceNode`. For external `ComponentInstanceNode`, use `framer.agent.makeExternalComponentLocal` first to convert them to local, then flatten.

## framer.agent.makeExternalComponentLocal

`framer.agent.makeExternalComponentLocal` converts an external component into a local project component and updates the `ComponentInstanceNode` to reference the now local component.

### Arguments

- `id`: The id of the external `ComponentInstanceNode` (from a previous read).
- `replaceAll` (optional): When `true`, replace all `ComponentInstanceNode` of this external component with the local component. When `false`, replace only this `ComponentInstanceNode`. Required when the tool returns `needs_confirmation` status.

### Response statuses

- `success`: Operation completed. The result includes `component.id` for follow-up commands and `component.displayName` for prose.
- `needs_confirmation`: The component has multiple `ComponentInstanceNode`. Confirm with the user whether to replace only this `ComponentInstanceNode` or all `ComponentInstanceNode`, then retry with `replaceAll` set to the user's choice.
- `blocked`: The operation cannot be performed. The `message` explains why.

### Guidelines

- For `replaceAll`: default to `false` (replace only the selected/referenced `ComponentInstanceNode`) unless the user explicitly says "all", "everywhere", or "replace all instances".
- When the success message suggests flattening, follow up by calling `framer.agent.flattenComponentInstance` on the same `ComponentInstanceNode` id.
