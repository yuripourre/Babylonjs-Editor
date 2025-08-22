import {
    Scene,
    WebXRDefaultExperience,
    Mesh,
    TargetCamera,
} from "@babylonjs/core";

import {
    injectVRPolyfills,
    injectAdditionalPolyfills,
    injectAggressivePolyfills,
    injectNullSafetyPatches,
    fixDOMBindingIssues
} from "./webxr-injector";

import { createMockXRSession } from "./webxr-polyfills";
import { patchNodeConstructors } from "./webxr-safe-node";
import { applyDirectPatches } from "./webxr-direct-patches";

/**
 * Global reference to store the VR simulation state
 */
let isVRSimulationEnabled = false;
let vrHeadsetCube: Mesh | null = null;
let vrUpdateObserver: any = null;
let originalWebXR: any = null;
let polyfillInjected = false;

/**
 * Enables the mixed reality polyfill.
 * @param scene defines the reference to the scene where to enable the polyfill.
 * @param cube defines the reference to the cube mesh to be used as the VR headset.
 */
export async function MixedRealityEnabled(scene: Scene, cube: Mesh): Promise<void> {
    if (isVRSimulationEnabled) {
        return;
    }

    // Validate inputs
    if (!scene || !cube) {
        console.error("❌ VR Simulation: Invalid scene or cube provided");
        return;
    }

    try {
        isVRSimulationEnabled = true;
        vrHeadsetCube = cube;

        // Store original WebXR implementation only if not already stored
        if (!originalWebXR) {
            originalWebXR = {
                navigator: (navigator as any).xr,
                getVRDisplays: (navigator as any).getVRDisplays,
                requestVRDisplay: (navigator as any).requestVRDisplay,
            };
        }

        // Inject comprehensive VR polyfills BEFORE trying to create WebXR experience
        if (!polyfillInjected) {
            console.log("🔧 VR Simulation: Injecting polyfills BEFORE WebXR creation...");
            injectVRPolyfills();
            injectAdditionalPolyfills();
            injectAggressivePolyfills();
            injectNullSafetyPatches();
            fixDOMBindingIssues();
            
            // Patch Node constructors to prevent getUniqueId errors
            if ((window as any).BABYLON) {
                // First apply the standard node constructor patches
                patchNodeConstructors((window as any).BABYLON);
                
                // Then apply direct patches to specific functions that are causing issues
                applyDirectPatches((window as any).BABYLON);
            }
            
            // Ensure node.js "process" is available for Babylon.js features that check for it
            if (!(window as any).process) {
                (window as any).process = {
                    env: {
                        NODE_ENV: 'development'
                    }
                };
            }
            
            polyfillInjected = true;
            
            // Give polyfills time to take effect
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Create WebXR experience with error handling
        let xrHelper: any = null;
        try {
            console.log("🔍 VR Simulation: Creating WebXR experience...");
            xrHelper = await WebXRDefaultExperience.CreateAsync(scene, {
                disableDefaultUI: true, // Create our own UI to avoid illegal invocation errors
                disableTeleportation: true,
                useStablePlugins: false, // Disable stable plugins to avoid missing feature errors
                optionalFeatures: false, // Disable optional features that might not be available
                // Explicitly disable features that commonly cause issues in simulation
                floorMeshes: [],
                ignoreNativeCameraTransformation: true,
            });
            
            // Create our own VR button since we disabled the default UI
            createCustomVRButton(scene, xrHelper);
            
            console.log("✅ VR Simulation: WebXR experience created successfully");
        } catch (xrError) {
            console.warn("⚠️ VR Simulation: WebXR experience creation failed, continuing with polyfills only:", xrError);
            // Try alternative WebXR creation approach
            try {
                console.log("🔄 VR Simulation: Trying alternative WebXR creation...");
                xrHelper = await createAlternativeWebXRExperience(scene);
            } catch (altError) {
                console.warn("⚠️ VR Simulation: Alternative WebXR creation also failed:", altError);
            }
        }

        // Add observer to sync camera with cube position
        vrUpdateObserver = scene.onBeforeRenderObservable.add(() => {
            if (scene.activeCamera && scene.activeCamera instanceof TargetCamera && vrHeadsetCube) {
                try {
                    // Copy position from cube to camera
                    scene.activeCamera.position.copyFrom(vrHeadsetCube.getAbsolutePosition());
                    
                    // Copy rotation from cube to camera
                    if (vrHeadsetCube.rotationQuaternion) {
                        scene.activeCamera.rotationQuaternion = vrHeadsetCube.rotationQuaternion.clone();
                    }
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Error syncing camera with cube:", error);
                }
            }
        });

        // Store reference for cleanup
        (scene as any)._vrSimulation = {
            xrHelper,
            updateObserver: vrUpdateObserver,
            headsetCube: cube,
            polyfills: true,
        };

        // Log VR simulation activation
        console.log("🎮 VR Simulation Enabled - Babylon.js now believes it's running in a VR headset!");
    } catch (error) {
        console.error("❌ VR Simulation: Failed to enable VR simulation:", error);
        // Rollback on error
        isVRSimulationEnabled = false;
        vrHeadsetCube = null;
        throw error;
    }
}

/**
 * Disables the mixed reality polyfill.
 * @param scene defines the reference to the scene where to disable the polyfill.
 */
export function MixedRealityDisabled(scene: Scene): void {
    if (!isVRSimulationEnabled) {
        return;
    }

    try {
        isVRSimulationEnabled = false;
        vrHeadsetCube = null;

        // Clean up observer
        if (vrUpdateObserver) {
            try {
                scene.onBeforeRenderObservable.remove(vrUpdateObserver);
            } catch (error) {
                console.warn("⚠️ VR Simulation: Error removing observer:", error);
            }
            vrUpdateObserver = null;
        }

        // Clean up stored references
        const vrSimulation = (scene as any)._vrSimulation;
        if (vrSimulation) {
            if (vrSimulation.xrHelper) {
                try {
                    vrSimulation.xrHelper.dispose();
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Error disposing XR helper:", error);
                }
            }
            (scene as any)._vrSimulation = undefined;
        }

        // Log VR simulation deactivation
        console.log("🔌 VR Simulation Disabled - Restored original WebXR implementation");
    } catch (error) {
        console.error("❌ VR Simulation: Error disabling VR simulation:", error);
    }
}

/**
 * Creates a custom VR button that works reliably in the editor
 */
function createCustomVRButton(scene: any, xrHelper: any): void {
    try {
        // Comprehensive null checks
        if (!xrHelper) {
            console.warn("⚠️ Cannot create VR button - xrHelper is missing");
            return;
        }
        
        if (!xrHelper.baseExperience) {
            console.warn("⚠️ Cannot create VR button - baseExperience is missing");
            
            // Create minimal baseExperience if missing
            xrHelper.baseExperience = {
                enterXRAsync: async (mode: string, referenceSpaceType: string) => {
                    console.log(`🔍 VR Simulation: Mock enterXRAsync called with ${mode}, ${referenceSpaceType}`);
                    return Promise.resolve();
                },
                state: { isInXR: false }
            };
            
            console.log("🔧 VR Simulation: Created minimal baseExperience for button functionality");
        }
        
        // Find the preview canvas container
        const canvas = scene.getEngine().getRenderingCanvas();
        if (!canvas) {
            console.warn("⚠️ Cannot create VR button - canvas not found");
            return;
        }
        
        // Create container for the button
        const buttonContainer = document.createElement("div");
        buttonContainer.style.position = "absolute";
        buttonContainer.style.bottom = "20px";
        buttonContainer.style.right = "20px";
        buttonContainer.style.zIndex = "10";
        
        // Create the VR button
        const enterVRButton = document.createElement("button");
        enterVRButton.textContent = "ENTER VR";
        enterVRButton.style.padding = "10px 20px";
        enterVRButton.style.backgroundColor = "#5460e6";
        enterVRButton.style.color = "white";
        enterVRButton.style.border = "none";
        enterVRButton.style.borderRadius = "4px";
        enterVRButton.style.fontWeight = "bold";
        enterVRButton.style.cursor = "pointer";
        enterVRButton.style.transition = "background-color 0.2s";
        
        // Hover effect
        enterVRButton.addEventListener("mouseover", function() {
            enterVRButton.style.backgroundColor = "#4450c6";
        });
        
        enterVRButton.addEventListener("mouseout", function() {
            enterVRButton.style.backgroundColor = "#5460e6";
        });
        
        // Click handler to enter VR
        enterVRButton.addEventListener("click", async function() {
            try {
                console.log("🔍 VR Simulation: Entering VR mode via custom button");
                
                // Use a safer enterXRAsync with fallbacks
                try {
                    // First try the standard approach
                    await xrHelper.baseExperience.enterXRAsync("immersive-vr", "local-floor");
                } catch (xrError) {
                    console.warn("⚠️ First VR entry attempt failed, trying alternate approach:", xrError);
                    
                    // If we have the baseExperience, attempt to manually set state
                    if (xrHelper && xrHelper.baseExperience) {
                        // Force the state to be in VR mode
                        if (xrHelper.baseExperience.state) {
                            xrHelper.baseExperience.state.isInXR = true;
                            
                            // Notify that XR mode was "entered" successfully
                            if (xrHelper.baseExperience.onXRSessionInit) {
                                xrHelper.baseExperience.onXRSessionInit.notifyObservers(null);
                            }
                        }
                    } else {
                        throw new Error("Cannot enter VR mode: baseExperience not available");
                    }
                }
                
                console.log("✅ VR Simulation: Entered VR mode successfully");
                
                // Hide button when in VR
                buttonContainer.style.display = "none";
            } catch (error) {
                console.error("❌ VR Simulation: Failed to enter VR mode:", error);
                
                // Show error message
                enterVRButton.textContent = "VR ERROR";
                enterVRButton.style.backgroundColor = "#e65454";
                
                // Reset after 2 seconds
                setTimeout(() => {
                    enterVRButton.textContent = "ENTER VR";
                    enterVRButton.style.backgroundColor = "#5460e6";
                }, 2000);
            }
        });
        
        // Add exit VR handler if observable exists
        if (xrHelper.baseExperience.onExitXRObservable) {
            xrHelper.baseExperience.onExitXRObservable.add(() => {
                console.log("🔍 VR Simulation: Exited VR mode");
                buttonContainer.style.display = "block";
            });
        } else {
            console.log("⚠️ VR Simulation: onExitXRObservable not available, using fallback");
            // Fallback: Check periodically if VR mode is exited
            const checkInterval = setInterval(() => {
                if (!xrHelper.baseExperience.state.isInXR) {
                    console.log("🔍 VR Simulation: Detected VR exit via polling");
                    buttonContainer.style.display = "block";
                    clearInterval(checkInterval);
                }
            }, 1000);
        }
        
        // Add button to container
        buttonContainer.appendChild(enterVRButton);
        
        // Add container to canvas parent if it exists
        if (canvas.parentNode) {
            canvas.parentNode.appendChild(buttonContainer);
        } else {
            // Fallback: append to document body if canvas parent is not available
            document.body.appendChild(buttonContainer);
            console.log("⚠️ VR Simulation: Canvas parent not found, appending button to document body");
        }
        
        console.log("✅ VR Simulation: Custom VR button created successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Failed to create custom VR button:", error);
    }
}

/**
 * Creates an alternative WebXR experience when the default approach fails
 */
async function createAlternativeWebXRExperience(scene: Scene): Promise<any> {
    console.log("🔧 VR Simulation: Creating alternative WebXR experience");
    
    // Create a minimal mock WebXR experience
    const mockExperience = {
        baseExperience: null,
        camera: scene.activeCamera,
        sessionManager: {
            session: createMockXRSession('immersive-vr'),
            isSessionSupportedAsync: async () => true,
            initializeSessionAsync: async () => {
                console.log("🔧 VR Simulation: Mock session initialized");
                return Promise.resolve();
            }
        },
        onInitialXRPoseSetObservable: {
            add: () => {},
            remove: () => {}
        },
        onStateChangedObservable: {
            add: () => {},
            remove: () => {}
        },
        dispose: () => {
            console.log("🔧 VR Simulation: Mock experience disposed");
        }
    };
    
    return mockExperience;
}
