// Prepared animation scenes available in the material library (spec §9, level 1).
export const VISUAL_IDS = ['sun', 'solar-system', 'earth-moon', 'leaf', 'photosynthesis', 'colors', 'counting', 'neuron', 'neural-net', 'gradient', 'fractions', 'water-cycle'] as const;
export type VisualId = (typeof VISUAL_IDS)[number];
