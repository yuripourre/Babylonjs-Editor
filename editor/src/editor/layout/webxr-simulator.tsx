import { Component, ReactNode, MouseEvent } from "react";

import { Editor } from "../main";

import { Toggle } from "../../ui/shadcn/ui/toggle";
import { Button } from "../../ui/shadcn/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/shadcn/ui/tooltip";
import { ToolbarRadioGroup, ToolbarRadioGroupItem } from "../../ui/shadcn/ui/toolbar-radio-group";
import { Separator } from "../../ui/shadcn/ui/separator";

import {
    Engine,
    Scene,
    Vector3,
    MeshBuilder,
    HemisphericLight,
    StandardMaterial,
    Color3,
    Quaternion,
    AbstractMesh,
    Nullable,
    PositionGizmo,
    RotationGizmo,
    ScaleGizmo,
    UtilityLayerRenderer,
    PickingInfo,
    Vector2,
} from "babylonjs";

import { EditorCamera } from "../nodes/camera";

import { GiArrowCursor } from "react-icons/gi";
import { LuMove3D, LuRotate3D, LuScale3D } from "react-icons/lu";

import { installSimulatedWebXR, ISimulatedGamepad } from "../../tools/webxr/polyfill";
import { EditorGraphContextMenu } from "./graph/graph";

export interface IEditorWebXRSimulatorProps {
    editor: Editor;
}

export interface IEditorWebXRSimulatorState {
    enableVR: boolean;
    previewVR: boolean;
    showGizmos: boolean;
    activeGizmo: "none" | "position" | "rotation" | "scaling";
    pickingEnabled: boolean;
    rightClickedObject: Nullable<AbstractMesh>;
    isFocused: boolean;
}

/**
 * A small WebXR simulator panel that provides:
 * - a simple Babylon scene with a ground plane and 3 boxes (headset + 2 controllers)
 * - drag-to-move for the three boxes
 * - a toggle "Enable VR" that injects a minimal WebXR polyfill into window.navigator.xr
 *   The polyfill is purposely minimal: it makes isSessionSupported('immersive-vr') resolve
 *   to true and returns a simulated session object for requestSession. The simulated
 *   XRFrame uses the headset transform from this simulator so other code (for example,
 *   a Preview) that requests an XR session will receive viewer poses based on the
 *   simulator's headset mesh position.
 *
 * NOTE: This polyfill is intentionally lightweight and meant for simulation/debugging
 * within the editor. It does not implement the full WebXR API. It tries to be enough
 * for Babylon/Preview to show a VR button and to receive viewer pose callbacks.
 */
export class EditorWebXRSimulator extends Component<IEditorWebXRSimulatorProps, IEditorWebXRSimulatorState> {
    private _engine: Engine | null = null;
    private _scene: Scene | null = null;

    private _headset: Nullable<AbstractMesh> = null;
    private _leftController: Nullable<AbstractMesh> = null;
    private _rightController: Nullable<AbstractMesh> = null;

    private _selectedMesh: Nullable<AbstractMesh> = null;
    private _mouseDownPosition: Vector2 = Vector2.Zero();
    private _meshUnderPointer: AbstractMesh | null = null;

    // Gizmos
    private _gizmosLayer: UtilityLayerRenderer | null = null;
    private _headsetGizmo: PositionGizmo | RotationGizmo | ScaleGizmo | null = null;
    private _leftControllerGizmo: PositionGizmo | RotationGizmo | ScaleGizmo | null = null;
    private _rightControllerGizmo: PositionGizmo | RotationGizmo | ScaleGizmo | null = null;

    // Simulation helpers
    private _uninstallPolyfill: (() => void) | null = null;

    // Gamepad layout: axes[0]=thumbX, axes[1]=thumbY
    // buttons: 0=trigger, 1=squeeze, 2=primary, 3=secondary, 4=thumbstick press
    private _leftGamepad: ISimulatedGamepad = { axes: [0, 0], buttons: [
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
    ] };

    private _rightGamepad: ISimulatedGamepad = { axes: [0, 0], buttons: [
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
        { pressed: false, value: 0 },
    ] };

    public constructor(props: IEditorWebXRSimulatorProps) {
        super(props);

        this.state = {
            enableVR: false,
            previewVR: false,
            showGizmos: true,
            activeGizmo: "position",
            pickingEnabled: true,
            rightClickedObject: null,
            isFocused: false,
        };
    }

    public render(): ReactNode {
        return (
            <div className="relative w-full h-full text-foreground">
                <div className="flex flex-col w-full h-full">
                    {this._getToolbar()}

                    <EditorGraphContextMenu editor={this.props.editor} object={this.state.rightClickedObject} onOpenChange={(o) => !o && this._resetPointerContextInfo()}>
                        <canvas
                            ref={(r) => this._onGotCanvasRef(r!)}
                            onBlur={() => this.setState({ isFocused: false })}
                            onFocus={() => this.setState({ isFocused: true })}
                            onPointerUp={(ev) => this._handleMouseUp(ev)}
                            onPointerDown={(ev) => this._handleMouseDown(ev)}
                            onMouseLeave={() => this._handleMouseLeave()}
                            onMouseMove={() => this._handleMouseMove(this._scene?.pointerX || 0, this._scene?.pointerY || 0)}
                            className={`
                                select-none outline-none w-full h-full object-contain
                                bg-background
                                transition-all duration-300 ease-in-out
                            `}
                        />
                    </EditorGraphContextMenu>
                </div>

                {/* Controller emulation UI */}
                <div className="absolute top-12 right-2 z-50 w-80 p-3 rounded bg-background/80 backdrop-blur">
                    <div className="text-sm font-bold mb-1">Left Controller</div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs">Trigger ({this._leftGamepad.buttons[0].value.toFixed(2)})</label>
                        <input type="range" min="0" max="1" step="0.01" value={this._leftGamepad.buttons[0].value} onChange={(e) => this._setLeftTrigger(parseFloat(e.target.value))} />

                        <label className="text-xs">Squeeze ({this._leftGamepad.buttons[1].value.toFixed(2)})</label>
                        <input type="range" min="0" max="1" step="0.01" value={this._leftGamepad.buttons[1].value} onChange={(e) => this._setLeftSqueeze(parseFloat(e.target.value))} />

                        <label className="text-xs">Thumb X ({this._leftGamepad.axes[0].toFixed(2)})</label>
                        <input type="range" min="-1" max="1" step="0.01" value={this._leftGamepad.axes[0]} onChange={(e) => this._setLeftThumbX(parseFloat(e.target.value))} />

                        <label className="text-xs">Thumb Y ({this._leftGamepad.axes[1].toFixed(2)})</label>
                        <input type="range" min="-1" max="1" step="0.01" value={this._leftGamepad.axes[1]} onChange={(e) => this._setLeftThumbY(parseFloat(e.target.value))} />

                        <div className="flex gap-2">
                            <button className="btn" onClick={() => this._toggleLeftPrimary()}>{this._leftGamepad.buttons[2].pressed ? "Primary: On" : "Primary: Off"}</button>
                            <button className="btn" onClick={() => this._toggleLeftSecondary()}>{this._leftGamepad.buttons[3].pressed ? "Secondary: On" : "Secondary: Off"}</button>
                            <button className="btn" onClick={() => this._toggleLeftThumbPress()}>{this._leftGamepad.buttons[4].pressed ? "Thumb: Pressed" : "Thumb: Off"}</button>
                        </div>
                    </div>

                    <div className="h-1" />

                    <div className="text-sm font-bold mb-1">Right Controller</div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs">Trigger ({this._rightGamepad.buttons[0].value.toFixed(2)})</label>
                        <input type="range" min="0" max="1" step="0.01" value={this._rightGamepad.buttons[0].value} onChange={(e) => this._setRightTrigger(parseFloat(e.target.value))} />

                        <label className="text-xs">Squeeze ({this._rightGamepad.buttons[1].value.toFixed(2)})</label>
                        <input type="range" min="0" max="1" step="0.01" value={this._rightGamepad.buttons[1].value} onChange={(e) => this._setRightSqueeze(parseFloat(e.target.value))} />

                        <label className="text-xs">Thumb X ({this._rightGamepad.axes[0].toFixed(2)})</label>
                        <input type="range" min="-1" max="1" step="0.01" value={this._rightGamepad.axes[0]} onChange={(e) => this._setRightThumbX(parseFloat(e.target.value))} />

                        <label className="text-xs">Thumb Y ({this._rightGamepad.axes[1].toFixed(2)})</label>
                        <input type="range" min="-1" max="1" step="0.01" value={this._rightGamepad.axes[1]} onChange={(e) => this._setRightThumbY(parseFloat(e.target.value))} />

                        <div className="flex gap-2">
                            <button className="btn" onClick={() => this._toggleRightPrimary()}>{this._rightGamepad.buttons[2].pressed ? "Primary: On" : "Primary: Off"}</button>
                            <button className="btn" onClick={() => this._toggleRightSecondary()}>{this._rightGamepad.buttons[3].pressed ? "Secondary: On" : "Secondary: Off"}</button>
                            <button className="btn" onClick={() => this._toggleRightThumbPress()}>{this._rightGamepad.buttons[4].pressed ? "Thumb: Pressed" : "Thumb: Off"}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    public componentWillUnmount(): void {
        this._disposeGizmos();
        this._disposeScene();
        this._disablePolyfill();
        
        // Remove event listeners
        window.removeEventListener("preview-vr-changed", this._onPreviewVRChanged);
        window.removeEventListener("keydown", this._onKeyDown);
        window.removeEventListener("resize", this._onWindowResize);
    }

    private _getToolbar(): ReactNode {
        return (
            <div className="absolute top-0 left-0 w-full h-12 z-10">
                <div className="flex justify-between items-center gap-4 h-full bg-background/95 w-full px-2 py-1">
                    <div className="flex gap-2 items-center h-10">
                        <Toggle pressed={this.state.enableVR} onPressedChange={(v) => this._setVRPolyfill(v)}>
                            {this.state.enableVR ? "✅ VR Enabled" : "Enable VR"}
                        </Toggle>

                        <Button 
                            variant="ghost" 
                            className="!px-2 !py-2" 
                            onClick={() => this._togglePreviewVR()}
                            disabled={!this.state.enableVR}
                        >
                            {this.state.previewVR ? "Exit Preview VR" : "Enter Preview VR"}
                        </Button>

                        <Separator orientation="vertical" className="mx-1 h-[24px]" />

                        <TooltipProvider>
                            <ToolbarRadioGroup
                                value={this.state.activeGizmo === "none" ? "select" : this.state.activeGizmo}
                                onValueChange={(value) => {
                                    if (value === "select") {
                                        this.setActiveGizmo("none");
                                    } else {
                                        this.setActiveGizmo(value as "position" | "rotation" | "scaling");
                                    }
                                }}
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ToolbarRadioGroupItem value="select" className={this.state.activeGizmo === "none" ? "bg-primary/20" : ""}>
                                            <GiArrowCursor className="h-4 w-4" />
                                        </ToolbarRadioGroupItem>
                                    </TooltipTrigger>
                                    <TooltipContent>Select mode</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ToolbarRadioGroupItem value="position" className={this.state.activeGizmo === "position" ? "bg-primary/20" : ""}>
                                            <LuMove3D height={16} />
                                        </ToolbarRadioGroupItem>
                                    </TooltipTrigger>
                                    <TooltipContent>Toggle position gizmo</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ToolbarRadioGroupItem value="rotation" className={this.state.activeGizmo === "rotation" ? "bg-primary/20" : ""}>
                                            <LuRotate3D height={16} />
                                        </ToolbarRadioGroupItem>
                                    </TooltipTrigger>
                                    <TooltipContent>Toggle rotation gizmo</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ToolbarRadioGroupItem value="scaling" className={this.state.activeGizmo === "scaling" ? "bg-primary/20" : ""}>
                                            <LuScale3D height={16} />
                                        </ToolbarRadioGroupItem>
                                    </TooltipTrigger>
                                    <TooltipContent>Toggle scaling gizmo</TooltipContent>
                                </Tooltip>
                            </ToolbarRadioGroup>
                        </TooltipProvider>

                        {this.state.enableVR && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                WebXR Ready
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    private async _onGotCanvasRef(canvas: HTMLCanvasElement): Promise<void> {
        if (this._engine) {
            return;
        }

        this._engine = new Engine(canvas, true, {
            antialias: true,
            audioEngine: false,
            adaptToDeviceRatio: true,
            disableWebGL2Support: false,
            useHighPrecisionFloats: true,
            useHighPrecisionMatrix: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            useExactSrgbConversions: true,
        });

        this._engine.disableContextMenu = false;

        this._scene = new Scene(this._engine);
        this._scene.autoClear = true;

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this._scene);
        light.intensity = 0.9;

        // Ground
        const groundMat = new StandardMaterial("groundMat", this._scene);
        groundMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
        const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, this._scene);
        ground.material = groundMat;
        ground.isPickable = false; // Don't pick the ground

        // Headset box
        this._headset = MeshBuilder.CreateBox("webxr_headset", { size: 0.26 }, this._scene);
        const headsetMat = new StandardMaterial("headsetMat", this._scene);
        headsetMat.diffuseColor = new Color3(0.2, 0.6, 1);
        this._headset.material = headsetMat;
        this._headset.position = new Vector3(0, 1.6, 0);
        this._headset.isPickable = true;
        console.log("Created headset mesh:", this._headset.name, "position:", this._headset.position, "isPickable:", this._headset.isPickable);

        // Left controller
        this._leftController = MeshBuilder.CreateBox("webxr_left_ctrl", { size: 0.12 }, this._scene);
        const leftMat = new StandardMaterial("leftMat", this._scene);
        leftMat.diffuseColor = new Color3(0, 1, 0.5);
        this._leftController.material = leftMat;
        this._leftController.position = new Vector3(-0.3, 1.4, -0.4);
        this._leftController.isPickable = true;
        console.log("Created left controller mesh:", this._leftController.name, "position:", this._leftController.position, "isPickable:", this._leftController.isPickable);

        // Right controller
        this._rightController = MeshBuilder.CreateBox("webxr_right_ctrl", { size: 0.12 }, this._scene);
        const rightMat = new StandardMaterial("rightMat", this._scene);
        rightMat.diffuseColor = new Color3(1, 0.35, 0.35);
        this._rightController.material = rightMat;
        this._rightController.position = new Vector3(0.3, 1.4, -0.4);
        this._rightController.isPickable = true;
        console.log("Created right controller mesh:", this._rightController.name, "position:", this._rightController.position, "isPickable:", this._rightController.isPickable);

        // Basic camera (used when not in immersive mode) - use EditorCamera like preview tab
        const camera = new EditorCamera("cam", Vector3.Zero(), this._scene);
        
        // Attach camera control like the preview tab does
        camera.attachControl(true);
        
        camera.minZ = 0.01;
        camera.maxZ = 1000;
        camera.speed = 0.5;
        camera.angularSensibility = 2000;
        camera.inertia = 0.9;
        
        // Position camera to look at the VR objects
        camera.position = new Vector3(0, 1.6, 3.5);
        camera.setTarget(Vector3.Zero());
        
        // Set as active camera
        this._scene.activeCamera = camera;
        this._scene.cameraToUseForPointers = camera;
        
        console.log("Camera setup complete:", camera.name, "position:", camera.position, "target:", camera.getTarget());

        // Create gizmos for VR objects
        this._createGizmos();

        // Gizmos will now work automatically since we're sharing the same camera instance
        // No need for complex pointer event handling

        // Simulator always uses single camera - no stereo cameras needed

        // Run loop
        this._engine.runRenderLoop(() => {
            if (!this._scene) {
                return;
            }

            // VR object positions are updated automatically through the pose getter methods
            
            // Ensure gizmo utility layer stays in sync with main scene
            if (this._gizmosLayer && this._scene.activeCamera) {
                // Keep the utility layer camera in sync with the main camera
                const utilityCamera = this._gizmosLayer.utilityLayerScene.activeCamera;
                if (utilityCamera) {
                    // Copy position from main camera to utility camera
                    utilityCamera.position.copyFrom(this._scene.activeCamera.position);
                    
                    // Ensure viewport is synchronized
                    utilityCamera.viewport = this._scene.activeCamera.viewport.clone();
                }
            }

            // Simulator always stays in normal 3D view - no stereo cameras needed
            this._scene.render();
        });

        // Note: Pointer events are now handled by React event handlers
        // This ensures proper coordinate mapping like the preview panel

        canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        // Note: Mouse events are now handled by React event handlers on the canvas element

        // Listen for preview VR changes to keep simulator in sync
        window.addEventListener("preview-vr-changed", this._onPreviewVRChanged);
        
        // Add keyboard event listener for gizmo toggle
        window.addEventListener("keydown", this._onKeyDown);
        
        // Add window resize listener to maintain canvas aspect ratio
        window.addEventListener("resize", this._onWindowResize);
        
        this.forceUpdate();
    }



    private _getHeadPosePlain() {
        if (!this._headset) {
            return {
                position: { x: 0, y: 1.6, z: 0 },
                orientation: { x: 0, y: 0, z: 0, w: 1 },
            };
        }

        const pos = this._headset.absolutePosition || new Vector3(0, 1.6, 0);
        const rotQ = (this._headset.rotationQuaternion as Quaternion) || new Quaternion(0, 0, 0, 1);

        return {
            position: { x: pos.x, y: pos.y, z: pos.z },
            orientation: { x: rotQ.x, y: rotQ.y, z: rotQ.z, w: rotQ.w },
        };
    }



    private _disposeScene(): void {
        this._disposeGizmos();
        
        if (this._scene) {
            try {
                this._scene.dispose();
            } catch (e) {
                // ignore
            }
            this._scene = null as any;
        }

        if (this._engine) {
            try {
                this._engine.dispose();
            } catch (e) {
                // ignore
            }
            this._engine = null as any;
        }
    }

    private _setVRPolyfill(enable: boolean) {
        if (enable) {
            this._enablePolyfill();
        } else {
            this._disablePolyfill();
        }

        this.setState({ enableVR: enable });
    }

    private _enablePolyfill() {
        try {
            // expose simple helpers that the polyfill will call
            (window as any).__webxrSimulator ||= {};
            (window as any).__webxrSimulator.getHeadPose = () => this._getHeadPosePlain();
            (window as any).__webxrSimulator.getLeftPose = () => this._getLeftControllerPosePlain();
            (window as any).__webxrSimulator.getRightPose = () => this._getRightControllerPosePlain();
            (window as any).__webxrSimulator.getLeftGamepad = () => this._getLeftGamepadPlain();
            (window as any).__webxrSimulator.getRightGamepad = () => this._getRightGamepadPlain();

            // Install polyfill via shared helper
            this._uninstallPolyfill = installSimulatedWebXR({
                getHeadPose: () => this._getHeadPosePlain(),
                getLeftPose: () => this._getLeftControllerPosePlain(),
                getRightPose: () => this._getRightControllerPosePlain(),
                getLeftGamepad: () => this._getLeftGamepadPlain(),
                getRightGamepad: () => this._getRightGamepadPlain(),
            });

            // allow other parts of the editor/preview to react
            window.dispatchEvent(new CustomEvent("webxr-polyfill-changed", { detail: { enabled: true } }));
        } catch (e) {
            console.error("Failed to enable webxr polyfill", e);
        }
    }

    private _disablePolyfill() {
        try {
            if (this._uninstallPolyfill) {
                this._uninstallPolyfill();
                this._uninstallPolyfill = null;
            }

            if ((window as any).__webxrSimulator) {
                delete (window as any).__webxrSimulator;
            }

            window.dispatchEvent(new CustomEvent("webxr-polyfill-changed", { detail: { enabled: false } }));
        } catch (e) {
            // ignore
        }
    }

    private async _togglePreviewVR() {
        if (!this.state.previewVR) {
            // Enter preview VR: enable VR mode in the main preview panel only
            try {
                if (!(window as any).navigator?.xr) {
                    // If polyfill isn't enabled, enable it temporarily
                    this._enablePolyfill();
                    this.setState({ enableVR: true });
                }

                // Trigger VR mode in the main preview panel
                if (this.props.editor.layout.preview && (this.props.editor.layout.preview as any)._togglePreviewXR) {
                    await (this.props.editor.layout.preview as any)._togglePreviewXR();
                }

                this.setState({ previewVR: true });
            } catch (e) {
                console.error("Failed to start preview VR mode", e);
                // fallback: set previewVR true locally
                this.setState({ previewVR: true });
            }
        } else {
            // exit preview VR
            try {
                // Stop VR mode in the main preview panel
                if (this.props.editor.layout.preview && (this.props.editor.layout.preview as any)._togglePreviewXR) {
                    await (this.props.editor.layout.preview as any)._togglePreviewXR();
                }
            } catch (e) {
                console.error("Failed to stop preview VR mode", e);
            }

            this.setState({ previewVR: false });
        }
    }

    private _getLeftControllerPosePlain() {
        if (!this._leftController) {
            return {
                position: { x: -0.3, y: 1.4, z: -0.4 },
                orientation: { x: 0, y: 0, z: 0, w: 1 },
            };
        }

        const pos = this._leftController.absolutePosition || this._leftController.position || new Vector3(-0.3, 1.4, -0.4);
        const rotQ = (this._leftController.rotationQuaternion as Quaternion) || new Quaternion(0, 0, 0, 1);

        return {
            position: { x: pos.x, y: pos.y, z: pos.z },
            orientation: { x: rotQ.x, y: rotQ.y, z: rotQ.z, w: rotQ.w },
        };
    }

    private _getRightControllerPosePlain() {
        if (!this._rightController) {
            return {
                position: { x: 0.3, y: 1.4, z: -0.4 },
                orientation: { x: 0, y: 0, z: 0, w: 1 },
            };
        }

        const pos = this._rightController.absolutePosition || this._rightController.position || new Vector3(0.3, 1.4, -0.4);
        const rotQ = (this._rightController.rotationQuaternion as Quaternion) || new Quaternion(0, 0, 0, 1);

        return {
            position: { x: pos.x, y: pos.y, z: pos.z },
            orientation: { x: rotQ.x, y: rotQ.y, z: rotQ.z, w: rotQ.w },
        };
    }

    // Accessors for the polyfill to read the current simulated gamepad states
    private _getLeftGamepadPlain() {
        return { axes: [...this._leftGamepad.axes], buttons: this._leftGamepad.buttons.map((b) => ({ pressed: !!b.pressed, value: b.value })) };
    }

    private _getRightGamepadPlain() {
        return { axes: [...this._rightGamepad.axes], buttons: this._rightGamepad.buttons.map((b) => ({ pressed: !!b.pressed, value: b.value })) };
    }

    private _notifyInputSourcesChange() {
        try {
            const xr: any = (window as any).navigator?.xr;
            if (xr && typeof xr._fireInputSourcesChange === "function") {
                xr._fireInputSourcesChange({ added: [], removed: [] });
            }
        } catch (e) {
            // ignore
        }
    }

    private _setLeftTrigger(v: number) {
        this._leftGamepad.buttons[0] = { pressed: v > 0.5, value: v };
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _toggleLeftButton(index: number) {
        const b = this._leftGamepad.buttons[index] || { pressed: false, value: 0 };
        b.pressed = !b.pressed;
        b.value = b.pressed ? 1 : 0;
        this._leftGamepad.buttons[index] = b;
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _setLeftSqueeze(v: number) {
        this._leftGamepad.buttons[1] = { pressed: v > 0.5, value: v };
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _toggleLeftPrimary() {
        this._toggleLeftButton(2);
    }

    private _toggleLeftSecondary() {
        this._toggleLeftButton(3);
    }

    private _toggleLeftThumbPress() {
        this._toggleLeftButton(4);
    }

    private _setRightTrigger(v: number) {
        this._rightGamepad.buttons[0] = { pressed: v > 0.5, value: v };
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _toggleRightButton(index: number) {
        const b = this._rightGamepad.buttons[index] || { pressed: false, value: 0 };
        b.pressed = !b.pressed;
        b.value = b.pressed ? 1 : 0;
        this._rightGamepad.buttons[index] = b;
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _setRightSqueeze(v: number) {
        this._rightGamepad.buttons[1] = { pressed: v > 0.5, value: v };
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _toggleRightPrimary() {
        this._toggleRightButton(2);
    }

    private _toggleRightSecondary() {
        this._toggleRightButton(3);
    }

    private _toggleRightThumbPress() {
        this._toggleRightButton(4);
    }

    private _setLeftThumbX(v: number) {
        this._leftGamepad.axes[0] = v;
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _setLeftThumbY(v: number) {
        this._leftGamepad.axes[1] = v;
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _setRightThumbX(v: number) {
        this._rightGamepad.axes[0] = v;
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _setRightThumbY(v: number) {
        this._rightGamepad.axes[1] = v;
        this._notifyInputSourcesChange();
        this.forceUpdate();
    }

    private _onPreviewVRChanged = (event: CustomEvent) => {
        // Sync simulator state with preview VR state
        const isVRActive = event.detail?.active || false;
        if (isVRActive !== this.state.previewVR) {
            this.setState({ previewVR: isVRActive });
        }
    };

    private _onKeyDown = (event: KeyboardEvent) => {
        // Toggle gizmos with 'G' key when VR is enabled
        if (event.key === 'g' || event.key === 'G') {
            if (this.state.enableVR) {
                this._toggleGizmos(!this.state.showGizmos);
            }
        }
    };

    private _onWindowResize = (): void => {
        if (this._engine) {
            // Resize the engine to maintain proper aspect ratio (like preview panel)
            this._engine.resize();
            
            // Ensure the gizmo utility layer is also properly resized
            if (this._scene && this._gizmosLayer && this._scene.activeCamera) {
                // Update utility layer camera viewport to match main camera
                const utilityCamera = this._gizmosLayer.utilityLayerScene.activeCamera;
                if (utilityCamera) {
                    utilityCamera.viewport = this._scene.activeCamera.viewport.clone();
                }
            }
        }
    };

    private _handleMouseMove(x: number, y: number): void {
        if (!this.state.pickingEnabled || !this._scene) {
            return;
        }

        console.log("Mouse move at:", x, y, "scene pointer:", this._scene.pointerX, this._scene.pointerY);

        const pickingInfo = this._getPickingInfo(x, y);
        const mesh = pickingInfo.pickedMesh;

        if (mesh && this._meshUnderPointer !== mesh) {
            this._restoreCurrentMeshUnderPointer();
            this._highlightCurrentMeshUnderPointer(mesh);
            this._meshUnderPointer = mesh;
        }
    }

    private _handleMouseDown(event: MouseEvent<HTMLCanvasElement, globalThis.MouseEvent>): void {
        if (!this.state.pickingEnabled || !this._scene) {
            return;
        }

        this._mouseDownPosition.set(event.clientX, event.clientY);

        if (event.button === 2) {
            this.setState({
                rightClickedObject: this._meshUnderPointer,
            });
        }

        this._restoreCurrentMeshUnderPointer();
        this._meshUnderPointer = null;

        if (event.button === 2) {
            this._scene.activeCamera?.inputs.detachElement();
            this._handleMouseUp(event);
        }
    }

    private _handleMouseUp(event: MouseEvent<HTMLCanvasElement, globalThis.MouseEvent>): void {
        if (!this.state.pickingEnabled || !this._scene) {
            return;
        }

        if (event.altKey || event.button === 1) {
            return;
        }

        const distance = Vector2.Distance(this._mouseDownPosition, new Vector2(event.clientX, event.clientY));

        if (distance > 2) {
            return;
        }

        const pickingInfo = this._getPickingInfo(this._scene.pointerX, this._scene.pointerY);
        const mesh = pickingInfo.pickedMesh;

        console.log("Mouse up at:", this._scene.pointerX, this._scene.pointerY, "picked:", mesh?.name);

        if (mesh && (mesh === this._headset || mesh === this._leftController || mesh === this._rightController)) {
            console.log("Setting selected mesh:", mesh.name);
            this._setSelectedMesh(mesh);
        }
    }

    private _handleMouseLeave(): void {
        this._restoreCurrentMeshUnderPointer();
        this._meshUnderPointer = null;
    }

    private _resetPointerContextInfo(): void {
        this.setState({ rightClickedObject: null });
    }

    private _getPickingInfo(x: number, y: number): PickingInfo {
        if (!this._scene) {
            console.log("No scene available for picking");
            return { hit: false } as PickingInfo;
        }

        console.log("Picking at coordinates:", x, y);
        console.log("Scene active camera:", this._scene.activeCamera?.name);
        console.log("Available meshes:", this._scene.meshes.map(m => m.name));

        // Try picking without filter first to see if picking works at all
        const allPick = this._scene.pick(x, y);
        console.log("All pick result:", allPick.hit, allPick.pickedMesh?.name);

        // Use the same picking logic as preview tab but filter for our VR objects
        const meshPick = this._scene.pick(
            x,
            y,
            (m) => {
                const isVRMesh = (m === this._headset || m === this._leftController || m === this._rightController);
                console.log("Checking mesh:", m.name, "isVRMesh:", isVRMesh, "isVisible:", m.isVisible, "isEnabled:", m.isEnabled());
                return m.isVisible && m.isEnabled() && isVRMesh;
            },
            false
        );

        console.log("VR mesh pick result:", meshPick.hit, meshPick.pickedMesh?.name);

        return meshPick;
    }

    private _restoreCurrentMeshUnderPointer(): void {
        if (this._meshUnderPointer) {
            // Restore original material if needed
            this._meshUnderPointer = null;
        }
    }

    private _highlightCurrentMeshUnderPointer(_mesh: AbstractMesh): void {
        // Add highlighting logic if needed
    }

    private _setSelectedMesh(mesh: AbstractMesh): void {
        this._selectedMesh = mesh;
        
        // Update gizmos based on active gizmo type
        if (this.state.activeGizmo !== "none") {
            this._updateGizmosForMesh(mesh);
        }
    }

    private _updateGizmosForMesh(mesh: AbstractMesh): void {
        if (!this._gizmosLayer || this.state.activeGizmo === "none") return;

        // Hide all gizmos first
        if (this._headsetGizmo) this._headsetGizmo.attachedMesh = null;
        if (this._leftControllerGizmo) this._leftControllerGizmo.attachedMesh = null;
        if (this._rightControllerGizmo) this._rightControllerGizmo.attachedMesh = null;

        // Show appropriate gizmo based on selected mesh and active gizmo type
        if (mesh === this._headset && this._headsetGizmo) {
            this._headsetGizmo.attachedMesh = this._headset;
        } else if (mesh === this._leftController && this._leftControllerGizmo) {
            this._leftControllerGizmo.attachedMesh = this._leftController;
        } else if (mesh === this._rightController && this._rightControllerGizmo) {
            this._rightControllerGizmo.attachedMesh = this._rightController;
        }
    }

    public setActiveGizmo(gizmo: "none" | "position" | "rotation" | "scaling"): void {
        this.setState({ activeGizmo: gizmo });
        
        // Recreate gizmos with new type
        this._updateGizmoTypes();
    }

    private _toggleGizmos(show: boolean): void {
        this.setState({ showGizmos: show });
        
        if (show) {
            this._showGizmos();
        } else {
            this._hideGizmos();
        }
    }

    private _showGizmos(): void {
        if (this._headsetGizmo) this._headsetGizmo.attachedMesh = this._headset;
        if (this._leftControllerGizmo) this._leftControllerGizmo.attachedMesh = this._leftController;
        if (this._rightControllerGizmo) this._rightControllerGizmo.attachedMesh = this._rightController;
    }

    private _hideGizmos(): void {
        if (this._headsetGizmo) this._headsetGizmo.attachedMesh = null;
        if (this._leftControllerGizmo) this._leftControllerGizmo.attachedMesh = null;
        if (this._rightControllerGizmo) this._rightControllerGizmo.attachedMesh = null;
    }

    private _createGizmos(): void {
        if (!this._scene) {
            return;
        }

        // Create gizmos layer with proper camera synchronization
        this._gizmosLayer = new UtilityLayerRenderer(this._scene);
        this._gizmosLayer.utilityLayerScene.postProcessesEnabled = false;
        
        // Critical: Share the camera between the main scene and utility layer
        if (this._scene.activeCamera) {
            this._gizmosLayer.utilityLayerScene.activeCamera = this._scene.activeCamera;
            // This is crucial for proper coordinate mapping
            this._gizmosLayer.utilityLayerScene.cameraToUseForPointers = this._scene.activeCamera;
        }

        // Create initial gizmos (will be updated based on active gizmo type)
        this._updateGizmoTypes();
    }

    private _updateGizmoTypes(): void {
        if (!this._gizmosLayer) return;

        // Dispose existing gizmos
        this._disposeGizmos();

        // Create new gizmos based on active type
        const gizmoType = this.state.activeGizmo;
        
        if (this._headset) {
            this._headsetGizmo = this._createGizmoForMesh(this._headset, gizmoType);
        }
        
        if (this._leftController) {
            this._leftControllerGizmo = this._createGizmoForMesh(this._leftController, gizmoType);
        }
        
        if (this._rightController) {
            this._rightControllerGizmo = this._createGizmoForMesh(this._rightController, gizmoType);
        }

        // Update visibility based on selected mesh
        if (this._selectedMesh) {
            this._updateGizmosForMesh(this._selectedMesh);
        }
    }

    private _createGizmoForMesh(_mesh: AbstractMesh, gizmoType: "none" | "position" | "rotation" | "scaling"): PositionGizmo | RotationGizmo | ScaleGizmo | null {
        if (!this._gizmosLayer || gizmoType === "none") {
            return null;
        }

        let gizmo: PositionGizmo | RotationGizmo | ScaleGizmo;
        
        switch (gizmoType) {
            case "position":
                gizmo = new PositionGizmo(this._gizmosLayer);
                break;
            case "rotation":
                gizmo = new RotationGizmo(this._gizmosLayer);
                break;
            case "scaling":
                gizmo = new ScaleGizmo(this._gizmosLayer);
                break;
            default:
                return null;
        }

        // Configure gizmo
        gizmo.scaleRatio = 2;
        if (gizmo instanceof PositionGizmo) {
            gizmo.planarGizmoEnabled = true;
        }
        
        // Configure gizmo for better interaction
        gizmo.updateGizmoRotationToMatchAttachedMesh = false;
        gizmo.updateGizmoPositionToMatchAttachedMesh = true;
        
        // Add drag event handlers for better interaction
        gizmo.onDragStartObservable.add(() => {
            // Detach camera control during gizmo drag
            if (this._scene && this._scene.activeCamera) {
                this._scene.activeCamera.detachControl();
            }
        });
        
        gizmo.onDragEndObservable.add(() => {
            // Re-attach camera control after gizmo drag
            if (this._scene && this._scene.activeCamera) {
                const canvas = this._engine?.getRenderingCanvas();
                if (canvas) {
                    this._scene.activeCamera.attachControl(canvas, true);
                }
            }
        });

        return gizmo;
    }

    private _disposeGizmos(): void {
        if (this._headsetGizmo) {
            this._headsetGizmo.dispose();
            this._headsetGizmo = null;
        }
        if (this._leftControllerGizmo) {
            this._leftControllerGizmo.dispose();
            this._leftControllerGizmo = null;
        }
        if (this._rightControllerGizmo) {
            this._rightControllerGizmo.dispose();
            this._rightControllerGizmo = null;
        }
        if (this._gizmosLayer) {
            this._gizmosLayer.dispose();
            this._gizmosLayer = null;
        }
    }
}
