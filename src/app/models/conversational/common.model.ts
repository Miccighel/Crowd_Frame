
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

export interface DropdownSelectItem {
    label: string;
    value: string;
}

export interface AnswerModel {
    dimensionValue: string;
    urlValue?: string;
}

export enum ConversationState {
    Questionnaire,
    QuestionnaireReview,
    TaskInstructions,
    Task,
    TaskReview,
    End,
}
export enum InputType {
    Text,
    Number,
    Dropdown,
    Button,
    Slider,
}

export enum QuestionType {
    Standard,
    CRT,
    Likert,
    None = 99
}


export enum ButtonsType {
    None,
    YesNo,
    Confirm,
}
