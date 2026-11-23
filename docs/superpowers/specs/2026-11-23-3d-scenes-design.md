# 3D scenes of geometric bodies – design

Date: 2026-11-23 · Status: draft, waiting for the owner's approval

## Intent

Teachers ask for worksheets on geometric bodies (Würfel, Quader, Kugel, Zylinder, Kegel, Pyramide), for example a
grade 2 colouring picture of a town built from bodies, followed by tasks ("colour all cubes red", "count the
cylinders", "match bodies to objects"). Today the model draws such pictures as an `svg` block: it writes 2D
coordinates by hand and has to do the perspective projection in its head. The result is wrong (flat shapes instead of
bodies, windows that ignore the perspective, inconsistent viewing angles), even with strong models over MCP.

The model should only **describe a 3D scene** (which bodies, how big, where, stacked on what, from which side) and
the assistant should **compute the picture** with three.js. The owner wants both kinds of output from one scene:

1. a **line drawing** to colour in and label (Ausmalbild), and
2. a **coloured, shaded** picture of the same scene (solution sheet, illustration).

## Goals

- New block `scene_3d`, usable in the built-in chat and over MCP (top level and inside `columns`), like every other
  graphic block.
- Bodies: cube, cuboid, sphere, cylinder, cone, square pyramid, triangular prism (roofs).
- Placement without 3D arithmetic: bodies stand on the ground automatically; `on` stacks a body on top of another;
  `turn` rotates about the vertical axis; cylinders and prisms can lie on their side (a lying prism is a roof).
- Bodies may overlap (a tree crown sunk into its trunk, wheels against a vehicle): the lines where their surfaces
  meet are drawn, so the picture stays colourable.
- Views: perspective (default), isometric, and oblique projection (Schrägbild/Kavalierperspektive as in German maths
  books). The camera frames the scene automatically.
- Styles: `outline` (colouring picture: black visible edges and outlines only) and `colored` (per-body colours or
  automatic colour by shape, soft shading, the same outlines on top). Hidden edges optionally dashed
  (standard for Schrägbilder). Optional short labels on bodies ("1", "A") for tasks like "Welcher Körper ist Nr. 3?".
- One scene, two blocks: the task uses `outline`, the solution the same scene with `colored`.
- Editable later: the scene is stored in the alt text (graphic marker), like all generated graphics.
- Problems the model cannot see (bodies that intersect, bodies that are completely hidden, invisible labels) come
  back as warnings, because the model never sees the picture.

## Non-goals

- Vertex labels (A–H), dimensions/measurements, nets of bodies (Körpernetze).
- 2D decoration in the same picture (sun, clouds, road markings). Trees, towers, houses, vehicles are built from
  bodies; anything else can be a separate `svg` block.
- Free meshes, boolean operations (CSG), textures, transparency, cast shadows, interactive 3D view in the editor.
- The model looking at the rendered picture (vision feedback).

## Anti-goals

- The model computing 2D coordinates or perspective itself.
- Lines through bodies in the colouring picture (hidden lines shown as solid), or gaps where edges should meet:
  every visible face must be a closed region a child can colour in.
- Visibly jagged outlines on round bodies (tessellation zig-zag on sphere, cylinder or cone silhouettes).
- Image bytes in the chat history: blocks carry only the scene description.
- A broken insert when WebGL is not available: the colored style falls back, the worksheet still gets a picture.

## Approaches considered

- **A. Everything rendered with WebGL in the plugin** (one three.js renderer, raster output for both styles).
  Least code, but outlines from WebGL are raster lines (uneven, hard to make clean silhouettes on round bodies), it
  needs WebGL for every picture, and the server and unit tests cannot produce the picture at all.
- **B. One scene, two outputs (chosen by the owner).** three.js builds the bodies. The line drawing is computed as
  vector lines (hidden-line removal) in a shared module that runs in Node and in the plugin. The coloured version is
  rendered with WebGL in the plugin and composed with the same vector lines on top. Crisp colouring pictures,
  server-side validation and testable geometry; real shading for the coloured version. Costs two output paths.
- **C. Everything as vector graphics, no WebGL** (exact hidden-surface removal, flat-filled SVG polygons). Works
  everywhere, but is the most work, and round bodies look faceted or need fake gradients.

Library decision within B: `three-edge-projection` (hidden-line removal on three-mesh-bvh) was considered and is
**not** used: its npm package was unpublished (only 0.0.x on GitHub) and it projects orthographically along one axis
only. The hidden-line removal is our own, on top of `three` and `three-mesh-bvh` (both on npm, MIT).

## Design

### The block

```json
{ "type": "scene_3d", "style": "outline", "projection": "perspective", "view": "front_left", "elevation": "medium",
  "hidden_edges": "none", "ground": true, "width_cm": 16, "caption": "Eine Stadt aus Körpern",
  "bodies": [
    { "id": "haus", "shape": "cuboid", "size": [3, 2, 3], "at": [0, 0] },
    { "shape": "triangular_prism", "lying": true, "size": [3, 1.2, 3], "on": "haus" },
    { "id": "turm", "shape": "cylinder", "radius": 1, "height": 4, "at": [5, 1] },
    { "shape": "cone", "radius": 1.2, "height": 2, "on": "turm" },
    { "shape": "sphere", "radius": 1, "at": [-3, 2], "label": "3", "color": "yellow" } ] }
```

Fields (all optional except `bodies`):

| Field | Values | Default |
|---|---|---|
| `bodies` | 1–40 bodies (below) | – |
| `style` | `outline` \| `colored` | `outline` |
| `projection` | `perspective` \| `isometric` \| `oblique` | `perspective` |
| `view` | `front` \| `front_left` \| `front_right` (ignored for `isometric`; `oblique` is always from the front, depth to the upper right) | `front_left` |
| `elevation` | `low` \| `medium` \| `high` (camera height angle, roughly 10°/25°/45°; ignored for `isometric` and `oblique`) | `medium` |
| `hidden_edges` | `none` \| `dashed` | `none` |
| `ground` | boolean: a ground plate around the bodies (outline: its visible edges; colored: a light ground colour) | `true` |
| `color_by` | `shape` \| `body` (colored style: colour from the shape table below, or each body's `color`) | `shape` if no body has a `color`, else `body` |
| `width_cm`, `caption` | as for the other graphic blocks; height follows from the framed scene, capped so the picture fits a page | text width |

Body fields:

| Field | Meaning |
|---|---|
| `shape` | `cube`, `cuboid`, `sphere`, `cylinder`, `cone`, `pyramid`, `triangular_prism` |
| size | cube: `size` (edge); cuboid: `size [width, height, depth]`; sphere: `radius`; cylinder, cone: `radius`, `height` (for a lying cylinder `height` is its length along x); pyramid: `size [width, height, depth]` (rectangular base, apex above the centre); triangular_prism: `size [width, height, depth]` = the extents of the placed body before `turn` (upright: isosceles triangle in the ground plane, base edge at the front, axis vertical, flat triangular top; lying: triangle in the side view, ridge on top running along x – a roof) |
| `at` | `[x, z]` ground position of the body's centre in scene units; x to the right, z towards the viewer. With `on`: offset from the centre of the supporting top face (default `[0, 0]`) |
| `on` | id of the body it stands on (placed on that body's top face) |
| `turn` | degrees about the vertical axis (default 0) |
| `lying` | cylinder and triangular_prism only: the axis is horizontal along x instead of vertical (rotate with `turn`); a lying prism rests on a rectangular face with the ridge on top |
| `id` | needed only as a target of `on` |
| `label` | up to 3 characters, drawn at the visible middle of the body |
| `color` | `red`, `blue`, `yellow`, `green`, `orange`, `purple`, `brown`, `gray`, `white` (colored style) |

Colour by shape (matches the usual task "Würfel rot, Quader blau, …"): cube red, cuboid blue, sphere yellow,
cylinder green, cone orange, pyramid purple, triangular_prism brown; the ground light gray-green. Palette values are
print-friendly and stay distinguishable in grayscale (different lightness), like the chart palette.

Rules and errors (messages in English, actionable, naming the block and body index, as for other blocks):
unknown shape or field values, sizes outside a sane range (e.g. 0.1–50 units, at most 1:100 between the largest and
the smallest body), `on` pointing to an unknown id or forming a cycle, `on` a body without a flat top – error; more
than 40 bodies – error. Flat tops: cube, cuboid, upright cylinder, upright triangular_prism. No flat top: sphere,
cone, pyramid, lying cylinder, lying triangular_prism. `turn` is absolute for every body (a stacked body does not
inherit the turn of its support); the `at` offset of a stacked body is in scene axes.

### Rendering

**Shared module `packages/shared/worksheet-3d.js`** (UMD like the other shared modules; global `Worksheet3d` in the
plugin, CommonJS in Node). Synchronous, so `WorksheetLayout.compose` can call it in the plugin and in the server's
`checkBlocks` validation:

1. Normalise and validate the scene (single source of truth for the server and the plugin).
2. Place the bodies (ground, stacking, turn, lying) and build three.js geometry.
3. Camera: the chosen projection and view, framed to the bounding box of all bodies (and the ground plate) with a
   margin; the oblique projection is a parallel projection with a shear matrix (receding axis at 45°, depth × 0.5).
4. Candidate lines: feature edges (angle between faces above a threshold, e.g. 30°), silhouettes, and the
   intersection curves of overlapping bodies (triangle–triangle intersections of the two meshes, found with
   three-mesh-bvh; a body sitting on another only touches it and produces no intersection curve). Silhouettes of
   sphere, cylinder and cone are computed for the current camera (analytically or from a fine tessellation) and come
   out as smooth curves – no stair-steps along mesh edges. With `hidden_edges: dashed` (maths-book style) a sphere
   also gets its equator ellipse, front half solid and back half dashed; in the plain colouring picture a sphere is
   only its outline (one region to colour).
5. Visibility: each candidate line is split where it may change visibility and tested by ray casting against all
   bodies (three-mesh-bvh), towards the eye for perspective, along the view direction for parallel projections.
   Visible pieces are solid; hidden pieces are dropped or dashed (`hidden_edges: dashed`). Endpoints of visible
   pieces must meet exactly so that faces are closed regions.
6. Output: an SVG in the conventions of `worksheet-svg.js` (`{ svg, widthMm, heightMm }`, viewBox in mm, no
   background, lines ≥ 0.25 mm; outline style uses a stronger line, about 0.5–0.7 mm, suitable for colouring),
   labels as small circled text, plus the camera and body data the coloured pass needs.
7. Warnings: a body completely inside another, bodies without any visible part, labels on bodies that are not
   visible. They reach the model with the insert result (plugin path, like other compose warnings and the quality
   check); `checkBlocks` on the server only reports errors.

**Coloured pass (plugin only).** `compose` emits an image run of `kind: 'scene_3d'` carrying the line SVG and the
scene. In `rasterize` (blocks.js), the plugin renders the filled bodies with three.js `WebGLRenderer` on an
off-screen canvas at the print resolution (settings.dpi, default 300) with exactly the same camera, soft lighting
(ambient + one directional light from the upper left, no cast shadows), then composes one SVG with the rendered PNG
as `<image>` under the vector lines and rasterises it through the existing `rasterizeSvg` path. If WebGL is not
available or fails, the picture falls back to the line drawing and the insert reports a warning. In Node the colored
style is only validated (lines computed), never filled.

**Dependencies.** `three` and `three-mesh-bvh` at exact versions as dependencies of `packages/shared` (Node: server,
desktop app bundle, tests). For the plugin a vendored browser bundle (built with esbuild from the same npm versions,
exposing the globals the module needs), pinned with a checksum in `vendor/SHA256SUMS`, listed in `vendor/SOURCES.md`,
licences copied by `scripts/build.sh`, and a unit test that the vendored bundle and the npm packages have the same
versions – the same pattern as dagre. Loaded in `index.html` before `worksheet-3d.js`.

### Integration

- `worksheet-layout.js`: `scene_3d` in `BLOCK_TYPES` and the graphic block types; builder calls `Worksheet3d`,
  adds warnings to `c.warnings`, alt text `graphicAlt('3D-Szene: <caption or body summary>', sourceOf(b, 'scene_3d'))`.
- Server `tools.ts`: block documentation string, allowed keys (`bodies` nested objects; the cleaner's depth limits
  must allow them), validation through the shared normaliser.
- Prompt (`prompt.ts`): use `scene_3d` for geometric bodies and scenes built from bodies, never `svg` for bodies;
  how to build common objects (house = cuboid + triangular_prism, tower = cylinder + cone, tree = cylinder + sphere,
  vehicle = cuboid + lying cylinders as wheels); colouring tasks: `outline` in the task, the same scene `colored` in
  the solutions; `oblique` + `hidden_edges: dashed` for Schrägbilder in grades 4–6; give bodies labels when tasks
  refer to them.
- Outline for the model: the scene appears as `GRAPHIC scene_3d` with its parameters, so the model can replace it
  with a changed scene, like other graphics.
- Docs, changelog and website feature lists as for earlier block types.

### Testing

- Unit tests (packages/shared): normalisation errors; stacking heights; framing; visibility on small known scenes
  (a cube behind a cube loses exactly the hidden edges; a sphere's silhouette is one closed smooth curve; dashed
  hidden edges in oblique view); closed regions (visible edge endpoints meet); deterministic output for the same
  scene; performance budget for a 40-body scene.
- Server tests: `checkBlocks` accepts and rejects scenes with useful messages.
- Harness e2e (Playwright Chromium has WebGL through SwiftShader): colored picture is inserted; fallback without
  WebGL.
- Real editor e2e (`dev/eurooffice`): insert both styles; check WebGL in the editor's plugin frame.

## Risks

- WebGL in the editor's plugin frame (browser editors: expected to work; desktop editors: unknown). The fallback keeps
  inserts working; the real-editor e2e must check it.
- Plugin size: three.js adds roughly 0.7 MB minified. Acceptable for a local plugin; the bundle includes only what
  is needed (tree-shaken by esbuild).
- Computation time in `compose` runs twice (server validation and plugin); keep a typical scene well under 300 ms.

## Left to the builder

Tessellation detail, exact line widths, the edge angle threshold, silhouette method per shape, label placement,
palette hex values, shading constants, ground plate size and margins, the esbuild entry for the vendored bundle,
warning wording, test structure.
