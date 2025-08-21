import * as React from "react";

import {
    ArcRotateCamera,
    Engine,
    GizmoManager,
    HemisphericLight,
    Mesh,
    MeshBuilder,
    Scene,
    Vector3,
} from "@babylonjs/core";

import { Editor } from "../main";

import {
    MixedRealityEnabled,
    MixedRealityDisabled,
} from "babylonjs-editor-tools";

export interface IMixedRealityProps {
    /**
     * Defines the reference to the editor.
     */
    editor: Editor;
}

export interface IMixedRealityState {
    /**
     * Defines wether or not VR simulation is enabled.
     */
    isVrEnabled: boolean;
}

export class MixedReality extends React.Component<IMixedRealityProps, IMixedRealityState> {
    /**
     * Defines the reference to the scene used to render the mixed reality tools.
     */
    public scene: Scene;

    private _cube: Mesh;
    private _gizmoManager: GizmoManager;

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
            <>
                <div style={{ width: "100%", height: "35px", backgroundColor: "#484848" }}>
                    <button
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            borderBottom: "1px solid #252525",
                        }}
                        onClick={() => this._handleEnableVrSimulation()}
                    >
                        Enable VR Simulation
                    </button>
                </div>
                <canvas
                    id="mixed-reality-canvas"
                    style={{ width: "100%", height: "calc(100% - 35px)", touchAction: "none" }}
                    onContextMenu={(e) => e.preventDefault()}
                ></canvas>
            </>
        );
    }

    /**
     * Called on the component did mount.
     */
    public componentDidMount(): void {
        const canvas = document.getElementById("mixed-reality-canvas") as HTMLCanvasElement;
        
        // Create a new engine for this canvas
        const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        
        this.scene = new Scene(engine);
        this.scene.clearColor.set(0.1, 0.1, 0.1, 1);

        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 3, new Vector3(0, 0, 0), this.scene);
        camera.attachControl(canvas, true);

        new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        this._cube = MeshBuilder.CreateBox("box", { size: 0.2 }, this.scene);
        this._cube.position.y = 1.6;

        this._gizmoManager = new GizmoManager(this.scene);
        this._gizmoManager.positionGizmoEnabled = true;
        this._gizmoManager.attachToMesh(this._cube);

        // Register render loop for this specific scene
        engine.runRenderLoop(() => {
            if (this.scene) {
                this.scene.render();
            }
        });
    }

    /**
     * Called on the component will unmount.
     */
    public componentWillUnmount(): void {
        this.scene.dispose();
    }

    private _handleEnableVrSimulation(): void {
        const enabled = !this.state.isVrEnabled;

        if (enabled) {
            MixedRealityEnabled(this.props.editor.layout.preview.scene! as any, this._cube);
        } else {
            MixedRealityDisabled(this.props.editor.layout.preview.scene! as any);
        }

        this.setState({ isVrEnabled: enabled });
    }
}
