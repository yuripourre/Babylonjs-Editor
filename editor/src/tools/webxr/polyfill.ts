export interface IVRSpacePose {
    position: { x: number; y: number; z: number };
    orientation: { x: number; y: number; z: number; w: number };
}

export interface IGamepadButton {
    pressed: boolean;
    touched?: boolean;
    value: number;
}

export interface ISimulatedGamepad {
    axes: number[];
    buttons: IGamepadButton[];
}

export interface ISimulatorCallbacks {
    getHeadPose?: () => IVRSpacePose | null;
    getLeftPose?: () => IVRSpacePose | null;
    getRightPose?: () => IVRSpacePose | null;

    getLeftGamepad?: () => ISimulatedGamepad | null;
    getRightGamepad?: () => ISimulatedGamepad | null;
}

/**
 * Installs a very small, simulated WebXR polyfill on window.navigator.xr.
 * Returns an uninstall function that will restore any previous navigator.xr.
 *
 * The polyfill is intentionally minimal and is meant for editor simulation.
 */
export function installSimulatedWebXR(callbacks: ISimulatorCallbacks = {}) {
    const win: any = typeof window !== "undefined" ? (window as any) : (global as any);

    const originalNavigatorXR = win.navigator?.xr;

    try {
        if (!win.XRWebGLLayer) {
            class SimpleXRWebGLLayer {
                public framebuffer: number;
                constructor(_session: any, gl: any) {
                    void _session;
                    // Provide a minimal framebuffer property many engines expect.
                    this.framebuffer = (gl && gl.getParameter && gl.getParameter(gl.FRAMEBUFFER_BINDING)) || 0;
                }
            }

            (win as any).XRWebGLLayer = SimpleXRWebGLLayer as any;
        }

        const polyfill: any = {
            _simulated: true,
            _sessions: [] as any[],
            isSessionSupported: (sessionType: string) => Promise.resolve(sessionType === "immersive-vr"),
            requestSession: (sessionType: string, options?: any) => {
                void options;
                if (sessionType !== "immersive-vr") {
                    return Promise.reject(new Error("webxr-simulator only supports immersive-vr"));
                }

                return new Promise((res) => {
                    const handlers: Record<string, Array<Function>> = {};
                    const rafIdMap: Record<number, number> = {} as any;
                    let rafIdCounter = 0;

                    const leftGripSpace = { __simulatorSpace: "left" };
                    const rightGripSpace = { __simulatorSpace: "right" };

                    const requestAnimationFrame = (cb: Function) => {
                        const id = ++rafIdCounter;
                        const timeoutId = setTimeout(() => {
                            delete rafIdMap[id];
                            const time = (win.performance && win.performance.now && win.performance.now()) || Date.now();

                            const frame: any = {
                                getViewerPose: (_refSpace: any) => {
                                    const pose = callbacks.getHeadPose ? callbacks.getHeadPose() : null;
                                    if (!pose) {
                                        return null;
                                    }

                                    const makeView = (eye: string) => ({
                                        eye,
                                        transform: {
                                            position: { x: pose.position.x + (eye === "left" ? -0.032 : 0.032), y: pose.position.y, z: pose.position.z },
                                            orientation: pose.orientation,
                                        },
                                        projectionMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
                                    });

                                    return { views: [makeView("left"), makeView("right")] };
                                },
                                getPose: (space: any, _ref: any) => {
                                    // Compare space identity
                                    if (space === leftGripSpace) {
                                        const p = callbacks.getLeftPose ? callbacks.getLeftPose() : null;
                                        if (!p) {
                                            return null;
                                        }
                                        return { transform: { position: { x: p.position.x, y: p.position.y, z: p.position.z }, orientation: p.orientation } };
                                    }
                                    if (space === rightGripSpace) {
                                        const p = callbacks.getRightPose ? callbacks.getRightPose() : null;
                                        if (!p) {
                                            return null;
                                        }
                                        return { transform: { position: { x: p.position.x, y: p.position.y, z: p.position.z }, orientation: p.orientation } };
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

                        rafIdMap[id] = timeoutId as any;
                        return id;
                    };

                    const cancelAnimationFrame = (id: number) => {
                        const timeoutId = rafIdMap[id];
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            delete rafIdMap[id];
                        }
                    };

                    const session: any = {
                        inputSources: [
                            {
                                handedness: "left",
                                targetRayMode: "tracked-pointer",
                                gripSpace: leftGripSpace,
                                profiles: ["simulated-controller"],
                                get gamepad() {
                                    return callbacks.getLeftGamepad ? callbacks.getLeftGamepad() : null;
                                },
                            },
                            {
                                handedness: "right",
                                targetRayMode: "tracked-pointer",
                                gripSpace: rightGripSpace,
                                profiles: ["simulated-controller"],
                                get gamepad() {
                                    return callbacks.getRightGamepad ? callbacks.getRightGamepad() : null;
                                },
                            },
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
                        requestReferenceSpace: (_type: any) => Promise.resolve({}),
                        updateRenderState: (_s: any) => void 0,
                        requestAnimationFrame,
                        cancelAnimationFrame,
                        end: async () => {
                            if (handlers["end"]) {
                                handlers["end"].forEach((fn) => fn());
                            }
                        },
                    };

                    // keep reference to handlers so external code can fire events
                    (session as any)._handlers = handlers;

                    // store sessions so the install function can notify them
                    polyfill._sessions.push(session);

                    res(session);
                });
            },
        } as any;

        polyfill._fireInputSourcesChange = function (detail: any) {
            const sessions = polyfill._sessions || [];
            for (const s of sessions) {
                const handlers = (s as any)._handlers as Record<string, Array<Function>> | undefined;
                if (handlers && handlers["inputsourceschange"]) {
                    for (const fn of handlers["inputsourceschange"]) {
                        try {
                            fn(detail);
                        } catch (e) {
                            // swallow
                        }
                    }
                }
            }
        };

        // install the polyfill on navigator.xr using defineProperty to override read-only property
        try {
            Object.defineProperty(win.navigator, 'xr', {
                value: polyfill,
                writable: true,
                configurable: true,
                enumerable: true
            });
        } catch (e) {
            // Fallback: try direct assignment
            (win as any).navigator.xr = polyfill;
        }

        return () => {
            try {
                if (originalNavigatorXR) {
                    // Restore original xr property
                    try {
                        Object.defineProperty(win.navigator, 'xr', {
                            value: originalNavigatorXR,
                            writable: true,
                            configurable: true,
                            enumerable: true
                        });
                    } catch (e) {
                        (win as any).navigator.xr = originalNavigatorXR;
                    }
                } else if ((win as any).navigator && (win as any).navigator.xr && (win as any).navigator.xr._simulated) {
                    try {
                        // Try to delete the property
                        delete (win as any).navigator.xr;
                    } catch (e) {
                        // If deletion fails, set to undefined
                        try {
                            Object.defineProperty(win.navigator, 'xr', {
                                value: undefined,
                                writable: true,
                                configurable: true,
                                enumerable: true
                            });
                        } catch (e2) {
                            (win as any).navigator.xr = undefined;
                        }
                    }
                }
            } catch (e) {
                // ignore
            }
        };
    } catch (e) {
        console.error("Failed to install simulated WebXR polyfill", e);
        return () => {
            // noop
        };
    }
}
