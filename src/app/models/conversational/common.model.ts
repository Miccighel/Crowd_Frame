export enum EnDimensionType {
    Categorical,
    Magnitude,
    Interval,
    URL,
    TBD,
}

export interface CategoricalDimensionModel {
    mapping: CategoricalInfo[];
}

export interface CategoricalInfo {
    label: string;
    description?: string;
    value: string;
}
export interface MagnitudeDimensionInfo {
    min: number;
    lowerBound: boolean;
    value?: number;
    instructions?: string;
}
export interface IntervalDimensionInfo {
    min: number;
    max: number;
    step: number;
    value?: number;
    instructions?: string;
}

export interface McqInfo {
    label: string;
    value?: string;
}

export enum EnConversationaTaskStatus {
    InstructionPhase,
    QuestionnairePhase,
    QuestionnaireReviewPhase,
    TaskPhase,
    ReviewPhase,
    EndPhase,
}
