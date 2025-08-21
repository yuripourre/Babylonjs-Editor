
import {
    Scene,
    WebXRDefaultExperience,
    Mesh,
    TargetCamera,
} from "@babylonjs/core";

/**
 * Global reference to store the VR simulation state
 */
let isVRSimulationEnabled = false;
let vrHeadsetCube: Mesh | null = null;
let vrUpdateObserver: any = null;

/**
 * Enables the mixed reality polyfill.
 * @param scene defines the reference to the scene where to enable the polyfill.
 * @param cube defines the reference to the cube mesh to be used as the VR headset.
 */
export async function MixedRealityEnabled(scene: Scene, cube: Mesh): Promise<void> {
    if (isVRSimulationEnabled) {
        return;
    }

    isVRSimulationEnabled = true;
    vrHeadsetCube = cube;

    // Create WebXR experience
    const xrHelper = await WebXRDefaultExperience.CreateAsync(scene, {
        disableDefaultUI: false,
        disableTeleportation: true,
    });

    // Add observer to sync camera with cube position
    vrUpdateObserver = scene.onBeforeRenderObservable.add(() => {
        if (scene.activeCamera && scene.activeCamera instanceof TargetCamera && vrHeadsetCube) {
            // Copy position from cube to camera
            scene.activeCamera.position.copyFrom(vrHeadsetCube.getAbsolutePosition());
            
            // Copy rotation from cube to camera
            if (vrHeadsetCube.rotationQuaternion) {
                scene.activeCamera.rotationQuaternion = vrHeadsetCube.rotationQuaternion.clone();
            }
        }
    });

    // Store reference for cleanup
    (scene as any)._vrSimulation = {
        xrHelper,
        updateObserver: vrUpdateObserver,
        headsetCube: cube,
    };
}

/**
 * Disables the mixed reality polyfill.
 * @param scene defines the reference to the scene where to disable the polyfill.
 */
export function MixedRealityDisabled(scene: Scene): void {
    if (!isVRSimulationEnabled) {
        return;
    }

    isVRSimulationEnabled = false;
    vrHeadsetCube = null;

    // Clean up observer
    if (vrUpdateObserver) {
        scene.onBeforeRenderObservable.remove(vrUpdateObserver);
        vrUpdateObserver = null;
    }

    // Clean up stored references
    const vrSimulation = (scene as any)._vrSimulation;
    if (vrSimulation) {
        if (vrSimulation.xrHelper) {
            vrSimulation.xrHelper.dispose();
        }
        (scene as any)._vrSimulation = undefined;
    }
}

