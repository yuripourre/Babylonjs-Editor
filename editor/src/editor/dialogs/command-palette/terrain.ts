import { Node } from "babylonjs";

import { Editor } from "../../main";

import { addTerrain } from "../../../project/add/terrain";

import { terrainCommandItems } from "./shared-commands";
import { ICommandPaletteType } from "./command-palette";

export function getTerrainCommands(editor?: Editor, parent?: Node): ICommandPaletteType[] {
	return [
		{
			...terrainCommandItems.terrain,
			action: () => editor && addTerrain(editor, parent),
		},
	];
}
