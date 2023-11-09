export interface HitSolution{
    completed: string;
    cost: Cost;
    finished: boolean;
    runner: string;
    solution: Solution;
    started: string;
    submitted: string;
    task_id: string;
}

export interface Cost{
    components: Array<number>;
    objective: number;
    total: number;
    violations: number;
}

export interface Solution{
    Instance_id: string;
    User_workers: number;
    Workers: Array<Assignment>
}

export interface Assignment{
    Assignments: Array<string>;
    Id: string;
}