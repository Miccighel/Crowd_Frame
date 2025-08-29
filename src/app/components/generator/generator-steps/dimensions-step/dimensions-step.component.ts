/* Core */
import {Component, EventEmitter, OnInit, Output} from "@angular/core";
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";
/* Services */
import {ConfigService} from "../../../../services/config.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
import {S3Service} from "src/app/services/aws/s3.service";
/* Models */
import {Dimension, Mapping} from "src/app/models/skeleton/dimension";

interface ScaleType {
    value: string;
    viewValue: string;
}

interface StyleType {
    value: string;
    viewValue: string;
}

interface PositionType {
    value: string;
    viewValue: string;
}

interface OrientationType {
    value: string;
    viewValue: string;
}

@Component({
    selector: "app-dimensions-step",
    templateUrl: "./dimensions-step.component.html",
    styleUrls: ["../../generator.component.scss"],
    standalone: false,
})
export class DimensionsStepComponent implements OnInit {
    configService: ConfigService;
    S3Service: S3Service;
    localStorageService: LocalStorageService;

    dataStored: Array<Dimension> = [];
    formStep: UntypedFormGroup;

    scaleTypes: ScaleType[] = [
        {value: "categorical", viewValue: "Categorical"},
        {value: "interval", viewValue: "Interval"},
        {value: "magnitude_estimation", viewValue: "Magnitude Estimation"},
    ];
    styleTypes: StyleType[] = [
        {value: "list", viewValue: "List"},
        {value: "matrix", viewValue: "Matrix"},
    ];
    positionTypes: PositionType[] = [
        {value: "top", viewValue: "Top"},
        {value: "middle", viewValue: "Middle"},
        {value: "bottom", viewValue: "Bottom"},
    ];
    orientationTypes: OrientationType[] = [
        {value: "horizontal", viewValue: "Horizontal"},
        {value: "vertical", viewValue: "Vertical"},
    ];

    configurationSerialized = "";

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: UntypedFormBuilder
    ) {
        this.configService = configService;
        this.S3Service = S3Service;
        this.localStorageService = localStorageService;
        this.initializeControls();
    }

    public initializeControls() {
        this.dataStored = [];
        this.formStep = this._formBuilder.group({
            dimensions: this._formBuilder.array([]),
        });
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    public async ngOnInit() {
        const serializedDimensions = Object.keys(localStorage).filter((key) =>
            key.startsWith("dimension-")
        );

        if (serializedDimensions.length > 0) {
            serializedDimensions.forEach((key) => {
                const index = key.split("-")[1];
                const item = this.localStorageService.getItem(`dimension-${index}`);
                this.dataStored.push(new Dimension(parseInt(index, 10), JSON.parse(item)));
            });
            this.dataStored.sort((a, b) => (a.index > b.index ? 1 : -1));
        } else {
            this.initializeControls();
            const rawDimensions = await this.S3Service.downloadDimensions(
                this.configService.environment
            );
            rawDimensions.forEach((data, index) => {
                const dimension = new Dimension(index, data);
                this.dataStored.push(dimension);
                this.localStorageService.setItem(
                    `dimension-${index}`,
                    JSON.stringify(dimension)
                );
            });
        }

        this.formStep = this._formBuilder.group({
            dimensions: this._formBuilder.array([]),
        });

        if (this.dataStored.length > 0) {
            this.dataStored.forEach((dimension, dimensionIndex) => {
                this.addDimension(dimensionIndex, dimension);
            });
        }

        this.formStep.valueChanges.subscribe(() => this.serializeConfiguration());
        this.serializeConfiguration();
        this.formEmitter.emit(this.formStep);
    }

    dimensions(): UntypedFormArray {
        return this.formStep?.get("dimensions") as UntypedFormArray;
    }

    addDimension(dimensionIndex: number | null = null, dimension: Dimension | null = null) {
        let name = dimension?.name ?? "";
        let name_pretty = dimension?.name_pretty ?? "";
        let description = dimension?.description ?? "";
        let example = dimension?.example ?? "";
        let gold = !!dimension?.gold;

        const setJustification = !!dimension?.justification;
        let justification = this._formBuilder.group({text: "", min_words: ""});
        if (dimension?.justification) {
            justification = this._formBuilder.group({
                text: [dimension.justification.text, [Validators.required]],
                min_words: [dimension.justification.min_words, [Validators.required]],
            });
        }

        const setUrl = !!dimension?.url;
        let url = this._formBuilder.group({
            enable: "",
            setInstructions: false,
            instructions: this._formBuilder.group({
                caption: "",
                label: "",
                text: "",
            }),
        });
        if (dimension?.url) {
            const urlConfig: any = {
                enable: [dimension.url.enable, [Validators.required]],
                setInstructions: !!dimension.url["instructions"],
            };
            urlConfig["instructions"] = this._formBuilder.group({
                caption: dimension.url.instructions?.["caption"] ?? "",
                label: dimension.url.instructions?.["label"] ?? "",
                text: dimension.url.instructions?.["text"] ?? "",
            });
            url = this._formBuilder.group(urlConfig);
        }

        const setScale = !!dimension?.scale;
        let scale = this._formBuilder.group({
            type: "",
            setMultipleSelection: false,
            multiple_selection: false,
            setInstructions: false,
            instructions: this._formBuilder.group({
                caption: "",
                label: "",
                text: "",
            }),
            min: "",
            max: "",
            step: "",
            mapping: this._formBuilder.array([]),
        });
        if (dimension?.scale) {
            const scaleConfig: any = {
                type: [dimension.scale.type, [Validators.required]],
                setMultipleSelection: !!dimension.scale["multiple_selection"],
                multiple_selection: dimension.scale["multiple_selection"] ?? false,
                setInstructions: !!dimension.scale["instructions"],
                min: dimension.scale["min"] ? [dimension.scale["min"], [Validators.required]] : "",
                max: dimension.scale["max"] ? [dimension.scale["max"], [Validators.required]] : "",
                step: dimension.scale["step"] ? [dimension.scale["step"], [Validators.required]] : "",
                mapping: this._formBuilder.array([]),
            };
            scaleConfig["instructions"] = this._formBuilder.group({
                caption: dimension.scale.instructions?.["caption"] ?? "",
                label: dimension.scale.instructions?.["label"] ?? "",
                text: dimension.scale.instructions?.["text"] ?? "",
            });
            scale = this._formBuilder.group(scaleConfig);
        }

        const setStyle = !!dimension?.style;
        let style = this._formBuilder.group({
            styleType: "",
            position: "",
            orientation: "",
            separator: "",
        });
        if (dimension?.style) {
            style = this._formBuilder.group({
                styleType: [dimension.style.type, [Validators.required]],
                position: [dimension.style.position, [Validators.required]],
                orientation: [dimension.style.orientation, [Validators.required]],
                separator: [dimension.style.separator],
            });
        }

        this.dimensions().push(
            this._formBuilder.group({
                name: [name, [Validators.pattern("[a-zA-Z0-9-]*"), Validators.required]],
                name_pretty,
                description,
                example,
                gold,
                setJustification,
                justification,
                setUrl,
                url,
                setScale,
                scale,
                setStyle,
                style,
            })
        );

        if (dimension) {
            if (dimension.scale?.type === "categorical") {
                if (dimension.scale["mapping"]) {
                    for (const mapping of dimension.scale["mapping"]) {
                        this.addDimensionMapping(dimensionIndex!, mapping);
                    }
                }
                if (this.dimensionMapping(dimensionIndex!).length === 0) {
                    this.addDimensionMapping(dimensionIndex!);
                }
            }
            if (dimension.style) this.updateStyleType(dimensionIndex!);
        }
    }

    removeDimension(dimensionIndex: number) {
        this.dimensions().removeAt(dimensionIndex);
    }

    resetJustification(dimensionIndex: number) {
        const dim = this.dimensions()?.at(dimensionIndex);
        dim?.get("justification")?.get("text")?.setValue("");
        dim?.get("justification")?.get("min_words")?.setValue("");

        if (dim?.get("setJustification")?.value === false) {
            dim?.get("justification")?.get("text")?.clearValidators();
            dim?.get("justification")?.get("min_words")?.clearValidators();
        } else {
            dim?.get("justification")?.get("text")?.setValidators(Validators.required);
            dim?.get("justification")?.get("min_words")?.setValidators(Validators.required);
        }
        dim?.get("justification")?.get("text")?.updateValueAndValidity();
        dim?.get("justification")?.get("min_words")?.updateValueAndValidity();
    }

    resetUrl(dimensionIndex: number) {
        this.instructionsUrl(dimensionIndex)?.get("label")?.setValue("");
        this.instructionsUrl(dimensionIndex)?.get("caption")?.setValue("");
        this.instructionsUrl(dimensionIndex)?.get("text")?.setValue("");
        this.instructionsUrl(dimensionIndex)?.get("text")?.updateValueAndValidity();
    }

    instructionsUrl(dimensionIndex: number): UntypedFormGroup {
        const dim = this.dimensions()?.at(dimensionIndex);
        return dim?.get("url")?.get("instructions") as UntypedFormGroup;
    }

    resetInstructionUrl(dimensionIndex: number) {
        this.instructionsUrl(dimensionIndex)?.get("label")?.setValue("");
        this.instructionsUrl(dimensionIndex)?.get("caption")?.setValue("");
        this.instructionsUrl(dimensionIndex)?.get("text")?.setValue("");
        this.instructionsUrl(dimensionIndex)?.get("text")?.updateValueAndValidity();
    }

    resetScale(dimensionIndex: number) {
        this.updateScale(dimensionIndex);
        this.updateStyleType(dimensionIndex);
    }

    updateScale(dimensionIndex: number) {
        const dim = this.dimensions()?.at(dimensionIndex);

        if (dim?.get("setScale")?.value === false) {
            dim?.get("scale")?.get("type")?.clearValidators();
            dim?.get("setStyle")?.setValue(false);
            dim?.get("setStyle")?.disable();
        } else {
            dim?.get("scale")?.get("type")?.setValidators(Validators.required);
        }

        dim?.get("scale")?.get("min")?.setValue("");
        dim?.get("scale")?.get("min")?.clearValidators();
        dim?.get("scale")?.get("min")?.updateValueAndValidity();

        dim?.get("scale")?.get("max")?.setValue("");
        dim?.get("scale")?.get("max")?.clearValidators();
        dim?.get("scale")?.get("max")?.updateValueAndValidity();

        dim?.get("scale")?.get("step")?.setValue("");
        dim?.get("scale")?.get("step")?.clearValidators();
        dim?.get("scale")?.get("step")?.updateValueAndValidity();

        this.dimensionMapping(dimensionIndex).clear();

        if (dim?.get("setScale")?.value === true && dim?.get("scale")?.get("type")?.value === "categorical") {
            this.addDimensionMapping(dimensionIndex);
        }

        if (dim?.get("setScale")?.value === true) {
            switch (dim?.get("scale")?.get("type")?.value) {
                case "categorical":
                    dim?.get("setStyle")?.enable();
                    dim?.get("style")?.get("styleType")?.enable();
                    dim?.get("style")?.get("styleType")?.setValue("list");
                    dim?.get("style")?.get("position")?.enable();
                    dim?.get("style")?.get("position")?.setValue("middle");
                    dim?.get("style")?.get("orientation")?.enable();
                    dim?.get("style")?.get("orientation")?.setValue("vertical");
                    this.updateStyleType(dimensionIndex);
                    break;
                case "interval":
                    dim?.get("setStyle")?.enable();
                    dim?.get("style")?.get("styleType")?.setValue("list");
                    dim?.get("style")?.get("styleType")?.disable();
                    dim?.get("style")?.get("position")?.enable();
                    dim?.get("style")?.get("position")?.setValue("middle");
                    dim?.get("style")?.get("orientation")?.setValue("vertical");
                    dim?.get("style")?.get("orientation")?.disable();
                    this.updateStyleType(dimensionIndex);
                    break;
                case "magnitude_estimation":
                    dim?.get("setStyle")?.enable();
                    dim?.get("style")?.get("styleType")?.setValue("list");
                    dim?.get("style")?.get("styleType")?.disable();
                    dim?.get("style")?.get("position")?.enable();
                    dim?.get("style")?.get("position")?.setValue("middle");
                    dim?.get("style")?.get("orientation")?.setValue("vertical");
                    dim?.get("style")?.get("orientation")?.disable();
                    this.updateStyleType(dimensionIndex);
                    break;
                default:
                    dim?.get("setStyle")?.disable();
            }
        }
    }

    resetMultipleSelection(dimensionIndex: number) {
        const dim = this.dimensions()?.at(dimensionIndex);
        if (dim?.get("scale")?.get("setMultipleSelection")?.value === true) {
            dim?.get("scale")?.get("multiple_selection")?.setValue(true);
        } else {
            dim?.get("scale")?.get("multiple_selection")?.setValue(false);
        }
    }

    instructionsScale(dimensionIndex: number): UntypedFormGroup {
        const dim = this.dimensions()?.at(dimensionIndex);
        return dim?.get("scale")?.get("instructions") as UntypedFormGroup;
    }

    resetInstructionScale(dimensionIndex: number) {
        const dim = this.dimensions()?.at(dimensionIndex);
        if (dim?.get("scale")?.get("setInstructions")?.value === true) {
            this.instructionsScale(dimensionIndex)?.get("label")?.setValue("");
            this.instructionsScale(dimensionIndex)?.get("caption")?.setValue("");
            this.instructionsScale(dimensionIndex)?.get("text")?.setValue("");
        } else {
            this.instructionsScale(dimensionIndex)?.get("text")?.clearValidators();
        }
    }

    resetStyle(dimensionIndex: number) {
        this.updateStyleType(dimensionIndex);
    }

    updateStyleType(dimensionIndex: number) {
        const dim = this.dimensions()?.at(dimensionIndex);
        const styleType = dim?.get("style")?.get("styleType")?.value;

        if (dim?.get("setStyle")?.value === true) {
            dim?.get("style")?.get("styleType")?.setValidators(Validators.required);
            dim?.get("style")?.get("position")?.setValidators(Validators.required);
            dim?.get("style")?.get("orientation")?.setValidators(Validators.required);
            dim?.get("style")?.get("separator")?.setValidators(Validators.required);

            switch (styleType) {
                case "matrix":
                    dim?.get("style")?.get("orientation")?.setValue("vertical");
                    dim?.get("style")?.get("orientation")?.disable();
                    dim?.get("style")?.get("separator")?.enable();
                    break;
                case "list":
                    if (dim?.get("scale")?.get("type")) {
                        if (dim?.get("scale")?.get("type")?.value === "categorical") {
                            dim?.get("style")?.get("orientation")?.enable();
                        } else {
                            dim?.get("style")?.get("orientation")?.disable();
                        }
                    }
                    dim?.get("style")?.get("separator")?.disable();
                    dim?.get("style")?.get("separator")?.setValue(false);
                    break;
                default:
                    dim?.get("style")?.get("position")?.setValue("middle");
                    dim?.get("style")?.get("orientation")?.disable();
                    dim?.get("style")?.get("orientation")?.setValue("vertical");
                    dim?.get("style")?.get("separator")?.disable();
                    dim?.get("style")?.get("separator")?.setValue(false);
            }

            dim?.get("style")?.get("styleType")?.updateValueAndValidity();
            dim?.get("style")?.get("position")?.updateValueAndValidity();
            dim?.get("style")?.get("orientation")?.updateValueAndValidity();
            dim?.get("style")?.get("separator")?.updateValueAndValidity();
        }
    }

    /* SUB ELEMENT: Mapping */
    dimensionMapping(dimensionIndex: number): UntypedFormArray {
        return this.dimensions()
            ?.at(dimensionIndex)
            ?.get("scale")
            ?.get("mapping") as UntypedFormArray;
    }

    addDimensionMapping(dimensionIndex: number, mapping: Mapping | null = null) {
        this.dimensionMapping(dimensionIndex).push(
            this._formBuilder.group({
                label: mapping?.label ?? "",
                description: mapping?.description ?? "",
                value: [mapping?.value ?? "", [Validators.required]],
            })
        );
    }

    removeDimensionMapping(dimensionIndex: number, dimensionMappingIndex: number) {
        this.dimensionMapping(dimensionIndex).removeAt(dimensionMappingIndex);
    }

    /* JSON Output */
    serializeConfiguration() {
        const serializedDimensions = Object.keys(localStorage).filter((key) =>
            key.startsWith("dimension-")
        );
        if (serializedDimensions.length > 0)
            serializedDimensions.forEach((key) => this.localStorageService.removeItem(key));

        const dimensionsJSON = JSON.parse(
            JSON.stringify(this.formStep?.get("dimensions")?.value)
        );

        dimensionsJSON.forEach((dimension: any, dimensionIndex: number) => {
            if (dimension.name_pretty === "") dimension.name_pretty = false;
            if (dimension.description === "") dimension.description = false;
            if (dimension.example === "") dimension.example = false;

            dimension.gold = !!dimension.gold;

            if (!dimension.setJustification) dimension.justification = false;
            delete dimension.setJustification;

            if (dimension.setUrl === true) {
                dimension.url.enable = true;
                if (dimension.url.setInstructions === false) {
                    dimension.url.instructions = false;
                }
                delete dimension.url.setInstructions;
            } else {
                dimension.url = false;
            }
            delete dimension.setUrl;

            if (dimension.setScale === false) {
                delete dimension.scale;
                dimension.scale = false;
                dimension.style = false;
            } else {
                if (dimension.scale.setInstructions === false) {
                    dimension.scale.instructions = false;
                } else {
                    if (dimension.scale.instructions.caption === "") dimension.scale.instructions.caption = false;
                    if (dimension.scale.instructions.label === "") dimension.scale.instructions.label = false;
                    if (dimension.scale.instructions.text === "") dimension.scale.instructions.text = false;
                }
                switch (dimension.scale.type) {
                    case "categorical":
                        delete dimension.scale.setMultipleSelection;
                        delete dimension.scale.min;
                        delete dimension.scale.max;
                        delete dimension.scale.step;
                        break;
                    case "interval":
                        delete dimension.scale.setMultipleSelection;
                        delete dimension.scale.multiple_selection;
                        delete dimension.scale.mapping;
                        break;
                    case "magnitude_estimation":
                        delete dimension.scale.setMultipleSelection;
                        delete dimension.scale.multiple_selection;
                        delete dimension.scale.mapping;
                        delete dimension.scale.max;
                        delete dimension.scale.step;
                        delete dimension.scale.mapping;
                        break;
                    default:
                        break;
                }
                delete dimension.scale.setInstructions;
            }
            delete dimension.setScale;

            if (dimension.style) {
                if (dimension.setStyle) {
                    dimension.style.type = dimension.style.styleType;
                    delete dimension.style.styleType;

                    if (!dimension.style.type) dimension.style.type = "";
                    if (!dimension.style.position) dimension.style.position = "";

                    if (dimension.scale.type === "interval" || dimension.scale.type === "magnitude_estimation") {
                        dimension.style.type = "list";
                        dimension.style.orientation = "vertical";
                    }

                    dimension.style.separator = !!dimension.style.separator;
                } else {
                    dimension.style = false;
                }
            } else {
                dimension.style = false;
            }
            delete dimension.setStyle;

            this.localStorageService.setItem(
                `dimension-${dimensionIndex}`,
                JSON.stringify(dimension)
            );
        });

        this.configurationSerialized = JSON.stringify(dimensionsJSON);
    }
}
