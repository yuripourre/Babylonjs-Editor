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
    Viewport,
    AbstractMesh,
    Nullable,
} from "babylonjs";

export interface IEditorWebXRSimulatorProps {
    editor: Editor;
}

export interface IEditorWebXRSimulatorState {
    enableVR: boolean;
    immersive: boolean;
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

    private _leftCamera: Nullable<FreeCamera> = null;
    private _rightCamera: Nullable<FreeCamera> = null;

    private _originalNavigatorXR: any = undefined;
    private _simulatedSession: any = null;

    public constructor(props: IEditorWebXRSimulatorProps) {
        super(props);

        this.state = {
            enableVR: false,
            immersive: false,
        };
    }

    public render(): ReactNode {
        return (
            <div className="relative w-full h-full text-foreground">
                <div className="sticky z-50 top-0 left-0 w-full h-10 bg-primary-foreground">
                    <div className="flex gap-2 items-center px-2 h-full">
                        <Toggle pressed={this.state.enableVR} onPressedChange={(v) => this._setVRPolyfill(v)}>
                            Enable VR
                        </Toggle>

                        <Button
                            variant="ghost"
                            className="!px-2 !py-2"
                            onClick={() => this._toggleImmersiveMode()}
                        >
                            {this.state.immersive ? "Exit VR" : "Enter VR"}
                        </Button>

                        <div className="text-xs text-muted">Drag boxes to move headset / controllers</div>
                    </div>
                </div>

                <canvas ref={(r) => this._onGotCanvasRef(r!)} className="w-full h-full select-none" />
            </div>
        );
    }

    public componentWillUnmount(): void {
        this._disposeScene();
        this._disablePolyfill();
    }

    private async _onGotCanvasRef(canvas: HTMLCanvasElement): Promise<void> {
        if (this._engine) {
            return;
        }

        // no longer storing canvas reference; it's only used to create the engine
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
        camera.attachControl(canvas, true);
        camera.minZ = 0.01;

        // Stereo cameras (visible only in immersive mode)
        this._leftCamera = new FreeCamera("left_cam", new Vector3(0, 1.6, 3), this._scene);
        this._rightCamera = new FreeCamera("right_cam", new Vector3(0, 1.6, 3), this._scene);

        // Run loop
        this._engine.runRenderLoop(() => {
            if (!this._scene) {
                return;
            }

            // Update stereo camera poses when immersive
            if (this.state.immersive) {
                this._updateStereoCameras();
            }

            this._scene.render();
        });

        // Pointer drag handlers
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
            }
        });

        canvas.addEventListener("pointermove", (ev: PointerEvent) => {
            if (!this._isDragging || !this._scene || !this._selectedMesh) {
                return;
            }
            const pick = this._scene.pick(ev.offsetX, ev.offsetY, (m) => m === ground);
            // If picking the ground failed, fallback to any pick plane
            const finalPick = pick && pick.hit && pick.pickedPoint ? pick : this._scene.pick(ev.offsetX, ev.offsetY);
            if (finalPick && finalPick.hit && finalPick.pickedPoint) {
                this._selectedMesh.position = finalPick.pickedPoint.subtract(this._dragOffset);
            }
        });

        canvas.addEventListener("pointerup", () => {
            this._isDragging = false;
            this._selectedMesh = null;
        });

        // Make sure gestures do not select text
        canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        // expose internal pose for the polyfill
        (window as any).__webxrSimulator = {
            getPose: () => this._getHeadPosePlain(),
        };

        this.forceUpdate();
    }

    private _getHeadPosePlain() {
        // returns a plain object describing headset pose
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

    private _updateStereoCameras() {
        if (!this._headset || !this._leftCamera || !this._rightCamera || !this._scene) {
            return;
        }

        const ipd = 0.064; // meters
        const headPos = this._headset.absolutePosition || new Vector3(0, 1.6, 0);
        const headRot = (this._headset.rotationQuaternion as Quaternion) || new Quaternion(0, 0, 0, 1);

        // naive offset along world X axis then rotate by headset orientation (approximation)
        // For simplicity we simply offset in world space; this is enough for a basic simulator.
        const leftPos = headPos.add(new Vector3(-ipd / 2, 0, 0));
        const rightPos = headPos.add(new Vector3(ipd / 2, 0, 0));

        this._leftCamera.position = leftPos;
        this._rightCamera.position = rightPos;

        this._leftCamera.rotationQuaternion = headRot;
        this._rightCamera.rotationQuaternion = headRot;

        // split screen
        this._leftCamera.viewport = new Viewport(0, 0, 0.5, 1);
        this._rightCamera.viewport = new Viewport(0.5, 0, 0.5, 1);

        this._scene.activeCameras = [this._leftCamera, this._rightCamera];
        this._scene.activeCamera = this._leftCamera as any;
        this._scene.cameraToUseForPointers = this._leftCamera as any; // to keep interactions functional
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

        // no longer storing canvas reference
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
            const win = window as any;

            if (win.navigator && win.navigator.xr) {
                // already exists: preserve but do not overwrite
                this._originalNavigatorXR = win.navigator.xr;
            }

            // minimal XRWebGLLayer if not present
            if (!win.XRWebGLLayer) {
                win.XRWebGLLayer = function (_session: any, gl: any) {
                    void _session;
                    // minimal polyfill: we only mimic the framebuffer property
                    // Babylon may use baseLayer.framebuffer so provide a small object
                    this.framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) || 0;
                };
            }

            // Create a minimal navigator.xr object that also provides controller inputSpaces
            const polyfill = {
                _simulated: true,
                isSessionSupported: (sessionType: string) => Promise.resolve(sessionType === "immersive-vr"),
                requestSession: (sessionType: string, options?: any) => {
                    void options;
                    if (sessionType !== "immersive-vr") {
                        return Promise.reject(new Error("webxr-simulator only supports immersive-vr"));
                    }

                    return new Promise((res) => {
                        const handlers: Record<string, Array<Function>> = {};
                        const rafIdMap: Record<number, number> = {};
                        let rafIdCounter = 0;

                        // create unique spaces for controller grips
                        const leftGripSpace = { __simulatorSpace: "left" };
                        const rightGripSpace = { __simulatorSpace: "right" };

                        const requestAnimationFrame = (cb: Function) => {
                            // clamp to ~60hz
                            const id = ++rafIdCounter;
                            const intervalId = window.setInterval(() => {
                                // Build a very small, minimal XRFrame that exposes viewer and controller poses
                                const time = performance.now();
                                const frame: any = {
                                    getViewerPose: (refSpace: any) => {
                                        void refSpace;
                                        const sim = (window as any).__webxrSimulator;
                                        if (!sim || !sim.getHeadPose) {
                                            return null;
                                        }

                                        const pose = sim.getHeadPose();

                                        const makeView = (eye: string) => {
                                            return {
                                                eye,
                                                transform: {
                                                    position: { x: pose.position.x + (eye === "left" ? -0.032 : 0.032), y: pose.position.y, z: pose.position.z },
                                                    orientation: pose.orientation,
                                                },
                                                projectionMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
                                            };
                                        };

                                        return {
                                            views: [makeView("left"), makeView("right")],
                                        };
                                    },
                                    getPose: (space: any, refSpace: any) => {
                                        void refSpace;
                                        const sim = (window as any).__webxrSimulator;
                                        if (!sim) {
                                            return null;
                                        }

                                        // left controller grip
                                        if (space === leftGripSpace) {
                                            const leftPose = sim.getLeftPose();
                                            if (!leftPose) {
                                                return null;
                                            }

                                            return {
                                                transform: {
                                                    position: { x: leftPose.position.x, y: leftPose.position.y, z: leftPose.position.z },
                                                    orientation: leftPose.orientation,
                                                },
                                            };
                                        }

                                        // right controller grip
                                        if (space === rightGripSpace) {
                                            const rightPose = sim.getRightPose();
                                            if (!rightPose) {
                                                return null;
                                            }

                                            return {
                                                transform: {
                                                    position: { x: rightPose.position.x, y: rightPose.position.y, z: rightPose.position.z },
                                                    orientation: rightPose.orientation,
                                                },
                                            };
                                        }

                                        return null;
                                    },
                                };

                                try {
                                    cb(time, frame);
                                } catch (e) {
                                    // swallow
                                }
                            }, 1000 / 60);

                            rafIdMap[id] = intervalId;
                            return id;
                        };

                        const cancelAnimationFrame = (id: number) => {
                            const intId = rafIdMap[id];
                            if (intId) {
                                clearInterval(intId);
                                delete rafIdMap[id];
                            }
                        };

                        const _sessionObj: any = {
                            inputSources: [
                                { handedness: "left", targetRayMode: "tracked-pointer", gripSpace: leftGripSpace, profiles: ["simulated-controller"] },
                                { handedness: "right", targetRayMode: "tracked-pointer", gripSpace: rightGripSpace, profiles: ["simulated-controller"] },
                            ],
                            addEventListener: (n: string, fn: Function) => {
                                if (!handlers[n]) {
                                    handlers[n] = [];
                                }
                                handlers[n].push(fn);
                            },
                            removeEventListener: (n: string, fn: Function) => {
                                if (handlers[n]) {
                                    handlers[n] = handlers[n].filter((f) => f !== fn);
                                }
                            },
                            requestReferenceSpace: (type: string) => {
                                void type;
                                return Promise.resolve({});
                            },
                            updateRenderState: (s: any) => {
                                void s;
                                return undefined;
                            },
                            requestAnimationFrame,
                            cancelAnimationFrame,
                            end: async () => {
                                if (handlers["end"]) {
                                    handlers["end"].forEach((fn) => fn());
                                }
                            },
                        };

                        // set navigator.xr to this polyfill (intentional override so preview detects XR availability)
                        win.navigator.xr = polyfill;

                        res(_sessionObj);
                     });
                 },
             } as any;

            // store original so we can restore
            this._originalNavigatorXR = (window as any).navigator?.xr ?? undefined;

            (window as any).navigator.xr = polyfill;

            (window as any).__webxrSimulator ||= {};
            (window as any).__webxrSimulator.getHeadPose = () => this._getHeadPosePlain();
            (window as any).__webxrSimulator.getLeftPose = () => this._getLeftControllerPosePlain();
            (window as any).__webxrSimulator.getRightPose = () => this._getRightControllerPosePlain();
        } catch (e) {
            console.error("Failed to enable webxr polyfill", e);
        }
    }

    private _disablePolyfill() {
        try {
            const win = window as any;
            if (this._originalNavigatorXR) {
                win.navigator.xr = this._originalNavigatorXR;
            } else if (win.navigator && win.navigator.xr && win.navigator.xr._simulated) {
                // only remove simulated polyfill if we created it
                try {
                    // Use a safe delete while keeping TypeScript happy
                    delete (win.navigator as any).xr;
                } catch (e) {
                    win.navigator.xr = undefined;
                }
            }

            if (win.__webxrSimulator) {
                delete win.__webxrSimulator;
            }
        } catch (e) {
            // ignore
        }
    }

    private async _toggleImmersiveMode() {
        if (!this.state.immersive) {
            // Enter immersive: request session (via polyfill if enabled)
            try {
                if (!(window as any).navigator?.xr) {
                    // If polyfill isn't enabled, enable it temporarily
                    this._enablePolyfill();
                    this.setState({ enableVR: true });
                }

                const session = await (window as any).navigator.xr.requestSession("immersive-vr");
                this._simulatedSession = session;

                // keep a reference and listen to end event
                session.addEventListener("end", () => {
                    this.setState({ immersive: false });
                    // restore to mono camera
                    if (this._scene && this._leftCamera && this._rightCamera) {
                        this._scene.activeCameras = null;
                        this._scene.activeCamera = this._leftCamera;
                        this._scene.cameraToUseForPointers = this._leftCamera;
                    }
                });

                this.setState({ immersive: true });
            } catch (e) {
                console.error("Failed to request XR session", e);
                // fallback: set immersive true locally
                this.setState({ immersive: true });
            }
        } else {
            // exit immersive
            try {
                if (this._simulatedSession && this._simulatedSession.end) {
                    await this._simulatedSession.end();
                }
            } catch (e) {
                // ignore
            }

            this.setState({ immersive: false });
            if (this._scene) {
                // restore mono camera
                if (this._leftCamera) {
                    this._scene.activeCamera = this._leftCamera;
                    this._scene.cameraToUseForPointers = this._leftCamera;
                    this._scene.activeCameras = null;
                }
            }
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
}
