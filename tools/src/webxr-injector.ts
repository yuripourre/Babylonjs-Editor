/**
 * WebXR Polyfill Injector for VR simulation
 * This file contains functions to inject WebXR polyfills into the browser
 */

import { 
    createMockXRSession, 
    createMockVRDisplay,
    createMockXRSessionClass,
    createMockXRReferenceSpaceClass,
    createMockXRRigidTransformClass,
    ensureUniqueId,
    createMockXRFrame
} from "./webxr-polyfills";

/**
 * Global reference to store the original WebXR implementation
 */
let originalWebXR: any = null;

/**
 * Injects comprehensive VR polyfills to make Babylon.js believe it's running in VR
 */
export function injectVRPolyfills(): void {
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
                        return createMockXRSession(sessionType);
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
        patchWebGLContexts();

        // Polyfill getVRDisplays (for older VR APIs)
        if (!(navigator as any).getVRDisplays) {
            console.log("🔧 VR Simulation: Injecting getVRDisplays polyfill");
            (navigator as any).getVRDisplays = async () => {
                try {
                    return [createMockVRDisplay()];
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
                    return createMockVRDisplay();
                } catch (error) {
                    console.warn("⚠️ VR Simulation: requestVRDisplay error:", error);
                    return null;
                }
            };
        }

        // Polyfill WebXR API if not present
        if (!(window as any).XRSession) {
            console.log("🔧 VR Simulation: Injecting XRSession polyfill");
            (window as any).XRSession = createMockXRSessionClass();
        }

        if (!(window as any).XRReferenceSpace) {
            console.log("🔧 VR Simulation: Injecting XRReferenceSpace polyfill");
            (window as any).XRReferenceSpace = createMockXRReferenceSpaceClass();
        }

        if (!(window as any).XRRigidTransform) {
            console.log("🔧 VR Simulation: Injecting XRRigidTransform polyfill");
            (window as any).XRRigidTransform = createMockXRRigidTransformClass();
        }

        // Override WebXR detection methods
        overrideWebXRDetection();

        // Log polyfill injection
        console.log("🔧 VR Polyfills injected successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error injecting polyfills:", error);
        throw error;
    }
}

/**
 * Injects additional polyfills when WebXR experience creation fails
 */
export function injectAdditionalPolyfills(): void {
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
                    return createMockXRSession(sessionType);
                }
            };
        }
        
        // Add safeguards for null reference errors
        const safeGetUniqueId = () => 'vr-safe-id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Apply patches to common WebXR objects
        ensureUniqueId((navigator as any).xr, 'navigator.xr');
        
        console.log("🔧 Additional polyfills injected successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error injecting additional polyfills:", error);
    }
}

/**
 * Injects aggressive polyfills for stubborn WebXR issues
 */
export function injectAggressivePolyfills(): void {
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
                requestSession: async (type: string) => createMockXRSession(type),
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
                                getUniqueId: () => `mock-feature-${featureName}-` + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
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
                            getUniqueId: () => `feature-${featureName}-` + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
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
                                getUniqueId: () => `mock-missing-feature-${featureName}-` + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
                            };
                        } catch (error) {
                            console.log(`🔧 VR Simulation: getFeature error for ${featureName}, returning mock`);
                            return {
                                attached: false,
                                required: false,
                                enabled: false,
                                getUniqueId: () => `mock-error-feature-${featureName}-` + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
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
export function injectNullSafetyPatches(): void {
    try {
        console.log("🔧 VR Simulation: Injecting null safety patches...");
        
        // Create a safe getUniqueId function that can be attached to any object
        const safeGetUniqueId = function() {
            // Capture stack trace to help debug where null access is happening
            const stack = new Error().stack;
            if (stack) {
                console.log('🔍 VR Simulation: Safe getUniqueId called from:', stack.split('\n').slice(1, 4).join(' -> '));
            }
            return 'safe-id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        };
        
        // Patch WebXR-related global objects
        ensureUniqueId((window as any).XRSession, 'XRSession');
        ensureUniqueId((window as any).XRReferenceSpace, 'XRReferenceSpace');
        ensureUniqueId((window as any).XRFrame, 'XRFrame');
        ensureUniqueId((window as any).XRPose, 'XRPose');
        ensureUniqueId((window as any).XRView, 'XRView');
        ensureUniqueId((window as any).XRWebGLLayer, 'XRWebGLLayer');
        ensureUniqueId((navigator as any).xr, 'navigator.xr');
        
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
                    ensureUniqueId(BABYLON[className].prototype, `BABYLON.${className}.prototype`);
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
export function fixDOMBindingIssues(): void {
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
 * Patches WebGL contexts to add makeXRCompatible method
 */
function patchWebGLContexts(): void {
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
function overrideWebXRDetection(): void {
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
                        return [createMockVRDisplay()];
                    }
                    return displays || [];
                } catch (error) {
                    console.warn("⚠️ VR Simulation: Original getVRDisplays failed:", error);
                    return [createMockVRDisplay()];
                }
            };
        }

        // Override VR-specific feature detection
        if ((navigator as any).xr) {
            const originalRequestSession = (navigator as any).xr.requestSession;
            (navigator as any).xr.requestSession = async (sessionType: string, options?: any) => {
                try {
                    if (sessionType === 'immersive-vr' || sessionType === 'immersive-ar') {
                        const session = createMockXRSession(sessionType);
                        
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
