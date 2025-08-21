
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

        // Inject comprehensive VR polyfills only once
        if (!polyfillInjected) {
            _injectVRPolyfills();
            polyfillInjected = true;
        }

        // Create WebXR experience with error handling
        let xrHelper: any = null;
        try {
            xrHelper = await WebXRDefaultExperience.CreateAsync(scene, {
                disableDefaultUI: false,
                disableTeleportation: true,
            });
        } catch (xrError) {
            console.warn("⚠️ VR Simulation: WebXR experience creation failed, continuing with polyfills only:", xrError);
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
 * Injects comprehensive VR polyfills to make Babylon.js believe it's running in VR
 */
function _injectVRPolyfills(): void {
    try {
        console.log("🔧 VR Simulation: Starting polyfill injection...");

        // Polyfill navigator.xr
        if (!(navigator as any).xr) {
            console.log("🔧 VR Simulation: Injecting navigator.xr polyfill");
            (navigator as any).xr = {
                isSessionSupported: async (sessionType: string) => {
                    try {
                        return sessionType === 'immersive-vr' || sessionType === 'immersive-ar';
                    } catch (error) {
                        console.warn("⚠️ VR Simulation: isSessionSupported error:", error);
                        return false;
                    }
                },
                requestSession: async (sessionType: string) => {
                    try {
                        return _createMockXRSession(sessionType);
                    } catch (error) {
                        console.warn("⚠️ VR Simulation: requestSession error:", error);
                        throw new Error('Failed to create VR session');
                    }
                },
                addEventListener: () => {},
                removeEventListener: () => {},
                // Add device property
                device: {
                    supportsSession: async (type: string) => true,
                    getUniqueId: () => 'vr-device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                },
            };
        }
        
        // Patch WebGLRenderingContext to add makeXRCompatible method
        _patchWebGLContexts();

        // Polyfill getVRDisplays (for older VR APIs)
        if (!(navigator as any).getVRDisplays) {
            console.log("🔧 VR Simulation: Injecting getVRDisplays polyfill");
            (navigator as any).getVRDisplays = async () => {
                try {
                    return [_createMockVRDisplay()];
                } catch (error) {
                    console.warn("⚠️ VR Simulation: getVRDisplays error:", error);
                    return [];
                }
            };
        }

        // Polyfill requestVRDisplay (for older VR APIs)
        if (!(navigator as any).requestVRDisplay) {
            console.log("🔧 VR Simulation: Injecting requestVRDisplay polyfill");
            (navigator as any).requestVRDisplay = async () => {
                try {
                    return _createMockVRDisplay();
                } catch (error) {
                    console.warn("⚠️ VR Simulation: requestVRDisplay error:", error);
                    return null;
                }
            };
        }

        // Polyfill WebXR API if not present
        if (!(window as any).XRSession) {
            console.log("🔧 VR Simulation: Injecting XRSession polyfill");
            (window as any).XRSession = _createMockXRSessionClass();
        }

        if (!(window as any).XRReferenceSpace) {
            console.log("🔧 VR Simulation: Injecting XRReferenceSpace polyfill");
            (window as any).XRReferenceSpace = _createMockXRReferenceSpaceClass();
        }

        if (!(window as any).XRRigidTransform) {
            console.log("🔧 VR Simulation: Injecting XRRigidTransform polyfill");
            (window as any).XRRigidTransform = _createMockXRRigidTransformClass();
        }

        // Override WebXR detection methods
        _overrideWebXRDetection();

        // Log polyfill injection
        console.log("🔧 VR Polyfills injected successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error injecting polyfills:", error);
        throw error;
    }
}



/**
 * Creates a mock XR session for VR simulation
 */
function _createMockXRSession(sessionType: string): any {
    try {
        const mockSession = {
            sessionType,
            inputSources: _createMockInputSources(),
            referenceSpace: _createMockReferenceSpace(),
            requestReferenceSpace: async (type: string) => {
                try {
                    const refSpace = _createMockReferenceSpace(type);
                    // Ensure reference space has getUniqueId
                    if (refSpace && !(refSpace as any).getUniqueId) {
                        (refSpace as any).getUniqueId = () => 'vr-reference-space-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    }
                    return refSpace;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: requestReferenceSpace error:", error);
                    return null;
                }
            },
            requestAnimationFrame: (callback: any) => {
                try {
                    if (typeof callback === 'function') {
                        const id = requestAnimationFrame((time) => {
                            // Create a mock XR frame with getUniqueId for each animation frame
                            const mockFrame = _createMockXRFrame(mockSession);
                            callback(time, mockFrame);
                        });
                        return id;
                    }
                    return 0;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: requestAnimationFrame error:", error);
                    return 0;
                }
            },
            cancelAnimationFrame: (id: number) => {
                try {
                    if (typeof id === 'number') {
                        cancelAnimationFrame(id);
                    }
                } catch (error) {
                    console.warn("⚠️ VR Simulation: cancelAnimationFrame error:", error);
                }
            },
            end: async () => {
                try {
                    return Promise.resolve();
                } catch (error) {
                    console.warn("⚠️ VR Simulation: end error:", error);
                    return Promise.resolve();
                }
            },
            addEventListener: () => {},
            removeEventListener: () => {},
            // Additional VR-specific properties
            renderState: {
                depthFar: 1000,
                depthNear: 0.1,
                inlineVerticalFieldOfView: 0.7853981633974483, // 45 degrees in radians
            },
            // VR-specific methods
            requestHitTest: async () => null,
            requestHitTestSource: async () => null,
            requestHitTestSourceForTransientInput: async () => null,
            // Add enabledFeatures property to fix session.enabledFeatures errors
            enabledFeatures: ['local', 'local-floor', 'bounded-floor', 'hand-tracking'],
            // Add a function to check if a feature is enabled
            isFeatureEnabled: (feature: string) => ['local', 'local-floor', 'bounded-floor', 'hand-tracking'].includes(feature),
            // Add makeXRCompatible method
            makeXRCompatible: async () => Promise.resolve(),
        };

        // Add unique ID to prevent getUniqueId errors
        (mockSession as any).getUniqueId = () => 'vr-simulation-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        return mockSession;
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock XR session:", error);
        return null;
    }
}

/**
 * Creates mock input sources for VR controllers
 */
function _createMockInputSources(): any {
    try {
        // Create grip space with getUniqueId
        const mockGripSpace = {
            type: 'grip',
            getOffsetReferenceSpace: () => _createMockReferenceSpace('grip'),
            getTransformedReferenceSpace: () => _createMockReferenceSpace('grip'),
            bounds: null,
            getBoundingVolume: () => null,
            originOffset: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        };
        (mockGripSpace as any).getUniqueId = () => 'vr-grip-space-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Create target ray space with getUniqueId
        const mockTargetRaySpace = {
            type: 'targetRay',
            getOffsetReferenceSpace: () => _createMockReferenceSpace('targetRay'),
            getTransformedReferenceSpace: () => _createMockReferenceSpace('targetRay'),
            bounds: null,
            getBoundingVolume: () => null,
            originOffset: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        };
        (mockTargetRaySpace as any).getUniqueId = () => 'vr-target-ray-space-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const mockInputSource = {
            handedness: 'right',
            profiles: ['generic-trigger'],
            targetRayMode: 'tracked-pointer',
            gripSpace: mockGripSpace,
            targetRaySpace: mockTargetRaySpace,
            gamepad: {
                id: 'VR Simulation Controller',
                index: 0,
                connected: true,
                timestamp: Date.now(),
                axes: [0, 0, 0, 0],
                buttons: [
                    { pressed: false, touched: false, value: 0 },
                    { pressed: false, touched: false, value: 0 },
                    { pressed: false, touched: false, value: 0 },
                    { pressed: false, touched: false, value: 0 },
                ],
                hapticActuators: [],
                // Add getUniqueId to gamepad
                getUniqueId: () => 'vr-gamepad-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            },
        };

        // Add unique ID to prevent getUniqueId errors
        (mockInputSource as any).getUniqueId = () => 'vr-input-source-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const inputSources = {
            length: 1,
            [0]: mockInputSource,
            // Add array-like methods
            forEach: (callback: (source: any, index: number) => void) => {
                if (mockInputSource) {
                    callback(mockInputSource, 0);
                }
            },
            // Add getUniqueId to the array-like object
            getUniqueId: () => 'vr-input-sources-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        };

        return inputSources;
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock input sources:", error);
        return { 
            length: 0,
            forEach: () => {},
            getUniqueId: () => 'vr-empty-input-sources-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        };
    }
}

/**
 * Creates a mock reference space
 */
function _createMockReferenceSpace(type: string = 'viewer'): any {
    try {
        const mockSpace = {
            type,
            getOffsetReferenceSpace: () => {
                const space = _createMockReferenceSpace(type);
                if (space) {
                    (space as any).getUniqueId = () => 'vr-reference-space-offset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                }
                return space;
            },
            getTransformedReferenceSpace: () => {
                const space = _createMockReferenceSpace(type);
                if (space) {
                    (space as any).getUniqueId = () => 'vr-reference-space-transformed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                }
                return space;
            },
            // VR-specific properties
            bounds: null,
            // VR-specific methods
            getBoundingVolume: () => null,
            // Add origin offset
            originOffset: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        };

        // Add unique ID to prevent getUniqueId errors
        (mockSpace as any).getUniqueId = () => 'vr-reference-space-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        return mockSpace;
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock reference space:", error);
        // Create a minimal reference space with getUniqueId instead of returning null
        const fallbackSpace = {
            type: type || 'viewer',
            getOffsetReferenceSpace: () => fallbackSpace,
            getTransformedReferenceSpace: () => fallbackSpace,
            bounds: null,
            getBoundingVolume: () => null,
            originOffset: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        };
        
        // Add unique ID to prevent getUniqueId errors
        (fallbackSpace as any).getUniqueId = () => 'vr-fallback-reference-space-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        return fallbackSpace;
    }
}

/**
 * Creates a mock VR display (for older VR APIs)
 */
function _createMockVRDisplay(): any {
    try {
        const mockDisplay = {
            displayName: 'VR Simulation Display',
            displayId: 0,
            isPresenting: false,
            capabilities: {
                hasPosition: true,
                hasOrientation: true,
                hasExternalDisplay: false,
                canPresent: true,
                maxLayers: 1,
                // Additional VR capabilities
                hasRoomScale: true,
            },
            stageParameters: {
                sittingToStandingTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                sizeX: 4,
                sizeZ: 4,
            },
            requestPresent: async () => Promise.resolve(),
            exitPresent: async () => Promise.resolve(),
            getPose: () => ({
                position: [0, 0, 0],
                orientation: [0, 0, 0, 1],
                linearVelocity: [0, 0, 0],
                angularVelocity: [0, 0, 0],
            }),
            requestAnimationFrame: (callback: any) => {
                try {
                    if (typeof callback === 'function') {
                        return requestAnimationFrame(callback);
                    }
                    return 0;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: requestAnimationFrame error:", error);
                    return 0;
                }
            },
            cancelAnimationFrame: (id: number) => {
                try {
                    if (typeof id === 'number') {
                        cancelAnimationFrame(id);
                    }
                } catch (error) {
                    console.warn("⚠️ VR Simulation: cancelAnimationFrame error:", error);
                }
            },
            // Additional VR methods
            getLayers: () => [],
        };

        // Add unique ID to prevent getUniqueId errors
        (mockDisplay as any).getUniqueId = () => 'vr-display-' + Date.now();

        return mockDisplay;
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock VR display:", error);
        return null;
    }
}

/**
 * Creates mock XR session class
 */
function _createMockXRSessionClass(): any {
    try {
        return class MockXRSession {
            static readonly IMMERSIVE_VR = 'immersive-vr';
            static readonly IMMERSIVE_AR = 'immersive-ar';
            static readonly INLINE = 'inline';
        };
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock XR session class:", error);
        return null;
    }
}

/**
 * Creates mock XR reference space class
 */
function _createMockXRReferenceSpaceClass(): any {
    try {
        return class MockXRReferenceSpace {
            static readonly VIEWER = 'viewer';
            static readonly LOCAL = 'local';
            static readonly LOCAL_FLOOR = 'local-floor';
            static readonly BOUNDED_FLOOR = 'bounded-floor';
            static readonly UNBOUNDED = 'unbounded';
        };
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock XR reference space class:", error);
        return null;
    }
}

/**
 * Creates mock XR rigid transform class
 */
function _createMockXRRigidTransformClass(): any {
    try {
        return class MockXRRigidTransform {
            constructor(position?: any, orientation?: any) {
                this.position = position || [0, 0, 0];
                this.orientation = orientation || [0, 0, 0, 1];
            }
            position: number[];
            orientation: number[];
            matrix: number[];
            // Add getUniqueId method
            getUniqueId(): string {
                return 'vr-rigid-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            }
        };
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock XR rigid transform class:", error);
        return null;
    }
}

/**
 * Creates a mock XR frame for animation frames
 */
function _createMockXRFrame(session: any): any {
    try {
        const mockFrame = {
            session,
            // Add view and projection matrices
            getViewerPose: (referenceSpace: any) => {
                try {
                    if (!referenceSpace) {
                        console.warn("⚠️ VR Simulation: getViewerPose called with null reference space");
                        // Return a minimal mock pose with getUniqueId instead of null
                        return {
                            transform: {
                                position: { x: 0, y: 0, z: 0 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 },
                                matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                                inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                                getUniqueId: () => 'vr-null-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                            },
                            views: [],
                            getUniqueId: () => 'vr-null-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        };
                    }
                    
                    // Create a mock viewer pose
                    const mockPose = {
                        transform: {
                            position: { x: 0, y: 0, z: 0 },
                            orientation: { x: 0, y: 0, z: 0, w: 1 },
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                            getUniqueId: () => 'vr-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        },
                        views: [
                            // Left eye view
                            {
                                eye: 'left',
                                projectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                                transform: {
                                    position: { x: -0.03, y: 0, z: 0 },
                                    orientation: { x: 0, y: 0, z: 0, w: 1 },
                                    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.03, 0, 0, 1],
                                    inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.03, 0, 0, 1] },
                                    getUniqueId: () => 'vr-view-transform-left-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                                },
                                getUniqueId: () => 'vr-view-left-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                            },
                            // Right eye view
                            {
                                eye: 'right',
                                projectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                                transform: {
                                    position: { x: 0.03, y: 0, z: 0 },
                                    orientation: { x: 0, y: 0, z: 0, w: 1 },
                                    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.03, 0, 0, 1],
                                    inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.03, 0, 0, 1] },
                                    getUniqueId: () => 'vr-view-transform-right-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                                },
                                getUniqueId: () => 'vr-view-right-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                            }
                        ],
                        getUniqueId: () => 'vr-viewer-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                    
                    return mockPose;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Error in getViewerPose:", error);
                    // Return a minimal mock pose with getUniqueId instead of null
                    return {
                        transform: {
                            position: { x: 0, y: 0, z: 0 },
                            orientation: { x: 0, y: 0, z: 0, w: 1 },
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                            getUniqueId: () => 'vr-error-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        },
                        views: [],
                        getUniqueId: () => 'vr-error-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                }
            },
            getPose: (space1: any, space2: any) => {
                try {
                    if (!space1 || !space2) {
                        console.warn("⚠️ VR Simulation: getPose called with null space");
                        // Return a minimal mock pose with getUniqueId instead of null
                        return {
                            transform: {
                                position: { x: 0, y: 0, z: 0 },
                                orientation: { x: 0, y: 0, z: 0, w: 1 },
                                matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                                inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                                getUniqueId: () => 'vr-null-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                            },
                            getUniqueId: () => 'vr-null-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        };
                    }
                    
                    // Create a mock pose
                    const mockPose = {
                        transform: {
                            position: { x: 0, y: 0, z: 0 },
                            orientation: { x: 0, y: 0, z: 0, w: 1 },
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                            getUniqueId: () => 'vr-pose-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        },
                        getUniqueId: () => 'vr-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                    
                    return mockPose;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Error in getPose:", error);
                    // Return a minimal mock pose with getUniqueId instead of null
                    return {
                        transform: {
                            position: { x: 0, y: 0, z: 0 },
                            orientation: { x: 0, y: 0, z: 0, w: 1 },
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                            getUniqueId: () => 'vr-error-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        },
                        getUniqueId: () => 'vr-error-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                }
            },
            // Add getUniqueId to prevent errors
            getUniqueId: () => 'vr-frame-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
        
        return mockFrame;
    } catch (error) {
        console.error("❌ VR Simulation: Error creating mock XR frame:", error);
        return {
            session,
            getViewerPose: () => ({
                transform: {
                    position: { x: 0, y: 0, z: 0 },
                    orientation: { x: 0, y: 0, z: 0, w: 1 },
                    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                    getUniqueId: () => 'vr-fallback-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                },
                views: [],
                getUniqueId: () => 'vr-fallback-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            }),
            getPose: () => ({
                transform: {
                    position: { x: 0, y: 0, z: 0 },
                    orientation: { x: 0, y: 0, z: 0, w: 1 },
                    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    inverse: { matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
                    getUniqueId: () => 'vr-fallback-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                },
                getUniqueId: () => 'vr-fallback-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            }),
            getUniqueId: () => 'vr-error-frame-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
    }
}

/**
 * Patches WebGL contexts to add makeXRCompatible method
 */
function _patchWebGLContexts(): void {
    try {
        console.log("🔧 VR Simulation: Patching WebGL contexts for XR compatibility");
        
        // Patch WebGLRenderingContext.prototype
        if (window.WebGLRenderingContext && !WebGLRenderingContext.prototype.makeXRCompatible) {
            WebGLRenderingContext.prototype.makeXRCompatible = async function() {
                console.log("🔧 VR Simulation: WebGLRenderingContext.makeXRCompatible called");
                // Suppress the BabylonJS error message about makeXRCompatible
                const originalConsoleError = console.error;
                console.error = (...args) => {
                    if (args[0] && typeof args[0] === 'string' && args[0].includes('Error executing makeXRCompatible')) {
                        console.log("🔧 VR Simulation: Suppressed makeXRCompatible error message");
                    } else {
                        originalConsoleError.apply(console, args);
                    }
                };
                
                // Restore console.error after a short delay
                setTimeout(() => {
                    console.error = originalConsoleError;
                }, 1000);
                
                return Promise.resolve(this);
            };
        }
        
        // Patch WebGL2RenderingContext.prototype if available
        if (window.WebGL2RenderingContext && !WebGL2RenderingContext.prototype.makeXRCompatible) {
            WebGL2RenderingContext.prototype.makeXRCompatible = async function() {
                console.log("🔧 VR Simulation: WebGL2RenderingContext.makeXRCompatible called");
                // Suppress the BabylonJS error message about makeXRCompatible
                const originalConsoleError = console.error;
                console.error = (...args) => {
                    if (args[0] && typeof args[0] === 'string' && args[0].includes('Error executing makeXRCompatible')) {
                        console.log("🔧 VR Simulation: Suppressed makeXRCompatible error message");
                    } else {
                        originalConsoleError.apply(console, args);
                    }
                };
                
                // Restore console.error after a short delay
                setTimeout(() => {
                    console.error = originalConsoleError;
                }, 1000);
                
                return Promise.resolve(this);
            };
        }
        
        // Patch any existing canvas contexts
        const canvases = document.getElementsByTagName('canvas');
        for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i];
            const context = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (context && !(context as any).makeXRCompatible) {
                (context as any).makeXRCompatible = async function() {
                    console.log("🔧 VR Simulation: Existing context.makeXRCompatible called");
                    return Promise.resolve(this);
                };
            }
        }
        
        console.log("🔧 VR Simulation: WebGL contexts patched successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error patching WebGL contexts:", error);
    }
}

/**
 * Overrides WebXR detection methods to always return VR-capable
 */
function _overrideWebXRDetection(): void {
    try {
        // Override WebXR capability detection
        if ((navigator as any).xr) {
            const originalIsSessionSupported = (navigator as any).xr.isSessionSupported;
            (navigator as any).xr.isSessionSupported = async (sessionType: string) => {
                try {
                    if (sessionType === 'immersive-vr' || sessionType === 'immersive-ar') {
                        return true; // Always return true for VR simulation
                    }
                    if (originalIsSessionSupported && typeof originalIsSessionSupported === 'function') {
                        try {
                            return await originalIsSessionSupported(sessionType);
                        } catch (error) {
                            console.warn("⚠️ VR Simulation: Original isSessionSupported failed:", error);
                            return false;
                        }
                    }
                    return false;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: isSessionSupported override error:", error);
                    return false;
                }
            };
            
            // Add makeXRCompatible to navigator.xr
            if (!(navigator as any).xr.makeXRCompatible) {
                (navigator as any).xr.makeXRCompatible = async () => {
                    console.log("🔧 VR Simulation: makeXRCompatible called");
                    return Promise.resolve(true);
                };
            }
        }

        // Override VR display detection
        if ((navigator as any).getVRDisplays) {
            const originalGetVRDisplays = (navigator as any).getVRDisplays;
            (navigator as any).getVRDisplays = async () => {
                try {
                    const displays = await originalGetVRDisplays();
                    if (displays && displays.length === 0) {
                        return [_createMockVRDisplay()];
                    }
                    return displays || [];
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Original getVRDisplays failed:", error);
                    return [_createMockVRDisplay()];
                }
            };
        }

        // Override VR-specific feature detection
        if ((navigator as any).xr) {
            const originalRequestSession = (navigator as any).xr.requestSession;
            (navigator as any).xr.requestSession = async (sessionType: string, options?: any) => {
                try {
                    if (sessionType === 'immersive-vr' || sessionType === 'immersive-ar') {
                        const session = _createMockXRSession(sessionType);
                        
                        // Process requested features from options
                        if (options && options.requiredFeatures && Array.isArray(options.requiredFeatures)) {
                            // Store requested features for later reference
                            (session as any).requestedFeatures = options.requiredFeatures;
                            
                            // Make sure all requested features are in enabledFeatures
                            for (const feature of options.requiredFeatures) {
                                if (!(session as any).enabledFeatures.includes(feature)) {
                                    (session as any).enabledFeatures.push(feature);
                                }
                            }
                        }
                        
                        return session;
                    }
                    if (originalRequestSession && typeof originalRequestSession === 'function') {
                        try {
                            return await originalRequestSession(sessionType, options);
                        } catch (error) {
                            console.warn("⚠️ VR Simulation: Original requestSession failed:", error);
                            throw new Error('Session type not supported');
                        }
                    }
                    throw new Error('Session type not supported');
                } catch (error) {
                    console.warn("⚠️ VR Simulation: requestSession override error:", error);
                    throw new Error('Session type not supported');
                }
            };
        }
    } catch (error) {
        console.error("❌ VR Simulation: Error overriding WebXR detection:", error);
    }
}

