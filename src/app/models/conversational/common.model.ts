export enum EnDimensionType {
    Categorial,
    Magnitude,
    Interval,
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
    max: number;
    step: number;
}
export interface IntervalDimensionInfo {
    min: number;
    lower_bound: boolean;
}
