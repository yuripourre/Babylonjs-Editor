"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextureUtils = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const workers_1 = require("./workers");
class TextureUtils {
    /**
     * Merges the two given textures to the desized format.
     * @param a defines the reference to the first texture.
     * @param b defines the reference to the second texture.
     * @param rootFolder defines the root folder where to write the texture.
     * @param callback defines the callback called for each pixel that returns the final merged color.
     */
    static async MergeTextures(a, b, rootFolder, callback) {
        const aSize = a.getSize();
        const bSize = b.getSize();
        if (aSize.width !== bSize.width || aSize.height !== bSize.height) {
            return null;
        }
        const aBuffer = (await a.readPixels())?.buffer;
        if (!aBuffer) {
            return null;
        }
        const bBuffer = (await b.readPixels())?.buffer;
        if (!bBuffer) {
            return null;
        }
        const aPixels = new Uint8ClampedArray(aBuffer);
        const bPixels = new Uint8ClampedArray(bBuffer);
        if (aPixels.length !== bPixels.length) {
            return null;
        }
        const worker = await workers_1.WorkerTools.AddWorker("textureMerger.js");
        const result = await workers_1.WorkerTools.Compute(worker, "compute", {
            aPixels,
            bPixels,
            callback: `return ${callback.toString()}`,
        });
        worker.terminate();
        const blob = await this._convertPixelsToBlobImage(aSize, new Uint8ClampedArray(result));
        if (!blob) {
            return null;
        }
        const name = `${(0, path_1.basename)(a.name).replace((0, path_1.extname)(a.name), "")}_${(0, path_1.basename)(b.name).replace((0, path_1.extname)(b.name), "")}.png`;
        const dest = (0, path_1.join)(rootFolder, name);
        await (0, fs_extra_1.writeFile)(dest, Buffer.from(await blob.arrayBuffer()));
        return dest;
    }
    /**
     * Converts the given pixels to a readable blob image.
     */
    static async _convertPixelsToBlobImage(size, pixels) {
        // Base canvas
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d");
        if (!context) {
            return null;
        }
        const imageData = new ImageData(pixels, canvas.width, canvas.height);
        context.putImageData(imageData, 0, 0);
        // Final canvas
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = size.width;
        finalCanvas.height = size.height;
        const finalContext = finalCanvas.getContext("2d");
        if (!finalContext) {
            return null;
        }
        finalContext.transform(1, 0, 0, -1, 0, canvas.height);
        finalContext.drawImage(canvas, 0, 0);
        const blob = await this._canvasToBlob(finalCanvas);
        context.restore();
        finalContext.restore();
        canvas.remove();
        finalCanvas.remove();
        return blob;
    }
    /**
     * Converts the given canvas data to blob.
     */
    static async _canvasToBlob(canvas) {
        return new Promise((resolve) => {
            babylonjs_1.Tools.ToBlob(canvas, (b) => resolve(b));
        });
    }
}
exports.TextureUtils = TextureUtils;
//# sourceMappingURL=textureMerger.js.map