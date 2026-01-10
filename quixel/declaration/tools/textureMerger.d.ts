import { Texture } from "babylonjs";
export interface IMergedColor {
    /**
     * Defines the value of the red channel for the pixel.
     */
    r: number;
    /**
     * Defines the value of the green channel for the pixel.
     */
    g: number;
    /**
     * Defines the value of the blue channel for the pixel.
     */
    b: number;
    /**
     * Defines the value of the alpha channel for the pixel.
     */
    a: number;
}
export declare class TextureUtils {
    /**
     * Merges the two given textures to the desized format.
     * @param a defines the reference to the first texture.
     * @param b defines the reference to the second texture.
     * @param rootFolder defines the root folder where to write the texture.
     * @param callback defines the callback called for each pixel that returns the final merged color.
     */
    static MergeTextures(a: Texture, b: Texture, rootFolder: string, callback: (color1: IMergedColor, color2: IMergedColor) => IMergedColor): Promise<string | null>;
    /**
     * Converts the given pixels to a readable blob image.
     */
    private static _convertPixelsToBlobImage;
    /**
     * Converts the given canvas data to blob.
     */
    private static _canvasToBlob;
}
