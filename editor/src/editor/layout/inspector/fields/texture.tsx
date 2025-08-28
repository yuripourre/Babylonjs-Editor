import { extname, join, dirname } from "path/posix";

import sharp from "sharp";
import { readJSON } from "fs-extra";
import "babylonjs-procedural-textures";
import { UniqueNumber } from "../../../../tools/tools";

import { Component, DragEvent, PropsWithChildren, ReactNode } from "react";

import { SiDotenv } from "react-icons/si";
import { IoIosColorPalette } from "react-icons/io";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { MdOutlineQuestionMark } from "react-icons/md";

import { CubeTexture, Scene, Texture, ColorGradingTexture } from "babylonjs";

import { isScene } from "../../../../tools/guards/scene";
import { registerUndoRedo } from "../../../../tools/undoredo";
import { updateIblShadowsRenderPipeline } from "../../../../tools/light/ibl";
import { onSelectedAssetChanged, onTextureAddedObservable } from "../../../../tools/observables";
import { isColorGradingTexture, isCubeTexture, isTexture } from "../../../../tools/guards/texture";

import { projectConfiguration } from "../../../../project/configuration";

import { configureImportedTexture } from "../../preview/import/import";

import { EXRIcon } from "../../../../ui/icons/exr";
import { SpinnerUIComponent } from "../../../../ui/spinner";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../ui/shadcn/ui/popover";

import { EditorInspectorListField } from "./list";
import { EditorInspectorNumberField } from "./number";
import { EditorInspectorSwitchField } from "./switch";
import { EditorInspectorSectionField } from "./section";

import { ProceduralTextureThumbnailRenderer } from "../../assets-browser/renderers/procedural-texture-thumbnail";
import { isProceduralTexture, updateTexture, renderProceduralTextureProperties, getProceduralTextureType } from "./procedural-texture";

export interface IEditorInspectorTextureFieldProps extends PropsWithChildren {
	title: string;
	property: string;
	accept3dlTexture?: boolean;
	acceptCubeTexture?: boolean;
	object: any;

	noUndoRedo?: boolean;

	hideLevel?: boolean;
	hideSize?: boolean;

	scene?: Scene;
	onChange?: (texture: Texture | CubeTexture | ColorGradingTexture | null) => void;
}

export interface IEditorInspectorTextureFieldState {
	dragOver: boolean;
	previewTemporaryUrl: string | null;
}

const TEXTURE_WIDTH = 128;
const TEXTURE_HEIGHT = 128;

const WRAP_MODE_ITEMS = [
	{ text: "Wrap", value: Texture.WRAP_ADDRESSMODE },
	{ text: "Clamp", value: Texture.CLAMP_ADDRESSMODE },
	{ text: "Mirror", value: Texture.MIRROR_ADDRESSMODE },
];

const COORDINATES_MODE_ITEMS = [

	{ text: "Explicit", value: Texture.EXPLICIT_MODE },
	{ text: "Spherical", value: Texture.SPHERICAL_MODE },
	{ text: "Planar", value: Texture.PLANAR_MODE },
	{ text: "Cubic", value: Texture.CUBIC_MODE },
	{ text: "Projection", value: Texture.PROJECTION_MODE },
	{ text: "Skybox", value: Texture.SKYBOX_MODE },
	{ text: "Inversed Cubic", value: Texture.INVCUBIC_MODE },
	{ text: "Equirectangular", value: Texture.EQUIRECTANGULAR_MODE },
	{ text: "Fixed Equirectangular", value: Texture.FIXED_EQUIRECTANGULAR_MODE },
	{ text: "Equirectangular Mirrored", value: Texture.FIXED_EQUIRECTANGULAR_MIRRORED_MODE },
];

export class EditorInspectorTextureField extends Component<IEditorInspectorTextureFieldProps, IEditorInspectorTextureFieldState> {

	public constructor(props: IEditorInspectorTextureFieldProps) {
		super(props);

		this.state = {
			dragOver: false,
			previewTemporaryUrl: null,
		};

		this._computeTemporaryPreview();
	}

	public componentDidUpdate(prevProps: IEditorInspectorTextureFieldProps): void {
		const prevTexture = prevProps.object[prevProps.property];
		const currentTexture = this.props.object[this.props.property];

		if (prevTexture !== currentTexture) {
			this._computeTemporaryPreview();
		}
	}

	public render(): ReactNode {
		const texture = this.props.object[this.props.property] as Texture | CubeTexture | ColorGradingTexture;
		const textureUrl = (isTexture(texture) || isCubeTexture(texture) || isColorGradingTexture(texture)) && texture.url;

		return (
			<div
				onDrop={(ev) => this._handleDrop(ev)}
				onDragOver={(ev) => this._handleDragOver(ev)}
				onDragLeave={(ev) => this._handleDragLeave(ev)}
				className={`flex flex-col w-full p-5 rounded-lg ${this.state.dragOver ? "bg-muted-foreground/75 dark:bg-muted-foreground/20" : "bg-muted-foreground/10 dark:bg-muted-foreground/5"} transition-all duration-300 ease-in-out`}
			>
				<div className="flex gap-4 w-full">
					{texture && this._getPreviewComponent(textureUrl)}

					{!texture && this._getPreviewComponent(textureUrl)}

					<div className="flex flex-col w-full">
						<div className="px-2">{this.props.title}</div>

						{textureUrl && (
							<div className="flex flex-col gap-1 mt-1 w-full">
								{!this.props.hideLevel && (
									<EditorInspectorNumberField
										noUndoRedo={this.props.noUndoRedo}
										label="Level"
										object={texture}
										property="level"
										onChange={() => this.props.onChange?.(texture)}
										onFinishChange={() => this.props.onChange?.(texture)}
									/>
								)}

								{isTexture(texture) && (
									<>
										{!this.props.hideSize && (
											<EditorInspectorNumberField
												noUndoRedo={this.props.noUndoRedo}
												label="Size"
												object={texture}
												property="uScale"
												onChange={(v) => (texture.vScale = v)}
												onFinishChange={() => this.props.onChange?.(texture)}
											/>
										)}
										{/* Only show Invert Y for non-procedural textures */}
										{(() => {
											const isProcedural = isProceduralTexture(texture);

											if (!isProcedural) {
												return (
													<EditorInspectorSwitchField
														noUndoRedo={this.props.noUndoRedo}
														label="Invert Y"
														object={texture}
														property="_invertY"
														onChange={() => {
															this._handleReloadTexture(texture);
															this.props.onChange?.(texture);
														}}
													/>
												);
											}
											return null;
										})()}
									</>
								)}

								{isCubeTexture(texture) && (
									<>
										<EditorInspectorNumberField
											label="Rotation Y"
											object={texture}
											property="rotationY"
											onFinishChange={() => this.props.onChange?.(texture)}
										/>
									</>
								)}
							</div>
						)}
					</div>
					<div
						onClick={() => {
							const oldTexture = this.props.object[this.props.property];

							this.props.object[this.props.property] = null;
							this.props.onChange?.(null);

							if (!this.props.noUndoRedo) {
								registerUndoRedo({
									executeRedo: true,
									undo: () => {
										this.props.object[this.props.property] = oldTexture;
										this._computeTemporaryPreview();
									},
									redo: () => {
										this.props.object[this.props.property] = null;
									},
								});
							}

							this.forceUpdate();
						}}
						className="flex justify-center items-center w-24 h-full hover:bg-muted-foreground rounded-lg transition-all duration-300"
					>
						{texture && <XMarkIcon className="w-6 h-6" />}
					</div>
				</div>

				{texture && this.props.children}
			</div>
		);
	}

	public componentWillUnmount(): void {
		if (this.state.previewTemporaryUrl) {
			URL.revokeObjectURL(this.state.previewTemporaryUrl);
		}
	}

	private _handleReloadTexture(texture: Texture | CubeTexture): void {
		if (isProceduralTexture(texture)) {
			return;
		}

		if (!projectConfiguration.path || !texture.url) {
			return;
		}

		const projectDir = join(dirname(projectConfiguration.path));
		const texturePath = texture.url.startsWith(projectDir) ? texture.url : join(projectDir, texture.url);

		texture.updateURL(texturePath);
		texture.url = texturePath.replace(join(projectDir, "/"), "");
	}

	private _getPreviewComponent(textureUrl: false | string | null): ReactNode {
		const texture = this.props.object[this.props.property];
		const isProcedural = texture && isProceduralTexture(texture);

		return (
			<div className={`flex justify-center items-center ${textureUrl || isProcedural ? "w-24 h-24" : "w-8 h-8"} aspect-square`}>
				{(textureUrl || isProcedural) && (
					<Popover>
						<PopoverTrigger>
							<>
								{isCubeTexture(texture) ? (
									<SiDotenv className="w-24 h-24" />
								) : isColorGradingTexture(texture) ? (
									<IoIosColorPalette className="w-24 h-24" />
								) : extname(textureUrl || "").toLowerCase() === ".exr" ? (
									<EXRIcon size="96px" />
								) : isProcedural ? (
									<ProceduralTextureThumbnailRenderer absolutePath={texture.url ? join(dirname(projectConfiguration.path!), texture.url) : ""} />
								) : this.state.previewTemporaryUrl ? (
									<img className="w-24 h-24 object-contain" src={this.state.previewTemporaryUrl} />
								) : (
									<SpinnerUIComponent width="64px" />
								)}
							</>
						</PopoverTrigger>
						<PopoverContent side="left">
							<>
								{isCubeTexture(texture)
									? this._getCubeTextureInspector()
									: isColorGradingTexture(texture)
										? this._getColorGradingTextureInspector()
										: this._getTextureInspector()}
							</>
						</PopoverContent>
					</Popover>
				)}

				{!textureUrl && !isProcedural && <MdOutlineQuestionMark className="w-8 h-8" />}
			</div>
		);
	}

	private _getCubeTextureInspector(): ReactNode {
		const texture = this.props.object[this.props.property] as CubeTexture;
		if (!isCubeTexture(texture)) {
			return;
		}

		return (
			<div className="flex flex-col gap-2 h-full">
				<EditorInspectorSectionField title="Common">
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Path</div>

						<div
							onClick={() => onSelectedAssetChanged.notifyObservers(join(dirname(projectConfiguration.path!), texture.name))}
							className="text-white/50 w-full text-end overflow-hidden whitespace-nowrap text-ellipsis underline-offset-2 cursor-pointer hover:underline"
						>
							{texture.name}
						</div>
					</div>

					<EditorInspectorSwitchField label="Gamma Space" object={texture} property="gammaSpace" onChange={() => this.props.onChange?.(texture)} />
					<EditorInspectorSwitchField label="Invert Z" object={texture} property="invertZ" onChange={() => this.props.onChange?.(texture)} />
				</EditorInspectorSectionField>

				<EditorInspectorSectionField title="Coordinates">
					<EditorInspectorNumberField
						noUndoRedo={this.props.noUndoRedo}
						label="Index"
						object={texture}
						property="coordinatesIndex"
						step={1}
						min={0}
						onChange={(v) => (texture.coordinatesIndex = Math.round(v))}
						onFinishChange={() => {
							this.forceUpdate();
							this.props.onChange?.(texture);
						}}
					/>

					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Mode"
						object={texture}
						property="coordinatesMode"
						onChange={() => {
							this.forceUpdate();
							this.props.onChange?.(texture);
						}}
						items={COORDINATES_MODE_ITEMS}
					/>
				</EditorInspectorSectionField>
			</div>
		);
	}

	private _getColorGradingTextureInspector(): ReactNode {
		const texture = this.props.object[this.props.property] as ColorGradingTexture;
		if (!isColorGradingTexture(texture)) {
			return;
		}

		return (
			<div className="flex flex-col gap-2 h-full">
				<EditorInspectorSectionField title="Common">
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Path</div>

						<div
							onClick={() => onSelectedAssetChanged.notifyObservers(join(dirname(projectConfiguration.path!), texture.name))}
							className="text-white/50 w-full text-end overflow-hidden whitespace-nowrap text-ellipsis underline-offset-2 cursor-pointer hover:underline"
						>
							{texture.name}
						</div>
					</div>
				</EditorInspectorSectionField>
			</div>
		);
	}

	private _getTextureInspector(): ReactNode {
		const texture = this.props.object[this.props.property] as Texture;
		if (!isTexture(texture)) {
			return;
		}

		if (isProceduralTexture(texture)) {
			return this._getProceduralTextureInspector(texture);
		}

		const o = {
			samplingMode: texture.samplingMode,
		};

		const onChange = () => {
			this.forceUpdate();
			this.props.onChange?.(texture);
		};

		return (
			<div className="flex flex-col gap-2 h-full">
				<EditorInspectorSectionField title="Common">
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Dimensions</div>

						<div className="text-white/50 w-full text-end">
							{texture.getSize().width}x{texture.getSize().height}
						</div>
					</div>
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Path</div>

						<div
							onClick={() => onSelectedAssetChanged.notifyObservers(join(dirname(projectConfiguration.path!), texture.name))}
							className="text-white/50 w-full text-end overflow-hidden whitespace-nowrap text-ellipsis underline-offset-2 cursor-pointer hover:underline"
						>
							{texture.name}
						</div>
					</div>
					<EditorInspectorSwitchField
						noUndoRedo={this.props.noUndoRedo}
						label="Gamma Space"
						object={texture}
						property="gammaSpace"
						onChange={() => this.props.onChange?.(texture)}
					/>
					<EditorInspectorSwitchField
						noUndoRedo={this.props.noUndoRedo}
						label="Get Alpha From RGB"
						object={texture}
						property="getAlphaFromRGB"
						onChange={() => this.props.onChange?.(texture)}
					/>
				</EditorInspectorSectionField>

				<EditorInspectorSectionField title="Scale">
					<EditorInspectorNumberField
						noUndoRedo={this.props.noUndoRedo}
						label="U Scale"
						object={texture}
						property="uScale"
						onChange={() => onChange()}
						onFinishChange={() => onChange()}
					/>
					<EditorInspectorNumberField
						noUndoRedo={this.props.noUndoRedo}
						label="V Scale"
						object={texture}
						property="vScale"
						onChange={() => onChange()}
						onFinishChange={() => onChange()}
					/>
				</EditorInspectorSectionField>
				<EditorInspectorSectionField title="Offset">
					<EditorInspectorNumberField noUndoRedo={this.props.noUndoRedo} label="U Offset" object={texture} property="uOffset" onFinishChange={() => onChange()} />
					<EditorInspectorNumberField noUndoRedo={this.props.noUndoRedo} label="V Offset" object={texture} property="vOffset" onFinishChange={() => onChange()} />
				</EditorInspectorSectionField>
				<EditorInspectorSectionField title="Coordinates">
					<EditorInspectorNumberField
						noUndoRedo={this.props.noUndoRedo}
						label="Index"
						object={texture}
						property="coordinatesIndex"
						step={1}
						min={0}
						onChange={(v) => (texture.coordinatesIndex = Math.round(v))}
						onFinishChange={() => onChange()}
					/>
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Mode"
						object={texture}
						property="coordinatesMode"
						onChange={() => onChange()}
						items={COORDINATES_MODE_ITEMS}
					/>
				</EditorInspectorSectionField>

				<EditorInspectorSectionField title="Sampling">
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Mode"
						object={o}
						property="samplingMode"
						onChange={(v) => {
							this.forceUpdate();
							texture.updateSamplingMode(v);
							this.props.onChange?.(texture);
						}}
						items={[
							{ text: "Nearest", value: Texture.NEAREST_SAMPLINGMODE },
							{ text: "Bilinear", value: Texture.BILINEAR_SAMPLINGMODE },
							{ text: "Trilinear", value: Texture.TRILINEAR_SAMPLINGMODE },
						]}
					/>
				</EditorInspectorSectionField>

				<EditorInspectorSectionField title="Wrap">
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Wrap U"
						object={texture}
						property="wrapU"
						onChange={() => onChange()}
						items={WRAP_MODE_ITEMS}
					/>
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Wrap V"
						object={texture}
						property="wrapV"
						onChange={() => onChange()}
						items={WRAP_MODE_ITEMS}
					/>
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Wrap R"
						object={texture}
						property="wrapR"
						onChange={() => onChange()}
						items={WRAP_MODE_ITEMS}
					/>
				</EditorInspectorSectionField>
			</div>
		);
	}

	private _getProceduralTextureInspector(texture: any): ReactNode {
		const textureType = getProceduralTextureType(texture);
		const onChange = () => {
			this.forceUpdate();
			this.props.onChange?.(texture);
		};

		return (
			<div className="flex flex-col gap-2 h-full">
				<EditorInspectorSectionField title="Common">
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Dimensions</div>
						<div className="text-white/50 w-full text-end">
							{texture.getSize().width}x{texture.getSize().height}
						</div>
					</div>
					<div className="flex justify-between items-center px-2 py-2">
						<div className="w-1/2">Type</div>
						<div className="text-white/50 w-full text-end">{textureType}</div>
					</div>
					<EditorInspectorSwitchField
						noUndoRedo={this.props.noUndoRedo}
						label="Gamma Space"
						object={texture}
						property="gammaSpace"
						onChange={() => this.props.onChange?.(texture)}
					/>
					<EditorInspectorSwitchField
						noUndoRedo={this.props.noUndoRedo}
						label="Get Alpha From RGB"
						object={texture}
						property="getAlphaFromRGB"
						onChange={() => this.props.onChange?.(texture)}
					/>
				</EditorInspectorSectionField>

				<EditorInspectorSectionField title="Scale">
					<EditorInspectorNumberField
						noUndoRedo={this.props.noUndoRedo}
						label="U Scale"
						object={texture}
						property="uScale"
						onChange={() => onChange()}
						onFinishChange={() => onChange()}
					/>
					<EditorInspectorNumberField
						noUndoRedo={this.props.noUndoRedo}
						label="V Scale"
						object={texture}
						property="vScale"
						onChange={() => onChange()}
						onFinishChange={() => onChange()}
					/>
				</EditorInspectorSectionField>
				<EditorInspectorSectionField title="Offset">
					<EditorInspectorNumberField noUndoRedo={this.props.noUndoRedo} label="U Offset" object={texture} property="uOffset" onFinishChange={() => onChange()} />
					<EditorInspectorNumberField noUndoRedo={this.props.noUndoRedo} label="V Offset" object={texture} property="vOffset" onFinishChange={() => onChange()} />
				</EditorInspectorSectionField>
				<EditorInspectorSectionField title="Wrap">
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Wrap U"
						object={texture}
						property="wrapU"
						onChange={() => onChange()}
						items={WRAP_MODE_ITEMS}
					/>
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Wrap V"
						object={texture}
						property="wrapV"
						onChange={() => onChange()}
						items={WRAP_MODE_ITEMS}
					/>
					<EditorInspectorListField
						noUndoRedo={this.props.noUndoRedo}
						label="Wrap R"
						object={texture}
						property="wrapR"
						onChange={() => onChange()}
						items={WRAP_MODE_ITEMS}
					/>
				</EditorInspectorSectionField>

				{/* Dynamic Procedural Texture Properties */}
				{this._getDynamicProceduralTextureProperties(texture)}
			</div>
		);
	}

	private _getDynamicProceduralTextureProperties(texture: any): ReactNode {
		const onChange = () => {
			this.forceUpdate();
			updateTexture(texture);
			this.props.onChange?.(texture);
		};

		// Use the helper function from procedural-texture.tsx
		return renderProceduralTextureProperties({
			texture,
			noUndoRedo: this.props.noUndoRedo,
			onChange,
			forceUpdate: () => this.forceUpdate(),
		});
	}

	private async _computeTemporaryPreview(): Promise<void> {
		const texture = this.props.object[this.props.property] as Texture;
		if (!isTexture(texture)) {
			return;
		}

		if (isProceduralTexture(texture)) {
			return;
		}

		if (!texture.url || extname(texture.url).toLowerCase() === ".exr") {
			return;
		}

		try {
			const path = join(dirname(projectConfiguration.path!), texture.url);
			const buffer = await sharp(path).resize(TEXTURE_WIDTH, TEXTURE_HEIGHT).toBuffer();

			if (this.state.previewTemporaryUrl) {
				URL.revokeObjectURL(this.state.previewTemporaryUrl);
			}

			this.setState({
				previewTemporaryUrl: URL.createObjectURL(new Blob([buffer])),
			});
		} catch (error) {
			console.warn("Failed to generate texture preview:", error);
		}
	}

	private _handleDragOver(ev: DragEvent<HTMLDivElement>): void {
		ev.preventDefault();
		this.setState({ dragOver: true });
	}

	private _handleDragLeave(ev: DragEvent<HTMLDivElement>): void {
		ev.preventDefault();
		this.setState({ dragOver: false });
	}

	private async _handleDrop(ev: DragEvent<HTMLDivElement>): Promise<void> {
		ev.preventDefault();
		this.setState({ dragOver: false });

		const absolutePath = JSON.parse(ev.dataTransfer.getData("assets"))[0];
		const extension = extname(absolutePath).toLowerCase();

		switch (extension) {
			case ".png":
			case ".webp":
			case ".jpg":
			case ".jpeg":
			case ".bmp":
			case ".exr":
				{
					const oldTexture = this.props.object[this.props.property];
					const newTexture = configureImportedTexture(
						new Texture(absolutePath, this.props.scene ?? (isScene(this.props.object) ? this.props.object : this.props.object.getScene()))
					);

					if (oldTexture !== newTexture) {
						this.props.object[this.props.property] = newTexture;
						this.props.onChange?.(newTexture);

						if (!this.props.noUndoRedo) {
							registerUndoRedo({
								executeRedo: true,
								undo: () => (this.props.object[this.props.property] = oldTexture),
								redo: () => (this.props.object[this.props.property] = newTexture),
								onLost: () => newTexture?.dispose(),
							});
						}

						onTextureAddedObservable.notifyObservers(newTexture);
					}

					this._computeTemporaryPreview();
				}
				break;

			case ".3dl":
				if (this.props.accept3dlTexture) {
					const oldTexture = this.props.object[this.props.property];
					const newTexture = configureImportedTexture(
						new ColorGradingTexture(absolutePath, this.props.scene ?? (isScene(this.props.object) ? this.props.object : this.props.object.getScene()))
					);

					if (oldTexture !== newTexture) {
						this.props.object[this.props.property] = newTexture;
						this.props.onChange?.(newTexture);

						if (!this.props.noUndoRedo) {
							registerUndoRedo({
								executeRedo: true,
								undo: () => (this.props.object[this.props.property] = oldTexture),
								redo: () => (this.props.object[this.props.property] = newTexture),
								onLost: () => newTexture?.dispose(),
							});
						}

						onTextureAddedObservable.notifyObservers(newTexture);
					}
				}
				break;

			case ".env":
				if (this.props.acceptCubeTexture) {
					const oldTexture = this.props.object[this.props.property];
					const newTexture = configureImportedTexture(
						CubeTexture.CreateFromPrefilteredData(absolutePath, this.props.scene ?? (isScene(this.props.object) ? this.props.object : this.props.object.getScene()))
					);

					const scene = newTexture.getScene();

					this.props.object[this.props.property] = newTexture;
					if (scene) {
						updateIblShadowsRenderPipeline(scene, true);
					}

					this.props.onChange?.(this.props.object[this.props.property]);

					if (oldTexture !== newTexture && !this.props.noUndoRedo) {
						registerUndoRedo({
							executeRedo: true,
							undo: () => {
								this.props.object[this.props.property] = oldTexture;
								if (scene) {
									updateIblShadowsRenderPipeline(scene, true);
								}
							},
							redo: () => {
								this.props.object[this.props.property] = newTexture;
								if (scene) {
									updateIblShadowsRenderPipeline(scene, true);
								}
							},
							onLost: () => newTexture?.dispose(),
						});
					}
				}
				break;

			case ".proceduraltexture":
				{
					let config: any = {};
					try {
						config = await readJSON(absolutePath);
					} catch (e) {
						config = {};
					}

					const scene = this.props.scene ?? (isScene(this.props.object) ? this.props.object : this.props.object.getScene());
					const oldTexture = this.props.object[this.props.property];

					const fileNameWithExt = absolutePath.split("/").pop() || "";
					const baseName = fileNameWithExt.replace(extname(absolutePath), "");
					const size = config.size ?? 512;

					// Get the correct procedural texture class based on config
					const textureType = config.customType || "BABYLON.PerlinNoiseProceduralTexture";
					const className = textureType.split(".").pop(); // Extract class name from "BABYLON.ClassName"

					// Import procedural textures module
					const proceduralTextures = await import("babylonjs-procedural-textures");
					const ProceduralTextureClass = (proceduralTextures as any)[className];

					if (!ProceduralTextureClass) {
						console.warn(`${className} class not found in babylonjs-procedural-textures.`);
						break;
					}

					const newTexture = new ProceduralTextureClass(baseName, size, scene) as Texture;

					newTexture.uniqueId = UniqueNumber.Get();

					const projectDir = join(dirname(projectConfiguration.path!), "/");
					const relativePath = absolutePath.replace(projectDir, "");
					newTexture.name = relativePath;
					newTexture.url = relativePath;

					if (oldTexture !== newTexture) {
						this.props.object[this.props.property] = newTexture;
						this.props.onChange?.(newTexture);

						if (!this.props.noUndoRedo) {
							registerUndoRedo({
								executeRedo: true,
								undo: () => (this.props.object[this.props.property] = oldTexture),
								redo: () => (this.props.object[this.props.property] = newTexture),
								onLost: () => newTexture?.dispose(),
							});
						}

						onTextureAddedObservable.notifyObservers(newTexture);

						(newTexture as any)._proceduralTextureType = className;
					}
				}
				break;
		}

		this.forceUpdate();
	}
}
