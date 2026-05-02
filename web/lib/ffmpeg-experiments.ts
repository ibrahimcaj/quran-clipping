export type ExperimentOperation = "pipeline" | "mix_random_verse";

export const OVERLAY_BLEND_MODES = ["normal", "screen", "lighten", "softlight", "overlay"] as const;

export type OverlayBlendMode = typeof OVERLAY_BLEND_MODES[number];
