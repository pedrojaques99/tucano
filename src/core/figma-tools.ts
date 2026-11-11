// Snapshot of the tools of Figma's remote MCP server (mcp.figma.com), taken 2026-11-11, for the
// Figma bridge (figma-bridge.ts). Claude Code reports only the names of the tools it has, not their
// schemas, so the schemas live here. A tool Figma adds later still works through `figma_call`; take a
// new snapshot when one should get its own schema.
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

type Schema = Record<string, unknown>

const fileKey = { type: 'string', minLength: 1, pattern: '^[0-9a-zA-Z]{22,128}$', description: 'The Figma file key: in figma.com/design/:fileKey/:fileName?node-id=1-2 it is :fileKey. For a branch URL (/design/:fileKey/branch/:branchKey/...) use the branchKey.' }
const nodeId = { type: 'string', minLength: 1, pattern: '^\\d+[:-]\\d+$', description: 'Node id, e.g. "123:456" or "123-456" (node-id=1-2 in a URL is "1:2"). Never empty or guessed.' }
const anyNodeId = { anyOf: [{ type: 'string', minLength: 1, pattern: '^\\d+[:-]\\d+$' }, { type: 'string', minLength: 1, pattern: '^I\\d+[:-]\\d+(?:;\\d+[:-]\\d+)*$' }, { type: 'string', minLength: 1, pattern: '^T\\d+[:-]\\d+(?:;\\d+[:-]\\d+){2}$' }], description: nodeId.description }
const sessionId = { type: 'string', format: 'uuid', description: 'After create_session succeeds, pass its exact returned UUID here on every file-tool call for this task, even when fileKey differs.' }
const planKey = { type: 'string', minLength: 1, pattern: '^(team|organization)::\\d+$', description: 'The team or organization key (e.g. "team::1234567890"), the `key` of one of the plans whoami returns. With more than one plan, ask which one.' }
const promptId = { type: 'string', format: 'uuid', description: 'One fresh UUID per user prompt that imports code or design into Figma, reused on every import call for that prompt.' }
const frameworks = { type: 'string', description: 'Comma-separated frameworks in use (e.g. react, vue), or unknown. Logging only.' }
const languages = { type: 'string', description: 'Comma-separated languages in use (e.g. typescript,css), or unknown. Logging only.' }
const skillNames = { type: 'string', description: 'Comma-separated Figma skill names being followed, only when skill documentation says so. Logging only.' }
const label = { type: 'string', enum: ['React', 'Web Components', 'Vue', 'Svelte', 'Storybook', 'Javascript', 'Swift', 'Swift UIKit', 'Objective-C UIKit', 'SwiftUI', 'Compose', 'Java', 'Kotlin', 'Android XML Layout', 'Flutter', 'Markdown'], description: 'The framework or language of the Code Connect mapping.' }
const id = { type: 'string', minLength: 1, description: 'The id of the resource, from the matching list tool.' }
const cursor = { type: 'string', description: 'nextCursor from a previous call; omit for the first page.' }
const commitMessage = { type: 'string', minLength: 1, description: "A concise title of the user's requested change (the intent, not the implementation)." }
const versionDescription = { type: 'string', minLength: 1, description: 'One line: the user-visible result of this version.' }
const versionDetail = { type: 'string', minLength: 1, description: 'The key implementation detail in 1–2 short sentences.' }
const includeSource = { type: 'boolean', default: false, description: "Include each file's source in the result. Only when the client cannot read MCP resources." }
const version = { type: 'string', description: 'Optional 40-character commit SHA; defaults to the latest build.' }

const obj = (properties: Record<string, Schema>, required: string[] = []): Tool['inputSchema'] & Schema => ({ type: 'object', additionalProperties: false, properties, ...(required.length ? { required } : {}) })
const read = { readOnlyHint: true }
const write = { readOnlyHint: false }

export const FIGMA_TOOLS: Tool[] = [
  {
    name: 'whoami',
    description: "Returns the authenticated user's handle, email, plans (with each plan's key) and seats. Use it for file access or rate-limit issues, and to find the planKey other tools ask for.",
    inputSchema: obj({}),
    annotations: read
  },
  {
    name: 'create_session',
    description: "Create a session recording the user's work on a Figma file. Call once before the first read or edit (review-only work too), as soon as the file key is known, and reuse the returned UUID as sessionId on file tools for the same task. When creating a file, call create_new_file first. Start a new session only for separate work with its own completion criteria.",
    inputSchema: obj({ fileKey: { ...fileKey, description: 'The Figma file where the agent is working.' }, description: { type: 'string', minLength: 1, maxLength: 2000, description: 'A concise description of the task.' } }, ['fileKey', 'description']),
    annotations: write
  },
  {
    name: 'create_new_file',
    description: "Create a new blank Figma file (in the user's drafts by default, or in projectId). Returns the file key and URL. editorType: design, figjam, slides, figspec or figmake. Get planKey from whoami; with several plans, ask which one.",
    inputSchema: obj({ fileName: { type: 'string', description: 'The name of the new file.' }, planKey, editorType: { type: 'string', enum: ['design', 'figjam', 'slides', 'figspec', 'figmake'] }, projectId: { type: 'string', description: 'Project (folder) id, from a figma.com/files/.../project/:projectId URL.' } }, ['fileName', 'planKey', 'editorType']),
    annotations: write
  },
  {
    name: 'use_figma',
    description: 'Create, edit, generate or sync any design in Figma (UIs, screens, components, frames, variables, styles, text, images, layouts, design systems) by running JavaScript against the Figma Plugin API. Works on design (/design/), FigJam (/board/) and Slides (/slides/) files. Also inspects node properties programmatically. Load the figma-use guidance first (get_figma_skill or the skill://figma/figma-use/SKILL.md resource). GOTCHAS: Inter styles are "Semi Bold" and "Extra Bold" (with a space); change pages with `await figma.setCurrentPageAsync(page)`; never use loadAllPagesAsync, setPluginData or createImageAsync.',
    inputSchema: obj({ fileKey, code: { type: 'string', maxLength: 50000, description: 'JavaScript to run, with the `figma` global (Figma Plugin API).' }, description: { type: 'string', maxLength: 2000, description: 'What the code aims to do.' }, sessionId, skillNames }, ['fileKey', 'code', 'description']),
    annotations: write
  },
  {
    name: 'get_design_context',
    description: 'Design context for a Figma node — the primary design-to-code tool. Returns reference code, a screenshot and metadata, to adapt to the target project (its components and tokens). For Figma Make files (/make/) use nodeId 0:1. Load the figma-design-to-code guidance first.',
    inputSchema: obj({ fileKey, nodeId: anyNodeId, clientFrameworks: frameworks, clientLanguages: languages, disableCodeConnect: { type: 'boolean', description: 'Only when the user asks to disable Code Connect.' }, excludeScreenshot: { type: 'boolean', description: 'Not recommended; only when asked or to save context.' }, forceCode: { type: 'boolean', description: 'Always return code even when large; only when asked.' }, sessionId, skillNames }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_metadata',
    description: 'Prefer get_design_context. XML overview of a node or page (ids, layer types, names, positions, sizes) in a design file. Without nodeId it lists the top-level pages. Not for FigJam, Slides or Make files.',
    inputSchema: obj({ fileKey, nodeId: anyNodeId, sessionId }, ['fileKey']),
    annotations: read
  },
  {
    name: 'get_screenshot',
    description: 'Screenshot of a node in a design, FigJam or Slides file. Returns a short-lived URL (with curl instructions) by default; set enableBase64Response only when URLs cannot be fetched. maxDimension caps the longer edge (default 1024).',
    inputSchema: obj({ fileKey, nodeId, maxDimension: { type: 'integer', default: 1024, maximum: 65536, description: 'Longer edge in pixels.' }, contentsOnly: { type: 'boolean', description: 'Render the node in isolation, without floating content.' }, enableBase64Response: { type: 'boolean', default: false, description: 'Also return the PNG inline as base64.' }, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_variable_defs',
    description: "Variable definitions used by a node, e.g. {'icon/default/secondary': #949494}. Needs a concrete node; design files only.",
    inputSchema: obj({ fileKey, nodeId, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_figjam',
    description: 'UI code for a FigJam (/board/) node; use 0:1 for the root. FigJam files only.',
    inputSchema: obj({ fileKey, nodeId, includeImagesOfNodes: { type: 'boolean', default: true }, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_motion_context',
    description: 'Keyframe animation data for a node: animated nodes, keyframe tracks with easing, CSS/@keyframes and motion.dev snippets, timeline hints. Use after get_design_context for motion-aware code.',
    inputSchema: obj({ fileKey, nodeId, recursive: { type: 'boolean', default: false, description: 'Include every animated descendant.' }, clientFrameworks: frameworks, clientLanguages: languages, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_libraries',
    description: 'Design libraries of a file: those added (subscribed) and those available to add. Organization libraries are paginated (libraries_available_to_add_next_offset → offset). Use the keys with search_design_system includeLibraryKeys.',
    inputSchema: obj({ fileKey: { type: 'string' }, offset: { type: 'integer', minimum: 0 }, sessionId }, ['fileKey']),
    annotations: read
  },
  {
    name: 'search_design_system',
    description: 'Search design system assets (components, variables, styles) across libraries. queries is an array of {entity: "component"|"variable"|"style", query: string}, one intent per query, batched in one call. Results come back in the same order.',
    inputSchema: obj({ fileKey: { type: 'string' }, queries: { type: 'array', items: obj({ entity: { type: 'string', enum: ['component', 'variable', 'style'] }, query: { type: 'string' } }, ['entity', 'query']) }, includeLibraryKeys: { type: 'array', items: { type: 'string' } }, disableCodeConnect: { type: 'boolean' }, sessionId }, ['queries', 'fileKey']),
    annotations: read
  },
  {
    name: 'download_assets',
    description: 'Assets of one node: an exported render (export), the original source images (rawImages, max 20) and SVGs of vector layers (svgAssets, max 20). Pass defaultFormat/defaultScale only when the user asks for a format or size. URLs are temporary.',
    inputSchema: obj({ fileKey, nodeId, defaultFormat: { type: 'string', enum: ['png', 'jpg', 'svg', 'pdf'] }, defaultScale: { type: 'number', minimum: 0.01, maximum: 4 }, sessionId }, ['fileKey', 'nodeId']),
    annotations: read
  },
  {
    name: 'upload_assets',
    description: 'Upload images and SVGs into a file. Call with count to get single-use upload URLs, then POST raw bytes to each with the right Content-Type. nodeIds sets raster images as fills on those nodes (same order); otherwise new frames are created on currentPageId. SVGs become editable vectors. PNG, JPG, GIF, WebP, SVG; max 10MB each; at most 60 URLs per call.',
    inputSchema: obj({ fileKey, count: { type: 'integer', default: 1, minimum: 1, maximum: 60 }, nodeIds: { type: 'array', items: { type: 'string', pattern: '^\\d+[:-]\\d+$' }, minItems: 1, maxItems: 60 }, nodeId: { type: 'string', description: 'Deprecated: use nodeIds.' }, currentPageId: { type: 'string' }, scaleMode: { type: 'string', enum: ['FILL', 'FIT', 'TILE'], default: 'FILL' }, batchCommit: { type: 'boolean', default: false, description: 'Only if you will call the returned commitUrl exactly once after all uploads.' }, sessionId }, ['fileKey']),
    annotations: write
  },
  {
    name: 'generate_image',
    description: 'PAID (Figma AI credits). Generate a raster image from a prompt and place it in a Design, FigJam or Slides file. Omit nodeId to create a new frame, or pass nodeId to replace an existing image fill.',
    inputSchema: obj({ fileKey, prompt: { type: 'string', minLength: 1 }, width: { type: 'integer', default: 1024, maximum: 2048 }, height: { type: 'integer', default: 1024, maximum: 2048 }, model: { type: 'string', enum: ['gemini-3.1-flash-lite-image', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gemini-3.1-flash-image'], default: 'gpt-image-2.5-flare' }, nodeId, sessionId }, ['prompt', 'fileKey']),
    annotations: write
  },
  {
    name: 'generate_vector_illustration',
    description: 'PAID (Figma AI credits). Generate an editable vector (logo, icon, mark or illustration) from a prompt into a Design or Slides file. kind "icon" for small glyphs/logos, "illustration" for larger scenes. Not for photographic images.',
    inputSchema: obj({ fileKey, prompt: { type: 'string', minLength: 1 }, kind: { type: 'string', enum: ['icon', 'illustration'] }, width: { type: 'integer', minimum: 16, maximum: 2048 }, height: { type: 'integer', minimum: 16, maximum: 2048 }, currentPageId: { type: 'string' }, parentNodeId: { type: 'string' } }, ['fileKey', 'prompt']),
    annotations: write
  },
  {
    name: 'generate_diagram',
    description: 'Create a FigJam diagram from Mermaid.js (graph, flowchart, sequenceDiagram, stateDiagram(-v2), gantt, erDiagram). Keep it simple; LR direction and quoted labels for flowcharts; no emojis. It creates its own file unless fileKey is given. Show the returned URL to the user.',
    inputSchema: obj({ name: { type: 'string' }, mermaidSyntax: { type: 'string' }, fileKey, planKey, userIntent: { type: 'string' }, useArchitectureLayoutCode: { type: 'string' }, sessionId }, ['name', 'mermaidSyntax']),
    annotations: write
  },
  {
    name: 'send_code_to_figma',
    description: 'Import a local project into Figma Code (standalone Code file or a new code layer in a Design file). First call without upload to get instructions; build the archive at nextStep.localArchivePath, run nextStep.uploadCommand, then call again with nextStep.thenCall.arguments unchanged within one hour. Do not retry ambiguous failures.',
    inputSchema: obj({ fileKey, pageId: nodeId, promptId, upload: obj({ fileKey, archivePath: { type: 'string', minLength: 1 }, createLayer: { const: true }, makeNodeId: nodeId }, ['fileKey', 'archivePath']), repairFrom: obj({ seedId: { type: 'string', minLength: 1 }, makeNodeId: nodeId }, ['seedId', 'makeNodeId']), sessionId }, ['fileKey']),
    annotations: write
  },
  {
    name: 'export_video',
    description: 'Export a timeline node (a top-level frame, or the slide in Slides) as MP4. If the render is still going, the response has a jobId: call again with {fileKey, jobId} after 10–15 s. Pass nodeId or jobId, never both.',
    inputSchema: obj({ fileKey, nodeId, jobId: { type: 'string', format: 'uuid' }, fps: { type: 'integer', minimum: 5, maximum: 60 }, quality: { type: 'string', enum: ['low', 'medium', 'high'] }, constraint: obj({ type: { type: 'string', enum: ['SCALE', 'WIDTH', 'HEIGHT'] }, value: { type: 'number', exclusiveMinimum: 0 } }, ['type', 'value']), ttlSeconds: { type: 'integer', minimum: 30, maximum: 604800 }, sessionId }, ['fileKey']),
    annotations: read
  },
  {
    name: 'get_code_connect_map',
    description: 'Code Connect mapping of a node: {nodeId: {codeConnectSrc, codeConnectName}}.',
    inputSchema: obj({ fileKey, nodeId, codeConnectLabel: { type: 'string' }, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_code_connect_suggestions',
    description: 'AI-suggested Code Connect links for a node. Review with the user, then save with send_code_connect_mappings.',
    inputSchema: obj({ fileKey, nodeId, excludeMappingPrompt: { type: 'boolean' }, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'get_context_for_code_connect',
    description: 'Component metadata (properties, variants, descendant tree) of a component or component set, for writing Code Connect templates.',
    inputSchema: obj({ fileKey, nodeId, sessionId }, ['nodeId', 'fileKey']),
    annotations: read
  },
  {
    name: 'add_code_connect_map',
    description: 'Map a Figma node to a code component with Code Connect. With template, creates a full template record instead of a simple mapping.',
    inputSchema: obj({ fileKey, nodeId, source: { type: 'string', description: 'Location of the component in the code.' }, componentName: { type: 'string' }, label, template: { type: 'string' }, templateDataJson: { type: 'string' }, sessionId }, ['nodeId', 'fileKey', 'source', 'componentName', 'label']),
    annotations: write
  },
  {
    name: 'send_code_connect_mappings',
    description: 'Save several Code Connect mappings at once (after get_code_connect_suggestions).',
    inputSchema: obj({ fileKey, nodeId, mappings: { type: 'array', items: obj({ nodeId: { type: 'string' }, componentName: { type: 'string' }, source: { type: 'string' }, label, template: { type: 'string' }, templateDataJson: { type: 'string' } }, ['nodeId', 'componentName', 'source', 'label']) }, clientFrameworks: frameworks, clientLanguages: languages, sessionId }, ['nodeId', 'fileKey', 'mappings']),
    annotations: write
  },
  {
    name: 'list_generative_plugins',
    description: "Generative plugins in the user's library (and Figma's first-party ones): id, name, description, owner.",
    inputSchema: obj({ cursor }),
    annotations: read
  },
  {
    name: 'get_generative_plugin',
    description: 'Read a generative plugin by id: metadata and a manifest of its source files (read each by its uri).',
    inputSchema: obj({ id, includeSource, version }, ['id']),
    annotations: read
  },
  {
    name: 'create_generative_plugin',
    description: "Create a generative plugin (a runnable scaffold that draws a square) in the user's library, then replace its source with update_generative_plugin. Load the figma-generative-plugins skill first.",
    inputSchema: obj({ name: { type: 'string', minLength: 1 }, description: { type: 'string', minLength: 1 }, planKey }, ['name', 'description', 'planKey']),
    annotations: write
  },
  {
    name: 'update_generative_plugin',
    description: 'Update an existing generative plugin: replace code.ts and/or ui.html, metadata, with a commit message. It is built, versioned and deployed.',
    inputSchema: obj({ id, commitMessage, files: { type: 'array', maxItems: 5, default: [], items: obj({ path: { type: 'string', enum: ['code.ts', 'ui.html'] }, content: { type: 'string', minLength: 1 } }, ['path', 'content']) }, metadata: obj({ name: { type: 'string', minLength: 1 }, description: { type: 'string', minLength: 1 } }), versionDescription, versionDetail }, ['id', 'commitMessage']),
    annotations: write
  },
  {
    name: 'list_shaders',
    description: "Shader effects and fills in the user's library: id, name, description, owner, type.",
    inputSchema: obj({ cursor }),
    annotations: read
  },
  {
    name: 'list_file_shaders',
    description: 'Shader effects and fills used in a file, with manifests of their source files.',
    inputSchema: obj({ fileKey, sessionId }, ['fileKey']),
    annotations: read
  },
  {
    name: 'get_shader',
    description: 'Read a shader by id: metadata and a manifest of its source files (read each by its uri).',
    inputSchema: obj({ id, includeSource, version }, ['id']),
    annotations: read
  },
  {
    name: 'create_shader',
    description: 'Create a shader (kind effect: transforms the layer beneath; fill: generates its own pixels) as a scaffold, then replace its source with update_shader. Load the figma-shaders skill first.',
    inputSchema: obj({ name: { type: 'string', minLength: 1 }, description: { type: 'string', minLength: 1 }, planKey, kind: { type: 'string', enum: ['effect', 'fill'] } }, ['name', 'description', 'planKey', 'kind']),
    annotations: write
  },
  {
    name: 'update_shader',
    description: 'Update an existing shader: replace main.ts, metadata, with a commit message. It is built, versioned and deployed.',
    inputSchema: obj({ id, kind: { type: 'string', enum: ['effect', 'fill'] }, commitMessage, files: { type: 'array', maxItems: 5, default: [], items: obj({ path: { const: 'main.ts' }, content: { type: 'string', minLength: 1 } }, ['path', 'content']) }, metadata: obj({ name: { type: 'string', minLength: 1 }, description: { type: 'string', minLength: 1 }, isAnimated: { type: 'boolean' }, usesMouse: { type: 'boolean' } }), versionDescription, versionDetail }, ['id', 'commitMessage', 'kind']),
    annotations: write
  },
  {
    name: 'weave_list_tools',
    description: 'Weave tools (published Weave workflows) the user can run. A pasted app.weavy.ai/tool/<id> URL already gives the recipeId.',
    inputSchema: obj({ search: { type: 'string' } }),
    annotations: read
  },
  {
    name: 'weave_get_tool_inputs',
    description: 'Input contract of a Weave tool (version, outputs, inputs with nodeId/type/default/required). Call before weave_run_tool.',
    inputSchema: obj({ recipeId: { type: 'string' }, version: { type: 'integer' } }, ['recipeId']),
    annotations: read
  },
  {
    name: 'weave_run_tool',
    description: 'PAID (Weave credits). Run a Weave tool. Without acknowledgedCost it only quotes: show the user the cost, get an explicit approval, then call again echoing acknowledgedCost (-1 for a dynamic cost). Poll with weave_get_tool_run_output.',
    inputSchema: obj({ recipeId: { type: 'string' }, version: { type: 'integer' }, inputs: { type: 'array', default: [], items: obj({ nodeId: { type: 'string' }, value: {} }, ['nodeId']) }, numberOfRuns: { type: 'integer', default: 1, minimum: 1, maximum: 10 }, acknowledgedCost: { type: 'number' } }, ['recipeId']),
    annotations: write
  },
  {
    name: 'weave_get_tool_run_output',
    description: 'Status and outputs of Weave tool runs (omit runIds for the latest).',
    inputSchema: obj({ recipeId: { type: 'string' }, runIds: { type: 'array', items: { type: 'string' }, minItems: 1 } }, ['recipeId']),
    annotations: read
  },
  {
    name: 'weave_cancel_tool_run',
    description: "Cancel in-progress Weave tool runs (omit runIds to cancel all the user's running runs of that tool). Cannot be undone.",
    inputSchema: obj({ recipeId: { type: 'string' }, runIds: { type: 'array', items: { type: 'string' }, minItems: 1 } }, ['recipeId']),
    annotations: write
  },
  {
    name: 'weave_find_model',
    description: 'Find a Weave AI model by name, with its approximate cost and input contract, to run with weave_run_model.',
    inputSchema: obj({ query: { type: 'string', minLength: 3 } }, ['query']),
    annotations: read
  },
  {
    name: 'weave_run_model',
    description: 'PAID (Weave credits). Run a Weave model directly. Without acknowledgedCost it only quotes: show the user the cost, get an explicit approval, then call again echoing acknowledgedCost. Poll with weave_get_model_run_output.',
    inputSchema: obj({ id: { type: 'string', minLength: 1 }, input: { type: 'object', additionalProperties: {} }, acknowledgedCost: { type: 'number' } }, ['id', 'input']),
    annotations: write
  },
  {
    name: 'weave_get_model_run_output',
    description: 'Status and outputs of Weave model runs.',
    inputSchema: obj({ predictionIds: { type: 'array', items: { type: 'string' }, minItems: 1 } }, ['predictionIds']),
    annotations: read
  },
  {
    name: 'weave_upload_asset',
    description: 'Get a submitUrl and token to upload a local image or video to Weave (multipart POST with a `file` field and the X-Weave-Upload-Token header).',
    inputSchema: obj({}),
    annotations: write
  }
]
