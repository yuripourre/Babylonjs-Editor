import { Component, ReactNode } from "react";

import { Editor } from "../main";

import { Button } from "../../ui/shadcn/ui/button";

import {
    Engine,
    Scene,
    FreeCamera,
    Vector3,
    MeshBuilder,
    HemisphericLight,
    StandardMaterial,
    Color3,
    Matrix,
    Quaternion,
    AbstractMesh,
    Mesh,
    Nullable,
    Observer,
    PositionGizmo,
    RotationGizmo,
    UtilityLayerRenderer,
} from "babylonjs";

import { installSimulatedWebXR } from "../../tools/webxr/polyfill";

export interface IEditorVRViewProps {
    editor: Editor;
}

export interface IEditorVRViewState {
    vrActive: boolean;
    /** Multiplier applied to headset/controller position deltas.
     *  Increase for large scenes where 1 unit of headset drag = 1 unit is too small. */
    movementScale: number;
}

/**
 * VR View panel — shows a 3D grid with a headset and two controllers.
 * A single "Enter VR / Exit VR" button installs the WebXR polyfill and enters
 * the Preview in stereo VR mode. Moving or rotating the headset mesh drives
 * the VR cameras in the preview.
 */
export class EditorVRView extends Component<IEditorVRViewProps, IEditorVRViewState> {
    private _engine: Engine | null = null;
    private _scene: Scene | null = null;
    private _canvas: HTMLCanvasElement | null = null;
    private _resizeObserver: ResizeObserver | null = null;

    private _headset: Nullable<AbstractMesh> = null;
    private _leftController: Nullable<AbstractMesh> = null;
    private _rightController: Nullable<AbstractMesh> = null;

    private _gizmosLayer: UtilityLayerRenderer | null = null;
    private _headsetPosGizmo: PositionGizmo | null = null;
    private _headsetRotGizmo: RotationGizmo | null = null;
    private _leftControllerGizmo: PositionGizmo | null = null;
    private _rightControllerGizmo: PositionGizmo | null = null;

    private _uninstallPolyfill: (() => void) | null = null;

    // VR world origin — recorded from the active camera when VR starts.
    // Pose getters return (vrOrigin + mesh.position - meshStartPosition) so the
    // headset/controller positions in the panel act as relative offsets and the
    // VR camera begins exactly where the editor camera was with no visual jump.
    private _vrOriginPosition: Vector3 | null = null;
    private _vrOriginRotation: Quaternion | null = null;
    private _headsetStartPosition: Vector3 | null = null;
    private _headsetStartRotation: Quaternion | null = null;

    // Controller spheres shown in the preview scene while VR is active
    private _previewLeftSphere: Mesh | null = null;
    private _previewRightSphere: Mesh | null = null;
    private _previewSphereObserver: Nullable<Observer<Scene>> = null;

    public constructor(props: IEditorVRViewProps) {
        super(props);
        this.state = { vrActive: false, movementScale: 1 };
    }

    public render(): ReactNode {
        const { vrActive, movementScale } = this.state;

        return (
            <div className="relative w-full h-full text-foreground flex flex-col">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-3 h-10 shrink-0 bg-primary-foreground">
                    <Button
                        variant={vrActive ? "destructive" : "default"}
                        className="h-7 px-4 text-sm"
                        onClick={() => this._toggleVR()}
                    >
                        {vrActive ? "Exit VR" : "Enter VR"}
                    </Button>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <span>Scale</span>
                        <input
                            type="range" min={1} max={50} step={1}
                            value={movementScale}
                            onChange={(e) => this.setState({ movementScale: parseInt(e.target.value) })}
                            className="w-20 accent-primary"
                        />
                        <span className="w-5 text-right">{movementScale}x</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {vrActive ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                VR active — move or rotate the headset to drive the camera
                            </>
                        ) : (
                            "Position/rotate the headset and controllers, then click Enter VR"
                        )}
                    </div>
                </div>

                {/* 3D scene — wrapper fills remaining height; canvas is absolute
                    so it never contributes to the container's scrollable area. */}
                <div className="flex-1 overflow-hidden relative">
                    <canvas
                        ref={(r) => this._onGotCanvasRef(r!)}
                        className="absolute inset-0 w-full h-full select-none"
                    />
                </div>
            </div>
        );
    }

    public componentWillUnmount(): void {
        this._stopVR();
        this._disposeGizmos();
        this._disposeScene();
        window.removeEventListener("preview-vr-changed", this._onPreviewVRChanged);
    }

    // ─── Scene setup ────────────────────────────────────────────────────────────

    private async _onGotCanvasRef(canvas: HTMLCanvasElement): Promise<void> {
        if (!canvas || this._engine) {
            return;
        }

        this._canvas = canvas;

        this._engine = new Engine(canvas, true, {
            antialias: true,
            audioEngine: false,
        });

        // Keep engine in sync with its CSS container so gizmo picking coordinates
        // stay aligned even when the FlexLayout panel is resized.
        this._resizeObserver = new ResizeObserver(() => this._engine?.resize());
        this._resizeObserver.observe(canvas);

        this._scene = new Scene(this._engine);

        // Sky colour and ambient fill
        this._scene.clearColor.set(0.18, 0.22, 0.3, 1);
        this._scene.ambientColor = new Color3(0.25, 0.25, 0.28);

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this._scene);
        light.intensity = 1.4;
        light.groundColor = new Color3(0.15, 0.15, 0.18); // softer bounce from below

        // Ground grid — large enough to feel room-scale
        const groundMat = new StandardMaterial("groundMat", this._scene);
        groundMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
        MeshBuilder.CreateGround("ground", { width: 30, height: 30, subdivisions: 20 }, this._scene).material = groundMat;

        // Headset — initialize rotationQuaternion so the RotationGizmo and pose
        // reader always work in quaternion space.
        this._headset = MeshBuilder.CreateBox("vr_headset", { size: 0.26 }, this._scene);
        const headsetMat = new StandardMaterial("headsetMat", this._scene);
        headsetMat.diffuseColor = new Color3(0.2, 0.6, 1);
        this._headset.material = headsetMat;
        this._headset.position = new Vector3(0, 1.6, 0);
        this._headset.rotationQuaternion = Quaternion.Identity();

        // Left controller
        this._leftController = MeshBuilder.CreateBox("vr_left_ctrl", { size: 0.12 }, this._scene);
        const leftMat = new StandardMaterial("leftMat", this._scene);
        leftMat.diffuseColor = new Color3(0, 1, 0.5);
        this._leftController.material = leftMat;

        // Right controller
        this._rightController = MeshBuilder.CreateBox("vr_right_ctrl", { size: 0.12 }, this._scene);
        const rightMat = new StandardMaterial("rightMat", this._scene);
        rightMat.diffuseColor = new Color3(1, 0.35, 0.35);
        this._rightController.material = rightMat;

        // Place controllers in front of the headset's initial position
        this._repositionControllersRelativeToHeadset();

        // Simulator camera
        const camera = new FreeCamera("cam", new Vector3(0, 3, 8), this._scene);
        camera.setTarget(new Vector3(0, 1.5, 0));
        camera.attachControl(canvas, true);
        camera.minZ = 0.01;
        camera.maxZ = 500;
        camera.speed = 0.5;
        this._scene.activeCamera = camera;

        this._createGizmos();

        this._engine.runRenderLoop(() => {
            if (!this._scene) {
                return;
            }
            if (this._gizmosLayer?.utilityLayerScene) {
                this._gizmosLayer.utilityLayerScene.activeCamera = this._scene.activeCamera;
            }
            this._scene.render();
        });

        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("preview-vr-changed", this._onPreviewVRChanged);

        this.forceUpdate();
    }

    private _createGizmos(): void {
        if (!this._scene) {
            return;
        }

        this._gizmosLayer = new UtilityLayerRenderer(this._scene);
        this._gizmosLayer.utilityLayerScene.autoClearDepthAndStencil = true;
        this._gizmosLayer.utilityLayerScene.autoClear = false;
        this._gizmosLayer.utilityLayerScene.activeCamera = this._scene.activeCamera;

        // Helpers to pause/resume camera during any gizmo drag so they don't fight
        const detachCamera = () => this._scene?.activeCamera?.detachControl();
        const reattachCamera = () => {
            if (this._canvas && this._scene?.activeCamera) {
                this._scene.activeCamera.attachControl(this._canvas, true);
            }
        };

        // ── Headset: position + rotation ──────────────────────────────────────
        if (this._headset) {
            this._headsetPosGizmo = new PositionGizmo(this._gizmosLayer);
            this._headsetPosGizmo.attachedMesh = this._headset;
            this._headsetPosGizmo.scaleRatio = 1.4;
            this._headsetPosGizmo.planarGizmoEnabled = true;
            this._headsetPosGizmo.updateGizmoRotationToMatchAttachedMesh = false;
            this._headsetPosGizmo.updateGizmoPositionToMatchAttachedMesh = true;
            this._headsetPosGizmo.onDragStartObservable.add(detachCamera);
            this._headsetPosGizmo.onDragEndObservable.add(reattachCamera);

            this._headsetRotGizmo = new RotationGizmo(this._gizmosLayer);
            this._headsetRotGizmo.attachedMesh = this._headset;
            this._headsetRotGizmo.scaleRatio = 1.4;
            this._headsetRotGizmo.updateGizmoRotationToMatchAttachedMesh = true;
            this._headsetRotGizmo.onDragStartObservable.add(detachCamera);
            this._headsetRotGizmo.onDragEndObservable.add(reattachCamera);
        }

        // ── Left controller: position only ────────────────────────────────────
        if (this._leftController) {
            this._leftControllerGizmo = new PositionGizmo(this._gizmosLayer);
            this._leftControllerGizmo.attachedMesh = this._leftController;
            this._leftControllerGizmo.scaleRatio = 1.2;
            this._leftControllerGizmo.planarGizmoEnabled = true;
            this._leftControllerGizmo.updateGizmoRotationToMatchAttachedMesh = false;
            this._leftControllerGizmo.updateGizmoPositionToMatchAttachedMesh = true;
            this._leftControllerGizmo.onDragStartObservable.add(detachCamera);
            this._leftControllerGizmo.onDragEndObservable.add(reattachCamera);
        }

        // ── Right controller: position only ───────────────────────────────────
        if (this._rightController) {
            this._rightControllerGizmo = new PositionGizmo(this._gizmosLayer);
            this._rightControllerGizmo.attachedMesh = this._rightController;
            this._rightControllerGizmo.scaleRatio = 1.2;
            this._rightControllerGizmo.planarGizmoEnabled = true;
            this._rightControllerGizmo.updateGizmoRotationToMatchAttachedMesh = false;
            this._rightControllerGizmo.updateGizmoPositionToMatchAttachedMesh = true;
            this._rightControllerGizmo.onDragStartObservable.add(detachCamera);
            this._rightControllerGizmo.onDragEndObservable.add(reattachCamera);
        }
    }

    private _disposeGizmos(): void {
        this._headsetPosGizmo?.dispose();
        this._headsetPosGizmo = null;
        this._headsetRotGizmo?.dispose();
        this._headsetRotGizmo = null;
        this._leftControllerGizmo?.dispose();
        this._leftControllerGizmo = null;
        this._rightControllerGizmo?.dispose();
        this._rightControllerGizmo = null;
        this._gizmosLayer?.dispose();
        this._gizmosLayer = null;
    }

    private _disposeScene(): void {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        try { this._scene?.dispose(); } catch (_) { /* ignore */ }
        this._scene = null;
        try { this._engine?.dispose(); } catch (_) { /* ignore */ }
        this._engine = null;
        this._canvas = null;
    }

    // ─── VR toggle ──────────────────────────────────────────────────────────────

    private async _toggleVR(): Promise<void> {
        if (this.state.vrActive) {
            await this._stopVR();
        } else {
            await this._startVR();
        }
    }

    private async _startVR(): Promise<void> {
        // Reset meshes to their default positions every time VR starts so that
        // the headset/controller positions from a previous session (which may have
        // been dragged at a different scale) don't pollute the origin snapshot.
        if (this._headset) {
            this._headset.position.set(0, 1.6, 0);
            if (this._headset.rotationQuaternion) {
                this._headset.rotationQuaternion.copyFrom(Quaternion.Identity());
            } else {
                this._headset.rotationQuaternion = Quaternion.Identity();
            }
        }
        this._repositionControllersRelativeToHeadset();

        this._recordVROrigin();

        this._uninstallPolyfill = installSimulatedWebXR({
            getHeadPose: () => this._getRelativePose(this._headset, true),
            getLeftPose: () => this._getRelativePose(this._leftController, false),
            getRightPose: () => this._getRelativePose(this._rightController, false),
        });

        window.dispatchEvent(new CustomEvent("webxr-polyfill-changed", { detail: { enabled: true } }));

        const preview = this.props.editor.layout.preview as any;
        if (preview?._startPreviewXR) {
            await preview._startPreviewXR();
        }

        this._createPreviewControllerSpheres();
        this.setState({ vrActive: true });
    }

    private async _stopVR(): Promise<void> {
        this._disposePreviewControllerSpheres();

        try {
            const preview = this.props.editor.layout.preview as any;
            if (preview?._stopPreviewXR) {
                await preview._stopPreviewXR();
            }
        } catch (_) { /* ignore */ }

        if (this._uninstallPolyfill) {
            this._uninstallPolyfill();
            this._uninstallPolyfill = null;
        }

        window.dispatchEvent(new CustomEvent("webxr-polyfill-changed", { detail: { enabled: false } }));

        this._vrOriginPosition = null;
        this._vrOriginRotation = null;
        this._headsetStartPosition = null;
        this._headsetStartRotation = null;

        this.setState({ vrActive: false });
    }

    // ─── Camera sync / VR origin ─────────────────────────────────────────────────

    /** Sets a fixed VR world origin and records the headset mesh's current pose.
     *  The VR camera always starts at (0, 1.6, 5) looking toward -Z (toward the
     *  scene origin) regardless of where the editor camera happens to be. */
    private _recordVROrigin(): void {
        // Fixed origin: eye-height, 5 units back on +Z, facing toward -Z.
        // This matches the VR panel's own camera orientation so "in front"
        // in the panel == "in front" in the VR preview.
        this._vrOriginPosition = new Vector3(0, 1.6, 5);
        this._vrOriginRotation = Quaternion.RotationAxis(new Vector3(0, 1, 0), Math.PI);

        this._headsetStartPosition = this._headset?.position.clone() ?? new Vector3(0, 1.6, 0);
        this._headsetStartRotation = this._headset?.rotationQuaternion?.clone() ?? Quaternion.Identity();
    }

    /** Places the controllers in front of the headset, respecting its current
     *  rotation so they always appear in the headset's "forward" direction. */
    private _repositionControllersRelativeToHeadset(): void {
        if (!this._headset) {
            return;
        }

        const rot = this._headset.rotationQuaternion ?? Quaternion.Identity();
        const rotMat = new Matrix();
        Matrix.FromQuaternionToRef(rot, rotMat);

        // Local offsets: hands slightly to the sides, below eye level, and
        // in front (negative local Z = forward for a camera-oriented headset).
        const leftOffset = Vector3.TransformCoordinates(new Vector3(-0.3, -0.15, -0.5), rotMat);
        const rightOffset = Vector3.TransformCoordinates(new Vector3(0.3, -0.15, -0.5), rotMat);

        if (this._leftController) {
            this._leftController.position = this._headset.position.add(leftOffset);
        }
        if (this._rightController) {
            this._rightController.position = this._headset.position.add(rightOffset);
        }
    }

    private _createPreviewControllerSpheres(): void {
        const previewScene: Scene | null = this.props.editor.layout.preview?.scene ?? null;
        if (!previewScene) {
            return;
        }

        const leftMat = new StandardMaterial("vr_ctrl_left_mat", previewScene);
        leftMat.diffuseColor = new Color3(0.2, 0.5, 1);
        leftMat.emissiveColor = new Color3(0.2, 0.5, 1);

        this._previewLeftSphere = MeshBuilder.CreateSphere("vr_ctrl_left", { diameter: 0.25, segments: 8 }, previewScene);
        this._previewLeftSphere.material = leftMat;
        this._previewLeftSphere.isPickable = false;

        const rightMat = new StandardMaterial("vr_ctrl_right_mat", previewScene);
        rightMat.diffuseColor = new Color3(1, 0.25, 0.25);
        rightMat.emissiveColor = new Color3(1, 0.25, 0.25);

        this._previewRightSphere = MeshBuilder.CreateSphere("vr_ctrl_right", { diameter: 0.25, segments: 8 }, previewScene);
        this._previewRightSphere.material = rightMat;
        this._previewRightSphere.isPickable = false;

        // Sync sphere positions every frame — use _getRelativePose so the spheres
        // appear at the correct world-space position (vrOrigin + scaled delta),
        // not at the raw VR-panel mesh coordinates.
        this._previewSphereObserver = previewScene.onBeforeRenderObservable.add(() => {
            if (this._previewLeftSphere && this._leftController) {
                const p = this._getRelativePose(this._leftController, false).position;
                this._previewLeftSphere.position.set(p.x, p.y, p.z);
            }
            if (this._previewRightSphere && this._rightController) {
                const p = this._getRelativePose(this._rightController, false).position;
                this._previewRightSphere.position.set(p.x, p.y, p.z);
            }
        });
    }

    private _disposePreviewControllerSpheres(): void {
        const previewScene: Scene | null = this.props.editor.layout.preview?.scene ?? null;
        if (previewScene && this._previewSphereObserver) {
            previewScene.onBeforeRenderObservable.remove(this._previewSphereObserver);
        }
        this._previewSphereObserver = null;

        this._previewLeftSphere?.dispose();
        this._previewLeftSphere = null;
        this._previewRightSphere?.dispose();
        this._previewRightSphere = null;
    }

    // ─── Pose helpers ────────────────────────────────────────────────────────────

    /**
     * Returns a world-space pose for a simulator mesh.
     *
     * World position = vrOrigin + (mesh.position − headsetStartPosition)
     *   → When the mesh hasn't moved since VR started, the result equals vrOrigin.
     *   → Any delta the user drags is added on top of the camera's real position.
     *
     * World rotation (headset only, applyRotation = true):
     *   = vrOriginRotation * (headsetStartRotation⁻¹ * mesh.rotationQuaternion)
     *   → Identity headset rotation reproduces the camera's starting look direction.
     *   → Any rotation the user applies is composed on top.
     */
    private _getRelativePose(mesh: Nullable<AbstractMesh>, applyRotation: boolean) {
        const originPos = this._vrOriginPosition ?? new Vector3(0, 1.6, 0);
        const originRot = this._vrOriginRotation ?? Quaternion.Identity();
        const startPos = this._headsetStartPosition ?? new Vector3(0, 1.6, 0);

        const meshPos = mesh?.position ?? startPos;
        const delta = meshPos.subtract(startPos).scale(this.state.movementScale);
        const worldPos = originPos.add(delta);

        let worldRot = originRot;
        if (applyRotation && mesh?.rotationQuaternion) {
            const startRot = this._headsetStartRotation ?? Quaternion.Identity();
            // delta rotation = how much the headset has been rotated since VR start
            const deltaRot = startRot.conjugate().multiply(mesh.rotationQuaternion);
            worldRot = originRot.multiply(deltaRot);
        }

        return {
            position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
            orientation: { x: worldRot.x, y: worldRot.y, z: worldRot.z, w: worldRot.w },
        };
    }

    // ─── Event sync ──────────────────────────────────────────────────────────────

    private _onPreviewVRChanged = (event: Event) => {
        const e = event as CustomEvent;
        const active = e.detail?.active ?? false;
        if (active !== this.state.vrActive) {
            if (!active && this._uninstallPolyfill) {
                this._uninstallPolyfill();
                this._uninstallPolyfill = null;
                window.dispatchEvent(new CustomEvent("webxr-polyfill-changed", { detail: { enabled: false } }));
            }
            this.setState({ vrActive: active });
        }
    };
}
