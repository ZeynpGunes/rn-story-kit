export interface StoryConfig {
  imageDurationMs: 5000;
  tapZoneRatio: 0.3;
  sortUnseenFirst: true;
  autoAdvanceWithScreenReader: false;
  mediaErrorAdvanceMs: 4000;
  /** Overrides the header time label; default is formatRelativeTime. */
  formatTime?: (createdAt: number) => string;
  motion: {
    tapCrossfadeMs: number;
    progressFillEasing: 'linear';
    longPressMs: number;
    longPressMaxDistance: number;
    uiHideMs: number;
    uiShowMs: number;
    cubePerspective: number;
    cubeMaxAngleDeg: number;
    cubeShadeMaxOpacity: number;
    cubeSettleDamping: number;
    cubeSettleStiffness: number;
    cubeSettleMass: number;
    cubeProgrammaticMs: number;
    cubeProgrammaticBezier: [number, number, number, number];
    swipeCommitDistanceRatio: number;
    swipeCommitVelocity: number;
    panActiveOffsetX: number;
    panFailOffsetY: number;
    rubberBandFactor: number;
    rubberBandDamping: number;
    rubberBandStiffness: number;
    rubberBandMass: number;
    dismissActiveOffsetY: number;
    dismissDistanceRatio: number;
    dismissMinScale: number;
    dismissScaleFactor: number;
    dismissMaxRadius: number;
    dismissUiFadeFactor: number;
    dismissCommitDistance: number;
    dismissCommitVelocity: number;
    dismissSnapDamping: number;
    dismissSnapStiffness: number;
    dismissSnapMass: number;
    swipeUpFollowMax: number;
    swipeUpCommitDistance: number;
    swipeUpCommitVelocity: number;
    openMs: number;
    openBezier: [number, number, number, number];
    openContentFadeRatio: number;
    closeMs: number;
    closeBezier: [number, number, number, number];
    closeContentFadeRatio: number;
    closeNoRectMs: number;
    closeNoRectScale: number;
    thumbCrossfadeMs: number;
    thumbVideoCrossfadeMs: number;
    seenRingMs: number;
    measureTimeoutMs: number;
    gradientSaturationBoost: number;
    gradientMaxLightness: number;
    gradientMidMix: number;
    gradientBottomMix: number;
    reducedCubeFadeMs: number;
    reducedDismissMs: number;
    reducedOpenCloseMs: number;
    reducedUiFadeMs: number;
    reducedSpringMs: number;
  };
}

export const defaultConfig: StoryConfig = {
  imageDurationMs: 5000,
  tapZoneRatio: 0.3,
  sortUnseenFirst: true,
  autoAdvanceWithScreenReader: false,
  mediaErrorAdvanceMs: 4000,
  motion: {
    tapCrossfadeMs: 90,
    progressFillEasing: 'linear',
    longPressMs: 200,
    longPressMaxDistance: 10,
    uiHideMs: 150,
    uiShowMs: 200,
    cubePerspective: 1000,
    cubeMaxAngleDeg: 90,
    cubeShadeMaxOpacity: 0.5,
    cubeSettleDamping: 22,
    cubeSettleStiffness: 220,
    cubeSettleMass: 1,
    cubeProgrammaticMs: 320,
    cubeProgrammaticBezier: [0.22, 1, 0.36, 1],
    swipeCommitDistanceRatio: 0.33,
    swipeCommitVelocity: 600,
    panActiveOffsetX: 12,
    panFailOffsetY: 12,
    rubberBandFactor: 0.35,
    rubberBandDamping: 20,
    rubberBandStiffness: 260,
    rubberBandMass: 1,
    dismissActiveOffsetY: 10,
    dismissDistanceRatio: 0.6,
    dismissMinScale: 0.75,
    dismissScaleFactor: 0.25,
    dismissMaxRadius: 40,
    dismissUiFadeFactor: 3,
    dismissCommitDistance: 120,
    dismissCommitVelocity: 800,
    dismissSnapDamping: 18,
    dismissSnapStiffness: 240,
    dismissSnapMass: 0.9,
    swipeUpFollowMax: 16,
    swipeUpCommitDistance: 80,
    swipeUpCommitVelocity: 700,
    openMs: 380,
    openBezier: [0.2, 0.9, 0.2, 1],
    openContentFadeRatio: 0.4,
    closeMs: 300,
    closeBezier: [0.4, 0, 0.2, 1],
    closeContentFadeRatio: 0.6,
    closeNoRectMs: 200,
    closeNoRectScale: 0.92,
    thumbCrossfadeMs: 220,
    thumbVideoCrossfadeMs: 180,
    seenRingMs: 400,
    measureTimeoutMs: 150,
    gradientSaturationBoost: 1.1,
    gradientMaxLightness: 0.45,
    gradientMidMix: 0.25,
    gradientBottomMix: 0.55,
    reducedCubeFadeMs: 200,
    reducedDismissMs: 200,
    reducedOpenCloseMs: 200,
    reducedUiFadeMs: 100,
    reducedSpringMs: 180,
  },
};
