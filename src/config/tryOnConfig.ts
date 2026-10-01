export const TRY_ON = {
  mirror: true,
  inferenceFps: { hairstyle: 24, top: 15 },
  inferenceMaxWidth: 640,
  smoothingTimeMs: 85,
  trackingExpiryMs: 450,
  face: { widthMultiplier: 1.55, verticalOffset: -0.42, eyeReference: 0.22 },
  garment: { widthMultiplier: 1.55, verticalOffset: -0.1 },
  minVisibility: 0.5,
  maxImageBytes: 15 * 1024 * 1024,
  maxImageSide: 2048,
  maxImagePixels: 40_000_000,
  maxCanvasDpr: 2,
} as const;
export const DEFAULT_CALIBRATION = { offsetX: 0, offsetY: 0, scale: 1, rotation: 0 };
