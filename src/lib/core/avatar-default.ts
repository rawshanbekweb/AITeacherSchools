import type { AvatarConfig } from './types';

// Demo teacher portrait and its calibrated face landmarks (natural image pixels).
export const DEFAULT_AVATAR: AvatarConfig = {
  name: 'AI Ustoz',
  image: 'assets/teacher.webp',
  // Landmarks in image pixels (calibrated in Admin → Avatar studio).
  landmarks: {
    eyeL: [492, 334], eyeR: [674, 327], eyeW: 40, eyeH: 21,
    mouthL: [519, 537], mouthC: [596, 527], mouthR: [673, 521],
    chin: [600, 700], neck: [605, 790],
  },
  voiceGender: 'male',
  charisma: 0.7,
};
