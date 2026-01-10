import { PBRMaterial } from "babylonjs";
import { Editor } from "babylonjs-editor";
import { QuixelJsonType } from "./typings";
export declare function importMaterial(editor: Editor, json: QuixelJsonType, assetsFolder: string): Promise<PBRMaterial | null>;
export declare function importMaterialTextures(editor: Editor, json: QuixelJsonType, assetsFolder: string, material: PBRMaterial): Promise<null | undefined>;
