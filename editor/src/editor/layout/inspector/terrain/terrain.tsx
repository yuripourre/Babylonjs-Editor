import { Component, ReactNode } from "react";

import { TerrainMesh } from "../../../nodes/terrain";
import { isTerrain } from "../../../../tools/guards/nodes";
import { onNodeModifiedObservable } from "../../../../tools/observables";

import { EditorInspectorStringField } from "../fields/string";
import { EditorInspectorVectorField } from "../fields/vector";
import { EditorInspectorSectionField } from "../fields/section";

import { ScriptInspectorComponent } from "../script/script";
import { CustomMetadataInspector } from "../metadata/custom-metadata";

import { IEditorInspectorImplementationProps } from "../inspector";
import { TerrainPropertiesInspector } from "./properties";
import { TerrainSculptingInspector } from "./sculpting";

export class EditorTerrainInspector extends Component<IEditorInspectorImplementationProps<TerrainMesh>> {
	/**
	 * Returns whether or not the given object is supported by this inspector.
	 */
	public static IsSupported(object: unknown): boolean {
		return isTerrain(object);
	}

	/**
	 * Renders the component
	 */
	public render(): ReactNode {
		return (
			<>
				<EditorInspectorSectionField title="Common">
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Type</div>
						<div className="text-white/50">{this.props.object.getClassName()}</div>
					</div>

					<EditorInspectorStringField
						label="Name"
						object={this.props.object}
						property="name"
						onChange={() => onNodeModifiedObservable.notifyObservers(this.props.object)}
					/>
				</EditorInspectorSectionField>

				<EditorInspectorSectionField title="Transforms">
					<EditorInspectorVectorField
						label={<div className="w-14">Position</div>}
						object={this.props.object}
						property="position"
					/>

					<EditorInspectorVectorField
						label={<div className="w-14">Rotation</div>}
						object={this.props.object}
						property="rotation"
						asDegrees
					/>

					<EditorInspectorVectorField
						label={<div className="w-14">Scaling</div>}
						object={this.props.object}
						property="scaling"
					/>
				</EditorInspectorSectionField>

				<TerrainPropertiesInspector {...this.props} />

				<TerrainSculptingInspector editor={this.props.editor} object={this.props.object} />

				<ScriptInspectorComponent editor={this.props.editor} object={this.props.object} />

				<CustomMetadataInspector object={this.props.object} />
			</>
		);
	}
}
