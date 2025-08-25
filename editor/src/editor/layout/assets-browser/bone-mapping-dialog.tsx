import { Component, ReactNode } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../ui/shadcn/ui/dialog";
import { Button } from "../../../ui/shadcn/ui/button";
import { Label } from "../../../ui/shadcn/ui/label";

export interface IBoneMappingDialogProps {
	/**
	 * Whether the dialog is open
	 */
	open: boolean;
	/**
	 * Called when the dialog should close
	 */
	onOpenChange: (open: boolean) => void;
	/**
	 * The mesh that has a skeleton
	 */
	mesh?: { name: string; uniqueId: number };
	/**
	 * The imported skeletons
	 */
	importedSkeletons?: { name: string; uniqueId: number }[];
	/**
	 * The editor reference for accessing scene data
	 */
	editor?: any;
}

export interface IBoneMappingDialogState {
	/**
	 * The selected source skeleton
	 */
	selectedSourceSkeleton: string;
	/**
	 * The selected target skeleton
	 */
	selectedTargetSkeleton: string;
	/**
	 * Bone mapping pairs
	 */
	boneMappings: Array<{ source: string; target: string }>;
	/**
	 * Source bones (from selected source skeleton)
	 */
	sourceBones: Array<{ id: string; label: string; value: string }>;
	/**
	 * Target bones (from selected target skeleton)
	 */
	targetBones: Array<{ id: string; label: string; value: string }>;
	/**
	 * Currently selected bones for pairing
	 */
	selectedSourceBone: string | null;
	selectedTargetBone: string | null;
	/**
	 * Hovered bone for tooltip
	 */
	hoveredBone: string | null;
}

export class BoneMappingDialog extends Component<IBoneMappingDialogProps, IBoneMappingDialogState> {
	public constructor(props: IBoneMappingDialogProps) {
		super(props);

		this.state = {
			selectedSourceSkeleton: "",
			selectedTargetSkeleton: "",
			boneMappings: [],
			sourceBones: [],
			targetBones: [],
			selectedSourceBone: null,
			selectedTargetBone: null,
			hoveredBone: null,
		};
	}

	public componentDidMount(): void {
		this._initializeDefaultSelections();
	}

	public componentDidUpdate(prevProps: IBoneMappingDialogProps): void {
		if (prevProps.importedSkeletons !== this.props.importedSkeletons) {
			this._initializeDefaultSelections();
		}
	}

	private _initializeDefaultSelections(): void {
		// Set default source skeleton to mesh skeleton
		this.setState({ selectedSourceSkeleton: "mesh" }, () => {
			this._loadSourceBones();
		});

		// Set default target skeleton (first available imported skeleton)
		if (this.props.importedSkeletons && this.props.importedSkeletons.length > 0) {
			const defaultTargetSkeleton = this.props.importedSkeletons[0].uniqueId.toString();
			this.setState({ selectedTargetSkeleton: defaultTargetSkeleton }, () => {
				this._loadTargetBones(defaultTargetSkeleton);
			});
		}
	}

	private _loadSourceBones(): void {
		try {
			// Get the actual mesh from the scene using the uniqueId
			const scene = this.props.editor?.layout?.preview?.scene;
			if (!scene) {
				console.warn("Scene not available for loading source bones");
				this.setState({ sourceBones: [] });
				return;
			}

			// Find the mesh by uniqueId
			const mesh = scene.meshes.find((m: any) => m.uniqueId === this.props.mesh?.uniqueId);
			if (!mesh || !mesh.skeleton) {
				console.warn("Mesh or skeleton not found for source bones");
				this.setState({ sourceBones: [] });
				return;
			}

			// Extract real bones from the mesh's skeleton
			const realSourceBones = mesh.skeleton.bones.map((bone: any) => ({
				id: bone.name || bone.id || `bone_${bone.uniqueId}`,
				label: bone.name || `Bone ${bone.uniqueId}`,
				value: bone.name || bone.id || `bone_${bone.uniqueId}`,
			}));

			console.log(`Loaded ${realSourceBones.length} real source bones from mesh skeleton:`, realSourceBones);
			this.setState({ sourceBones: realSourceBones });
		} catch (error) {
			console.error("Error loading source bones:", error);
			this.setState({ sourceBones: [] });
		}
	}

	private _loadTargetBones(skeletonId: string): void {
		try {
			// Get the actual scene
			const scene = this.props.editor?.layout?.preview?.scene;
			if (!scene) {
				console.warn("Scene not available for loading target bones");
				this.setState({ targetBones: [] });
				return;
			}

			// Find the skeleton by uniqueId
			const skeleton = scene.skeletons.find((s: any) => s.uniqueId.toString() === skeletonId);
			if (!skeleton) {
				console.warn(`Target skeleton with ID ${skeletonId} not found`);
				this.setState({ targetBones: [] });
				return;
			}

			// Extract real bones from the imported skeleton
			const realTargetBones = skeleton.bones.map((bone: any) => ({
				id: bone.name || bone.id || `bone_${bone.uniqueId}`,
				label: bone.name || `Bone ${bone.uniqueId}`,
				value: bone.name || bone.id || `bone_${bone.uniqueId}`,
			}));

			console.log(`Loaded ${realTargetBones.length} real target bones from imported skeleton:`, realTargetBones);
			this.setState({ targetBones: realTargetBones });
		} catch (error) {
			console.error("Error loading target bones:", error);
			this.setState({ targetBones: [] });
		}
	}

	private _handleSourceSkeletonChange = (skeletonId: string): void => {
		this.setState({ 
			selectedSourceSkeleton: skeletonId,
			boneMappings: [], // Reset mappings when skeleton changes
			selectedSourceBone: null,
			selectedTargetBone: null,
		});
		this._loadSourceBones();
	};

	private _handleTargetSkeletonChange = (skeletonId: string): void => {
		this.setState({ 
			selectedTargetSkeleton: skeletonId,
			boneMappings: [], // Reset mappings when skeleton changes
			selectedSourceBone: null,
			selectedTargetBone: null,
		});
		this._loadTargetBones(skeletonId);
	};

	private _handleSourceBoneClick = (boneId: string): void => {
		if (this.state.selectedTargetBone) {
			// Complete pairing
			const newPair = { source: boneId, target: this.state.selectedTargetBone };
			const updatedPairs = this.state.boneMappings.filter(
				(p) => p.source !== boneId && p.target !== this.state.selectedTargetBone
			);
			updatedPairs.push(newPair);
			this.setState({
				boneMappings: updatedPairs,
				selectedSourceBone: null,
				selectedTargetBone: null,
			});
		} else {
			this.setState({ selectedSourceBone: this.state.selectedSourceBone === boneId ? null : boneId });
		}
	};

	private _handleTargetBoneClick = (boneId: string): void => {
		if (this.state.selectedSourceBone) {
			// Complete pairing
			const newPair = { source: this.state.selectedSourceBone, target: boneId };
			const updatedPairs = this.state.boneMappings.filter(
				(p) => p.source !== this.state.selectedSourceBone && p.target !== boneId
			);
			updatedPairs.push(newPair);
			this.setState({
				boneMappings: updatedPairs,
				selectedSourceBone: null,
				selectedTargetBone: null,
			});
		} else {
			this.setState({ selectedTargetBone: this.state.selectedTargetBone === boneId ? null : boneId });
		}
	};

	private _isPaired = (boneId: string, side: "source" | "target"): boolean => {
		return this.state.boneMappings.some((pair) => 
			side === "source" ? pair.source === boneId : pair.target === boneId
		);
	};

	private _getPairedWith = (boneId: string, side: "source" | "target"): string | null => {
		const pair = this.state.boneMappings.find((p) => 
			side === "source" ? p.source === boneId : p.target === boneId
		);
		if (!pair) return null;

		const pairedId = side === "source" ? pair.target : pair.source;
		const bones = side === "source" ? this.state.targetBones : this.state.sourceBones;
		const pairedBone = bones.find((bone) => bone.id === pairedId);
		return pairedBone?.label || null;
	};

	public render(): ReactNode {
		const meshInfo = this.props.mesh ? `${this.props.mesh.name} (id: ${this.props.mesh.uniqueId})` : "No mesh selected";
		const selectedTargetSkeleton = this.props.importedSkeletons?.find(s => s.uniqueId.toString() === this.state.selectedTargetSkeleton);

		return (
			<Dialog open={this.props.open} onOpenChange={this.props.onOpenChange}>
				<DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Bone Mapping</DialogTitle>
						<DialogDescription>
							Map bones between the selected source and target skeletons.
							<br />
							<strong>Target Mesh:</strong> {meshInfo}
						</DialogDescription>
					</DialogHeader>

					{/* Skeleton Selection - Compact */}
					<div className="grid grid-cols-2 gap-6 mb-6">
						{/* Source Skeleton Selection */}
						<div>
							<Label htmlFor="source-skeleton">Source Skeleton (Mesh)</Label>
							<select
								id="source-skeleton"
								className="w-full mt-2 p-2 border rounded-md bg-background"
								value={this.state.selectedSourceSkeleton}
								onChange={(e) => this._handleSourceSkeletonChange(e.target.value)}
							>
								<option value="">Select source skeleton...</option>
								<option value="mesh">Mesh Skeleton ({this.props.mesh?.name})</option>
							</select>
						</div>

						{/* Target Skeleton Selection */}
						<div>
							<Label htmlFor="target-skeleton">Target Skeleton (Imported)</Label>
							<select
								id="target-skeleton"
								className="w-full mt-2 p-2 border rounded-md bg-background"
								value={this.state.selectedTargetSkeleton}
								onChange={(e) => this._handleTargetSkeletonChange(e.target.value)}
							>
								<option value="">Select target skeleton...</option>
								{this.props.importedSkeletons?.map((skeleton) => (
									<option key={skeleton.uniqueId} value={skeleton.uniqueId.toString()}>
										{skeleton.name} (id: {skeleton.uniqueId})
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Bone Pairing Interface - Always Visible */}
					<div className="relative w-full mx-auto">
						<div className="grid grid-cols-2 gap-8">
							{/* Source Bones Column */}
							<div className="space-y-2">
								<h3 className="text-xl text-center mb-4 text-green-400 font-semibold">
									Source Bones (Mesh Skeleton)
								</h3>
								<div className="max-h-96 overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-muted">
									{this.state.sourceBones.length > 0 ? (
										this.state.sourceBones.map((bone) => {
											const isSelected = this.state.selectedSourceBone === bone.id;
											const isItemPaired = this._isPaired(bone.id, "source");
											const pairedWith = this._getPairedWith(bone.id, "source");
											const shouldDim = this.state.selectedSourceBone && this.state.selectedSourceBone !== bone.id;

											return (
												<div key={bone.id} className="relative">
													<div
														className={`
															p-3 cursor-pointer transition-all duration-300 border rounded-md min-h-[2.5rem] w-full flex items-center justify-center
															${isSelected ? "border-green-400 bg-green-400/10" : ""}
															${isItemPaired ? "border-green-500 bg-green-500/5" : ""}
															${shouldDim ? "opacity-30 cursor-not-allowed" : ""}
															${!isSelected && !isItemPaired && !shouldDim ? "border-border hover:border-green-400/50" : ""}
														`}
														onClick={() => !shouldDim && this._handleSourceBoneClick(bone.id)}
														onMouseEnter={() => {
															if (isItemPaired && pairedWith) {
																this.setState({ hoveredBone: bone.id });
															}
														}}
														onMouseLeave={() => this.setState({ hoveredBone: null })}
													>
														<div className="text-sm font-medium text-foreground">{bone.label}</div>
													</div>
													{isItemPaired && pairedWith && this.state.hoveredBone === bone.id && (
														<div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-md whitespace-nowrap z-50 shadow-lg pointer-events-none">
															Paired with: {pairedWith}
														</div>
													)}
												</div>
											);
										})
									) : (
										<div className="text-center text-muted-foreground py-8">
											{this.state.selectedSourceSkeleton ? "Loading bones..." : "Select source skeleton to view bones"}
										</div>
									)}
								</div>
							</div>

							{/* Target Bones Column */}
							<div className="space-y-2">
								<h3 className="text-xl text-center mb-4 text-blue-400 font-semibold">
									Target Bones ({selectedTargetSkeleton?.name || "Selected Skeleton"})
								</h3>
								<div className="max-h-96 overflow-y-auto space-y-2 pl-2 border rounded-md p-2 bg-muted">
									{this.state.targetBones.length > 0 ? (
										this.state.targetBones.map((bone) => {
											const isSelected = this.state.selectedTargetBone === bone.id;
											const isItemPaired = this._isPaired(bone.id, "target");
											const pairedWith = this._getPairedWith(bone.id, "target");
											const shouldDim = this.state.selectedTargetBone && this.state.selectedTargetBone !== bone.id;

											return (
												<div key={bone.id} className="relative">
													<div
														className={`
															p-3 cursor-pointer transition-all duration-300 border rounded-md min-h-[2.5rem] w-full flex items-center justify-center
															${isSelected ? "border-blue-400 bg-blue-400/10" : ""}
															${isItemPaired ? "border-blue-500 bg-blue-500/5" : ""}
															${shouldDim ? "opacity-30 cursor-not-allowed" : ""}
															${!isSelected && !isItemPaired && !shouldDim ? "border-border hover:border-blue-400/50" : ""}
														`}
														onClick={() => !shouldDim && this._handleTargetBoneClick(bone.id)}
														onMouseEnter={() => {
															if (isItemPaired && pairedWith) {
																this.setState({ hoveredBone: bone.id });
															}
														}}
														onMouseLeave={() => this.setState({ hoveredBone: null })}
													>
														<div className="text-sm font-medium text-foreground">{bone.label}</div>
													</div>
													{isItemPaired && pairedWith && this.state.hoveredBone === bone.id && (
														<div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 bg-gray-900 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-md whitespace-nowrap z-50 shadow-lg pointer-events-none">
															Paired with: {pairedWith}
														</div>
													)}
												</div>
											);
										})
									) : (
										<div className="text-center text-muted-foreground py-8">
											{this.state.selectedTargetSkeleton ? "Loading bones..." : "Select target skeleton to view bones"}
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Pairing Instructions */}
						{(this.state.selectedSourceBone || this.state.selectedTargetBone) && (
							<div className="mt-6 text-center">
								<div className="text-sm text-muted-foreground">
									Select {this.state.selectedSourceBone ? "target" : "source"} bone to complete pairing
								</div>
							</div>
						)}

					</div>

					{/* Action Buttons */}
					<div className="flex justify-end gap-2 pt-6">
						<Button variant="outline" onClick={() => this.props.onOpenChange(false)}>
							Cancel
						</Button>
						<Button 
							onClick={this._handleApplyMapping}
							disabled={this.state.boneMappings.length === 0 || !this.state.selectedSourceSkeleton || !this.state.selectedTargetSkeleton}
						>
							Apply Mapping ({this.state.boneMappings.length} pairs)
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	private _handleApplyMapping = (): void => {
		// TODO: Implement actual bone mapping logic
		console.log("Applying bone mapping:", this.state.boneMappings);
		this.props.onOpenChange(false);
	};
}
