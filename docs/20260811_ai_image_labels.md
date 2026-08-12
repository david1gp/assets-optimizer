# AI image labels

## Goal

Extend the asset optimizer so images identified as AI-generated or AI-modified receive an EU AI Act label, with configurable placement, size, offset, opacity variant, and simple/adaptive color selection.

## Approach

- Add a shared AI classification model and detect it from source paths and optional transformation suffixes.
- Thread classification and label options through expected-image construction and processing.
- Select a supplied SVG deterministically, analyze the target region in adaptive mode, and composite after resize but before output encoding.
- Preserve existing behavior for assets without an AI classification and verify focused and regression coverage.

## Tasks

1. **Complete** — Map discovery, parsing, processing, configuration, assets, tests, and documentation seams.
2. **Complete** — Add the AI classification model, source-path detection, and transformation suffix parsing with focused tests.
3. **Complete** — Add public label configuration and thread classification/options to processing.
4. **Complete** — Implement deterministic supplied-SVG selection and package-safe asset loading.
5. **Complete** — Implement bounded placement and sizing geometry.
6. **Complete** — Implement adaptive target-region color analysis.
7. **Complete** — Composite labels in the Sharp processing pipeline.
8. **Complete** — Add end-to-end coverage for detection, suffixes, options, and outputs.
9. **Complete** — Document detection, transformation suffixes, and configuration.
10. **Complete** — Review the complete diff and identify release-critical cache and boundary issues.
11. **Complete** — Include effective AI classification and rendering options in output identity/cache behavior.
12. **Complete** — Align adaptive sampling with final integer composite geometry.
13. **Complete** — Bound directory detection to the configured image tree.
14. **Complete** — Align low-level public API option typing with top-level partial options.
15. **Complete** — Add classified JPG, WebP, and AVIF output coverage.
16. **Complete** — Correct final documentation details and clarify substring detection semantics.
17. **Complete** — Run final verification and release-readiness review.
18. **Complete** — Format, split the feature into semantic commits, and push.

## Active paths

- `public/ai/`
- `src/image/buildExpectedImages.ts`
- `src/image/parseTransformSpec.ts`
- `src/image/TransformSpec.ts`
- `src/image/processImage.ts`
- `src/AssetsOptimizeOptions.ts`
- `src/image/OptimizeImagesOptions.ts`
- `README.md`

## Durable decisions

- Detection is case-limited to `AI`, `Ai`, or `ai`, followed by whitespace, `-`, `_`, or `.`, then `generated` or `modified`.
- A matching directory marks all files beneath it.
- Transformation names support an optional `_ai_generated` or `_ai_modified` ending after the existing format segment.
- Label defaults: bottom-right, 32 px high.
- Simple mode selects a configured black or white label; adaptive mode samples the destination region and chooses whichever is less conspicuous.
- Supplied visual variants are filled/opaque and 50% transparent.
- Classification from an explicit transformation suffix overrides source-path classification; filename classification overrides directory classification.
- Adaptive mode chooses the label color with the lower luminance contrast against the pixels under its final target region.
- Labels are composited after resizing and before output format encoding.
- Configuration defaults are simple mode, black, padding visual, opaque, bottom-right, 32 px high, and zero x/y offsets.
- Configurable visuals are `padding` or `circle`; configurable opacity is `opaque` or `50%`.
- All 16 classification/color/visual/opacity combinations map explicitly to supplied assets; circle assets are shared across classifications.
- SVGs resolve relative to the built module, and package contents include both `dist/` and `public/`.
- Placement preserves SVG aspect ratio and clamps to image bounds; positive offsets inset from the selected edge, while negative offsets move outward before clamping.
- Adaptive analysis samples the clipped target with fractional pixel coverage and alpha weighting, uses linear relative luminance, and selects black for ties or invisible/invalid regions.
- Classified images use a lossless resized intermediate, composite the label, then perform final format encoding; unclassified images retain the prior direct Sharp path.
- Effective classification and resolved rendering options must participate in classified-image output identity so reruns cannot reuse stale labels.
- Directory classification is bounded to the configured originals/image source tree and never inspects outside ancestors.
