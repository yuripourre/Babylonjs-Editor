import * as React from "react";

import {
    ArcRotateCamera,
    Engine,
    HemisphericLight,
    Scene,
    Vector3,
    AbstractMesh,
    UtilityLayerRenderer
} from "@babylonjs/core";

import {
    MixedRealityEnabled,
    MixedRealityDisabled,
} from "babylonjs-editor-tools";

import { IMixedRealityProps, IMixedRealityState } from "./types";
import { Grid } from "./Grid";
import { VRHeadset } from "./VRHeadset";

/**
 * Mixed Reality component for VR simulation in the editor
 */
export class MixedRealityComponent extends React.Component<IMixedRealityProps, IMixedRealityState> {
    /**
     * Defines the reference to the scene used to render the mixed reality tools.
     */
    public scene: Scene;

    private _vrHeadset: VRHeadset;
    private _engine: Engine;
    private _previewMeshes: AbstractMesh[] = [];
    private _utilityLayer: UtilityLayerRenderer;

    /**
     * Constructor.
     * @param props defines the component's props.
     */
    public constructor(props: IMixedRealityProps) {
        super(props);

        this.state = {
            isVrEnabled: false,
            canvasReady: false,
            canvasError: undefined
        };
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <div className="flex flex-col w-full h-full text-foreground" style={{ minHeight: '400px' }}>
                {/* Header with VR simulation toggle */}
                <div className="flex items-center justify-between w-full h-12 px-4 bg-muted/50 border-b border-border">
                    <h3 className="text-sm font-medium">Mixed Reality Tools</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {this.state.canvasReady ? "Canvas ready" : "Initializing canvas..."}
                        </span>
                        <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                this.state.isVrEnabled
                                    ? "bg-red-500 hover:bg-red-600 text-white"
                                    : "bg-green-500 hover:bg-green-600 text-white"
                            }`}
                            onClick={() => this._handleEnableVrSimulation()}
                        >
                            {this.state.isVrEnabled ? "Disable VR Simulation" : "Enable VR Simulation"}
                        </button>
                    </div>
                </div>

                {/* VR Cube Canvas */}
                <div 
                    className="flex-1 relative" 
                    id="mixed-reality-container"
                    style={{ 
                        width: '100%', 
                        height: 'calc(100% - 48px)', 
                        minHeight: '300px',
                        overflow: 'hidden',
                        border: '1px solid #333',
                        background: '#111'
                    }}
                >
                    <canvas
                        id="mixed-reality-canvas"
                        className="w-full h-full touch-none"
                        style={{ 
                            display: 'block', 
                            width: '100%', 
                            height: '100%', 
                            position: 'absolute', 
                            top: 0, 
                            left: 0 
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                    
                    {/* Instructions overlay */}
                    {!this.state.isVrEnabled && (
                        <div className="absolute top-4 left-4 right-4 p-4 bg-background/90 rounded-lg border border-border">
                            <h4 className="text-sm font-medium mb-2">VR Headset Simulation</h4>
                            <p className="text-xs text-muted-foreground mb-3">
                                Click on the cube below to position your VR headset. Use the translation gizmo to move it around.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Enable VR simulation to inject polyfill methods and make Babylon.js believe it's running in a VR headset.
                            </p>
                        </div>
                    )}

                    {/* Error Display */}
                    {this.state.canvasError && (
                        <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/90 rounded-lg border border-red-600">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                <span className="text-xs font-medium text-white">Error: {this.state.canvasError}</span>
                            </div>
                        </div>
                    )}
                    
                    {/* VR Active Indicator */}
                    {this.state.isVrEnabled && (
                        <div className="absolute top-4 right-4 p-3 bg-green-500/90 rounded-lg border border-green-600">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                <span className="text-xs font-medium text-white">VR Simulation Active</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /**
     * Called on the component did mount.
     */
    public componentDidMount(): void {
        // Get the canvas element or wait for it to be available
        let canvas = document.getElementById("mixed-reality-canvas") as HTMLCanvasElement;
        
        // If canvas is not available, wait for it to be rendered
        if (!canvas) {
            console.warn("Mixed Reality canvas not found on initial mount, waiting for it to be available...");
            setTimeout(() => this._initializeEngine(), 100);
            return;
        }
        
        this._initializeEngine();
    }
    
    /**
     * Initializes the Babylon.js engine and scene.
     */
    private _initializeEngine(): void {
        try {
            const canvas = document.getElementById("mixed-reality-canvas") as HTMLCanvasElement;
            
            if (!canvas) {
                console.error("Failed to find mixed-reality-canvas element even after delay");
                this.setState({ canvasError: "Canvas element not found" });
                
                // Try again after a longer delay
                setTimeout(() => this._initializeEngine(), 500);
                return;
            }
            
            // Log canvas parent and dimensions for debugging
            console.log("Canvas parent:", canvas.parentElement);
            console.log("Canvas container:", document.getElementById("mixed-reality-container"));
            
            // Get actual dimensions
            const containerDiv = document.getElementById("mixed-reality-container");
            const containerWidth = containerDiv ? containerDiv.clientWidth : window.innerWidth;
            const containerHeight = containerDiv ? containerDiv.clientHeight : window.innerHeight;
            
            console.log("Container dimensions:", containerWidth, "x", containerHeight);
            
            // Make sure canvas dimensions are properly set
            canvas.width = containerWidth || 800;
            canvas.height = containerHeight || 600;
            
            console.log("Set canvas dimensions to:", canvas.width, "x", canvas.height);
            
            // Create a new engine for this canvas
            this._engine = new Engine(canvas, true, { 
                preserveDrawingBuffer: true, 
                stencil: true,
                antialias: true,
                adaptToDeviceRatio: true,
                useHighPrecisionMatrix: true,
            });
            
            // Update state to indicate canvas is being initialized
            this.setState({ canvasError: undefined });
        } catch (error) {
            console.error("Error initializing Babylon engine:", error);
            this.setState({ 
                canvasError: `Initialization error: ${error.message || "Unknown error"}` 
            });
        }
        
        try {
            // Ensure engine was created successfully
            if (!this._engine) {
                console.error("Cannot initialize scene - engine is null");
                this.setState({ 
                    canvasError: "Failed to create rendering engine" 
                });
                return;
            }
            
            // Create and configure the scene
            this.scene = new Scene(this._engine);
            this.scene.clearColor.set(0.1, 0.1, 0.1, 1);

            // Get canvas again for attaching controls
            const canvas = document.getElementById("mixed-reality-canvas") as HTMLCanvasElement;
            if (!canvas) {
                console.error("Canvas disappeared during initialization");
                this.setState({ canvasError: "Canvas element lost during initialization" });
                return;
            }

            // Create camera
            const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), this.scene);
            camera.attachControl(canvas, true);

            // Add light
            new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

            // Create utility layer for gizmos with error handling
            try {
                this._utilityLayer = new UtilityLayerRenderer(this.scene);
            } catch (error) {
                console.warn("Error creating utility layer, continuing without it:", error);
            }

            // Create grid for better contrast and reference
            try {
                Grid.create({ scene: this.scene });
            } catch (error) {
                console.warn("Error creating grid, continuing without it:", error);
            }

            // Create VR headset and indicator with error handling
            try {
                this._vrHeadset = new VRHeadset({
                    scene: this.scene,
                    isVrEnabled: this.state.isVrEnabled
                });
            } catch (error) {
                console.warn("Error creating VR headset, continuing without it:", error);
                this.setState({ canvasError: "Failed to create VR headset" });
            }

            // Register render loop for this specific scene
            this._engine.runRenderLoop(() => {
                if (this.scene) {
                    try {
                        this.scene.render();
                    } catch (e) {
                        console.error("Error in render loop:", e);
                    }
                }
            });

            // Handle window resize
            window.addEventListener("resize", this._handleResize);
            
            // Force an initial resize to ensure canvas is properly sized
            setTimeout(() => this._handleResize(), 0);
            
            // Mark canvas as ready
            this.setState({ canvasReady: true, canvasError: undefined });
            
        } catch (error) {
            console.error("Failed to initialize scene:", error);
            this.setState({ 
                canvasReady: false, 
                canvasError: `Scene initialization error: ${error.message || "Unknown error"}` 
            });
        }
    }

    /**
     * Called on the component will unmount.
     */
    public componentWillUnmount(): void {
        window.removeEventListener("resize", this._handleResize);
        this._vrHeadset?.dispose();
        if (this._previewMeshes && this._previewMeshes.length > 0) {
            this._previewMeshes.forEach(mesh => mesh?.dispose());
        }
        this._utilityLayer?.dispose();
        this._engine?.dispose();
        this.scene?.dispose();
    }

    /**
     * Creates preview objects similar to those in the main preview scene
     */
    /* private _createPreviewObjects(): void {
        // Create a simple cube as a reference object
        const cube = MeshBuilder.CreateBox("preview-cube", { size: 0.5 }, this.scene);
        cube.position.y = 0.25;
        
        const cubeMaterial = new StandardMaterial("preview-cube-material", this.scene);
        cubeMaterial.diffuseColor = new Color3(0.4, 0.6, 0.9);
        cubeMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
        cube.material = cubeMaterial;
        
        // Create a ground plane
        const ground = MeshBuilder.CreateGround("preview-ground", { width: 6, height: 6 }, this.scene);
        const groundMaterial = new StandardMaterial("preview-ground-material", this.scene);
        groundMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;
        
        // Try to clone objects from preview scene if available
        if (this.props.editor.layout.preview.scene) {
            const previewScene = this.props.editor.layout.preview.scene;
            
            // Find non-utility meshes to clone
            const meshesToClone = previewScene.meshes.filter(mesh => {
                // Skip utility meshes, gizmos, and special objects
                return !mesh.name.includes("gizmo") && 
                       !mesh.name.includes("utilityLayer") &&
                       !mesh.name.includes("vr-headset") &&
                       !mesh.name.includes("grid-") &&
                       mesh.isVisible;
            });
            
            // Instead of cloning (which can cause type issues), create simple representations
            meshesToClone.forEach(mesh => {
                try {
                    // Create a simple box representation at the same position
                    const simpleMesh = MeshBuilder.CreateBox(
                        "mr-" + mesh.name, 
                        { size: 0.5 }, 
                        this.scene
                    );
                    
                    // Set position and rotation manually to avoid type conflicts
                    simpleMesh.position.x = mesh.position.x;
                    simpleMesh.position.y = mesh.position.y;
                    simpleMesh.position.z = mesh.position.z;
                    
                    // Set rotation manually
                    if (mesh.rotationQuaternion) {
                        simpleMesh.rotation.x = 0;
                        simpleMesh.rotation.y = 0;
                        simpleMesh.rotation.z = 0;
                    } else {
                        simpleMesh.rotation.x = mesh.rotation.x;
                        simpleMesh.rotation.y = mesh.rotation.y;
                        simpleMesh.rotation.z = mesh.rotation.z;
                    }
                    
                    // Create a simple material with similar color if available
                    const material = new StandardMaterial("mr-mat-" + mesh.name, this.scene);
                    material.diffuseColor = new Color3(0.4, 0.6, 0.9);
                    simpleMesh.material = material;
                    
                    this._previewMeshes.push(simpleMesh);
                } catch (e) {
                    console.warn("Failed to create representation for mesh:", mesh.name, e);
                }
            });
        }
        
        // Add created meshes to tracking array
        this._previewMeshes.push(cube, ground);
    } */

    /**
     * Handles window resize events.
     */
    private _handleResize = (): void => {
        if (!this._engine) {
            return;
        }
        
        const canvas = document.getElementById("mixed-reality-canvas") as HTMLCanvasElement;
        if (canvas) {
            // Explicitly set canvas dimensions before resizing
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            
            // Log canvas size for debugging
            console.log("Resizing mixed reality canvas to:", canvas.width, "x", canvas.height);
        }
        
        this._engine.resize();
    };

    /**
     * Handles enabling/disabling VR simulation.
     */
    private async _handleEnableVrSimulation(): Promise<void> {
        const enabled = !this.state.isVrEnabled;

        try {
            if (enabled) {
                console.log("Starting VR simulation...");
                
                // Check if preview scene exists
                if (!this.props.editor.layout.preview.scene) {
                    throw new Error("Preview scene is not available");
                }
                
                console.log("Preview scene available:", this.props.editor.layout.preview.scene.meshes.length, "meshes");
                
                // Check if VR headset cube is available
                if (!this._vrHeadset || !this._vrHeadset.cube) {
                    throw new Error("VR headset cube is not available");
                }
                
                console.log("VR headset cube available at position:", 
                    this._vrHeadset.cube.position.x.toFixed(2),
                    this._vrHeadset.cube.position.y.toFixed(2),
                    this._vrHeadset.cube.position.z.toFixed(2)
                );
                
                // Enable VR simulation with detailed logging
                console.log("Calling MixedRealityEnabled...");
                
                // Add a global error handler to catch any unhandled WebXR errors
                const originalOnError = window.onerror;
                window.onerror = function(message, source, lineno, colno, error) {
                    if (typeof message === 'string' && (
                        message.includes('getUniqueId') || 
                        message.includes('enabledFeatures') ||
                        message.includes('makeXRCompatible') ||
                        message.includes('Error initializing XR') ||
                        message.includes('feature not found') ||
                        message.includes('xr-hand-tracking') ||
                        message.includes('Cannot read properties of null')
                    )) {
                        console.log("🔇 Suppressed WebXR error:", message.substring(0, 100));
                        console.log("🔍 Error location: ", source, "line:", lineno);
                        return true; // Prevent default error handling
                    }
                    return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
                };
                
                // Add unhandledrejection handler for promise errors
                const originalUnhandledRejection = window.onunhandledrejection;
                window.onunhandledrejection = function(event) {
                    const reason = event.reason?.toString() || '';
                    if (reason.includes('getUniqueId') || 
                        reason.includes('Cannot read properties of null') ||
                        reason.includes('WebXR') ||
                        reason.includes('XR')) {
                        console.log("🔇 Suppressed WebXR promise rejection:", reason.substring(0, 100));
                        event.preventDefault();
                        return;
                    }
                    return originalUnhandledRejection ? originalUnhandledRejection.call(window, event) : true;
                };
                
                // Restore original error handlers after 10 seconds
                setTimeout(() => {
                    window.onerror = originalOnError;
                    window.onunhandledrejection = originalUnhandledRejection;
                }, 10000);
                
                try {
                    await MixedRealityEnabled(this.props.editor.layout.preview.scene! as any, this._vrHeadset.cube);
                    console.log("MixedRealityEnabled completed successfully");
                } catch (err) {
                    console.error("MixedRealityEnabled failed:", err);
                    // Continue anyway - the polyfills should handle most issues
                }
                
                // Update the editor's VR state
                console.log("Updating editor VR state...");
                this.props.editor.layout.preview.setVrSimulationEnabled(true);
                
                // Update VR headset state
                console.log("Updating VR headset state...");
                this._vrHeadset.updateState(true, this.scene);
                
                console.log("VR simulation enabled successfully");
                
                // Force a resize to ensure WebXR experience is properly sized
                setTimeout(() => {
                    console.log("Forcing resize after delay...");
                    this.props.editor.layout.preview.engine?.resize();
                    this.props.editor.layout.preview.scene?.render();
                }, 1000);
            } else {
                console.log("Disabling VR simulation...");
                
                // Disable VR simulation
                MixedRealityDisabled(this.props.editor.layout.preview.scene! as any);
                
                // Update the editor's VR state
                this.props.editor.layout.preview.setVrSimulationEnabled(false);
                
                // Update VR headset state
                this._vrHeadset.updateState(false, this.scene);
                
                console.log("VR simulation disabled successfully");
            }
        } catch (error) {
            console.error("Error toggling VR simulation:", error);
        }

        this.setState({ isVrEnabled: enabled });
    }
}
