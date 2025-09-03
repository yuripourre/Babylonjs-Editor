import { Component, ReactNode } from "react";

import { Editor } from "../main";

import { Toggle } from "../../ui/shadcn/ui/toggle";
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
    Quaternion,

    AbstractMesh,
    Nullable,
} from "babylonjs";

import { installSimulatedWebXR, ISimulatedGamepad } from "../../tools/webxr/polyfill";

export interface IEditorWebXRSimulatorProps {
    editor: Editor;
}

export interface IEditorWebXRSimulatorState {
    enableVR: boolean;
    previewVR: boolean;
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
    private _dragOffset: Vector3 = Vector3.Zero();
    private _isDragging: boolean = false;





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
        };
    }

    public render(): ReactNode {
        return (
            <div className="relative w-full h-full text-foreground">
                <div className="sticky z-50 top-0 left-0 w-full h-10 bg-primary-foreground">
                    <div className="flex gap-2 items-center px-2 h-full">
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

                        <div className="text-xs text-muted">
                            {this.state.enableVR ? "WebXR polyfill active - Drag boxes to move headset / controllers" : "Enable VR to start simulation"}
                        </div>
                        
                        {this.state.enableVR && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                WebXR Ready
                            </div>
                        )}
                    </div>
                </div>

                <canvas ref={(r) => this._onGotCanvasRef(r!)} className="w-full h-full select-none" />

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
        this._disposeScene();
        this._disablePolyfill();
        
        // Remove event listener for preview VR changes
        window.removeEventListener("preview-vr-changed", this._onPreviewVRChanged);
    }

    private async _onGotCanvasRef(canvas: HTMLCanvasElement): Promise<void> {
        if (this._engine) {
            return;
        }

        this._engine = new Engine(canvas, true, {
            antialias: true,
            audioEngine: false,
            adaptToDeviceRatio: true,
        });

        this._scene = new Scene(this._engine);

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this._scene);
        light.intensity = 0.9;

        // Ground
        const groundMat = new StandardMaterial("groundMat", this._scene);
        groundMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
        const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, this._scene);
        ground.material = groundMat;

        // Headset box
        this._headset = MeshBuilder.CreateBox("webxr_headset", { size: 0.26 }, this._scene);
        const headsetMat = new StandardMaterial("headsetMat", this._scene);
        headsetMat.diffuseColor = new Color3(0.2, 0.6, 1);
        this._headset.material = headsetMat;
        this._headset.position = new Vector3(0, 1.6, 0);

        // Left controller
        this._leftController = MeshBuilder.CreateBox("webxr_left_ctrl", { size: 0.12 }, this._scene);
        const leftMat = new StandardMaterial("leftMat", this._scene);
        leftMat.diffuseColor = new Color3(0, 1, 0.5);
        this._leftController.material = leftMat;
        this._leftController.position = new Vector3(-0.3, 1.4, -0.4);

        // Right controller
        this._rightController = MeshBuilder.CreateBox("webxr_right_ctrl", { size: 0.12 }, this._scene);
        const rightMat = new StandardMaterial("rightMat", this._scene);
        rightMat.diffuseColor = new Color3(1, 0.35, 0.35);
        this._rightController.material = rightMat;
        this._rightController.position = new Vector3(0.3, 1.4, -0.4);

        // Basic camera (used when not in immersive mode)
        const camera = new FreeCamera("cam", new Vector3(0, 1.6, 3.5), this._scene);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(canvas, true);
        camera.minZ = 0.01;
        camera.maxZ = 1000;
        camera.speed = 0.5;
        camera.angularSensibility = 2000;
        camera.inertia = 0.9;
        
        // Set as active camera
        this._scene.activeCamera = camera;

        // Simulator always uses single camera - no stereo cameras needed

        // Run loop
        this._engine.runRenderLoop(() => {
            if (!this._scene) {
                return;
            }

            // Simulator always stays in normal 3D view - no stereo cameras needed

            this._scene.render();
        });

        // Pointer drag handlers - only for VR objects
        canvas.addEventListener("pointerdown", (ev: PointerEvent) => {
            if (!this._scene) {
                return;
            }
            const pick = this._scene.pick(ev.offsetX, ev.offsetY);
            if (pick && pick.hit && pick.pickedMesh && (pick.pickedMesh === this._headset || pick.pickedMesh === this._leftController || pick.pickedMesh === this._rightController)) {
                this._selectedMesh = pick.pickedMesh;
                if (pick.pickedPoint && this._selectedMesh.position) {
                    this._dragOffset = pick.pickedPoint.subtract(this._selectedMesh.position);
                }
                this._isDragging = true;
                ev.preventDefault(); // Prevent camera controls when dragging objects
            }
        });

        canvas.addEventListener("pointermove", (ev: PointerEvent) => {
            if (!this._isDragging || !this._scene || !this._selectedMesh) {
                return;
            }
            const pick = this._scene.pick(ev.offsetX, ev.offsetY, (m) => m === ground);
            const finalPick = pick && pick.hit && pick.pickedPoint ? pick : this._scene.pick(ev.offsetX, ev.offsetY);
            if (finalPick && finalPick.hit && finalPick.pickedPoint) {
                this._selectedMesh.position = finalPick.pickedPoint.subtract(this._dragOffset);
            }
            ev.preventDefault(); // Prevent camera controls when dragging objects
        });

        canvas.addEventListener("pointerup", (ev: PointerEvent) => {
            if (this._isDragging) {
                ev.preventDefault(); // Prevent camera controls when finishing drag
            }
            this._isDragging = false;
            this._selectedMesh = null;
        });

        canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        // Listen for preview VR changes to keep simulator in sync
        window.addEventListener("preview-vr-changed", this._onPreviewVRChanged);
        
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
}
