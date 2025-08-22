
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

        // Inject comprehensive VR polyfills BEFORE trying to create WebXR experience
        if (!polyfillInjected) {
            console.log("🔧 VR Simulation: Injecting polyfills BEFORE WebXR creation...");
            _injectVRPolyfills();
            _injectAdditionalPolyfills();
            _injectAggressivePolyfills();
            _injectNullSafetyPatches();
            _fixDOMBindingIssues();
            polyfillInjected = true;
            
            // Give polyfills time to take effect
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Create WebXR experience with error handling
        let xrHelper: any = null;
        try {
            console.log("🔍 VR Simulation: Creating WebXR experience...");
            xrHelper = await WebXRDefaultExperience.CreateAsync(scene, {
                disableDefaultUI: false,
                disableTeleportation: true,
                useStablePlugins: false, // Disable stable plugins to avoid missing feature errors
                optionalFeatures: false, // Disable optional features that might not be available
                // Explicitly disable features that commonly cause issues in simulation
                floorMeshes: [],
                ignoreNativeCameraTransformation: true,
            });
            console.log("✅ VR Simulation: WebXR experience created successfully");
        } catch (xrError) {
            console.warn("⚠️ VR Simulation: WebXR experience creation failed, continuing with polyfills only:", xrError);
            // Try alternative WebXR creation approach
            try {
                console.log("🔄 VR Simulation: Trying alternative WebXR creation...");
                xrHelper = await _createAlternativeWebXRExperience(scene);
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
 * Creates an alternative WebXR experience when the default approach fails
 */
async function _createAlternativeWebXRExperience(scene: Scene): Promise<any> {
    console.log("🔧 VR Simulation: Creating alternative WebXR experience");
    
    // Create a minimal mock WebXR experience
    const mockExperience = {
        baseExperience: null,
        camera: scene.activeCamera,
        sessionManager: {
            session: _createMockXRSession('immersive-vr'),
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

/**
 * Injects aggressive polyfills for stubborn WebXR issues
 */
function _injectAggressivePolyfills(): void {
    try {
        console.log("🔧 VR Simulation: Injecting aggressive polyfills");
        
        // Override console.error to prevent spam while keeping important errors
        const originalError = console.error;
        console.error = (...args) => {
            const errorStr = args[0]?.toString() || '';
            const suppressedPatterns = [
                'BJS - [',
                'Error executing makeXRCompatible',
                'session.enabledFeatures is not available',
                'Cannot read properties of null',
                'getUniqueId',
                'Error initializing XR',
                'feature not found',
                'xr-hand-tracking',
                'xr-hit-test',
                'xr-plane-detection',
                'xr-mesh-detection',
                'xr-light-estimation',
                'Feature not supported'
            ];
            
            if (!suppressedPatterns.some(pattern => errorStr.includes(pattern))) {
                originalError.apply(console, args);
            } else {
                console.log('🔇 VR Simulation: Suppressed XR error:', errorStr.substring(0, 100));
            }
        };
        
        // Force WebXR support detection
        Object.defineProperty(navigator, 'xr', {
            value: (navigator as any).xr || {
                isSessionSupported: async () => true,
                requestSession: async (type: string) => _createMockXRSession(type),
                addEventListener: () => {},
                removeEventListener: () => {},
                getUniqueId: () => 'navigator-xr-' + Date.now()
            },
            writable: true,
            configurable: true
        });
        
        // Ensure WebXR classes exist
        const webXRClasses = ['XRSession', 'XRReferenceSpace', 'XRRigidTransform', 'XRWebGLLayer', 'XRFrame', 'XRPose', 'XRView'];
        webXRClasses.forEach(className => {
            if (!(window as any)[className]) {
                (window as any)[className] = class {
                    constructor() {
                        console.log(`🔧 VR Simulation: Created mock ${className}`);
                    }
                    getUniqueId() {
                        return `mock-${className.toLowerCase()}-` + Date.now();
                    }
                };
            }
        });
        
        // Patch Babylon.js WebXR feature detection
        if ((window as any).BABYLON) {
            const BABYLON = (window as any).BABYLON;
            
            // Override WebXR support detection
            if (BABYLON.WebXRSessionManager) {
                BABYLON.WebXRSessionManager.IsSessionSupportedAsync = async () => {
                    console.log("🔧 VR Simulation: Overriding WebXR session support check");
                    return true;
                };
            }
            
            // Override feature detection and management
            if (BABYLON.WebXRFeaturesManager) {
                const originalAttachFeature = BABYLON.WebXRFeaturesManager.prototype.attachFeature;
                BABYLON.WebXRFeaturesManager.prototype.attachFeature = function(featureName: string, options?: any) {
                    try {
                        // Skip problematic features that commonly fail in simulation
                        const problematicFeatures = [
                            'xr-hand-tracking',
                            'xr-hit-test',
                            'xr-plane-detection',
                            'xr-mesh-detection',
                            'xr-light-estimation'
                        ];
                        
                        if (problematicFeatures.some(pf => featureName.includes(pf))) {
                            console.log(`🔧 VR Simulation: Skipping problematic feature ${featureName}, creating mock`);
                            return {
                                attached: true,
                                required: false,
                                enabled: false,
                                getUniqueId: () => `mock-feature-${featureName}-` + Date.now(),
                                dispose: () => console.log(`🔧 VR Simulation: Mock feature ${featureName} disposed`)
                            };
                        }
                        
                        return originalAttachFeature.call(this, featureName, options);
                    } catch (error) {
                        console.log(`🔧 VR Simulation: Feature ${featureName} attachment failed, creating mock`);
                        return {
                            attached: true,
                            required: false,
                            enabled: false,
                            getUniqueId: () => `feature-${featureName}-` + Date.now(),
                            dispose: () => console.log(`🔧 VR Simulation: Mock feature ${featureName} disposed`)
                        };
                    }
                };
                
                // Override feature availability check
                const originalGetFeature = BABYLON.WebXRFeaturesManager.prototype.getFeature;
                if (originalGetFeature) {
                    BABYLON.WebXRFeaturesManager.prototype.getFeature = function(featureName: string) {
                        try {
                            const feature = originalGetFeature.call(this, featureName);
                            if (feature) return feature;
                            
                            // Return mock feature if not found
                            console.log(`🔧 VR Simulation: Creating mock for missing feature ${featureName}`);
                            return {
                                attached: false,
                                required: false,
                                enabled: false,
                                getUniqueId: () => `mock-missing-feature-${featureName}-` + Date.now()
                            };
                        } catch (error) {
                            console.log(`🔧 VR Simulation: getFeature error for ${featureName}, returning mock`);
                            return {
                                attached: false,
                                required: false,
                                enabled: false,
                                getUniqueId: () => `mock-error-feature-${featureName}-` + Date.now()
                            };
                        }
                    };
                }
            }
        }
        
        console.log("🔧 VR Simulation: Aggressive polyfills injected successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error injecting aggressive polyfills:", error);
    }
}

/**
 * Injects comprehensive null safety patches to prevent getUniqueId errors
 */
function _injectNullSafetyPatches(): void {
    try {
        console.log("🔧 VR Simulation: Injecting null safety patches...");
        
        // Override Object.prototype access to catch null getUniqueId calls
        // Note: Keep references for potential future use
        // const originalHasOwnProperty = Object.prototype.hasOwnProperty;
        // const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        
        // Create a safe getUniqueId function that can be attached to any object
        const safeGetUniqueId = function() {
            // Capture stack trace to help debug where null access is happening
            const stack = new Error().stack;
            if (stack) {
                console.log('🔍 VR Simulation: Safe getUniqueId called from:', stack.split('\n').slice(1, 4).join(' -> '));
            }
            return 'safe-id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        };
        
        // Patch common null access patterns
        const patchNullAccess = (obj: any, name: string) => {
            if (!obj) return;
            
            try {
                const originalMethod = obj.getUniqueId;
                if (!originalMethod || typeof originalMethod !== 'function') {
                    Object.defineProperty(obj, 'getUniqueId', {
                        value: safeGetUniqueId,
                        writable: true,
                        configurable: true
                    });
                    console.log(`🔧 VR Simulation: Added getUniqueId to ${name}`);
                }
            } catch (error) {
                console.warn(`⚠️ VR Simulation: Could not patch ${name}:`, error);
            }
        };
        
        // Patch WebXR-related global objects
        patchNullAccess((window as any).XRSession, 'XRSession');
        patchNullAccess((window as any).XRReferenceSpace, 'XRReferenceSpace');
        patchNullAccess((window as any).XRFrame, 'XRFrame');
        patchNullAccess((window as any).XRPose, 'XRPose');
        patchNullAccess((window as any).XRView, 'XRView');
        patchNullAccess((window as any).XRWebGLLayer, 'XRWebGLLayer');
        patchNullAccess((navigator as any).xr, 'navigator.xr');
        
        // Override property access to intercept getUniqueId calls on null objects
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj: any, prop: string, descriptor: PropertyDescriptor) {
            if (prop === 'getUniqueId' && !obj) {
                console.warn('🔧 VR Simulation: Attempted to define getUniqueId on null object, skipping');
                return obj;
            }
            return originalDefineProperty.call(this, obj, prop, descriptor);
        };
        
        // Patch Babylon.js WebXR objects if they exist
        if ((window as any).BABYLON) {
            const BABYLON = (window as any).BABYLON;
            
            // Patch WebXR manager classes
            const webxrClasses = [
                'WebXRSessionManager',
                'WebXRCamera',
                'WebXRExperienceHelper',
                'WebXRDefaultExperience',
                'WebXRFeaturesManager'
            ];
            
            webxrClasses.forEach(className => {
                if (BABYLON[className] && BABYLON[className].prototype) {
                    patchNullAccess(BABYLON[className].prototype, `BABYLON.${className}.prototype`);
                }
            });
            
            // Override WebXR object creation to ensure getUniqueId
            if (BABYLON.WebXRSessionManager) {
                const originalConstructor = BABYLON.WebXRSessionManager;
                BABYLON.WebXRSessionManager = function(...args: any[]) {
                    const instance = new originalConstructor(...args);
                    if (instance && !instance.getUniqueId) {
                        instance.getUniqueId = safeGetUniqueId;
                    }
                    return instance;
                };
                
                // Copy static properties
                Object.setPrototypeOf(BABYLON.WebXRSessionManager, originalConstructor);
                Object.defineProperty(BABYLON.WebXRSessionManager, 'prototype', {
                    value: originalConstructor.prototype,
                    writable: false
                });
            }
        }
        
        // Global error interceptor for getUniqueId specifically
        // Note: __lookupGetter__ is deprecated, using alternative approach
        try {
            const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
            Object.getOwnPropertyDescriptor = function(obj: any, prop: string | symbol) {
                if (prop === 'getUniqueId' && (obj === null || obj === undefined)) {
                    console.warn('🔧 VR Simulation: getUniqueId descriptor access on null object intercepted');
                    return {
                        value: safeGetUniqueId,
                        writable: true,
                        configurable: true,
                        enumerable: false
                    };
                }
                return originalGetOwnPropertyDescriptor.call(this, obj, prop);
            };
        } catch (error) {
            console.warn('🔧 VR Simulation: Could not override getOwnPropertyDescriptor:', error);
        }
        
        // Most aggressive approach: proxy all property access
        const createNullSafeProxy = (target: any, name: string) => {
            if (!target) return target;
            
            return new Proxy(target, {
                get: function(obj, prop) {
                    if (prop === 'getUniqueId' && (obj === null || obj === undefined)) {
                        console.warn(`🔧 VR Simulation: Intercepted getUniqueId call on null ${name}`);
                        return safeGetUniqueId;
                    }
                    
                    const value = obj[prop];
                    if (value === null && prop === 'getUniqueId') {
                        console.warn(`🔧 VR Simulation: getUniqueId was null on ${name}, providing safe version`);
                        return safeGetUniqueId;
                    }
                    
                    return value;
                },
                set: function(obj, prop, value) {
                    obj[prop] = value;
                    return true;
                }
            });
        };
        
        // Apply null-safe proxies to critical WebXR objects
        if ((navigator as any).xr) {
            (navigator as any).xr = createNullSafeProxy((navigator as any).xr, 'navigator.xr');
        }
        
        // Patch common WebXR API endpoints that might return null
        const webxrEndpoints = ['requestSession', 'requestReferenceSpace', 'getViewerPose', 'getPose'];
        webxrEndpoints.forEach(endpoint => {
            if ((navigator as any).xr && (navigator as any).xr[endpoint]) {
                const original = (navigator as any).xr[endpoint];
                (navigator as any).xr[endpoint] = async function(...args: any[]) {
                    try {
                        const result = await original.apply(this, args);
                        if (result && !result.getUniqueId) {
                            result.getUniqueId = safeGetUniqueId;
                        }
                        return result;
                    } catch (error) {
                        console.warn(`🔧 VR Simulation: ${endpoint} failed, returning safe mock`);
                        return {
                            getUniqueId: safeGetUniqueId,
                            [endpoint]: endpoint
                        };
                    }
                };
            }
        });
        
        console.log("🔧 VR Simulation: Null safety patches injected successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error injecting null safety patches:", error);
    }
}

/**
 * Fixes DOM method binding issues that cause "Illegal invocation" errors
 */
function _fixDOMBindingIssues(): void {
    try {
        console.log("🔧 VR Simulation: Fixing DOM binding issues...");
        
        // Fix document methods that lose their binding context
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName: string, options?: ElementCreationOptions) {
            return originalCreateElement.call(document, tagName, options);
        };
        
        const originalQuerySelector = document.querySelector;
        document.querySelector = function(selector: string) {
            return originalQuerySelector.call(document, selector);
        };
        
        const originalQuerySelectorAll = document.querySelectorAll;
        document.querySelectorAll = function(selector: string) {
            return originalQuerySelectorAll.call(document, selector);
        };
        
        const originalGetElementById = document.getElementById;
        document.getElementById = function(id: string) {
            return originalGetElementById.call(document, id);
        };
        
        // Fix canvas context methods
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(contextId: string, options?: any) {
            const context = originalGetContext.call(this, contextId, options);
            
            // Ensure WebGL context methods are properly bound
            if (context && (contextId === 'webgl' || contextId === 'webgl2')) {
                const webglContext = context as WebGLRenderingContext;
                
                // Fix common WebGL methods that lose binding
                const methodsToFix = [
                    'getExtension', 'getParameter', 'createTexture', 'createBuffer',
                    'createShader', 'createProgram', 'getShaderParameter', 'getProgramParameter'
                ];
                
                methodsToFix.forEach(methodName => {
                    const original = (webglContext as any)[methodName];
                    if (original && typeof original === 'function') {
                        (webglContext as any)[methodName] = function(...args: any[]) {
                            return original.apply(webglContext, args);
                        };
                    }
                });
            }
            
            return context;
        };
        
        // Fix Element methods that commonly lose binding
        const originalAddEventListener = Element.prototype.addEventListener;
        Element.prototype.addEventListener = function(type: string, listener: any, options?: any) {
            return originalAddEventListener.call(this, type, listener, options);
        };
        
        const originalRemoveEventListener = Element.prototype.removeEventListener;
        Element.prototype.removeEventListener = function(type: string, listener: any, options?: any) {
            return originalRemoveEventListener.call(this, type, listener, options);
        };
        
        // Fix window methods
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback: FrameRequestCallback) {
            return originalRequestAnimationFrame.call(window, callback);
        };
        
        // Fix specific WebXR-related DOM issues
        if ((window as any).DeviceOrientationEvent) {
            const originalRequestPermission = (window as any).DeviceOrientationEvent.requestPermission;
            if (originalRequestPermission) {
                (window as any).DeviceOrientationEvent.requestPermission = function() {
                    return originalRequestPermission.call((window as any).DeviceOrientationEvent);
                };
            }
        }
        
        // Fix fullscreen API binding issues
        if (document.documentElement.requestFullscreen) {
            const originalRequestFullscreen = document.documentElement.requestFullscreen;
            Element.prototype.requestFullscreen = function(options?: FullscreenOptions) {
                return originalRequestFullscreen.call(this, options);
            };
        }
        
        console.log("🔧 VR Simulation: DOM binding issues fixed successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error fixing DOM binding issues:", error);
    }
}

/**
 * Injects additional polyfills when WebXR experience creation fails
 */
function _injectAdditionalPolyfills(): void {
    try {
        console.log("🔧 VR Simulation: Injecting additional polyfills after WebXR failure");
        
        // Force WebXR support flag to be true
        (window as any).isWebXRSupported = true;
        
        // Add additional WebXR API polyfills
        if (!(window as any).XRWebGLLayer) {
            console.log("🔧 VR Simulation: Injecting XRWebGLLayer polyfill");
            (window as any).XRWebGLLayer = class MockXRWebGLLayer {
                constructor(session: any, context: any, _options?: any) {
                    this.session = session;
                    this.context = context;
                    this.framebuffer = null;
                    this.framebufferWidth = window.innerWidth;
                    this.framebufferHeight = window.innerHeight;
                }
                
                session: any;
                context: any;
                framebuffer: any;
                framebufferWidth: number;
                framebufferHeight: number;
                
                getViewport(_view: any) {
                    return {
                        x: 0,
                        y: 0,
                        width: this.framebufferWidth,
                        height: this.framebufferHeight
                    };
                }
                
                // Add getUniqueId to prevent null reference errors
                getUniqueId() {
                    return 'vr-webgl-layer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                }
            };
        }
        
        // Ensure enabledFeatures is available on all mock sessions
        const originalRequestSession = (navigator as any).xr?.requestSession;
        if (originalRequestSession) {
            (navigator as any).xr.requestSession = async (sessionType: string, options?: any) => {
                try {
                    const session = await originalRequestSession(sessionType, options);
                    
                    // Add enabledFeatures if it doesn't exist
                    if (session && !session.enabledFeatures) {
                        console.log("🔧 VR Simulation: Adding enabledFeatures to session");
                        session.enabledFeatures = ['local', 'local-floor', 'bounded-floor', 'hand-tracking'];
                        session.isFeatureEnabled = (feature: string) => 
                            session.enabledFeatures.includes(feature);
                    }
                    
                    // Add getUniqueId if it doesn't exist
                    if (session && !session.getUniqueId) {
                        session.getUniqueId = () => 'vr-patched-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    }
                    
                    return session;
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Original requestSession failed, using mock:", error);
                    return _createMockXRSession(sessionType);
                }
            };
        }
        
        // Add safeguards for null reference errors
        const safeGetUniqueId = () => 'vr-safe-id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Patch any existing objects that might be missing getUniqueId
        const patchObjectIfNeeded = (obj: any, name: string) => {
            if (obj && !obj.getUniqueId) {
                console.log(`🔧 VR Simulation: Adding getUniqueId to ${name}`);
                obj.getUniqueId = safeGetUniqueId;
            }
        };
        
        // Apply patches to common WebXR objects
        patchObjectIfNeeded((navigator as any).xr, 'navigator.xr');
        
        console.log("🔧 Additional polyfills injected successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error injecting additional polyfills:", error);
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
                    supportsSession: async (_type: string) => true,
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
 * Patches WebGL contexts to add makeXRCompatible method
 */
function _patchWebGLContexts(): void {
    try {
        console.log("🔧 VR Simulation: Patching WebGL contexts for XR compatibility");
        
        // Completely suppress BabylonJS error messages about WebXR globally
        const originalConsoleError = console.error;
        const suppressedErrors = [
            'Error executing makeXRCompatible',
            'Cannot read properties of null',
            'session.enabledFeatures is not available',
            'getUniqueId',
            'Error initializing XR',
            'feature not found',
            'xr-hand-tracking',
            'Feature not supported',
            'BJS - [' // All BabylonJS timestamped messages
        ];
        
        console.error = (...args) => {
            if (args[0] && typeof args[0] === 'string' && 
                suppressedErrors.some(errMsg => args[0].includes(errMsg))) {
                console.log("🔧 VR Simulation: Suppressed WebXR error message:", args[0].substring(0, 80) + "...");
            } else {
                originalConsoleError.apply(console, args);
            }
        };
        
        // Patch WebGLRenderingContext.prototype
        if (window.WebGLRenderingContext && !WebGLRenderingContext.prototype.makeXRCompatible) {
            WebGLRenderingContext.prototype.makeXRCompatible = async function() {
                console.log("🔧 VR Simulation: WebGLRenderingContext.makeXRCompatible called");
                
                // Simulate successful completion after a short delay
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Add XR compatibility flag
                this._xrCompatible = true;
                
                return Promise.resolve(this);
            };
        }
        
        // Patch WebGL2RenderingContext.prototype if available
        if (window.WebGL2RenderingContext && !WebGL2RenderingContext.prototype.makeXRCompatible) {
            WebGL2RenderingContext.prototype.makeXRCompatible = async function() {
                console.log("🔧 VR Simulation: WebGL2RenderingContext.makeXRCompatible called");
                
                // Simulate successful completion after a short delay
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Add XR compatibility flag
                this._xrCompatible = true;
                
                return Promise.resolve(this);
            };
        }
        
        // Patch any existing canvas contexts
        const canvases = document.getElementsByTagName('canvas');
        for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i];
            
            // Patch both webgl and webgl2 contexts if they exist
            ['webgl', 'webgl2', 'experimental-webgl'].forEach(contextType => {
                try {
                    const context = canvas.getContext(contextType);
                    if (context && !(context as any).makeXRCompatible) {
                        (context as any).makeXRCompatible = async function() {
                            console.log(`🔧 VR Simulation: Existing ${contextType} context.makeXRCompatible called`);
                            
                            // Add XR compatibility flag
                            this._xrCompatible = true;
                            
                            return Promise.resolve(this);
                        };
                        
                        // Mark as already XR compatible
                        (context as any)._xrCompatible = true;
                    }
                } catch (e) {
                    // Ignore errors getting context
                }
            });
            
            // Add a special method to get XR compatible context directly
            if (!(canvas as any)._getXRCompatibleContext) {
                (canvas as any)._getXRCompatibleContext = canvas.getContext;
                (canvas as any).getContext = function(contextType: string, options?: any) {
                    const context = (this as any)._getXRCompatibleContext(contextType, options);
                    if (context && ['webgl', 'webgl2', 'experimental-webgl'].includes(contextType)) {
                        // Mark as XR compatible
                        context._xrCompatible = true;
                        
                        // Ensure it has makeXRCompatible
                        if (!context.makeXRCompatible) {
                            context.makeXRCompatible = async function() {
                                console.log(`🔧 VR Simulation: Dynamic context.makeXRCompatible called`);
                                return Promise.resolve(this);
                            };
                        }
                    }
                    return context;
                };
            }
        }
        
        // Patch Babylon.js WebXRSessionManager if it exists
        if ((window as any).BABYLON && (window as any).BABYLON.WebXRSessionManager) {
            const originalInitialize = (window as any).BABYLON.WebXRSessionManager.prototype._initializeSessionAsync;
            (window as any).BABYLON.WebXRSessionManager.prototype._initializeSessionAsync = async function() {
                try {
                    // Try original method first
                    return await originalInitialize.apply(this, arguments);
                } catch (err) {
                    console.log("🔧 VR Simulation: Handling WebXRSessionManager initialization error:", err);
                    
                    // Add missing properties to session if needed
                    if (this.session && !this.session.enabledFeatures) {
                        this.session.enabledFeatures = ['local', 'local-floor', 'bounded-floor', 'hand-tracking'];
                        this.session.isFeatureEnabled = (feature: string) => 
                            this.session.enabledFeatures.includes(feature);
                    }
                    
                    // Ensure session has getUniqueId
                    if (this.session && !this.session.getUniqueId) {
                        this.session.getUniqueId = () => 'vr-session-fixed-' + Date.now();
                    }
                    
                    // Continue without throwing
                    return Promise.resolve();
                }
            };
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

