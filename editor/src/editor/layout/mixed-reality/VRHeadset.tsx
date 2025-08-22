import { 
    Mesh, 
    MeshBuilder, 
    Vector3, 
    Animation, 
    CircleEase, 
    EasingFunction,
    PositionGizmo,
    UtilityLayerRenderer
} from "@babylonjs/core";

import { IVRHeadsetProps } from "./types";
import { MaterialFactory } from "./Materials";

/**
 * VR Headset component that creates and manages the VR headset cube and indicator
 */
export class VRHeadset {
    /**
     * The VR headset cube mesh
     */
    public cube: Mesh;
    
    /**
     * The VR indicator mesh (floating sphere above the headset)
     */
    public indicator: Mesh;
    
    /**
     * The position gizmo for moving the headset
     */
    public positionGizmo: PositionGizmo;

    /**
     * Creates a new VR headset
     * @param props The VR headset properties
     */
    constructor(props: IVRHeadsetProps) {
        const { scene } = props;
        
        // Create VR headset cube with custom material
        this.cube = MeshBuilder.CreateBox("vr-headset", { size: 0.2 }, scene);
        this.cube.position.y = 1.6;
        this.cube.material = MaterialFactory.createHeadsetMaterial(scene);

        // Create VR indicator (small floating sphere)
        this.indicator = MeshBuilder.CreateSphere("vr-indicator", { diameter: 0.05 }, scene);
        this.indicator.position = this.cube.position.add(new Vector3(0, 0.15, 0));
        this.indicator.material = MaterialFactory.createIndicatorMaterial(scene);
        this.indicator.setEnabled(false);

        // Setup gizmo manager and position gizmo
        this._setupGizmos(scene);
        
        // Update indicator visibility based on VR enabled state
        if (props.isVrEnabled) {
            this.indicator.setEnabled(true);
            this._animateIndicator(scene);
        }
    }

    /**
     * Sets up the gizmos for the VR cube.
     */
    private _setupGizmos(scene: any): void {
        // Create utility layer for gizmos
        new UtilityLayerRenderer(scene);
        
        // Create position gizmo
        this.positionGizmo = new PositionGizmo();
        this.positionGizmo.attachedMesh = this.cube;
        this.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    }

    /**
     * Updates the VR headset state
     * @param isEnabled Whether VR simulation is enabled
     * @param scene The scene to animate in
     */
    public updateState(isEnabled: boolean, scene: any): void {
        this.indicator.setEnabled(isEnabled);
        
        // Make sure the cube has proper position for VR camera alignment
        if (isEnabled) {
            // Ensure the cube is at a good height for VR camera
            if (this.cube.position.y < 1.4) {
                this.cube.position.y = 1.6; // Standard VR camera height
            }
            
            // Update indicator position to match cube
            this.indicator.position.x = this.cube.position.x;
            this.indicator.position.z = this.cube.position.z;
            
            // Start animation
            this._animateIndicator(scene);
            
            console.log("VR headset position updated:", 
                this.cube.position.x.toFixed(2),
                this.cube.position.y.toFixed(2),
                this.cube.position.z.toFixed(2)
            );
        }
    }

    /**
     * Animates the VR indicator to show it's active.
     */
    private _animateIndicator(scene: any): void {
        if (!this.indicator) return;

        try {
            // Update indicator base position to match cube
            this.indicator.position.y = this.cube.position.y + 0.15;
            
            // Create a simple floating animation
            const animation = new Animation(
                "vr-indicator-float", 
                "position.y", 
                30, 
                Animation.ANIMATIONTYPE_FLOAT, 
                Animation.ANIMATIONLOOPMODE_CYCLE
            );
            
            const keyFrames: { frame: number; value: number }[] = [];
            keyFrames.push({
                frame: 0,
                value: this.cube.position.y + 0.15
            });
            keyFrames.push({
                frame: 30,
                value: this.cube.position.y + 0.2
            });
            keyFrames.push({
                frame: 60,
                value: this.cube.position.y + 0.15
            });
            
            animation.setKeys(keyFrames);
            
            const easingFunction = new CircleEase();
            easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
            animation.setEasingFunction(easingFunction);
            
            this.indicator.animations = [animation];
            scene.beginAnimation(this.indicator, 0, 60, true);
        } catch (error) {
            console.warn("Error animating VR indicator:", error);
        }
    }

    /**
     * Disposes the VR headset and its resources
     */
    public dispose(): void {
        this.positionGizmo?.dispose();
        this.cube?.dispose();
        this.indicator?.dispose();
    }
}
