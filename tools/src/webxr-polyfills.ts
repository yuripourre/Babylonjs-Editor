/**
 * WebXR Polyfills for VR simulation
 * This file contains polyfills to simulate WebXR support in environments where it's not available
 */

/**
 * Creates a mock XR session for VR simulation
 * @param sessionType The type of session to create
 * @returns A mock XR session
 */
export function createMockXRSession(sessionType: string): any {
    try {
        const mockSession = {
            sessionType,
            inputSources: createMockInputSources(),
            referenceSpace: createMockReferenceSpace(),
            requestReferenceSpace: async (type: string) => {
                try {
                    const refSpace = createMockReferenceSpace(type);
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
                            const mockFrame = createMockXRFrame(mockSession);
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
 * @returns Mock input sources
 */
export function createMockInputSources(): any {
    try {
        // Create grip space with getUniqueId
        const mockGripSpace = {
            type: 'grip',
            getOffsetReferenceSpace: () => createMockReferenceSpace('grip'),
            getTransformedReferenceSpace: () => createMockReferenceSpace('grip'),
            bounds: null,
            getBoundingVolume: () => null,
            originOffset: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        };
        (mockGripSpace as any).getUniqueId = () => 'vr-grip-space-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Create target ray space with getUniqueId
        const mockTargetRaySpace = {
            type: 'targetRay',
            getOffsetReferenceSpace: () => createMockReferenceSpace('targetRay'),
            getTransformedReferenceSpace: () => createMockReferenceSpace('targetRay'),
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
 * @param type The type of reference space
 * @returns A mock reference space
 */
export function createMockReferenceSpace(type: string = 'viewer'): any {
    try {
        const mockSpace = {
            type,
            getOffsetReferenceSpace: () => {
                const space = createMockReferenceSpace(type);
                if (space) {
                    (space as any).getUniqueId = () => 'vr-reference-space-offset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                }
                return space;
            },
            getTransformedReferenceSpace: () => {
                const space = createMockReferenceSpace(type);
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
 * @returns A mock VR display
 */
export function createMockVRDisplay(): any {
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
 * Creates a mock XR frame for animation frames
 * @param session The XR session
 * @returns A mock XR frame
 */
export function createMockXRFrame(session: any): any {
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
                    // Always ensure spaces have getUniqueId to prevent null reference errors
                    if (space1 && !space1.getUniqueId) {
                        space1.getUniqueId = () => 'vr-space1-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    }
                    
                    if (space2 && !space2.getUniqueId) {
                        space2.getUniqueId = () => 'vr-space2-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    }
                    
                    if (!space1 || !space2) {
                        console.warn("⚠️ VR Simulation: getPose called with null space");
                        // Return a minimal mock pose with getUniqueId instead of null
                        const transform = {
                            position: { x: 0, y: 0, z: 0 },
                            orientation: { x: 0, y: 0, z: 0, w: 1 },
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            inverse: { 
                                matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                                getUniqueId: () => 'vr-null-inverse-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                            },
                            getUniqueId: () => 'vr-null-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        };
                        
                        const mockPose = {
                            transform,
                            getUniqueId: () => 'vr-null-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        };
                        
                        return mockPose;
                    }
                    
                    // Create a mock pose with all required properties and methods
                    const transform = {
                        position: { x: 0, y: 0, z: 0 },
                        orientation: { x: 0, y: 0, z: 0, w: 1 },
                        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                        inverse: { 
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            getUniqueId: () => 'vr-pose-inverse-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        },
                        getUniqueId: () => 'vr-pose-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                    
                    const mockPose = {
                        transform,
                        getUniqueId: () => 'vr-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                    
                    return mockPose;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Error in getPose:", error);
                    // Return a minimal mock pose with getUniqueId instead of null
                    const transform = {
                        position: { x: 0, y: 0, z: 0 },
                        orientation: { x: 0, y: 0, z: 0, w: 1 },
                        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                        inverse: { 
                            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                            getUniqueId: () => 'vr-error-inverse-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                        },
                        getUniqueId: () => 'vr-error-transform-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                    
                    const mockPose = {
                        transform,
                        getUniqueId: () => 'vr-error-pose-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                    };
                    
                    return mockPose;
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
 * Creates mock XR session class
 * @returns A mock XR session class
 */
export function createMockXRSessionClass(): any {
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
 * @returns A mock XR reference space class
 */
export function createMockXRReferenceSpaceClass(): any {
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
 * @returns A mock XR rigid transform class
 */
export function createMockXRRigidTransformClass(): any {
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
 * Function to add getUniqueId to an object if it doesn't have one
 * @param obj The object to add getUniqueId to
 * @param name The name of the object for logging purposes
 */
export function ensureUniqueId(obj: any, name: string): void {
    if (!obj) return;
    
    try {
        const originalMethod = obj.getUniqueId;
        if (!originalMethod || typeof originalMethod !== 'function') {
            Object.defineProperty(obj, 'getUniqueId', {
                value: () => `safe-id-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                writable: true,
                configurable: true
            });
            console.log(`🔧 VR Simulation: Added getUniqueId to ${name}`);
        }
    } catch (error) {
        console.warn(`⚠️ VR Simulation: Could not add getUniqueId to ${name}:`, error);
    }
}

