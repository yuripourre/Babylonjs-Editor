import { MixedRealityComponent } from "./MixedRealityComponent";

// Export the main component as MixedReality to maintain backward compatibility
export const MixedReality = MixedRealityComponent;

// Export types and utilities for external use
export * from "./types";
export { Grid } from "./Grid";
export { VRHeadset } from "./VRHeadset";
export { MaterialFactory } from "./Materials";
