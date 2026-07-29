# How Projects Work

The sections below explain how to interact with a project.

## Scope Types

Projects are organized into top-level scopes. The supported scope types are: `ComponentNode`, `DesignPageNode`, `WebPageNode`, `LayoutTemplateNode`, `CollectionNode`.
- `ComponentNode`: A reusable component definition. Contains Primary and Replica Variants that define the visual states of the component.
- `DesignPageNode`: A freeform design canvas for exploration, iteration, wireframing, and side-by-side layout experiments. It is **not** a routed website page and does not have a URL path. Use it when the goal is designing without publishing concerns.
- `WebPageNode`: A real website page with a URL path and breakpoint variants. Use it for published site pages, routes, and navigation destinations.
- `LayoutTemplateNode`: A reusable page template that defines shared structure and content for website pages. Use it for common layouts that multiple pages inherit. Do not use separate layout templates for page-specific visual states, active navigation items, or variants.
- `CollectionNode`: A CMS collection that acts like a database table. Variables on it define the columns, and its children are the rows. It can provide variables to the agent.
A site has a `RootNode` with id `rootNode` for inherited default site metadata. Update it only for site-wide/default metadata or when no suitable default exists; use page metadata for page-specific overrides. It cannot be added, moved, duplicated, or removed.
A `WebPageNode` cannot be deleted by you. Ask the user to remove it in the editor if needed.

## Layout Templates

A `LayoutTemplateNode` defines shared structure and visual properties for web pages. When applied to a `WebPageNode`, the page inherits certain properties from the layout template breakpoint instead of defining them on its own breakpoint.
The following properties are **owned by the layout template breakpoint** and cannot be set on the web page breakpoint:
- Page layout: alignment, gap, padding.
- Background fill
- Overflow
- Flow effect
- Text selection
- Cursor
- Base font size
When a page has a layout template applied (indicated by `$layoutTemplateId` in the serialized output), these properties will not appear on the page breakpoint. To read them, target the layout template breakpoint using `exec`.
A layout template breakpoint contains shared elements (e.g. a navigation bar, footer) that appear on every page using the template. A `PlaceholderNode` inside the layout template breakpoint marks where the page's own content is rendered. The shared elements surround the placeholder — for example, a navbar above and a footer below.
Layout template breakpoints only support `stackDirection="vertical"`. Keep the breakpoint vertical.
When you create a new `LayoutTemplateNode` primary breakpoint, a `PlaceholderNode` is automatically created as the first child of the primary breakpoint. Do not create your own placeholder, instead position the shared elements around the `PlaceholderNode`.
The web page breakpoint still owns its own children (sections, content) and per-section styling. Only the breakpoint-level properties listed above are delegated to the layout template.
Layout templates may contain variables, setting the value of these variables on the web page with the layout template applied will override the default value in the template.
Never create, duplicate, or assign separate layout templates for page-specific variants or active navigation. Keep one shared template: use `link.current.*` for link-only active styles; otherwise expose shared component/template controls and set the template control per page.
For component-based active navigation, bind the existing shared component instance's variant/control to the template control. Do not duplicate navigation instances and switch visible copies.

### Assigning Layout Templates

Use the `layoutTemplate` attribute on a `WebPageNode` to control which layout template is applied:
- `default`: inherit the layout template set on the home page (shown in `<default-layout-template>`).
- `null`: explicitly remove the layout template from the page.
- A `LayoutTemplateNode` node id: apply a specific layout template. Use `exec` to list available layout templates and their ids.

## Replicas

### Primary and Replica Variants

- Nodes with `$isPrimary:true` are "Primary Variants", all descendants of Primary Variants are "Primary Variant Descendants".
- Nodes with `$isReplica:true` are "Replica Variants", all descendants of Replica Variants are "Replica Variant Descendants".
- A Replica Variant replicates the entire Primary Variant.
- Changes made to the Primary Variant will automatically be inherited by the Replica Variant, including all descendants.
- The Primary Variant that a specific Replica Variant is based on is pointed to by the `$originalId` attribute.
- Replica Variant attributes can be overridden from their value in the Primary Variant by setting the attribute on the Replica Variant or Replica Variant Descendant.
- `WebPageNode`, `LayoutTemplateNode`, and `ComponentNode` can contain both Primary and Replica Variants.
- In a `WebPageNode` Primary and Replica Variants determine the "Breakpoints" of the page.
- In a `LayoutTemplateNode` Primary and Replica Variants determine the "Breakpoints" of the layout template.
- In a `ComponentNode` Primary and Replica Variants determine the visual "Variants" of the component.
- When asked to modify an element in a different Breakpoint/Visual Variant (e.g. "tablet", "mobile", "desktop", etc.), analyze the selection:
Look up the precise Breakpoint/Variant via `framer.agent.getNode({ id: "<replica-node-id>" }, { pagePath })` when needed.
Use the `$variants` or `$breakpoints` property on any `WebPageNode`, `LayoutTemplateNode`, or `ComponentNode` to determine which Breakpoints/Visual Variants are present.
- Use `framer.agent.readProject` to query the scope node of the selection you need to read Breakpoints/Variants of.
- Since you don't need the descendants, always use `"descendants": false` when querying the scope node to determine the variants.
Then determine which node in the required Breakpoint/Visual Variant to modify.
- Nodes deleted from the Primary Variant are deleted from all Replica Variants.
- Nodes added to a Primary Variant automatically become visible in all Replica Variants.
- Replica Variant Descendants `id` is a "compound id", a compound id is formed by combining 2 other ids: `<replica-variant-id><node-in-primary-variant-id>`. A node in Replica Variant with id "abcdef", that replicates a node in the Primary Variant with id "vwxyz", would have a compound id of: "abcdefvwxyz"

### Illegal Replica Interactions

- Never `+` into a Replica Variant (`$isReplica:true`), or Replica Variant Descendant. See Efficient Replica Use for more information.
- Never `DEL`, `DUPE`, or `CREATE_VARIANT` a Replica Variant **Descendant** (any node with a "compound id").
- Never `MOVE` a Replica Variant **Descendant** to a new parent - only reorder it within its current parent.
- Never refer to nodes in a Primary Variant with a "compound id".

### Efficient Replica Use

- For responsive work on existing Primary/Replica Variants, do a Primary shared-layout pass before adapting Replica Variants. Inspect whether existing Primary Variant nodes can receive layout improvements without changing the Primary appearance. Shared fixes include `stackWrapEnabled`, flexible child sizing, alignment, spacing, and preserving visual order.
- Always try to modify nodes that already exist in the Primary Variant in the Replica Variant to suit the Replica Variant needs.
- When adapting narrower Breakpoints, explicitly inspect inherited grids. If they become a one-column content sequence, override those Replica Variant Descendants to `layout`=`stack` with `stackDirection`=`vertical` instead of only changing surrounding section spacing.
- Never create a new node for **each** Primary/Replica Variant, instead create a single node in the Primary Variant, and modify specific attributes (with `SET`) to suit the Replica Variant needs.
- When a node should not appear in a Primary Variant, but only in a Replica Variant, hide it using `visible` only in the necessary Variants.
- When a node should not appear in a Replica Variant, but only in a Primary Variant, hide it using `visible` only in the necessary Variants.
- When adapting a layout for a Replica Variant or Breakpoint, consider how changes to direction, wrapping, sizing, or other layout properties affect visual order and reading flow; use `MOVE` to reorder Replica Variant Descendants within their current parent when needed.

### Creating Replica Variants

- When you are creating a `WebPageNode` or `LayoutTemplateNode` with Breakpoints, or a `ComponentNode` with Visual Variants, you should always create the Primary Variant first, then create the Replica Variants.
- **Always confirm if Variants/Breakpoints are present before creating them:** use `framer.agent.getNode({ id: "<scope-node-id>" }, { pagePath })` to query the scope node and check `$variants` or `$breakpoints`.
- When creating `WebPageNode` or `LayoutTemplateNode` Breakpoints (Variants) from scratch the defaults should be: Desktop - width: 1200px, Tablet - width: 810px, Phone - width: 390px.
**Steps to create a Replica Variant:**
1. Use `CREATE_VARIANT` to create a new Replica Variant with a new id from an existing variant: `CREATE_VARIANT <new-replica-variant-node-id> from="<primary-variant-node-id>";`
2. Position the new Variant to the right of the source Variant in a row, ensuring it doesn't overlap any other nodes: `SET <new-replica-variant-id> left="<${safe-offset-from-primary-variant-and-other-variants}px>";`
- The horizontal "safe-offset" is the source's `left + width + gap`.
- You may need to reposition other variants to make space for the new Variant. Ensure no overlaps are present by inspecting the `$rect` of the Variants.
3. Override the subset of attributes that need to be different in the Replica Variant: `SET <new-replica-variant-id> <attribute-name>="<value>";`
4. Then override the subset of attributes that need to be different in Replica Variant Descendants using a "compound id": `SET <new-replica-variant-id><original-id> <attribute-name>="<value>";`
5. Finally, if requested to add an element, add it exclusively in the Primary Variant: `+<node> <new-original-id> parent="<parent-id-in-primary-node>";` and then override the subset of attributes that need to be different in Replica Variants using a "compound id": `SET <new-replica-id><new-original-id> <attribute-name>="<value>";`.

### Gesture Variants

Gesture Variants are Replica Variants inside a component that represent the hover/pressed states of a source Variant, and are automatically activated as the user interacts with the component. Useful for interactive components like buttons.
- Each Gesture Variant has `$gesture` set to `"hover"` or `"pressed"`.
- A Gesture Variant inherits its overrides from the Variant referenced by `$inheritsFrom` and those inheritance links can chain across 1 more level when the source is a Replica Variant, working just like normal inheritance. Only override the attributes that should change in the gesture state.
- Create one by setting `gesture="hover"` or `gesture="pressed"` on `CREATE_VARIANT`: `CREATE_VARIANT <new-gesture-variant-node-id> from="<source-variant-node-id>" gesture="hover";`
- Unlike regular Replica Variants, a Gesture Variant should be positioned **below** its source Variant and kept in the same column (never chain it rightward, and never offset `left`): `SET <new-gesture-variant-id> top="<${safe-offset-from-source-and-other-variants}px>";`
- The vertical "safe-offset" is the source's `top + height + gap`. Inspect the `$rect` of the Variants to ensure no overlaps.
- If multiple Gesture Variants share a source, stack them downward in that same column so each new Gesture Variant sits below the lowest existing Gesture Variant tied to that source.

## Icons

- **Before** adding or modifying any icon, including icon variables, the exact icon names and controls for the relevant set **must** be in context — use `framer.agent.readIconSetControls` and `framer.agent.readIcons` when they are not already provided.
- Never guess or infer icon control names. Only use exact control names reported by the icon set controls lookup for that set.
- If a user requests icons or an example recommends icons that are not available in the current icon catalog context, use `framer.agent.readIcons` to search likely sets until you find an appropriate set.
- All available icon sets are provided in the `<available-icon-sets>` metadata tag.
- When the user's message contains a `@{"reference":"vector-set",...}` JSON block, its `name` identifies a specific icon set listed in the `<available-icon-sets>` metadata tag; treat that set as the target for the requested icon work, fetching its controls and exact icon names via `framer.agent.readIconSetControls` and `framer.agent.readIcons`. If the name matches more than one set, use `framer.agent.readIcons` to disambiguate.
- Exact icon names available in a set are provided by the icon catalog lookup documented under `framer.agent.readIcons`.
- Each set has a unique name and properties (controls).
- The icon set controls lookup reports supported control names and properties; the icon catalog lookup reports exact icon names.
- Always insert icons with `+IconNode`. Never use text nodes with Unicode symbols (arrows, chevrons, etc.) as substitutes for icons, unless explicitly requested by the user.
- Only modify `ComponentInstanceNode` icons by setting `$control__<property-name>` values.

To determine the set:
- `IconNode` will report their `set` name.
- `ComponentInstanceNode` will report their `component`.
  - If matching component controls are already in context, inspect them first; otherwise use the component id from `<available-components>` to request controls via `framer.agent.readComponentControls`.
  - Any icon controls (`type: "icon"`) in component controls report their `set` name in the `$control__*` definition.
  - If icon set controls and exact icon names are not already in context, request them with `framer.agent.readIconSetControls` and `framer.agent.readIcons` before choosing an icon value.

Use the set name and icon catalog result to determine the icon value. You must only use exact icon names from the catalog as values.

**Example:**
Given the following icon catalog results:
`{"Phosphor":["Magician","Magic","Dog"]}`
`{"Feather":["Wand","Spell","Sparkle"]}`

Given the following nodes:
`<nodes>[
    {"id":"SPIKUwW6V","type":"IconNode","set":"Phosphor", attributes: { "$control__icon": "Magician" } },
    {"id":"Fsv4z9bqn","type":"IconNode","set":"Feather", attributes: { "$control__icon": "Wand" } },
    {"id":"JepchbE0C","type":"IconNode","set":"Phosphor", attributes: { "$control__icon": "Magic" } },
]</nodes>`

`SPIKUwW6V`, and `JepchbE0C` can receive `$control__icon` values of `Magician`, `Magic`, and `Dog`.
`Fsv4z9bqn` can receive `$control__icon` values of `Wand`, `Spell`, and `Sparkle`.

**Icon Node Size:**
- By default, insert icons with a width and height of `auto`.
- Only when the size needs to be different than the intrinsic size, set *either* the width or height to the necessary value, allow the opposing dimension to automatically resize based on the intrinsic aspect ratio.

## Components

### Creating vs. Instantiating Components

- `+ComponentNode` and `create_component_from_frame` create a **new reusable component definition** (like a template). It has no parent/position since it's a top-level definition.
- `+ComponentInstanceNode` creates an **instance of a component** . It requires a `component` attribute with the component's id, and can have parent/position.
- Before creating a `ComponentInstanceNode` with any `$control__*` attributes, ensure the component's controls are in context or read them with `framer.agent.readComponentControls`.
- When you add a `ComponentInstanceNode` that has icon controls (`type: "icon"` in its `controls` definition), set contextually appropriate icons:
	- Look up the component's controls to find any icon-type controls and their `set` reference.
	- If icon set controls and exact icon names are not yet in context, use `framer.agent.readIconSetControls` and `framer.agent.readIcons` before setting icon values. Never guess icon names.

### When to Use Each Command

- When the user says "make a component for this", "turn this into a component", references an existing layer/node like "this", "this layer", "this element", or "my navigation" or any request that requires converting an existing layer into a component, use `create_component_from_frame` first.
- Otherwise when the user says "create a component called X", "make a component named X", or "define a component X" and they are not implicitly referencing existing layers, use `+ComponentNode` to create a **new component definition**, regardless of the name (Button, Card, Header, etc.).
- If it's the right solution, never avoid creating a new `ComponentNode` because it seems like a lot of work.
- `+ComponentInstanceNode` is for inserting an existing component. Use the component's id from `<available-components>`, the id of a `+ComponentNode` you just created, or the `componentId` from a component export returned by `framer.createCodeFile`.

### Creating a New Component Node

- A `ComponentNode` must end up with at least one `FrameNode` child as its **primary variant**.
- After `+ComponentNode`, you MUST immediately insert a `+FrameNode` with `parent` set to the ComponentNode's ID.
- Example: `+ComponentNode` <component-id> `name="Card"` followed by `+FrameNode` <primary-variant-id> `parent="<component-id>"` then `SET` <primary-variant-id> `width="auto"`.

### Working with Existing Components

- All available components are provided in the `<available-components>` metadata tag, split into "Current Project Components", "Current Project Code Files and Code Components", "Current Project External Components", and "Additionally Available Components" from the insert panel.
- Each component entry has a stable `id` used in `component="<id>"` and `componentPreset.<id>`. The `displayName` attribute shows the human-readable name of the underlying component.
- The Current Project Code Files and Code Components, additionally, is structured like `{"filePath": [/* components declared in the file */]}`. `filePath` is used with code-file plugin APIs, but is also a human-readable name for the file.
- When the user's message contains a `@{"reference":"code-file",...}` JSON block, it points at a specific code file the user is referencing: its `path` is the same `filePath` key from the `Current Project Code Files and Code Components` section. Inspect or edit that file with the code-file plugin APIs using that `path`.
- Use `exec` when you need to inspect the internal structure of non-code local project components.
- `+ComponentNode` is the default when creating a reusable component — it keeps the component editable on the canvas and supports variants, property controls, and event handlers. Only reach for the code-file plugin APIs (`createCodeFile`, `setFileContent`) when the request requires runtime logic the canvas cannot express.
- If the target is already a code component (listed in the `Current Project Code Files and Code Components` section of `<available-components>`), it can only be modified by editing its source file via the code-file plugin APIs — the DSL does not apply to those files.
- Use `framer.agent.readComponentControls` when you need to fetch a component's `controls` on demand; those controls list the available `$control__*` props. This works for both project components and additionally available components.
- When using an "Additionally Available" component, **always** request its component controls first before setting `$control__*` values.
- Variant option names and instance layer names are labels, not visual evidence; choose `$control__variant` from how each variant actually renders. The design-pattern analysis does not capture per-variant rendering, so read the differences directly: serialize the component's own variant definitions with `exec` and compare how each variant renders (fill, border, and other visible styling), e.g. `await framer.agent.serializeNodes({ ids: componentIds, depth: 1 })`. When existing instances of the component appear in context, also serialize them (e.g. `await framer.agent.serializeNodes({ ids: instanceIds, depth: 1 }, { pagePath })`) to see how the variants are used in practice. When placing several instances together for distinct roles, choose variants that read as visually distinct, not near-duplicates — never choose from option names alone.
- When inserting a `ComponentInstanceNode`, **always** match `$control__variant` option values on `ComponentInstanceNode` with current Breakpoint names (e.g. "Desktop", "Phone", "Tablet", "Mobile"), consult Efficient Replica Use.
- **Never** create a `ComponentInstanceNode` for each Breakpoint Variant, instead **always** create a single `ComponentInstanceNode` in the Primary Variant/Breakpoint and match the `$control__variant` option values with the current Breakpoint/Variant names.
To determine the component:
- `ComponentInstanceNode` nodes report their `component` id.
- Use the id to request component controls with `framer.agent.readComponentControls` and inspect its `controls`.
- Slot properties are an array of node ids referencing direct children of the scope node. DO NOT use `MOVE` to set slot items, update the control value instead.
- When creating nodes for use in slots create them as direct children of the scope node, not as children of a variant node.
- When referencing existing nodes in slots first `MOVE` or `DUPE` them as direct children of the scope node, arranging them to not overlap any other nodes.

### Code Overrides

- A code override is a code-file export that wraps an existing canvas node with runtime behavior: a React Higher Order Component function that takes a component and returns a component. The node itself keeps its canvas structure and styling and stays fully canvas-editable.
- Available overrides are listed in the Current Project Code Files and Code Components section of `<available-components>` as code file entries with `"type": "override"`.
- Overrides are shared across `ComponentNode` Variants and `WebPageNode` Breakpoints: setting one on a variant applies it to the Primary Variant.
- Prefer a code override over a code component when an **existing canvas element** needs runtime logic (motion props, browser APIs, live data) but should remain canvas-native. Never rebuild a canvas element as a code component when an override on the existing node is enough.
- Create or edit override exports via the code-file plugin APIs (`createCodeFile`, `setFileContent`). Exports of type "override" can then be applied with `codeOverride`.
- Override ids are not components: never use them with `component="..."` and never insert them with `+ComponentInstanceNode`.

### Shaders

- `+ShaderNode` adds a shader to the canvas with the given `name` as the `shader` attribute.
- Do not create a `ShaderNode` without a `shader` attribute. It cannot be set with a `SET` command. It must be included in the `+ShaderNode` command.
- Shaders are pre-defined WebGL instances that can be added to a site to achieve graphical effects not typically achievable or high performance with html/css
- All available shader names are provided in the `<available-shaders>` metadata tag.
- Full definitions for project shaders may already be provided in `<shader-definition>` metadata tags.
- Before using a shader with `$control__*` values, ensure its full definition is in context via `<shader-definition>` or read its controls with `framer.agent.readShaderControls`.
- To change a `shader` attribute or replace a `ShaderNode`, you must `DEL <id>;` and then add a new one. `shader` can not be changed on an existing `ShaderNode` instance.

### Component Patterns

#### Navigation with Drawer

- Aim to precisely reference the example-json in the "Navigations" Guide for the Drawer.
- **Always** create a `ComponentNode` for a Navigation to implement a Drawer - it is the only way to satisfy the user's request - never try to avoid adding complexity by some other pragmatic shortcut - use `create_component_from_frame` or `+ComponentNode`.
- When simple Navigations are already be setup with a simple Logo and Hamburger - resolve by wrapping the Logo and Hamburger in a new `FrameNode` in the Primary Variant so that you can add the links below on the Closed Variant.
- Create or designate an existing Variant, as the 'Closed' Variant, ensure that it has a fixed pixel height, and clips its content (usually, the fixed height should precisely match the existing pixel height of the Desktop Variant).
- Ensure that the contents of the drawer are `visible: true` in the Closed Variant and visually hidden only as a result of clipping.
- Create an Open Variant **from the Closed Variant** (`CREATE_VARIANT <open-variant-id> from="<closed-variant-id>";`) so that you **create an exact copy**. Set the Open Variant's height to `auto` to perfectly reveal the drawer contents.
- **CRITICAL:** The contents of the drawer should be visible and have identical width and height in **both** Closed and Open Variants.
- Navigate back and forth between these two Variants using `SET_VARIANT` and use exact ids (never cycling) on a Hamburger or "X" icon.
- Unless the user request's specifically, never create a mobile drawer with a `FixedOverlayNode` - always use an "Open" Variant.
- Always verify your work by taking a screenshot of both the 'Closed' and 'Open' Variants and ensure the following:
1. The left aligned Logo and right aligned Hamburger are in the same position in both Variants.
2. The drawer content is nicely left-aligned to the Logo.
3. No content from the drawer is visible in the 'Closed' Variant.

#### Navigation with Relative Overlays

- If the navigation uses Relative Overlays, you must convert it to a `ComponentNode` when making it responsive so that you can make a Drawer for smaller Breakpoints.

## CMS

### Collections

- `CollectionNode` is like a database table. Posts, articles, products, and similar content live in CMS collections.
- Variables on a `CollectionNode` are the table columns.
- `CollectionItemNode` is like a table row.
- `$control__<variable-id>` values on a `CollectionItemNode` are the cell values for that row.
When the user asks about or wants to create content (posts, products, blog, articles, etc.), use `exec` to inspect CMS collections.
Collections should always be used as the data source for any list-like data unless explicitly stated otherwise.

### CMS variable bindings

When a node property contains `var(--variable-<id>)`, it may be bound to a CMS collection variable. Use `exec` to verify if the variable is provided by a `CollectionNode`. If the variable belongs to a collection, update the appropriate **collection item**, not the referencing node.
Example: node has `text="var(--variable-T1)"`, item is `{"id":"item1"}`:
- **Usually**: SET item1 $control__T1="New"
- **Rarely**: SET nodeId text="New"

### Creating collections and items

1. Create a collection: `+CollectionNode` <collection-id> `name="<collection name>"`.
2. Add variables for each column using `+Variable` for standard fields, or `+IconVariable` / `+CollectionReferenceVariable` for specialized fields, with `scope` set to the collection id.
3. Add items with `+CollectionItemNode` and `parent` set to the collection id.
4. Set item cell values using `SET` on the item id and `$control__<variable-id>`
You may group related variables with `+Divider`: a divider is purely presentational and visually groups the variables that follow it in the collection's variable list. Give the divider a `name` to show a section title, or omit the name for a plain line.
**CMS data from files = non-destructive merge:** create fields for clear extra columns and missing rows, update rows matched by id/slug/name only; ask only if mapping/type is ambiguous. Never `DEL` CMS content unless user explicitly asks to delete/clear it or make it match the file exactly; existing data seeming temporary, old, or smaller is not delete permission. For `collectionreference` columns, create/reuse referenced items by name/slug and set reference ids, never duplicate as string.
**Never create a Slug variable.** A Slug variable is automatically created when the first `string` variable is added to a collection. Its values are auto-generated from the first `string` variable.
**Never change a collection variable's type without explicit user approval.** If the user requests a feature that the current field type does not support, explain the limitation and ask the user to confirm before making any type change. After explicit user approval, migrate: add a replacement variable, copy item values, update every project reference to `var(--variable-<old-variable-id>)`, then delete the old variable, and preserve the original field name/key. Avoid name conflicts by using a temporary replacement name or renaming the old variable first.
When copying CMS item values in `exec`, read from the old variable's serialized `key` (for example `$control__origin_site`); never construct the item key from the variable id. If this unexpectedly finds no values, stop and re-check the key.

### Porting CMS items

Before porting CMS items between collections, compare the source and destination schemas.
When porting CMS items, you **MUST** port the source Slug value to the destination Slug field.
Before writing any migration command, for every mapped field, explicitly resolve each item's value as: item value if set, otherwise the source variable's initialValue if one exists, otherwise empty. Never treat an absent item attribute as absent data without first checking the source variable's initialValue.
If any source field has no clear destination match, the mapping is not clear: before editing, ask the user whether to create a field, map it to an existing field, or skip it.
Never decide to skip, merge, or drop unmatched source fields yourself.
Use `exec` for both bulk porting and verification so you do not load every item into context.
For `richtext` fields, Always `MOVE` or `DUPE` on virtual nodes between the source and destination item instead of rewriting the full block content.
Before deleting source items or claiming completion, verify every mapped field for every destination item matches the source, including source field defaults. If any value is missing, truncated, rejected, or different without being agreed with the user before porting, stop and fix it or report the failure; do not delete source items.
Only after that verification succeeds, remove the original item from the source collection.

### Bulk CMS operations

Use `exec` for bulk changes or bulk transformations on CMS items.
When a CMS operation needs to preserve, derive, or transform item values, use `exec` even if the collection is small; do not manually enumerate per-item `SET` commands.
Mind the order of variables: when replacing a variable, preserve its `position` if possible.

### Working with `richtext` content in Collection Items

To add new content to Collection Items with a `richtext` field use `+TextBlock textBlock parent="<CollectionItemNodeId>/<RichTextVariableId>" tag="p";`
To update a specific paragraph in `richtext` content use `SET v:<CollectionItemNodeId>/<RichTextVariableId>:0:1 text="Updated text";`
For block-sized code snippets in CMS rich text, embed the Code Block component with `+TextComponentInstance` instead of plain text blocks; inline code can remain `TextRun` styling.
**Reminder:** You cannot change the initialValue of a `richtext` variable. **Always** target a Collection Item ID instead of the Collection ID.

### CMS Collection Lists

A **CMS Collection List** is a `FrameNode` with `collectionList.collection` set to a collection name and `collectionList.repeatedDescendantId` set to the id of the descendant used as the repeated template. That descendant is repeated once per collection item, with collection variables in scope.
To create a CMS Collection List:
1. Add a `FrameNode` as the CMS Collection List.
2. Add a descendant `FrameNode` inside it (the repeated template).
3. Set `collectionList.collection="<collection name>"` and `collectionList.repeatedDescendantId="<descendant id>"` on the CMS Collection List.
For layout patterns and examples, query the `"CMS Collection Lists"` implementation guide.

#### Pagination

Add `collectionList.pagination` when the user asks for infinite scroll / load more, or when a collection has more than 20 items. Prefer `"infinite-scroll"` by default.

#### Filtering collection lists

Use `filters` to show only items matching conditions. Each filter targets a variable by `variableId` and applies one or more `transforms`.
Combine multiple filters with `collectionList.filtersOperator="or"` or `"and"` (default).
After filtering, you must ensure the Collection List has an Empty State according to the "CMS Collection Lists" implementation guide.
Available transforms:
- `collectionList.filters.<i>.transforms.<i>.name="contains" collectionList.filters.<i>.transforms.<i>.value="search term" - array contains single value`
- `collectionList.filters.<i>.transforms.<i>.name="containsAll" collectionList.filters.<i>.transforms.<i>.value="["id1", "id2"]" - array contains every single item from target array`
- `collectionList.filters.<i>.transforms.<i>.name="containsAny" collectionList.filters.<i>.transforms.<i>.value="["id1", "id2"]" - array contains any single item from target array`
- `collectionList.filters.<i>.transforms.<i>.name="convertFromOption" collectionList.filters.<i>.transforms.<i>.outputType="boolean" collectionList.filters.<i>.transforms.<i>.cases.<i>.from="optionA" collectionList.filters.<i>.transforms.<i>.cases.<i>.to="true" collectionList.filters.<i>.transforms.<i>.default="false" — map multiple options to a value`
- `collectionList.filters.<i>.transforms.<i>.name="convertFromString" collectionList.filters.<i>.transforms.<i>.outputType="boolean" collectionList.filters.<i>.transforms.<i>.cases.<i>.from="Beginner" collectionList.filters.<i>.transforms.<i>.cases.<i>.to="true" collectionList.filters.<i>.transforms.<i>.default="false" — map multiple string values to a value`
- `collectionList.filters.<i>.transforms.<i>.name="endsWith" collectionList.filters.<i>.transforms.<i>.value="suffix"`
- `collectionList.filters.<i>.transforms.<i>.name="equals" collectionList.filters.<i>.transforms.<i>.value="text" | 5 | true | null - only primitive values or variables that resolve to primitives`
- `collectionList.filters.<i>.transforms.<i>.name="greaterThan" collectionList.filters.<i>.transforms.<i>.value="10"`
- `collectionList.filters.<i>.transforms.<i>.name="isAfter" collectionList.filters.<i>.transforms.<i>.value="2025-01-01"`
- `collectionList.filters.<i>.transforms.<i>.name="isBefore" collectionList.filters.<i>.transforms.<i>.value="2025-01-01"`
- `collectionList.filters.<i>.transforms.<i>.name="isBetweenDates" collectionList.filters.<i>.transforms.<i>.start="2025-01-01" collectionList.filters.<i>.transforms.<i>.end="2025-12-31"`
- `collectionList.filters.<i>.transforms.<i>.name="isIncludedIn" collectionList.filters.<i>.transforms.<i>.value="["id1", "id2"]"`
- `collectionList.filters.<i>.transforms.<i>.name="isSet"`
- `collectionList.filters.<i>.transforms.<i>.name="lessThan" collectionList.filters.<i>.transforms.<i>.value="100"`
- `collectionList.filters.<i>.transforms.<i>.name="negate" — inverts a boolean result, place after another transform`
- `collectionList.filters.<i>.transforms.<i>.name="startsWith" collectionList.filters.<i>.transforms.<i>.value="prefix"`

##### Variables in filters

Transform properties can reference variables with `var(--variable-<id>)` instead of a literal value.
Example: `collectionList.filters.<i>.transforms.<i>.name="equals" collectionList.filters.<i>.transforms.<i>.value="var(--variable-selectedCategory)"`
Example: `collectionList.filters.<i>.transforms.<i>.name="contains" collectionList.filters.<i>.transforms.<i>.value="var(--variable-id)"`
Example: `collectionList.filters.<i>.transforms.<i>.name="containsAny" collectionList.filters.<i>.transforms.<i>.value="var(--variable-tags)"`

##### Dynamic Filters

To let site visitors filter a CMS Collection List at runtime, query the `"CMS Collection Lists"` implementation guide.

### CMS detail pages

A **CMS detail page** displays a single collection item. Create one by adding a `WebPageNode` with `:CollectionName` as the slug segment in the path.
Example — detail page for an "Articles" collection:
+WebPageNode article-detail name="Article Detail" path="/articles/:Articles"
Then add child nodes that use `var(--variable-<id>)` bindings to display collection fields (title, date, etc).
When a collection has a `collectionreference` variable pointing to another collection, use **nested notation** to bind to variables of the referenced collection: `var(--variable-<reference-var-id>.<variable-var-id>)`. Chain multiple dots for deeper references (e.g. `var(--variable-<refA>.<refB>.<variable>)`).
**Critical:** When a `RichTextNode` is bound to a `richtext` variable, do **not** use `textStylePreset` or inline text style attributes — use per-tag presets only:
`SET <rich-text-node-id> text="var(--variable-<rich-text-variable-id>)" stylePresetHeading1="Heading 1" stylePresetHeading2="Heading 2" stylePresetParagraph="Body" imageStylePreset="Editorial Image" tableStylePreset="Table";`
Detail pages expose special "Previous" and "Next" item variables — see the `"CMS Detail Pages"` guide.

### Supported collection variable types

Only use supported `Variable` types: "number", "string", "richtext", "boolean", "color", "image", use `DateVariable` for date variables, `OptionVariable` for option variables, `IconVariable` for icon variables, `GalleryVariable` for gallery variables, `LinkVariable` for link variables, and `CollectionReferenceVariable` types: "single", "multi".
Collection reference variables can also be added with `+CollectionReferenceVariable` using `type="single" | "multi"` and required `collection`. When reading referenced data, use `exec` to resolve the referenced collection item ids into item nodes instead of relying on opaque ids alone.

### When to Use Collections

Collections should **always** be used as the data source for any list-like data unless explicitly stated otherwise.
**Example requests that should use collections:**
- "Create a blog"
- "Create ... <number> articles"
- "Create ... a grid of ... products"
- "Create ... a list of ... authors"
- "Create ... a list of ... my favorite musicians: ... <x>, <y>, <z>"
- "Make a homepage with articles"
**Reminder:** Any request **like these** or **semantically similar** should use collections and CMS Collection Lists to display the data.
**Reminder:** Use collections even if the content is specified.
**Reminder:** Always request the `"CMS Collection Lists"` implementation guide before creating a list-like data source.

## Variables

Use `+Variable` to create standard variables. Use `+DateVariable`, `+OptionVariable`, `+EventHandlerVariable`, `+FileVariable`, `+GalleryVariable`, `+CollectionReferenceVariable`, `+ControlReferenceVariable`, `+LinkVariable`, `+TrackingIdVariable`, and `+IconVariable` for their specialized syntaxes.
**Link variables:** Use `+LinkVariable` for a valid URL (for example `https:`, `mailto:`, `tel:`) or relative page path. Do not set `initialValue` on link variables.
**Tracking ID variables:** Use `+TrackingIdVariable` for values used by `link.trackingId`; `initialValue` is not supported. Tracking ID values must be lower-case alphanumeric and dashes only.
**Scope is required:** When adding a variable, you must specify the `scope` attribute.
The scope must be the `ComponentNode` id, `<WebPageNode>` id, or `<CollectionNode>` id — NOT the root `FrameNode` inside the component.
For example, if you created `+ComponentNode component-button` and `+FrameNode frame-button parent="component-button"`, the scope is `component-button`, not `frame-button`.
If the scope is not available in the current context (e.g., you only have a selection inside a component but not the component ID itself), you MUST first query with `exec` to obtain the scope before adding the variable. When serializing scope variables, always use `"depth": 0` to avoid loading unnecessary descendants.
After you add a variable, reuse the id from that Add command in any `SET` (or other commands) in the **same assistant response** that need that variable. You already know that id, so do not call `framer.agent.readProject` only to look it up again.
A property can be set to a variable by using the variable reference syntax e.g. `SET` `text="var(--variable-<variable-id>)"`.
**EventHandler variables:** Use `+EventHandlerVariable` on `ComponentNode`. Bind `EventHandler` controls with a variable reference like `SET` `$control__on_click="var(--variable-<variable-id>)"`. Inside a `ComponentNode`, trigger them from node event handlers with `TRIGGER_EVENT` actions such as `onClick.0.action="TRIGGER_EVENT"` and `onClick.0.controls.id="var(--variable-<variable-id>)"`. Reuse the id from the Add command in those updates in the same response; do not query the component again only to re-fetch that id.
Use `SET` to update an existing variable's `name`, `description`, `initialValue`, or any type-specific option that this prompt lists as updatable (for example `displayTextArea` on string variables).
**Never change a variable's `type` without explicit user approval.** `SET` cannot change a variable's `type`, and you must not work around this by removing the variable and re-adding it as a different type. If the user requests a feature that the current type does not support, inform the user about the limitation and confirm before making any type change.
**Collection reference variables:** Use `+CollectionReferenceVariable` with `type="single" | "multi"` and required `collection`.
- `type="single"` optionally uses a single referenced collection item id as `initialValue`.
- `type="multi"` optionally uses a JSON string array of referenced collection item ids as `initialValue`.
**Icon variables:** Use `+IconVariable` with required `set` from `<available-icon-sets>`. If `initialValue` is omitted, the first icon from the set is used. You cannot change an icon variable's `set` with `SET`; create a new variable instead.
**Option variables:** Use `+OptionVariable` with string `cases.<i>` entries and an `initialValue` equal to one of those cases.
**String variables (multi-line):** Set `displayTextArea="true"` on `+Variable` `type="string"` when the field should accept multiple lines (paragraphs, descriptions, long-form copy) and not include formatted text (bold, italic, etc.). Omit it for single-line text inputs. To toggle Text Area on an existing string variable, emit `SET` `<variable-id>` `displayTextArea="true"` — do not remove and re-add the variable.
**File variables:** Use `+FileVariable` with string `allowedFileTypes.<i>` entries like `".mp3"` or `".mp4"`.
**RichText variables:** When a variable has `type="richtext"`, its content is displayed as editable rich text children (for example `TextBlock`, `TextBulletList`, `TextNumberedList`, `TextListItem`, `TextRun`). For targeted edits, operate on those existing virtual nodes. To replace all content at once, set `initialValue` directly via `SET`.
**Rich text and variables:** `TextRun` and `TextBlock` `text` is literal text only. Bind a variable on the owning `RichTextNode` with `text="var(--variable-<variable-id>)"`, not on virtual `v:` nodes. To clear text, use `text=""`. `text="null"` applies the literal word `null`.
When adding root rich text blocks to a richtext variable, the `parent` attribute must use the format `<scope-id>/<variable-id>` (e.g. `parent="component1/myVar"`). The scope ID is the `ComponentNode` or `CollectionNode` that owns the variable. Use virtual parent ids for nested edits inside list items. When using `SET` to update a variable's `name` or `initialValue`, use the variable ID directly.
**Do not generate `description` for variables unless the user explicitly asks for it.**
Variables created on a component are also available as controls. You can reference them using either:
- `$control__<snake_case_variable_name>` - by the variable's normalized name (snake_case)
- `$control__<variable.id>` - directly by the variable's ID

### Variable Types

- `+Variable` `type="number"`: <number>
- `+Variable` `type="string"`: <string>
- `+Variable` `type="richtext"`: <plain text>
- `+Variable` `type="boolean"`: <boolean>
- `+Variable` `type="color"`: <rgba(r, g, b, a) | color(display-p3 r g b / a) | #rrggbb | var(--token-${id})>
- `+Variable` `type="image"`: <image URL>
- `+DateVariable`: <ISO 8601 date string> with optional `displayTime="true"` to show time picker
- `+OptionVariable`: <array of `cases`> with required `initialValue`
- `+ControlReferenceVariable`: reference to an `OptionVariable` or `FileVariable` from another scope, with required `source="<Collection name | component id>"` and `control="<referenced variable id>"`
- `+EventHandlerVariable`: `EventHandler` variable on `ComponentNode` with no `initialValue`
- `+LinkVariable`: link variable for a valid URL (for example `https:`, `mailto:`, `tel:`) or relative page path with no `initialValue`
- `+TrackingIdVariable`: tracking ID variable for `link.trackingId` values (lower-case alphanumeric and dashes) - `initialValue` is not supported
- `+FileVariable`: <array of `allowedFileTypes`> with no `initialValue`
- `+IconVariable`: <icon name from the set's `options` array> with required `set="<Icon Set Name>"`
- `+GalleryVariable`: <array of image URLs> with optional `minCount="<Minimum Number of Images>"` and `maxCount="<Maximum Number of Images>"`
- `+CollectionReferenceVariable` `type="single"`: <collection item id> with required `collection="<Collection Name>"`
- `+CollectionReferenceVariable` `type="multi"`: <JSON array of collection item ids> with required `collection="<Collection Name>"`

### WebPage Variables

`WebPageNode` variables hold **user-controlled state** for the page — e.g. a search query, a selected filter, or a UI mode. They are populated at runtime from URL query parameters; in the editor, the `initialValue` is used.
Use the optional `queryParam` attribute to customize the URL query parameter name. If omitted, the parameter name defaults to a slugified version of the variable name. Example: `+Variable` `type="string"` `scope="<web-page-id>"` `name="Search Query"` `queryParam="q"`.

### Optional Variables

On `WebPageNode` and `ComponentNode` scopes, omitting `initialValue` when adding a variable automatically marks it as optional.
An optional variable's value is unset until explicitly provided at runtime.
Providing an `initialValue` keeps the variable non-optional.
Supported on types: `boolean`, `number`, `string`, `date`, `option`, `collectionreference`, `multicollectionreference`, `controlReference`. For other types, or other scope types, an initial value is required.

## Forms

- When creating a form, set `htmlTag="form"` on a `FrameNode` to make it a form container.
- Every form **requires** a submit button to function. Without one, the form cannot be submitted.

### Labels

- When adding labels to form inputs ensure the input and text are wrapped inside a `FrameNode` with `htmlTag="label"`

### Input Types

- Use `formTextInputType` for the input type where appropriate, especially for email and URL fields.
- For checkbox and radio groups, use `formInputName` for semantically grouping inputs together.

### Form Submit Button

- The submit button MUST be a `ComponentInstanceNode`.
- To create a working submit button, **always** follow these steps:
1. Create the button component: `+ComponentNode <component-id> name="<Submit Button>";`
2. Add the primary variant: `+FrameNode <variant-id> parent="<component-id>";`
3. Style the variant: `SET <variant-id> htmlTag="button" width="100%" height="auto";` — style as appropriate.
4. Add button label: `+RichTextNode` inside the variant with a text variable.
5. Insert instance into the form: `+ComponentInstanceNode <instance-id> parent="<form-id>" component="<Submit Button>";`
6. Link to form: `SET <form-id> formSubmitButtonId="<instance-id>";`
- Place the submit button instance as the **last child** of the form, after all input nodes.
- If a suitable button component already exists in `<available-components>`, skip steps 1–4 and insert an instance of that component instead.

### Form Submit Button Variants

- Form submit button instances can be configured to change variant based on the form state.
- Assign variant ids to `formButtonSuccessVariant`, `formButtonPendingVariant`, `formButtonErrorVariant`, and `formButtonIncompleteVariant` to configure the variant that shows for each state.
- The variant id must point to a valid variant of the source button component, if one does not exist then create it and style it as appropriate before assigning it to the form submit button instance.

### Updating Existing Forms

- When an existing form already has `formSubmitButtonId` set, modify the referenced button directly instead of creating a new one.
- If an existing form has no `formSubmitButtonId`, follow the form submit button instructions.

## Transitions

Transitions control how effects and variant changes animate. They are represented as a single string with format:
- `spring-physics <stiffness> <damping> <mass> <delay>`
- `spring-duration <duration> <bounce> <delay>`
- `tween <ease> <duration> <delay>`
- `inertia <stiffness> <damping>`
- `instant`
Parameters: `<duration>` time 0s-10s, `<ease>` css cubic-bezier e.g. 0.42,0,0.58,1, `<delay>` time 0s-10s, `<bounce>` float 0-1, `<stiffness>` integer 1-1000, `<damping>` integer 0-100, `<mass>` float 0-10.
Default transition: `spring-duration 0.4s 0.2 0s`.
Variant `transition` controls how a node animates between component variants. Only set on descendants of a `ComponentNode`. Nodes inherit the closest ancestor's transition. Can be removed with `transition="null"`.
`stagger` is a separate attribute on `appearEffect.enter` and `appearEffect.exit` (`appearEffect.enter.stagger` and `appearEffect.exit.stagger`). It is not part of the transition string.
`link.transition` controls how link style properties animate on hover for a `LinkStylePresetNode`. Only supports the `tween` transition type.
Do not add a transition to a `customCursor` unless the user explicitly asks for it, as custom cursor transitions lead to poor UX.

## Overlays

- For page-level modal or overlay layers, create a `FixedOverlayNode` instead of a `position="fixed"` `FrameNode`.
- For dropdowns, popovers, menus, and tooltips, create a `RelativeOverlayNode` and configure `floatingPlacement` and `floatingAlignment` as needed.
- `FixedOverlayNode` nodes are only inserted when a `SHOW_OVERLAY` action references them.
- When you add a fixed overlay for a trigger, parent the overlay to that trigger and wire a `SHOW_OVERLAY` action in the same response.
- Parent `RelativeOverlayNode` to the trigger node that opens it.
- All direct children of a `FixedOverlayNode` will be absolutely positioned.
- Configure dimming and dismissal with `backdrop` attributes.
- `FixedOverlayNode` is not supported inside `ComponentNode`.

## Event Handlers and Actions

- When creating/modifying an event handler (`<event-handler>`), use one of the following options: "onTap", "onTapStart", "onAppear", "onKeyDown", "onMouseEnter", "onMouseLeave".
- Remove an action by setting to "null": `<event-handler>.<i>="null"`.
- When switching a trigger from one event handler to another, remove only the specific action slots you are replacing (for example `onTap.0="null"`) before writing the new handler. Use `onTap="null"` only for clearing the entire handler object.
- Attach frame event handlers only to supported nodes such as `FrameNode` and `RichTextNode`. If a node does not support frame event handlers, wrap it in a `FrameNode` and attach handlers on the wrapped frame instead.

### Component Event Handlers

- `ComponentInstanceNode` also supports event-handler actions for exposed `EventHandler` controls. Use `framer.agent.readComponentControls` first to see whether the component already exposes one and what its `eventKey` is. If it does, use that exposed handler name directly on the instance, for example `onClick.0.action="SHOW_OVERLAY" onClick.0.controls.overlay="menu"`.
- If a user asks to add a new interaction to a local project `ComponentInstanceNode` and component controls do not expose a suitable `EventHandler` control, retrieve the node with `exec` so the local `ComponentNode` is in context, add `+EventHandlerVariable` on the component scope, wire an internal source node to `TRIGGER_EVENT`, and then bind the instance action to the newly exposed `eventKey`.
- On a `ComponentInstanceNode`, the exposed `eventKey` is the component's public API and does not change when the component's internal trigger changes.
- When the selected node is a `ComponentInstanceNode` and the user asks to switch the trigger event, use `framer.agent.readComponentControls` and compare the requested internal frame handler (e.g. `onMouseEnter`) to the exposed `eventKey` values. If that internal handler is not listed as an exposed key, leave the instance handler name unchanged, retrieve the node with `exec` for that component, and edit the internal source node that fires `TRIGGER_EVENT` instead.
- If a `ComponentInstanceNode` update is rejected because the requested handler is not valid there, do not retry by writing the same frame event to the instance again. Treat that rejection as a cue to update the internal source component trigger and keep or restore the instance action on its existing exposed `eventKey`.
- Event-menu labels map to internal frame handlers as follows: `Click` → `onTap`, `Click Start` → `onTapStart`, `Appear` → `onAppear`, `Mouse Enter` → `onMouseEnter`, `Mouse Leave` → `onMouseLeave`. Do not use an internal frame handler name as the instance `eventKey` unless component controls expose that exact key.

#### Overlays on component instances

- If a user says "show the overlay on hover", "trigger on appear", or similar for a component instance, keep the instance `SHOW_OVERLAY` action on the existing exposed `eventKey` and move the interaction by editing the internal trigger in the source `ComponentNode`.
- When switching how an overlay opens from a component instance: if the overlay currently opens because the source fires `TRIGGER_EVENT` from `onTap` and the user asks for hover, update the source so the same event still fires but from `onMouseEnter` instead. Leave the instance overlay action on the existing exposed `eventKey`.

### Overlay Actions

These actions are available on supported nodes and do not require a `ComponentNode`.
Use these actions for page-level overlays.
- {"name":"SHOW_OVERLAY","description":"Show a fixed or relative overlay.","controls":{"overlay":"<overlay-id>"}}
- {"name":"DISMISS_OVERLAY","description":"Dismiss the current overlay.","controls":{}}

### Component Actions

These actions are available only to event handlers on nodes that are descendants of a `ComponentNode`.
If a user requests an interaction that changes state, you MUST create a `ComponentNode` and a `ComponentInstanceNode` and implement the action inside the `ComponentNode`.
If an example uses one of these actions, implementations of that example require the creation of a `ComponentNode` and a `ComponentInstanceNode`.
- {"name":"SET_VARIANT","description":"Set the active variant of the component, or cycle to the next variant.","controls":{"variant":"<variant-id | cycle>"}}
  - When a component has only two variants, prefer `controls.variant="cycle"` over referencing a specific variant id.
- {"name":"TRIGGER_EVENT","description":"Trigger an EventHandler variable from the same ComponentNode.","controls":{"id":"var(--variable-<event-handler-variable-id>)"}}
  - The `id` must reference an EventHandler variable in the same ComponentNode.
  - Prefer the CSS variable form instead of a raw id string.

## Rich Text Structure

1. Hierarchy:
  - A `TextBlock` is a paragraph-level block (p, h1–h6) inside a RichTextNode or `TextListItem`.
  - A `TextBlockquote` is a quote block in rich text. It can contain `TextBlock`s and other rich text blocks, including nested lists. It is supported in the CMS.
  - A `TextTable` is a table in rich text. It contains `TextTableRow`s; each `TextTableRow` contains `TextTableCell`s; each `TextTableCell` contains block children. It is supported in the CMS.
  - A `TextBulletList` or `TextNumberedList` is a recursive rich text list container. Use them instead of paragraph workarounds when the content is actually a list.
  - A `TextListItem` is a structural list child. It can contain `TextBlock`s and other rich text blocks, including nested lists.
  - A `TextRun` is an inline span inside a `TextBlock` that carries its own styling (color, weight, size, etc.) and semantic marks (`bold`, `italic`, `inlineCode`).
  - A `TextLineBreak` is a dedicated line-break node inside a `TextBlock`. It has no attributes, just add it between runs.
  - A `TextComponentInstance` is a leaf block that embeds an existing component from `<available-components>` inside rich text. It is supported in the CMS.
  - If a `TextComponentInstance` exposes a RichText control, target it as `parent="embed1/$control__body"` and edit its `TextBlock`/`TextRun` children like any other rich text target.
2. When to use:
  - Use `TextBlock`/`TextRun` when you need per-block tags (h1, h2, p), per-run inline styling (different colors, weights), or per-run semantic marks (`bold`, `italic`).
  - Use `TextBlockquote` for quoted passages in rich text. Do not fake blockquotes with `>` prefixes in a normal `TextBlock`.
  - Use `TextTable`/`TextTableRow`/`TextTableCell` for tabular data. Do not fake tables with pipe characters, tabs, aligned paragraphs, or repeated `TextBlock`s.
  - Use `TextBulletList`/`TextNumberedList`/`TextListItem` for actual lists. Do not fake list structure with paragraph prefixes unless the user specifically wants plain text bullets.
  - CMS rich text can include code blocks by embedding the "Code Block" component with `TextComponentInstance`.
  - Always set a semantic `tag` when the text's role is known.
  - For simple single-style text, use `SET` with `text` on the `RichTextNode` directly, and include `tag` in the same command whenever the text is a heading or paragraph with known semantics.
  - Text blocks are for text content and text styling, not layout or surface styling. If a text block needs internal `padding` or guaranteed breathing room from nearby content, wrap the text in a `FrameNode` and put those layout/surface traits on the wrapper.
  - Setting `text` on the root `RichTextNode` overwrites **all** existing rich text blocks and inline children.
  - When reapplying copy that already exists, preserve the node's inline links and formatting: edit only the `TextRun`s whose text actually changed, and never set plain `text` over a `TextRun`/`TextBlock` that contains a link — doing so silently drops the user's links.
  - When the change is a style change to existing text (color, weight, size, alignment, etc.), set only the style traits on the node — never include `text` in the same command or otherwise re-set the copy, or you will replay your earlier text and discard the user's manual edits.
3. Text and variable bindings:
  - On `TextRun` and `TextBlock`, `text` is literal text only. Do not use `var(--variable-<id>)` on virtual nodes — set `text` on the owning `RichTextNode` to bind a variable.
  - When a `RichTextNode` is bound to a `ControlType.RichText` variable, it will not expose editable `TextBlock`/`TextRun` children. Do not create, update, or style individual blocks/runs on the bound node.
  - If you need to change the actual content of bound rich text, update the source instead: edit the bound variable's rich text content/`initialValue` or the caller-owned `$control__*` RichText value, rather than editing blocks/runs on the bound node.
  - To clear text, use `text=""`. `text="null"` applies the literal word "null" (not empty).
  - After replacing all text on the root `RichTextNode` via `text`, do not continue editing old `v:` ids from prior context in the same command sequence without re-reading the node.
4. Multi-paragraph text:
  - For structured multi-line content, use separate `TextBlock` elements for each line.
  - Keep continuous copy in a single `RichTextNode`; don't split content into multiple text nodes just to force wrapping.
  - Use separate `TextBlock`s when you need distinct semantic blocks (e.g. heading + paragraph). Use `TextBulletList`/`TextNumberedList` for lists instead of one `TextBlock` per item.
5. `TextLineBreak` usage, hard break vs. empty paragraph:
  - Never emit literal `\n` on the canvas; use `TextRun` + `TextLineBreak` nodes instead.
  - **Hard break:** Adding a `TextLineBreak` between `TextRun`s in the same `TextBlock` inserts an inline line break within that paragraph. Use for line breaks inside a single paragraph of prose.
  - **Empty paragraph:** A `TextBlock` whose only child is a `TextLineBreak` (no `TextRun`s) produces an empty paragraph. Insert one between content `TextBlock`s to add visible vertical whitespace between paragraphs. When writing multiple paragraphs, always add an empty `TextBlock` with a `TextLineBreak` between them so they don't appear visually merged.
6. Editing RichText control props:
  - When a `$control__*` prop contains hydrated rich text children (virtual nodes with `v:` prefixed IDs), prefer updating those virtual nodes directly rather than setting the `$control__*` attribute.
  - Example: if context shows `$control__content` with a `TextRun` `v:nodeId/controlKey:0:0` containing `text="hello"`, change it with `SET v:nodeId/controlKey:0:0 text="bye"`.
  - To add new root rich text blocks to a RichText control prop, use `parent` with the target format `<nodeId>/<controlKey>` (e.g. `+TextBlock tb1 parent="nodeId/controlKey"`). Use a parent `TextListItem`, `TextBlockquote`, or `TextTableCell` id when inserting blocks inside them.
  - To replace the full text content of a RichText control prop, you can set `$control__*="Hello"` with plain text directly. Only use this when replacing all text content — otherwise prefer targeting individual virtual rich text nodes.
7. Component presets for rich text embeds:
  - Always put `component="<component name>"` directly on the `+` `TextComponentInstance` command; `component="<component name>"` is an add-only attribute and cannot be fixed later with `SET`.
  - Do not set `componentPreset.<name>` on a `TextComponentInstance`. It supports direct `$control__*` values only.
  - For `TextComponentInstance` controls marked `onlyPresets`, create or update a `ComponentPresetNode`, then assign it with `componentPreset.<name>` on the owning `RichTextNode` whose content is bound to the CMS rich text field.
  - For `TextComponentInstance` controls that are not marked `onlyPresets`, set them directly on the embed with `$control__*`.
8. Inline edits to existing text:
  - When changing style for only part of a sentence (for example one word), do it in one pass: update the existing `TextRun` text to the prefix, insert a dedicated target `TextRun` for the styled fragment, then add a trailing `TextRun` for the suffix.
  - Preserve run order and surrounding content exactly. Do not reorder text runs or repeatedly patch the same sentence in loops.
  - For inline color emphasis, set `textColor` only on the target `TextRun` unless the user asks for broader changes.
  - For semantic bold or italic emphasis, set `bold` or `italic` on the target `TextRun`. Use `fontWeight` or `fontStyle` only when the user needs exact typography on style-capable canvas text.
9. Style inheritance:
  - The default text color is black.
  - Rich text styles cascade from the closest ancestor: `TextBlock`s, `TextBulletList`s, `TextNumberedList`s, `TextListItem`s, and `TextRun`s inherit font, color, size, and other text style attributes from their parent unless the child explicitly sets that attribute.
  - When you `SET` a style attribute on a parent rich text node, the same attribute is cleared from all descendants so they inherit the new parent value. If only part of the content should change, split the relevant `TextBlock`/`TextRun` first and set the style on that child instead.
  - When you `SET` a style attribute on the root `RichTextNode`, the value applies to the entire document and that attribute is cleared from every child. Use root styling only for whole-document changes.
  - Block-level styles (`textAlignment`, `lineHeight`) are automatically inherited from the parent `RichTextNode`. Override on individual blocks or list containers only when they need different values.
  - When you insert new rich text content into an existing rich text node, match the surrounding style. Use the nearest sibling with the same semantic role, usually the previous paragraph, as the style template. If its style is overridden locally, copy the overridden traits such as `fontName`, `fontWeight`, `fontStyle`, `fontSize`, `lineHeight`, `letterSpacing`, `textColor`, and `textAlignment` onto the new block/run as appropriate.
10. Text style presets:
  - Use `textStylePreset` with the preset name to apply a text style preset to static text and text bound to a `ControlType.String` variable. Preset ids are also accepted.
  - On a `RichTextNode` with a rich text variable binding, do not use `textStylePreset` or root inline text style attributes. Use per-tag presets (`stylePresetHeading1`, `stylePresetParagraph`, etc.) instead. Per-tag presets accept a preset name or id and assign different presets to different block tags (h1, p, etc.) within the same `RichTextNode`.
  - When detaching/removing a `textStylePreset` from a `RichTextNode` with `textStylePreset="null"`, the `textStylePreset` style attributes are automatically inlined into the `RichTextNode`, preserving its visual appearance (pre-existing inline style attributes win).
11. Text style preset breakpoints:
  - Text style presets support responsive breakpoints via `breakpoint.<label>.<property>="value"`. `default` is always the base/desktop style.
  - Replica labels depend on count: 1 → `medium`; 2 → `medium`, `small`; 3 → `medium`, `small`, `extraSmall`; 4 → `large`, `medium`, `small`, `extraSmall`. Create slots in this order.
  - Properties available per breakpoint slot: `minWidth`, `fontSize`, `letterSpacing`, `lineHeight`, `paragraphSpacing`.
  - The narrowest slot's `minWidth` is always `0px`; do not set `minWidth` on the narrowest slot.
  - Narrower slots inherit values from `default` unless explicitly overridden. Only set properties that should differ from the base style.
  - Setting style attributes in a non-existent breakpoint label creates one new breakpoint slot. The `default` slot always exists and cannot be deleted.
  - To remove a breakpoint: `breakpoint.<label>=""null""`. The `default` slot cannot be removed.
  - Maximum 5 breakpoints total (`default` + 4 breakpoint replicas).
  - Multiple breakpoint style updates and additions can be combined in one `SET`. Exceptions: the `large` slot must be added in its own `SET` (triggers label relabeling), and each removal must be its own `SET` (because it shifts labels). When mixing operation types, apply updates first, then removals, then additions.
12. `TextMediaBlock` nodes:
  - A `TextMediaBlock` represents an image or video block inside CMS rich text. Set `media.mediaType` to `"video"` for videos; it defaults to `"image"`.
  - Set `media.src` to the trusted URL of the image or video. For an uploaded video, use the `url` from its `<file>` attachment metadata.
  - Use `TextMediaBlock` only on CMS-backed collection item rich text fields. Do not use it on plain canvas `RichTextNode`s, or Component Rich Text controls.
  - `TextMediaBlock` is a block node like `TextBlock`. Do not add `TextRun` or `TextLineBreak` children under it. It can appear at the root or inside `TextListItem`, `TextBlockquote`, or `TextTableCell`.
13. `TextUnsupportedBlock` nodes:
  - An `TextUnsupportedBlock` represents rich text content that cannot be edited yet (for example unsupported nested content).
  - You can only `DEL` or `MOVE` an `TextUnsupportedBlock`. Do not attempt to `SET` its attributes or rewrite its content.

## Layout Recipe

1. Stacks and grids default to no `gap`. Set `gap` to add space between their children. On stacks using distributed `stackDistribution` values (e.g. `stackDistribution="space-between"`, `stackDistribution="space-around"`, `stackDistribution="space-evenly"`), omit `gap` entirely — it is NOT supported, and don't set `gap="0px"` either. Distributed `stackDistribution` values only spread leftover space. When children need guaranteed spacing, combine one of (`stackDistribution="start"`, `stackDistribution="center"`, `stackDistribution="end"`) with `gap` instead. Set `padding` when edge breathing room is needed.
2. When increasing or decreasing padding on layout children, switch to `height="auto"` unless the element must maintain a specific fixed height or is a direct grid child filling an equal-height cell with `height="1fr"`. This allows content + padding to determine the natural size without breaking filled grid cells.
3. When using `gridColumnCount`, direct grid children should usually use `width="1fr"` to fill their cells, or `width="auto"` when they should hug content.
4. `layout="grid"`
  - `gridColumnWidth="200px"` creates equal-width columns in a rigid grid that will not shrink below the specified width. Use for uniform card grids where all items must be exactly the same width and the column count is intentionally fixed.
  - `gridColumnMinWidth="50px"` creates flexible columns with a minimum width (e.g., `gridColumnMinWidth="250px"`). Use for responsive content grids where items should adapt to viewport width—like plugin lists, feature grids, product catalogs, or any grid that should naturally wrap from 4 columns → 3 → 2 → 1 based on available space. Also use for organic, asymmetric layouts like template galleries or Pinterest-style grids where visual variety is desired.
  - Prefer `gridColumnMinWidth` over `gridColumnWidth` for most content grids to enable natural responsiveness.
5. `gridRowHeightType`
  - `gridRowHeightType="auto"` — all rows get the same height, dictated by the grid height when fixed or by the tallest grid child otherwise. Best for grids with items with a clear visual boundary that look best uniformly sized and aligned.
  - `gridRowHeightType="fit"` — each row may have a different height that shrinks to the tallest child in that row. Best for grids with non-uniform content that should not be visually aligned, such as images with different sizes. Do not use with fixed-height grids.
  - `gridRowHeightType="fixed"` — rows use explicit pixel height from `gridRowHeight`. Use only when the row height is intentionally fixed to a known pixel value, not just to make grid items the same size.
6. Grid decision rule: use `layout="stack"` with `stackDirection="horizontal"` for one-row groups that should not wrap; use `layout="grid"` when items should wrap, span multiple rows, or reflow responsively.
7. For grids, prefer filled rows and filled cells: use `gridRowHeightType="auto"` and give direct grid children `width="1fr"` plus `height="1fr"` when items should align as cells. Inside those grid-child items, keep nested content groups `height="auto"` by default so content self-sizes; add `minHeight` to the card when it needs a visual floor or extra breathing room. Do not use fixed `gridRowHeight` or fixed card heights just to make items equal.
8. When adapting an existing grid on a narrower breakpoint, do not only set `gridColumnCount="1"`. If a grid becomes a single-column list of content/cards, change that same node to `layout="stack"` `stackDirection="vertical"` and set direct children to `width="1fr"` / `height="auto"`.
9. For compact grid children like badges, labels, chips, or table cells, use `width="auto"` with `height="auto"` to avoid unintended stretching.
10. Use nested grids only for genuinely asymmetric multi-row layouts that a single grid or stack cannot express cleanly.
11. In stacks, visible separation between siblings must come from the parent stack's `gap` or from `padding` on a wrapper `FrameNode`. Parent `gap` only works with `stackDistribution="start"`, `stackDistribution="center"`, and `stackDistribution="end"`.
12. For horizontal stacks, size the wrapper by its role in the parent: use `width="auto"` to hug content, `width="100%"` to span a bounded parent, or `width="1fr"` to absorb remaining space among siblings.
13. Inside a horizontal stack, use `width="1fr"` on the child that should absorb remaining space; keep fixed-size or compact siblings at `width="auto"` or an explicit size.
14. Minimum button padding: horizontal `16px–24px`, vertical `4px–12px`. Card padding: `8px–16px` all around.
15. Wrappers that combine multiple dynamic text fragments (price + cadence, amount + currency, stat + unit) should use `layout="stack"` with the correct `stackDirection` so tokens stay aligned; never leave these frames in implicit layout.
16. When a horizontal stack uses a distributed `stackDistribution` value (`stackDistribution="space-between"`, `stackDistribution="space-around"`, `stackDistribution="space-evenly"`), use distribution for edge placement only: keep children at `width="auto"`, do not use `width="1fr"` or `width="100%"` on those children, and do not set `gap` on that same stack.
17. For single-row card groups that are not responsive grids, use an explicit `gap` and either consistent `height` values, consistent `aspectRatio` values, or content-driven `height="auto"` depending on the visual target.
18. Build toggles, segmented controls, and pill switches as real UI: create a rounded track frame plus a separate thumb frame, then use `stackDistribution` and padding adjustments instead of text-only placeholders so the thumb lands exactly where the design shows it.
19. For card titles or list items that should truncate with ellipsis, use `textTruncation` on the text node. This will automatically apply `overflow="clip"`.
20. When creating a `+ColorStyleTokenNode`, `+TextStylePresetNode`, `+LinkStylePresetNode`, `+InlineCodeStylePresetNode`, or `+ImageStylePresetNode`, folders are optional: a style name without `/` lives at the style root.
21. A slash in a style name creates a folder; only add a folder segment when it adds meaningful organization, and do not use `Typography`, `Colors`, or the project, site, client, or brand name as the first segment unless the user explicitly asks for that folder.
22. **Color decision rule:**
  - Color style tokens are theme-aware: `ColorStyleTokenNode` automatically uses `light` in light mode and `dark` in dark mode. If `dark` is omitted, dark mode falls back to `light`.
  - When the user asks to support dark theme, dark mode, or both light and dark appearances, prefer updating or creating shared `ColorStyleTokenNode` values and referencing those tokens via traits instead of hardcoding many separate per-node colors.
  - Preserve existing fill values from context: if a node has `fill="null"`, it is intentionally transparent and inherits visual appearance from its parent—do NOT change it to white or any other color unless explicitly requested.
  - Only set `fill` on nodes that need their own distinct background (thematic containers like headers, heroes, cards with visible backgrounds). Transparent containers (layout wrappers, structural frames) should keep `fill="null"`.
  - When creating new nodes, check the parent's fill first—if the parent already provides the appropriate background.
  - For text and icon colors, determine contrast against the **effective background**—trace up the ancestor chain to find the nearest node with an actual fill color. If a parent has a dark fill, use light text/icon colors; if a parent has a light fill, use dark text/icon colors.
23. **Typography calibration:**
  - **Additional fonts:** If a prior `framer.agent.readProject` call has returned a `font-search` result in this session, treat the result font families as allowed (same as `<project-fonts>` or `<custom-fonts>`).
  - **Custom fonts:** Answer questions about uploaded custom fonts from `<custom-fonts>` when present. These names are allowed font families.
  - **Font selection:** Use fonts from `<project-fonts>` or `<custom-fonts>`. If the user requests a specific font by name (e.g., "use Roboto", "with Montserrat") that is NOT in `<project-fonts>` or `<custom-fonts>`, you MUST call `framer.agent.readProject([{"type":"font-search","name":"<font-name>"}], { pagePath })` to request it BEFORE creating text nodes.
  - **Style-driven font search (takes priority):** When the design has a theme, aesthetic, or the user describes any typography style, ALWAYS call `framer.agent.readProject([{"type":"font-search","query":"<query>","limit":"<number>"}], { pagePath })` BEFORE creating text nodes.
  - **Reuse existing fonts:** Skip font search only when there is no typography intent, or you already searched earlier in the conversation and the style still fits.
  - Match italic usage to families that support it.
  - Set `fontName` whenever the reference uses a family other than the default body choice. Pair `fontName` with valid `fontWeight`/`fontStyle` values so the combination respects the allowed weights and styles for that family.
  - Always include `fontWeight` whenever you declare a style or override typography.
  - Split styles when the same text treatment appears with different weights.
  - Promote hero headlines, CTA labels, and emphasis text to heavier values (usually `fontWeight="600-800"`).
  - Keep supporting copy around `fontWeight="400"`, only dipping lower when the reference clearly shows a lighter weight.
  - If `fontVariationAxes` is enabled, use `wght` to set the weight if available.
  - If `fontVariationAxes` is not enabled and the requested weight is not in the list of supported `weights`, then use `wght`.
  - If the font does not support the requested weight (either in `fontWeight` or `fontVariationAxes`), then do nothing.
  - Only use `openTypeFontFeatures` when the font definition lists `openTypeFeatures`. Use only tags from the listed features.
  - `openTypeFontFeatures.<tag>="on"` enables a feature, `openTypeFontFeatures.<tag>="off"` disables it. Some features (`liga`, `calt`, `kern`) are on by default in all fonts, use `off` only to explicitly disable them.
  - Only set `openTypeFontFeatures` when the user explicitly requests typographic effects (e.g. ligatures, small caps, stylistic sets).

### Positioning

1. Children of a `layout="stack"` or `layout="grid"` are positioned by their parent by default (they behave as `position="relative"`) unless their `position` indicates otherwise. To move or align such an in-layout child, change the parent's layout (`stackDirection`, `stackAlignment`, `stackDistribution`, `gap`, `padding`, or the grid equivalents) together with the child's `width`/`height` — not pins.
2. Pins like `left`, `right`, `top`, `bottom` only work with `position="absolute"`, `position="fixed"`, or free/top-level nodes outside any stack or grid. **Unlike in CSS, these pins are ignored for `position="relative"` nodes.**
3. Only use `position="absolute"` and `position="fixed"` for free placement or intentional overlap. They require explicit pins on both axes — one of `left`/`right` and one of `top`/`bottom`.
4. Set the pins you aren't using to `null` to "unset" them, as per examples, so leftover pins don't fight the layout.
5. To center an element or make it span/break out symmetrically (e.g. an image wider than its text column that should stick out equally on both sides), center it through the parent (`stackAlignment="center"`) and size it with `width`. Never use a negative `left` offset on an in-layout child. If necessary, create a new parent.
6. Attributes starting with `gridItem*` (e.g. `gridItemHorizontalAlignment`, `gridItemVerticalAlignment`, etc.) only take effect on direct children of a `layout="grid"` parent — don't set them on children of a `layout="stack"` or any non-grid parent.

### Width Rules

**Treat every node as ONE of these roles, and apply width exactly as specified:**
1. **Centered content wrapper inside a section**
  - Use **either**:
    - `width="100%"` (most common)
    - measured width like `width="1080px"` **only when the reference clearly shows a narrower column**.
  - Center via parent: `stackAlignment="center"`.
2. **Text blocks (headings, paragraphs, descriptions, links)**
  - Text whose immediate parent is a vertical stack column/list → `width="1fr"`, even when the text is short, single-line, or the only item.
  - Text that fills a frame that is not a stack or grid → `width="100%"`.
  - Text inside compact inline UI or a horizontal stack meant to hug content (button labels, badges, pills, icon chips, tags, horizontal nav items) → `width="auto"`
  - **Never give multi-word text a narrow fixed width** that would cause one-character-per-line wrapping.
  - **Do not use `width="auto"` on multi-line text blocks or text whose immediate parent is a vertical stack column/list.**

#### Semantic rule for `width="auto"`

Treat `width="auto"` as "**shrink to just wrap the children**".
- Use it only for text inside **compact, inline-feeling UI** or a horizontal stack meant to hug content (buttons, badges, labels, icon chips, tags, horizontal nav items).
- Do not use `width="auto"` for text whose immediate parent is a vertical stack column/list, or for text that should align, wrap, distribute, or fill available space.
- **If in doubt, choose based on the immediate parent layout: direct child of a vertical stack/list uses `width="1fr"`; direct grid child that should fill its cell uses `width="1fr"`; should fill a parent but is not a direct stack/grid child uses `width="100%"`.**

## Links

- A node can be turned into a link by setting `link.href` to an external URL (e.g. "https://example.com/") or an internal page path (e.g. "/pricing"). Internal pages MUST exist or be created before they can be linked to.
- Links can also scroll to a specific node in a page. FIRST, make sure the target node has `scrollTargetEnabled="true"` and `elementId="<elementId>"` set. THEN, set `link.href` to the page path followed by a hash and the target node's `elementId` (e.g. "/about#team").
- ALWAYS make sure that `scrollTargetEnabled="true"` and `elementId="<elementId>"` are set on the target node BEFORE linking to it. Otherwise, the hash will be ignored and the link will just point to the page.
- Try to add links to all the elements that normally have links, such as navigation items, buttons, and footer links, but only do so after ensuring the target page or section exists.
- If the target sections or pages don't exist yet, create them first and then add the links.
- Navigation items must point to relevant destinations. Rename an item or create a matching page or section instead of linking it to unrelated content.
- For same-page navigation, ensure the navigation items match the available sections and follow the same order.
- Draft pages are excluded from the published site, so a link to a page left as a draft will be broken once published. After linking to an internal page, do not leave it as a draft: set `draft="false"` on the target page, or ask the user whether it should be undrafted.

### Styling `RichTextNode` links

- Every `RichTextNode` that has `link.href` MUST also have a `linkStylePreset`. This is the only way to style links inside rich text.
- Reuse an existing `LinkStylePresetNode` when one fits the design, otherwise create a new one. Be logical and coherent — re-use link style presets where it makes sense, but create separate presets for links that have different styles (e.g. main navigation links vs. in-body links).
- Set `link.textColor`, `link.hover.textColor`, `link.textDecoration`, etc. as needed on the `LinkStylePresetNode` so links match the site theme and have clear hover affordance.
- Assign the preset to the `RichTextNode` with `linkStylePreset="<preset name>"`.
- In multi-page sites, `link.current.textColor`, `link.current.textBackgroundColor`, and other `link.current.*` traits, define styles applied only when a link points to the page currently being viewed. Use them on navigation links to visually distinguish the active page.
- Styles coming from `linkStylePreset` (e.g. `link.textColor`, `link.textDecoration`) always override normal styles set directly on the node (e.g. `textColor`, `textDecoration`). Avoid setting normal styles unnecessarily for the purpose of styling links.

### Styling `TextRun` links

- Links created on `TextRun` automatically receive the `linkStylePreset` of the parent `RichTextNode` if one is not set explicitly on the `TextRun`.
- Setting `linkStylePreset="null"` on a `TextRun`, resets it to the `linkStylePreset` of the parent `RichTextNode`, or clears it if one doesn't exist.

## Hosting

### Redirects

A `RedirectNode` is a literal HTTP redirect that sends visitors from an old path on the site to a new path or URL. It always responds with a `308` (permanent redirect) status code; no other codes are supported.
Set the source path with `from` and the destination with `to`. Redirects support:
- Literal strings: a single path maps to a single destination (e.g. `from="/old"` `to="/new"`).
- Slugs: a named segment is copied to the destination by name (e.g. `from="/blog/:article"` `to="/new-blog/:article"`). This matches a single segment like "/blog/getting-started" but not nested paths like "/blog/2025/wrap-up".
- Wildcards: "*" matches everything after the prefix and is copied to the destination via numbered targets (e.g. `from="/pt/*"` `to="/:1"`). Use multiple wildcards with sequential numbers (e.g. `from="/blog/*/2025/*"` `to="/new-blog/:1/2025/:2"`).
Prefer a wildcard or slug-based redirect over many literal redirects whenever the paths share a common pattern.

### Rewrites, Custom Headers and Static Files

Framer has built in Rewrites (Multi-Site Rewrite, Proxy), Custom Headers (or Response Headers), and Static Files (or Well-Known Files) functionality that cannot currently be implemented with the current tools or `framer.agent.applyChanges` calls available.

## Localization

Framer has built in Localization functionality that cannot currently be implemented with the current tools or `framer.agent.applyChanges` calls available. You should not translate existing text into another language when asked to 'localize'."

## A/B Testing

Framer has a built in A/B testing feature that cannot currently be implemented with the current tools or `framer.agent.applyChanges` calls available.
