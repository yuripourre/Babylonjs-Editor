/**
 * WebXR Direct Patches Module
 * This file contains direct patches for specific Babylon.js functions that are causing issues
 */

import { createSafeNode } from "./webxr-safe-node";

/**
 * Patches the XRWebGLLayer constructor to handle our mock XRSession objects
 */
function patchXRWebGLLayer(): void {
    try {
        // Store the original XRWebGLLayer constructor if it exists
        const OriginalXRWebGLLayer = (window as any).XRWebGLLayer;
        
        // Create a new constructor that can handle our mock XRSession objects
        (window as any).XRWebGLLayer = function(session: any, context: any, options?: any) {
            if (!session) {
                console.warn("🔧 VR Simulation: XRWebGLLayer constructor called with null session, creating mock");
                return createMockXRWebGLLayer(context);
            }
            
            // Check if this is our mock session object
            if (session.getUniqueId && typeof session.getUniqueId === 'function') {
                console.log("🔧 VR Simulation: XRWebGLLayer constructor called with mock session, creating mock layer");
                return createMockXRWebGLLayer(context);
            }
            
            // If it's a real XRSession and the original constructor exists, use it
            if (OriginalXRWebGLLayer) {
                try {
                    return new OriginalXRWebGLLayer(session, context, options);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Original XRWebGLLayer constructor failed, falling back to mock:", error);
                    return createMockXRWebGLLayer(context);
                }
            }
            
            // Fallback: create a mock if the original constructor doesn't exist
            return createMockXRWebGLLayer(context);
        };
        
        // Copy any static properties from the original constructor
        if (OriginalXRWebGLLayer) {
            Object.keys(OriginalXRWebGLLayer).forEach(key => {
                (window as any).XRWebGLLayer[key] = OriginalXRWebGLLayer[key];
            });
        }
        
        console.log("✅ VR Simulation: XRWebGLLayer constructor patched successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Failed to patch XRWebGLLayer constructor:", error);
    }
}

/**
 * Creates a mock XRWebGLLayer object
 * @param context The WebGL context
 */
function createMockXRWebGLLayer(context: any): any {
    return {
        framebuffer: null,
        framebufferWidth: window.innerWidth * 2, // Double width for stereo rendering
        framebufferHeight: window.innerHeight,
        context,
        getViewport: (view: any) => {
            // Create different viewports for left and right eyes
            const isRightEye = view && view.eye === 'right';
            const halfWidth = window.innerWidth;
            
            return {
                x: isRightEye ? halfWidth : 0,
                y: 0,
                width: halfWidth,
                height: window.innerHeight
            };
        },
        getUniqueId: () => 'mock-xr-webgl-layer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        // Add additional properties that Babylon.js might expect
        ignoreDepthValues: false,
        fixedFoveation: 0,
        composition: "opaque",
        passthrough: false
    };
}

/**
 * Apply direct patches to specific Babylon.js functions
 * @param babylonjs The BABYLON namespace to patch
 */
export function applyDirectPatches(babylonjs: any): void {
    if (!babylonjs) {
        console.warn("Cannot apply direct patches - BABYLON namespace is not available");
        return;
    }

    try {
        console.log("🔧 VR Simulation: Applying direct patches to Babylon.js functions");
        
        // Patch XRWebGLLayer constructor first
        patchXRWebGLLayer();

        // Patch MeshBuilder.CreateIcoSphere which is in the error stack trace
        if (babylonjs.MeshBuilder && babylonjs.MeshBuilder.CreateIcoSphere) {
            const originalCreateIcoSphere = babylonjs.MeshBuilder.CreateIcoSphere;
            
            babylonjs.MeshBuilder.CreateIcoSphere = function(name: string, options: any, scene: any): any {
                try {
                    // Check for null scene
                    if (!scene) {
                        console.warn("🔧 VR Simulation: Caught null scene in CreateIcoSphere, using safe implementation");
                        return createSafeNode();
                    }
                    
                    return originalCreateIcoSphere(name, options, scene);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Error in CreateIcoSphere, using safe implementation:", error);
                    return createSafeNode();
                }
            };
        }
        
        // Patch all MeshBuilder creation functions
        if (babylonjs.MeshBuilder) {
            const meshBuilderFunctions = [
                'CreateBox', 'CreateSphere', 'CreateCylinder', 'CreatePlane', 'CreateGround',
                'CreateTiledGround', 'CreateDisc', 'CreateTorusKnot', 'CreateTorus',
                'CreateLineSystem', 'CreateLines', 'CreateDashedLines', 'CreatePolygon',
                'ExtrudePolygon', 'ExtrudeShape', 'CreateLathe', 'CreateTube',
                'CreatePolyhedron', 'CreateDecal', 'CreateCapsule', 'CreateGroundFromHeightMap'
            ];
            
            meshBuilderFunctions.forEach(functionName => {
                if (babylonjs.MeshBuilder[functionName]) {
                    const originalFunction = babylonjs.MeshBuilder[functionName];
                    
                    babylonjs.MeshBuilder[functionName] = function(name: string, options: any, scene: any): any {
                        try {
                            // Check for null scene
                            if (!scene) {
                                console.warn(`🔧 VR Simulation: Caught null scene in ${functionName}, using safe implementation`);
                                return createSafeNode();
                            }
                            
                            return originalFunction(name, options, scene);
                        } catch (error) {
                            console.warn(`🔧 VR Simulation: Error in ${functionName}, using safe implementation:`, error);
                            return createSafeNode();
                        }
                    };
                }
            });
        }
        
        // Patch WebXRDefaultExperience.baseExperience.enterXRAsync
        if (babylonjs.WebXRDefaultExperience && babylonjs.WebXRDefaultExperience.prototype.enterXRAsync) {
            const originalEnterXRAsync = babylonjs.WebXRDefaultExperience.prototype.enterXRAsync;
            
            babylonjs.WebXRDefaultExperience.prototype.enterXRAsync = async function(sessionMode: string, referenceSpaceType: string): Promise<any> {
                try {
                    console.log(`🔧 VR Simulation: Attempting to enter XR mode with ${sessionMode} and ${referenceSpaceType}`);
                    
                    // Try original function with error handling
                    try {
                        return await originalEnterXRAsync.call(this, sessionMode, referenceSpaceType);
                    } catch (error) {
                        console.warn("🔧 VR Simulation: Original enterXRAsync failed, using safe implementation:", error);
                        
                        // Set state to indicate we're in XR mode even though it failed
                        if (this.baseExperience && this.baseExperience.state) {
                            this.baseExperience.state.isInXR = true;
                        }
                        
                        // Return empty promise for success
                        return Promise.resolve();
                    }
                } catch (error) {
                    console.error("❌ VR Simulation: Failed to enter XR mode:", error);
                    return Promise.reject(error);
                }
            };
        }
        
        // Patch WebXRExperienceHelper.enterXRAsync which is called by WebXRDefaultExperience
        if (babylonjs.WebXRExperienceHelper && babylonjs.WebXRExperienceHelper.prototype.enterXRAsync) {
            const originalHelperEnterXRAsync = babylonjs.WebXRExperienceHelper.prototype.enterXRAsync;
            
            babylonjs.WebXRExperienceHelper.prototype.enterXRAsync = async function(sessionMode: string, referenceSpaceType: string): Promise<any> {
                try {
                    console.log(`🔧 VR Simulation: WebXRExperienceHelper enterXRAsync called with ${sessionMode} and ${referenceSpaceType}`);
                    
                    // Try original function with error handling
                    try {
                        return await originalHelperEnterXRAsync.call(this, sessionMode, referenceSpaceType);
                    } catch (error) {
                        console.warn("🔧 VR Simulation: Original WebXRExperienceHelper enterXRAsync failed, using safe implementation:", error);
                        
                        // Set state to indicate we're in XR mode even though it failed
                        this.state.isInXR = true;
                        
                        // Return empty promise for success
                        return Promise.resolve(this);
                    }
                } catch (error) {
                    console.error("❌ VR Simulation: Failed to enter XR mode in helper:", error);
                    return Promise.reject(error);
                }
            };
        }
        
        // Patch WebXRSessionManager.initializeXRLayerAsync which is in the error stack trace
        if (babylonjs.WebXRSessionManager && babylonjs.WebXRSessionManager.prototype.initializeXRLayerAsync) {
            const originalInitializeXRLayerAsync = babylonjs.WebXRSessionManager.prototype.initializeXRLayerAsync;
            
            babylonjs.WebXRSessionManager.prototype.initializeXRLayerAsync = async function(): Promise<any> {
                try {
                    // Check if we need to handle this call differently
                    if (!this.session || !this.session.renderState) {
                        console.warn("🔧 VR Simulation: initializeXRLayerAsync called with invalid session, using safe implementation");
                        
                        // Create a mock XRWebGLLayer if it doesn't exist
                        this.xrNativeLayer = createMockXRWebGLLayer(this.scene?.getEngine()?.getRenderingContext());
                        
                        // Set necessary properties that Babylon.js expects
                        this.baseLayer = this.xrNativeLayer;
                        
                        return Promise.resolve(this.xrNativeLayer);
                    }
                    
                    // Try the original function first
                    return await originalInitializeXRLayerAsync.apply(this, arguments);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Error in initializeXRLayerAsync, using safe implementation:", error);
                    
                    // Create a mock XRWebGLLayer if it failed
                    this.xrNativeLayer = createMockXRWebGLLayer(this.scene?.getEngine()?.getRenderingContext());
                    
                    // Set necessary properties that Babylon.js expects
                    this.baseLayer = this.xrNativeLayer;
                    
                    return Promise.resolve(this.xrNativeLayer);
                }
            };
        }
        
        // Patch WebXRFeaturesManager.attachFeature which is in the error stack trace
        if (babylonjs.WebXRFeaturesManager && babylonjs.WebXRFeaturesManager.prototype.attachFeature) {
            const originalAttachFeature = babylonjs.WebXRFeaturesManager.prototype.attachFeature;
            
            babylonjs.WebXRFeaturesManager.prototype.attachFeature = function(featureName: string, options?: any): any {
                try {
                    // Skip problematic features like xr-hand-tracking
                    const problematicFeatures = [
                        'xr-hand-tracking',
                        'xr-hit-test',
                        'xr-plane-detection',
                        'xr-mesh-detection',
                        'xr-light-estimation',
                        'xr-physics-controller',
                        'xr-teleportation',
                        'xr-feature-pointer'
                    ];
                    
                    if (problematicFeatures.some(pf => featureName.includes(pf))) {
                        console.log(`🔧 VR Simulation: Skipping problematic feature ${featureName}, creating mock`);
                        
                        // Return a mock feature that won't crash
                        return {
                            attach: () => true,
                            detach: () => true,
                            dispose: () => true,
                            isCompatible: () => false,
                            attached: false,
                            enabled: false,
                            featureImplementation: null,
                            _options: options || {},
                            xrNativeFeatureName: featureName,
                            getUniqueId: () => `mock-feature-${featureName}-${Date.now()}`,
                            isNativelySupported: () => false
                        };
                    }
                    
                    return originalAttachFeature.call(this, featureName, options);
                } catch (error) {
                    console.warn(`🔧 VR Simulation: Error in attachFeature, creating mock:`, error);
                    
                    // Return a mock feature implementation
                    return {
                        attach: () => true,
                        detach: () => true,
                        dispose: () => true,
                        isCompatible: () => false,
                        attached: false,
                        enabled: false,
                        featureImplementation: null,
                        _options: options || {},
                        xrNativeFeatureName: featureName,
                        getUniqueId: () => `error-feature-${featureName}-${Date.now()}`,
                        isNativelySupported: () => false
                    };
                }
            };
        }

        console.log("✅ VR Simulation: Direct patches applied successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error applying direct patches:", error);
    }
}
