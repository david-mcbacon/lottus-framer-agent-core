# Core Examples

Use these examples to guide resolving ambiguous user requests into concrete Framer outputs.
Pay careful attention to "Description" and "Example Context" of the examples to understand when the Output is expected.
---
Example Prompt: "Make the layout less dense".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET WHKr22AAm gap=\"10px\"; SET WeoMMVJ7w padding=\"10px 0px 10px 0px\" height=\"auto\"; SET qo0lasyg9 padding=\"10px 0px 10px 0px\" height=\"auto\"; SET Qp6bS1FEr padding=\"10px 0px 10px 0px\" height=\"auto\"; SET t0NXGFENs padding=\"10px 0px 10px 0px\" height=\"auto\"; SET kI0IciQcN padding=\"10px 0px 10px 0px\" height=\"auto\"; SET yenvhiBsT padding=\"10px 0px 10px 0px\" height=\"auto\";", { pagePath })
---
Example Prompt: "Turn into 2x2 Grid with double the spacing and rounder images".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET WRcwDmcLi layout=\"grid\" gridAlignment=\"center\" gridColumnCount=\"2\" gridColumnMinWidth=\"50px\" gridRowCount=\"2\" gridRowHeightType=\"auto\" gridRowHeight=\"200px\" gap=\"10px 10px\"; SET A51CDaA9L radius=\"10px\"; SET s3n9I3Sgu radius=\"10px\"; SET jeAVHMDlS radius=\"10px\";", { pagePath })
---
Example Prompt: "Make accent color a nice bright yellow".
Category: text, update
Expected Output: framer.agent.applyChanges("SET h1bmS5nt3 fill=\"rgb(255, 187, 0)\";", { pagePath })
---
Example Prompt: "Try with round avatars?".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET pWbbUTaZk radius=\"100px\"; SET XiKKVdsh_ radius=\"100px\";", { pagePath })
---
Example Prompt: "Feature the first image by making it span 2 rows and 2 cols".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET m_VV5hFP2 gridItemColumnSpan=\"2\" gridItemRowSpan=\"2\";", { pagePath })
---
Example Prompt: "Make logos a small, (dense | narrow), 3x3 grid".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET C5I7YkNuC layout=\"grid\" gridAlignment=\"center\" gridColumnCount=\"3\" gridColumnMinWidth=\"50px\" gridRowCount=\"3\" gridRowHeightType=\"auto\" gridRowHeight=\"200px\" width=\"300px\";", { pagePath })
---
Example Prompt: "Can we try a left aligned vertical navbar layout?".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET wRth9YEGr stackDirection=\"vertical\" stackDistribution=\"start\" stackAlignment=\"start\" gap=\"20px\" height=\"auto\"; SET kLrMLQamK stackDirection=\"vertical\" stackAlignment=\"start\" gap=\"5px\";", { pagePath })
---
Example Prompt: "Make symmetrical and place icon in middle of links".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET wRth9YEGr stackDistribution=\"center\"; MOVE ds4ZzM3Fq parent=\"kLrMLQamK\" position=\"2\";", { pagePath })
---
Example Prompt: "Have links span full width".
Category: layout, update
Example Explanation: "Since it's unclear if the links should be centred or not, just update the `stackDistribution`.".
Expected Output: framer.agent.applyChanges("SET kLrMLQamK stackDistribution=\"space-between\" width=\"1fr\";", { pagePath })
---
Example Prompt: "Make the links evenly occupy all available space".
Category: layout, update
Example Explanation: "Because we don't want the links to touch the edges of the parent, we don't use `stackDistribution="space-between"`, instead we use `width="1fr"` on each item to make them evenly occupy all available space. Since the text is already centred, we don't need any other modifications.".
Expected Output: framer.agent.applyChanges("SET iNth2fBii width=\"1fr\"; SET M4bviiwpE width=\"1fr\"; SET id0bS0Jsg width=\"1fr\"; SET gznTFn0cs width=\"1fr\";", { pagePath })
---
Example Prompt: "Make this grid (denser | narrower)".
Category: layout, update
Example Explanation: "When the input grid node is `width="auto"`, has `gridColumnMinWidth="50"` and filling it's parent which has `width="1000px"`, we need to reduce the width of the grid by setting a concrete size to make the columns narrower.".
Example Context: ```
[{"type":"FrameNode","id":"c61UCZi5o","$parentId":"scope-id","$scopeId":"scope-id","attributes":{"fill":"white","layout":"stack","stackDirection":"vertical","stackDistribution":"center","stackAlignment":"center","stackWrapEnabled":false,"gap":"10px","overflow":"clip","left":"5738px","right":"null","top":"3997px","bottom":"null","centerAnchorX":"0%","centerAnchorY":"0%","constraintsLocked":false,"width":"1000px","height":"468px"},"children":[{"type":"FrameNode","name":"Cards","id":"Szuwj9DOQ","attributes":{"layout":"grid","gridAlignment":"center","gridColumnCount":2,"gridColumnMinWidth":"50px","gridRowCount":2,"gridRowHeightType":"auto","gridRowHeight":"200px","gap":"10px","overflow":"clip","position":"relative","width":"1fr","height":"229px"},"children":[{"type":"FrameNode","name":"Card","id":"lIYVvZk0P","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}},{"type":"FrameNode","name":"Card","id":"auhsIVdYj","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}},{"type":"FrameNode","name":"Card","id":"ptIMSxNqq","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}},{"type":"FrameNode","name":"Card","id":"fg4jnPM9D","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}}]}]}]
```
Expected Output: framer.agent.applyChanges("SET Szuwj9DOQ width=\"500px\";", { pagePath })
---
Example Prompt: "Make this grid (denser | narrower)".
Category: layout, update
Example Explanation: "When the input grid node is `width="auto"`, has `gridColumnWidth="500"` and filling it's parent which has `width="1000px"`, we need to reduce the width of the grid by reducing the width of the columns.".
Example Context: ```
[{"type":"FrameNode","id":"c61UCZi5o","$parentId":"scope-id","$scopeId":"scope-id","attributes":{"fill":"white","layout":"stack","stackDirection":"vertical","stackDistribution":"center","stackAlignment":"center","stackWrapEnabled":false,"gap":"10px","overflow":"clip","left":"5738px","right":"null","top":"3997px","bottom":"null","centerAnchorX":"0%","centerAnchorY":"0%","constraintsLocked":false,"width":"1000px","height":"468px"},"children":[{"type":"FrameNode","name":"Cards","id":"Szuwj9DOQ","attributes":{"layout":"grid","gridAlignment":"center","gridColumnCount":2,"gridColumnWidth":"500px","gridRowCount":2,"gridRowHeightType":"auto","gridRowHeight":"200px","gap":"10px","overflow":"clip","position":"relative","width":"1fr","height":"229px"},"children":[{"type":"FrameNode","name":"Card","id":"lIYVvZk0P","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}},{"type":"FrameNode","name":"Card","id":"auhsIVdYj","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}},{"type":"FrameNode","name":"Card","id":"ptIMSxNqq","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}},{"type":"FrameNode","name":"Card","id":"fg4jnPM9D","attributes":{"fill":"#4cf","layout":"null","overflow":"clip","position":"relative","width":"109px","height":"94px"}}]}]}]
```
Expected Output: framer.agent.applyChanges("SET Szuwj9DOQ gridColumnWidth=\"250px\";", { pagePath })
---
Example Prompt: "Center layout and put logo in middle of links".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET d0zuItEQC stackDistribution=\"center\"; SET r8KWpd9ws stackDistribution=\"center\" width=\"auto\"; MOVE qHgsNDPaB parent=\"r8KWpd9ws\" position=\"2\";", { pagePath })
---
Example Prompt: "Make the links fill the space".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET r8KWpd9ws width=\"1fr\"; SET kc0BgmOwu width=\"1fr\"; SET yGd6oMgDm width=\"1fr\"; SET Si8u8Y5Cc width=\"1fr\"; SET ZUk3po84b width=\"1fr\";", { pagePath })
---
Example Prompt: "Replace the images with my images".
Category: update
Example Explanation: "No updates other than `fill` are required since the prompt is a specific instruction.".
Example Images: <image-attachments>[{"url":"https://framerusercontent.com/assets/9nfnlHB3O5VQP9oeRwyvi7ztrE.png","name":"studio-portrait.jpg"},{"url":"https://framerusercontent.com/assets/ApXnpSn7KTqRCzLmeQs9psd1fSU.png","name":"team-offsite.jpg"},{"url":"https://framerusercontent.com/assets/ArrUzY8CZC2i6zL1BT8FMm3Mg1k.png","name":"founder-headshot.jpg"}]</image-attachments>
Expected Output: framer.agent.applyChanges("SET AzqEAmjRl fill=\"https://framerusercontent.com/assets/9nfnlHB3O5VQP9oeRwyvi7ztrE.png\"; SET KDbTNPVHf fill=\"https://framerusercontent.com/assets/ApXnpSn7KTqRCzLmeQs9psd1fSU.png\"; SET v9mCJDnM7 fill=\"https://framerusercontent.com/assets/ArrUzY8CZC2i6zL1BT8FMm3Mg1k.png\";", { pagePath })
---
Example Prompt: "Update the other links to match Gallery".
Category: layout, update, create
Expected Output: framer.agent.applyChanges("SET mVuB_Yu54 $control__icon=\"Blogger\"; +FrameNode LR6qrmbKC parent=\"eAjFKmWd8\" position=\"1\"; SET LR6qrmbKC layout=\"stack\" stackDirection=\"horizontal\" stackDistribution=\"center\" stackAlignment=\"center\" gap=\"10px\" overflow=\"clip\" position=\"relative\" width=\"auto\" height=\"21px\"; +IconNode fRQWQVsfx parent=\"LR6qrmbKC\" position=\"0\" set=\"Meteor\" $control__icon=\"Blogger\"; SET fRQWQVsfx $control__color=\"rgb(153, 153, 153)\" position=\"relative\" width=\"17px\" height=\"17px\" aspectRatio=\"1\"; +RichTextNode jdTNgUKN1 parent=\"LR6qrmbKC\" position=\"1\"; SET jdTNgUKN1 position=\"relative\" pointerEvents=\"none\" width=\"auto\" height=\"auto\" userSelect=\"none\" zIndex=\"1\"; +FrameNode LavXhaJ90 parent=\"eAjFKmWd8\" position=\"2\"; SET LavXhaJ90 layout=\"stack\" stackDirection=\"horizontal\" stackDistribution=\"center\" stackAlignment=\"center\" gap=\"10px\" overflow=\"clip\" position=\"relative\" width=\"auto\" height=\"21px\"; +IconNode IEQ48MU_m parent=\"LavXhaJ90\" position=\"0\" set=\"Meteor\" $control__icon=\"Circle Exclamation\"; SET IEQ48MU_m $control__color=\"rgb(153, 153, 153)\" position=\"relative\" width=\"17px\" height=\"17px\" aspectRatio=\"1\"; +RichTextNode Pr41ZOzh8 parent=\"LavXhaJ90\" position=\"1\"; SET Pr41ZOzh8 position=\"relative\" pointerEvents=\"none\" width=\"auto\" height=\"auto\" userSelect=\"none\" zIndex=\"1\"; +FrameNode mYOaQUeNw parent=\"eAjFKmWd8\" position=\"3\"; SET mYOaQUeNw layout=\"stack\" stackDirection=\"horizontal\" stackDistribution=\"center\" stackAlignment=\"center\" gap=\"10px\" overflow=\"clip\" position=\"relative\" width=\"auto\" height=\"21px\"; +IconNode lcq2jOOTf parent=\"mYOaQUeNw\" position=\"0\" set=\"Meteor\" $control__icon=\"Gift\"; SET lcq2jOOTf $control__color=\"rgb(153, 153, 153)\" position=\"relative\" width=\"17px\" height=\"17px\" aspectRatio=\"1\"; +RichTextNode R0p0ayBQq parent=\"mYOaQUeNw\" position=\"1\"; SET R0p0ayBQq position=\"relative\" pointerEvents=\"none\" width=\"auto\" height=\"auto\" userSelect=\"none\" zIndex=\"1\";", { pagePath })
---
Example Prompt: "Recreate this footer on my page".
Category: layout, create
Example Explanation: "The user is asking to recreate the footer from the attached image. In recreate/match intent, maximum visual and layout accuracy to the reference is the top priority. First infer hierarchy: top-level sections -> section containers -> child groups -> leaf elements. Determine parent-child relationships from shared bounds, alignment, and visual containment (backgrounds, borders, wrappers), then place children relative to parents (parent gap controls sibling spacing, parent padding controls internal spacing; use absolute only for intentional overlap). Preserve spacing ratios across levels (outer margin vs section padding vs internal gaps) so distinctive whitespace is not flattened. After structure is set, match typography, spacing, and color palette, then request Implementation Guidance Documentation, fonts to match typography, and node context to continue the build.".
Example Images: <image-attachments>[{"url":"https://framerusercontent.com/assets/Hk3pQ2nRtLvWmXcYbZsDfGjN8.png","name":"footer-reference.png"}]</image-attachments>
Expected Output: framer.agent.applyChanges("SET minimalScope fill=\"linear-gradient(180deg, rgb(12, 18, 33) 0%, rgb(28, 37, 65) 100%)\";", { pagePath })
---
Example Prompt: "Add a Tablet breakpoint, add a label in each breakpoint with corresponding text".
Category: replicas
Example Explanation: "Create a new Variant from the existing Breakpoint. Insert a single node, then modify it in each replica to have the corresponding text.".
Expected Output: framer.agent.applyChanges("CREATE_VARIANT tablet from=\"WQLkyLRf1\"; SET tablet name=\"Tablet\" width=\"810px\" left=\"1240px\" top=\"0px\"; +RichTextNode label parent=\"WQLkyLRf1\"; SET label text=\"Desktop\"; SET tabletlabel text=\"Tablet\";", { pagePath })
---
Example Prompt: "Add text here that says 'Tablet'".
Category: replicas
Example Explanation: "Since the selection is a Replica Variant, we MUST add the text in the Primary Variant, then modify it in the Replica Variant to make it visible.".
Expected Output: framer.agent.applyChanges("+RichTextNode label parent=\"WQLkyLRf1\"; SET label text=\"Tablet\" visible=\"false\"; SET dz8fcT1Jylabel visible=\"true\";", { pagePath })
---
Example Prompt: "Make the title text better reflect the content of this subheading".
Category: update
---
Example Prompt: "Add 3 product feature cards here".
Category: layout, create
Example Explanation: "When the request requires certain features to be implemented that don't already exist on the page, request similar Implementation Guidance Documentation.".
---
Example Prompt: "Add a testimonials section with 3 customer reviews".
Category: layout, create
Example Explanation: "Even when specific content is provided (e.g. '3 customer reviews'), always request the necessary Implementation Guidance Documentation.".
---
Example Prompt: "Create a button component".
Category: create
Example Explanation: "Create the label variable first and bind the `RichTextNode` label to its variable reference.".
Expected Output: framer.agent.applyChanges("+ComponentNode component-button name=\"Button\"; +FrameNode frame-button parent=\"component-button\"; SET frame-button layout=\"stack\" stackAlignment=\"center\" stackDistribution=\"center\" padding=\"10px\"; +Variable cNtr1abcd name=\"Content\" type=\"string\" initialValue=\"Click me\" scope=\"component-button\"; +RichTextNode text-button parent=\"frame-button\" name=\"Content\"; SET text-button text=\"var(--variable-cNtr1abcd)\";", { pagePath })
---
Example Prompt: "Create a `ComponentNode` with a button that triggers an event handler variable".
Category: create
Example Explanation: "Use the minimal `EventHandler` pattern: add `+ComponentNode`, create `+EventHandlerVariable` on the component scope, place the button directly under the component as its primary variant, and wire the button with `onTap.0.action="TRIGGER_EVENT"` plus `onTap.0.controls.id="var(--variable-<event-handler-variable-id>)"`.".
Expected Output: framer.agent.applyChanges("+ComponentNode test-trigger-comp name=\"Test Trigger\"; +FrameNode fire-btn parent=\"test-trigger-comp\" name=\"Fire Button\"; SET fire-btn htmlTag=\"button\" cursor=\"pointer\" layout=\"stack\" stackDirection=\"horizontal\" stackAlignment=\"center\" stackDistribution=\"center\" gap=\"6px\" padding=\"10px 18px\" width=\"auto\" height=\"auto\" fill=\"rgba(239, 68, 68, 1)\" radius=\"8px\"; +EventHandlerVariable var-on-fire name=\"On Fire\" scope=\"test-trigger-comp\"; SET fire-btn onTap.0.action=\"TRIGGER_EVENT\" onTap.0.controls.id=\"var(--variable-var-on-fire)\"; +RichTextNode fire-label parent=\"fire-btn\" name=\"Label\"; SET fire-label text=\"Fire\" width=\"auto\" height=\"auto\" textColor=\"rgba(255,255,255,1)\";", { pagePath })
---
Example Prompt: "Create an interactive FAQ component".
Category: create
Example Explanation: "For accordion/disclosure components with two variants (Open/Closed), hide the answer in the Closed variant with `visible="false"`. Use `SET_VARIANT` with cycle for two-variant toggles.".
Expected Output: framer.agent.applyChanges("+ComponentNode faq-component name=\"FAQ/Question\"; +FrameNode faq-open parent=\"faq-component\"; SET faq-open name=\"Open\" layout=\"stack\" stackDirection=\"vertical\" width=\"1fr\" height=\"auto\"; +FrameNode faq-row parent=\"faq-open\"; SET faq-row layout=\"stack\" stackDirection=\"horizontal\" stackDistribution=\"space-between\" stackAlignment=\"center\" width=\"1fr\" height=\"auto\"; +Variable var-question name=\"Question\" type=\"string\" initialValue=\"What services do you offer?\" scope=\"faq-component\"; +RichTextNode faq-question-text parent=\"faq-row\"; SET faq-question-text text=\"var(--variable-var-question)\" width=\"1fr\" height=\"auto\"; +IconNode faq-icon set=\"Lucide\" $control__icon=\"Minus\" parent=\"faq-row\"; +FrameNode faq-answer parent=\"faq-open\"; SET faq-answer width=\"1fr\" height=\"auto\"; +Variable var-answer name=\"Answer\" type=\"string\" initialValue=\"We offer a full range of design and development services.\" scope=\"faq-component\"; +RichTextNode faq-answer-text parent=\"faq-answer\"; SET faq-answer-text text=\"var(--variable-var-answer)\" width=\"1fr\" height=\"auto\"; SET faq-row onTap.0.action=\"SET_VARIANT\" onTap.0.controls.variant=\"cycle\"; CREATE_VARIANT faq-closed from=\"faq-open\"; SET faq-closed name=\"Closed\" height=\"auto\"; SET faq-closedfaq-icon $control__icon=\"Plus\"; SET faq-closedfaq-answer visible=\"false\";", { pagePath })
---
Example Prompt: "Create a fixed overlay from this button with a dimmed dismissible backdrop".
Category: create, update
Example Explanation: "Create a fixed overlay that opens from the tapped button, then configure the dimmed dismissible backdrop with `backdrop` attributes.".
Expected Output: framer.agent.applyChanges("+FixedOverlayNode DfghyUQhH parent=\"yl6L_LGRF\" position=\"1\"; SET DfghyUQhH backdrop.fill=\"rgba(0, 0, 0, 0.8)\" backdrop.dismissible=\"true\" backdrop.enter=\"tween 0.5,0,0.88,0.77 0s 0s\" backdrop.exit=\"tween 0.12,0.23,0.5,1 0s 0s\"; SET yl6L_LGRF onTap.0.action=\"SHOW_OVERLAY\" onTap.0.controls.overlay=\"DfghyUQhH\";", { pagePath })
---
Example Prompt: "Create a dropdown menu that opens below this button on hover".
Category: create, update
Example Explanation: "Create a `+RelativeOverlayNode` and configure `floatingPlacement` and `floatingAlignment` for a relative overlay anchored to the hovered button.".
Expected Output: framer.agent.applyChanges("+RelativeOverlayNode F5C4uM4r2 parent=\"yl6L_LGRF\" position=\"1\"; SET F5C4uM4r2 appearEffect.trigger=\"onMount\" appearEffect.enter.opacity=\"0\" appearEffect.enter.x=\"0\" appearEffect.enter.y=\"0\" appearEffect.enter.scale=\"1\" appearEffect.enter.rotate=\"0\" appearEffect.enter.rotateX=\"0\" appearEffect.enter.rotateY=\"0\" appearEffect.enter.skewX=\"0\" appearEffect.enter.skewY=\"0\" appearEffect.enter.transition=\"spring-duration 0.4s 0.2 0s\" appearEffect.enter.stagger=\"0s\" boxShadows.0=\"0px 10px 20px 0px rgba(0,0,0,0.05)\" fill=\"rgba(255,255,255,1)\" layout=\"null\" overflow=\"clip\" radius=\"10px\" floatingPlacement=\"bottom\" floatingAlignment=\"center\" floatingOffsetX=\"0px\" floatingOffsetY=\"10px\" floatingCollisionDetection=\"true\" floatingCollisionPadding=\"20px\" width=\"200px\" height=\"150px\"; SET yl6L_LGRF onMouseEnter.0.action=\"SHOW_OVERLAY\" onMouseEnter.0.controls.overlay=\"F5C4uM4r2\";", { pagePath })
---
Example Prompt: "When clicking on this button show an overlay".
Category: create, update
Example Explanation: "For an existing `ComponentInstanceNode` whose `component` is listed under Current Project in `<available-components>`, first request component controls and retrieve the node with `exec` so the local `ComponentNode` is in context. If the source does not already expose a suitable `EventHandler` control for this interaction, add `+EventHandlerVariable` on the component scope, wire the source trigger node with `onTap.0.action="TRIGGER_EVENT"` plus `onTap.0.controls.id="var(--variable-<event-handler-variable-id>)"`, then create the overlay and bind `SHOW_OVERLAY` to the instance's exposed `eventKey` (for example `onClick`).".
Expected Output: framer.agent.applyChanges("+EventHandlerVariable var-on-click name=\"On Click\" scope=\"button-component\"; SET source-trigger-node onTap.0.action=\"TRIGGER_EVENT\" onTap.0.controls.id=\"var(--variable-var-on-click)\"; +RelativeOverlayNode menu-overlay parent=\"button-instance\"; SET menu-overlay floatingPlacement=\"bottom\" floatingAlignment=\"start\" floatingOffsetY=\"8px\" width=\"220px\" height=\"auto\" fill=\"rgba(18,18,18,1)\" radius=\"12px\" padding=\"8px\"; SET button-instance onClick.0.action=\"SHOW_OVERLAY\" onClick.0.controls.overlay=\"menu-overlay\";", { pagePath })
---
Example Prompt: "I want the overlay to be shown on hover".
Category: update
Example Explanation: "If that overlay currently opens because the source component fires `TRIGGER_EVENT` from `onTap` and component controls show the instance exposes only `onClick`, first retrieve the node with `exec`. Then switch the internal source trigger from `onTap` to `onMouseEnter`, keep the instance `SHOW_OVERLAY` action on `onClick`, and do not rewrite the instance handler to `onMouseEnter`.".
Expected Output: framer.agent.applyChanges("SET source-trigger-node onTap.0=\"null\"; SET source-trigger-node onMouseEnter.0.action=\"TRIGGER_EVENT\" onMouseEnter.0.controls.id=\"var(--variable-var-on-click)\"; SET button-instance onClick.0.action=\"SHOW_OVERLAY\" onClick.0.controls.overlay=\"menu-overlay\";", { pagePath })
---
Example Prompt: "Switch to Variant 2 when the overlay is open".
Category: update
Example Explanation: "When a `ComponentInstanceNode` already has `whileOpen` and an overlay wired, prefer `whileOpen` to switch variants while the overlay is open. Do not add a `SET_VARIANT` action to the event handler.".
Expected Output: framer.agent.applyChanges("SET button-instance whileOpen=\"Variant 2\";", { pagePath })
---
Example Prompt: "Add some buttons".
Category: create, update
Example Explanation: "When inserting a `ComponentInstanceNode` that has icon controls, always set the icon control to an appropriate icon for the button. It should always be on the first `SET` that configures the instance.".
Expected Output: framer.agent.applyChanges("+ComponentInstanceNode N6LAMmsxZ parent=\"WQLkyLRf1\" position=\"0\" component=\"Xx_2f0XsX\"; SET N6LAMmsxZ $control__icon=\"Download\" $control__title=\"Download\" position=\"relative\" width=\"auto\" height=\"auto\";", { pagePath })
---
Example Prompt: "Add a fade in animation on appear".
Category: effect, update
Expected Output: framer.agent.applyChanges("SET WHKr22AAm appearEffect.threshold=\"0.5\" appearEffect.trigger=\"onMount\" appearEffect.enter.opacity=\"0\" appearEffect.enter.x=\"0\" appearEffect.enter.y=\"0\" appearEffect.enter.scale=\"1\" appearEffect.enter.rotate=\"0\" appearEffect.enter.rotateX=\"0\" appearEffect.enter.rotateY=\"0\" appearEffect.enter.skewX=\"0\" appearEffect.enter.skewY=\"0\" appearEffect.enter.transition=\"spring-duration 0.4s 0.2 0s\" appearEffect.enter.stagger=\"0s\";", { pagePath })
---
Example Prompt: "Add a shadow to the card".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET G76q2ibR5 boxShadows.0=\"0px 2px 4px 0px red\" boxShadows.1=\"0px 4px 8px 0px red\" boxShadows.2=\"0px 0px 0px 1px red\";", { pagePath })
---
Example Prompt: "Make the shadows red".
Category: layout, update
Expected Output: framer.agent.applyChanges("SET G76q2ibR5 boxShadows.0=\"0px 2px 4px 0px red\" boxShadows.1=\"0px 4px 8px 0px red\" boxShadows.2=\"0px 0px 0px 1px red\";", { pagePath })
---
Example Prompt: "Add 3 color styles: Primary Blue, Background White, and Text Black".
Category: token, create
Example Explanation: "Primary Blue has different values for light and dark modes, while Background and Text only specify light mode (dark is optional)".
Expected Output: framer.agent.applyChanges("+ColorStyleTokenNode color-style-token-1 name=\"Primary Blue\"; SET color-style-token-1 light=\"#0099FF\" dark=\"#0066CC\"; +ColorStyleTokenNode color-style-token-2 name=\"Background White\"; SET color-style-token-2 light=\"#FFFFFF\"; +ColorStyleTokenNode color-style-token-3 name=\"Text Black\"; SET color-style-token-3 light=\"#000000\";", { pagePath })
---
Example Prompt: "Create a style preset for button text".
Category: stylePreset, create
Example Explanation: "Button text typically uses medium weight, slightly increased letter spacing, and uppercase transform".
Expected Output: framer.agent.applyChanges("+TextStylePresetNode style-preset-1 name=\"Button Text\" tag=\"p\"; SET style-preset-1 fontSize=\"14px\" fontWeight=\"500\" letterSpacing=\"0.5px\" textTransform=\"uppercase\"; SET button-text textStylePreset=\"Button Text\";", { pagePath })
---
Example Prompt: "Convert this FAQ title into a reusable text style".
Category: stylePreset, update
Example Explanation: "When converting existing text into a reusable preset, preserve the current visible color by copying it into the preset unless the user explicitly asked to restyle the theme.".
Expected Output: framer.agent.applyChanges("+TextStylePresetNode style-preset-1 name=\"FAQ Title\" tag=\"p\"; SET style-preset-1 fontName=\"Geist Mono\" fontWeight=\"700\" fontSize=\"32px\" letterSpacing=\"-0.03em\" lineHeight=\"1.15em\" textColor=\"rgb(15, 15, 15)\"; SET J29QInxOS textStylePreset=\"FAQ Title\";", { pagePath })
---
Example Prompt: "Detach the text style preset from the button text".
Category: stylePreset, update
Example Explanation: "Unassigns the text style preset from the button text, automatically inlining the preset styles into the text (pre-existing inline styles win). The text remains visually unchanged, but no longer linked to the preset.".
Expected Output: framer.agent.applyChanges("SET button-text textStylePreset=\"null\";", { pagePath })
---
Example Prompt: "Make the heading smaller on tablet and mobile".
Category: stylePreset, update
Example Explanation: "Multiple breakpoint style additions can go in one command. Setting style attributes on a non-existent label creates the slot.".
Expected Output: framer.agent.applyChanges("SET style-preset-1 breakpoint.medium.fontSize=\"36px\" breakpoint.small.fontSize=\"28px\";", { pagePath })
---
Example Prompt: "The heading style has medium, small, and extraSmall breakpoints. Update medium to 32px and add a large breakpoint at 48px.".
Category: stylePreset, update
Example Explanation: "Update existing slots first. The `large` slot must be in its own `SET` because it triggers label relabeling.".
Expected Output: framer.agent.applyChanges("SET style-preset-1 breakpoint.medium.fontSize=\"32px\"; SET style-preset-1 breakpoint.large.fontSize=\"48px\";", { pagePath })
---
Example Prompt: "Update the medium breakpoint of the heading style to 32px".
Category: stylePreset, update
Example Explanation: "Use breakpoint.<label>.<property> to update an existing breakpoint slot property.".
Expected Output: framer.agent.applyChanges("SET style-preset-1 breakpoint.medium.fontSize=\"32px\";", { pagePath })
---
Example Prompt: "The heading style has medium, small, and extraSmall breakpoints. Update medium to 32px and remove the extraSmall breakpoint.".
Category: stylePreset, update
Example Explanation: "Update existing slots first. Each removal must be in its own `SET` because it shifts labels.".
Expected Output: framer.agent.applyChanges("SET style-preset-1 breakpoint.medium.fontSize=\"32px\"; SET style-preset-1 breakpoint.extraSmall=\"null\";", { pagePath })
---
Example Prompt: "The heading style has medium and small breakpoints. Update medium to 32px, remove small, and add an extraSmall breakpoint at 24px.".
Category: stylePreset, update
Example Explanation: "Update existing slots first, then remove (own `SET`), then add remaining slots.".
Expected Output: framer.agent.applyChanges("SET style-preset-1 breakpoint.medium.fontSize=\"32px\"; SET style-preset-1 breakpoint.small=\"null\"; SET style-preset-1 breakpoint.extraSmall.fontSize=\"24px\";", { pagePath })
---
Example Prompt: "Set text size to fit".
Category: create, text
Expected Output: framer.agent.applyChanges("SET text fontSize=\"auto-fit(100%)\";", { pagePath })
---
Example Prompt: "Add a link to the text".
Category: update, text
Example Explanation: "Setting `link.href` on a `RichTextNode` applies the link to all its text content.".
Expected Output: framer.agent.applyChanges("SET text link.href=\"https://example.com\" link.openInNewTab=\"true\";", { pagePath })
---
Example Prompt: "Update the existing Getting Started item Content rich text field by adding a CodeBlock after the intro paragraph with code `npm run dev` and language `shell`. Style the CodeBlock with the dark theme and background #111827.".
Category: update, text
Example Explanation: "When embedding a Code Block in CMS rich text, keep content controls (`$control__code`, `$control__language`) on the `TextComponentInstance` and move preset-only visual controls to a `ComponentPresetNode` assigned through `componentPreset.codeBlock`.".
Expected Output: framer.agent.applyChanges("+ComponentPresetNode codePreset component=\"codeBlock\" name=\"Shell Dark\"; SET codePreset $control__theme=\"Static\" $control__theme1=\"atomDark\" $control__fill=\"#111827\"; +TextComponentInstance codeEmbed component=\"codeBlock\" parent=\"<itemId>/<richTextVarId>\" position=\"2\"; SET codeEmbed $control__code=\"npm run dev\" $control__language=\"Shell\"; SET <richTextNodeId> componentPreset.codeBlock=\"Shell Dark\";", { pagePath })
---
Example Prompt: "Remove the hover effect from the button".
Category: update, effect
Example Explanation: "Most effects can be removed by setting the effect to null".
Expected Output: framer.agent.applyChanges("SET button hoverEffect=\"null\";", { pagePath })
---
Example Prompt: "Add a heading with 'Hello' in red and 'World' in yellow".
Category: text, create
Example Explanation: "Use `TextBlock` and `TextRun` to apply different inline styles per word.".
Expected Output: framer.agent.applyChanges("+RichTextNode heading; +TextBlock tb1 tag=\"h1\" parent=\"heading\"; +TextRun tr1 parent=\"tb1\"; SET tr1 text=\"Hello \" fontWeight=\"700\" textColor=\"rgb(255, 0, 0)\"; +TextRun tr2 parent=\"tb1\"; SET tr2 text=\"World\" fontWeight=\"700\" textColor=\"rgb(255, 221, 0)\";", { pagePath })
---
Example Prompt: "Add a heading and a paragraph below it".
Category: text, create
Example Explanation: "Use multiple `TextBlock` nodes with different tags to create multi-paragraph rich text within a single `RichTextNode`.".
Expected Output: framer.agent.applyChanges("+RichTextNode heading; +TextBlock tb1 tag=\"h1\" parent=\"heading\"; +TextRun tr1 parent=\"tb1\"; SET tr1 text=\"Welcome\" fontWeight=\"700\"; +TextBlock tb2 tag=\"p\" parent=\"heading\"; +TextRun tr2 parent=\"tb2\"; SET tr2 text=\"This is a paragraph of text below the heading.\";", { pagePath })
---
Example Prompt: "Add a short paragraph with an inline line break after the first sentence".
Category: text, create
Example Explanation: "Use a `TextLineBreak` node for inline line breaks inside one paragraph instead of using newline characters.".
Expected Output: framer.agent.applyChanges("+RichTextNode paragraph; +TextBlock tb1 tag=\"p\" parent=\"paragraph\"; +TextRun tr1 parent=\"tb1\"; SET tr1 text=\"First sentence.\"; +TextLineBreak tr-break parent=\"tb1\"; +TextRun tr2 parent=\"tb1\"; SET tr2 text=\"Second sentence on a new line.\";", { pagePath })
---
Example Prompt: "Write two paragraphs with whitespace between them".
Category: text, create
Example Explanation: "Use an empty `TextBlock` (containing only a `TextLineBreak`) between content `TextBlock` nodes to create visible vertical whitespace between paragraphs.".
Expected Output: framer.agent.applyChanges("+RichTextNode content; +TextBlock tb1 tag=\"p\" parent=\"content\"; +TextRun tr1 parent=\"tb1\"; SET tr1 text=\"This is the first paragraph.\"; +TextBlock spacer tag=\"p\" parent=\"content\"; +TextLineBreak spacer-br parent=\"spacer\"; +TextBlock tb2 tag=\"p\" parent=\"content\"; +TextRun tr2 parent=\"tb2\"; SET tr2 text=\"This is the second paragraph.\";", { pagePath })
---
Example Prompt: "Make only the word Einstein red in this paragraph".
Category: text, update
Example Explanation: "When the user asks for an inline edit to one word, rewrite the existing `TextRun` in place: keep run order stable, split only at styling boundaries, and style just the inserted target run.".
Expected Output: framer.agent.applyChanges("SET tr1 text=\"Born in Ulm, Germany, \"; +TextRun tr-einstein parent=\"tb1\"; SET tr-einstein text=\"Einstein\" textColor=\"rgb(239, 68, 68)\" fontWeight=\"700\"; +TextRun tr2 parent=\"tb1\"; SET tr2 text=\" revolutionized modern physics.\";", { pagePath })
---
Example Prompt: "Create a layout template with a navigation and footer".
Category: create
Example Explanation: "Create the `LayoutTemplateNode` and immediately create and `SET` its primary breakpoint `FrameNode` before setting layout-template properties or adding shared elements. The generated placeholder will occupy the page-content position, so place shared elements around it.".
Expected Output: framer.agent.applyChanges("+LayoutTemplateNode layout-template name=\"Product Layout\"; +FrameNode layout-desktop parent=\"layout-template\"; SET layout-desktop fill=\"#ffffff\" layout=\"stack\" stackDirection=\"vertical\" stackDistribution=\"start\" stackAlignment=\"center\" gap=\"0px\"; +FrameNode nav position=\"0\" parent=\"layout-desktop\"; SET nav name=\"Navigation\" layout=\"stack\" stackDirection=\"horizontal\" stackDistribution=\"space-between\" stackAlignment=\"center\" width=\"1fr\" height=\"auto\"; +FrameNode footer position=\"2\" parent=\"layout-desktop\"; SET footer name=\"Footer\" layout=\"stack\" stackDirection=\"horizontal\" stackDistribution=\"center\" stackAlignment=\"center\" width=\"1fr\" height=\"auto\";", { pagePath })
---
Example Prompt: "Create a features page".
Category: create
Example Explanation: "Create the `WebPageNode` and immediately create and `SET` its primary breakpoint `FrameNode` before adding any other page content.".
Expected Output: framer.agent.applyChanges("+WebPageNode features-page name=\"Features\" path=\"/features\"; +FrameNode features-root parent=\"features-page\"; SET features-root fill=\"#ffffff\";", { pagePath })
