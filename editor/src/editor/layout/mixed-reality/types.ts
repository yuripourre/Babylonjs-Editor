import { Editor } from "../../main";
import { Scene, Mesh, PositionGizmo, Engine } from "@babylonjs/core";

/**
 * Props for the MixedReality component
 */
export interface IMixedRealityProps {
    /**
     * Defines the reference to the editor.
     */
    editor: Editor;
}

/**
 * State for the MixedReality component
 */
export interface IMixedRealityState {
    /**
     * Defines whether or not VR simulation is enabled.
     */
    isVrEnabled: boolean;
}

/**
 * Props for the VRHeadset component
 */
export interface IVRHeadsetProps {
    /**
     * The scene to create the headset in
     */
    scene: Scene;
    
    /**
     * Whether the VR simulation is enabled
     */
    isVrEnabled: boolean;
}

/**
 * Props for the Grid component
 */
export interface IGridProps {
    /**
     * The scene to create the grid in
     */
    scene: Scene;
    
    /**
     * The size of the grid
     */
    size?: number;
    
    /**
     * The spacing between grid lines
     */
    spacing?: number;
}

/**
 * Shared context between mixed reality components
 */
export interface IMixedRealityContext {
    scene: Scene;
    engine: Engine;
    cube: Mesh;
    vrIndicator: Mesh;
    positionGizmo: PositionGizmo;
    isVrEnabled: boolean;
}
