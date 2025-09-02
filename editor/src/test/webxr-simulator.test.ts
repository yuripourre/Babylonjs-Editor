import { installSimulatedWebXR, ISimulatedGamepad } from "../tools/webxr/polyfill";

describe("webxr simulator polyfill", () => {
    test("should report immersive-vr as supported and create session with inputSources", async () => {
        // head pose
        const headPose = { position: { x: 1, y: 2, z: 3 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };

        // controller states
        let leftGamepad: ISimulatedGamepad = { axes: [0.5, -0.5], buttons: [{ pressed: true, value: 0.3 }, { pressed: false, value: 0 }] };
        let rightGamepad: ISimulatedGamepad = { axes: [0.1, 0.2], buttons: [{ pressed: false, value: 0 }, { pressed: true, value: 1 }] };

        const uninstall = installSimulatedWebXR({
            getHeadPose: () => headPose,
            getLeftGamepad: () => leftGamepad,
            getRightGamepad: () => rightGamepad,
        });

        try {
            // isSessionSupported
            const supported = await (window as any).navigator.xr.isSessionSupported("immersive-vr");
            expect(supported).toBe(true);

            const session = await (window as any).navigator.xr.requestSession("immersive-vr");
            expect(session).toBeDefined();
            expect(session.inputSources).toBeInstanceOf(Array);
            expect(session.inputSources.length).toBe(2);

            // gamepad reads
            const gpLeft = session.inputSources[0].gamepad;
            expect(gpLeft).toBeDefined();
            expect(gpLeft.axes[0]).toBeCloseTo(leftGamepad.axes[0]);
            expect(gpLeft.axes[1]).toBeCloseTo(leftGamepad.axes[1]);
            expect(gpLeft.buttons[0].value).toBeCloseTo(leftGamepad.buttons[0].value);

            // frame callback returns viewer pose
            const pose = await new Promise<any>((resolve, reject) => {
                const id = session.requestAnimationFrame((_time: number, frame: any) => {
                    try {
                        const p = frame.getViewerPose(null);
                        resolve(p);
                    } catch (e) {
                        reject(e);
                    }
                });

                // safety timeout
                setTimeout(() => {
                    try {
                        session.cancelAnimationFrame(id);
                    } catch (e) {
                        // ignore
                    }
                }, 1000);
            });

            expect(pose).toBeDefined();
            expect(pose.views && pose.views.length >= 1).toBeTruthy();
            const view = pose.views[0];
            expect(view.transform).toBeDefined();
            expect(view.transform.position.x).toBeCloseTo(headPose.position.x);
            expect(view.transform.position.y).toBeCloseTo(headPose.position.y);
            expect(view.transform.position.z).toBeCloseTo(headPose.position.z);

            // changing gamepad values should be reflected
            leftGamepad.axes[0] = 0.9;
            const gpLeft2 = session.inputSources[0].gamepad;
            expect(gpLeft2.axes[0]).toBeCloseTo(0.9);

            // test inputsourceschange handler invocation via polyfill helper call
            let called = false;
            const onChange = () => {
                called = true;
            };

            session.addEventListener("inputsourceschange", onChange);

            // notify via navigator.xr polyfill method
            const poly: any = (window as any).navigator.xr;
            if (poly && typeof poly._fireInputSourcesChange === "function") {
                poly._fireInputSourcesChange({ added: [], removed: [] });
            }

            await new Promise((r) => setTimeout(r, 50));

            expect(called).toBe(true);

            // end session
            if (session && session.end) {
                await session.end();
            }
        } finally {
            uninstall();
        }
    });
});
