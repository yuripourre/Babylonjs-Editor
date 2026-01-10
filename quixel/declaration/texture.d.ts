import { PBRMaterial } from "babylonjs";
import { Editor } from "babylonjs-editor";
import { QuixelJsonType } from "./typings";
export declare function setupTextures(editor: Editor, json: QuixelJsonType, material: PBRMaterial, assetsFolder: string): Promise<never[] | undefined>;
export declare function copyTextures(editor: Editor, json: QuixelJsonType, assetsFolder: string): Promise<void>;
