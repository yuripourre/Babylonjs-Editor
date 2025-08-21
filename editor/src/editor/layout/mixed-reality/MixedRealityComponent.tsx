import * as React from "react";

import {
    ArcRotateCamera,
    Engine,
    HemisphericLight,
    Scene,
    Vector3,
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

    /**
     * Constructor.
     * @param props defines the component's props.
     */
    public constructor(props: IMixedRealityProps) {
        super(props);

        this.state = {
            isVrEnabled: false,
        };
    }

    /**
     * Renders the component.
     */
    public render(): React.ReactNode {
        return (
            <div className="flex flex-col w-full h-full text-foreground">
                {/* Header with VR simulation toggle */}
                <div className="flex items-center justify-between w-full h-12 px-4 bg-muted/50 border-b border-border">
                    <h3 className="text-sm font-medium">Mixed Reality Tools</h3>
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

                {/* VR Cube Canvas */}
                <div className="flex-1 relative">
                    <canvas
                        id="mixed-reality-canvas"
                        className="w-full h-full touch-none"
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
        const canvas = document.getElementById("mixed-reality-canvas") as HTMLCanvasElement;
        
        // Create a new engine for this canvas
        this._engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        
        this.scene = new Scene(this._engine);
        this.scene.clearColor.set(0.1, 0.1, 0.1, 1);

        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), this.scene);
        camera.attachControl(canvas, true);

        new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        // Create grid for better contrast and reference
        Grid.create({ scene: this.scene });

        // Create VR headset and indicator
        this._vrHeadset = new VRHeadset({
            scene: this.scene,
            isVrEnabled: this.state.isVrEnabled
        });

        // Register render loop for this specific scene
        this._engine.runRenderLoop(() => {
            if (this.scene) {
                this.scene.render();
            }
        });

        // Handle window resize
        window.addEventListener("resize", this._handleResize);
    }

    /**
     * Called on the component will unmount.
     */
    public componentWillUnmount(): void {
        window.removeEventListener("resize", this._handleResize);
        this._vrHeadset?.dispose();
        this._engine?.dispose();
        this.scene?.dispose();
    }

    /**
     * Handles window resize events.
     */
    private _handleResize = (): void => {
        this._engine?.resize();
    };

    /**
     * Handles enabling/disabling VR simulation.
     */
    private _handleEnableVrSimulation(): void {
        const enabled = !this.state.isVrEnabled;

        if (enabled) {
            // Enable VR simulation
            MixedRealityEnabled(this.props.editor.layout.preview.scene! as any, this._vrHeadset.cube);
            
            // Update the editor's VR state
            this.props.editor.layout.preview.setVrSimulationEnabled(true);
            
            // Update VR headset state
            this._vrHeadset.updateState(true, this.scene);
        } else {
            // Disable VR simulation
            MixedRealityDisabled(this.props.editor.layout.preview.scene! as any);
            
            // Update the editor's VR state
            this.props.editor.layout.preview.setVrSimulationEnabled(false);
            
            // Update VR headset state
            this._vrHeadset.updateState(false, this.scene);
        }

        this.setState({ isVrEnabled: enabled });
    }
}
