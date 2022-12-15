export enum EnDimensionType {
    Categorial,
    Magnitude,
    Interval,
    URL,
    TBD,
}

export interface CategorialDimensionModel {
    mapping: CategorialInfo[];
}

export interface CategorialInfo {
    label: string;
    description?: string;
    value: string;
}
export interface MagnitudeDimensionInfo {
    min: number;
    lowerBound: boolean;
    value?: number;
}
export interface IntervalDimensionInfo {
    min: number;
    max: number;
    step: number;
    value?: number;
}
