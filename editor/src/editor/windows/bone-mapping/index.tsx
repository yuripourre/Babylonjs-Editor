import { Component, ReactNode } from "react";

import { ToolbarComponent } from "../../../ui/toolbar";
import { Toaster } from "../../../ui/shadcn/ui/sonner";

export interface IBoneMappingWindowProps {
	mesh?: { name: string; uniqueId: number };
	importedSkeletons?: { name: string; uniqueId: number }[];
}

export default class BoneMappingWindow extends Component<IBoneMappingWindowProps> {
	public render(): ReactNode {
		const meshInfo = this.props.mesh ? `${this.props.mesh.name} (id: ${this.props.mesh.uniqueId})` : "No mesh selected";

		return (
			<>
				<div className="flex flex-col w-screen h-screen">
					<ToolbarComponent>
						<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
							<div className="flex items-center gap-1 font-semibold text-lg select-none">
								Bone Mapping
								<div className="text-sm font-thin ml-2">{meshInfo}</div>
							</div>
						</div>
					</ToolbarComponent>

					<div className="flex flex-col w-full h-full justify-center items-center gap-4">
						<div className="text-2xl font-bold">Bone Mapping (Placeholder)</div>
						<div className="text-lg">This window will be used to map bones between the two skeletons.</div>
						<div>
							<strong>Imported skeletons:</strong>
							<ul className="list-disc list-inside text-left mt-2">
								{this.props.importedSkeletons?.map((s) => (
									<li key={s.uniqueId}>{s.name} (id: {s.uniqueId})</li>
								)) ?? <li>None</li>}
							</ul>
						</div>
					</div>
				</div>

				<Toaster />
			</>
		);
	}
}
