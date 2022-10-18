export interface HitSolutionStatus{
    cost: Cost;
    finished: boolean;
    instance_url: string;
    runner: string;
    running: boolean;
    started: string;
    submitted: string;
    task_id: string;
}

export interface Cost{
    components: Components;
    objective: number;
    total: number;
    violations: number;
}

export interface Components{
    IA_CategoryWorkerAssignments: ComponentCosts;
    IA_MinimumItemQualityLevel: ComponentCosts;
    IA_PropertyItemAssignments: ComponentCosts;
}

export interface ComponentCosts{
    cost: number;
    hard: boolean;
    weight: number;
}