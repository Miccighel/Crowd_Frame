export class HitRequest{

    id: string;
    min_item_repetitions: number;
    min_item_quality_level: number;

    categories =  new Array<Category>();
    properties = new Array<Property>();

    items = new Array<Item>();
    workers = new Array<HitWorker>();

    /**
     * 
     * @param docs : JSON object that contains an array of documents
     * @param min_item_repetitions : minimum number of repetitions of the same document in different assigments 
     * @param min_item_quality_level : minimum quality level for each item in the assignment
     */
    constructor(min_item_repetitions: number, min_item_quality_level: number){
        /* Generation of a random id is given by the current date and a random number in the interval 0:100000 */
        this.id = (Date.now() + Math.floor(Math.random() * 100000)).toString();
        
        this.min_item_repetitions = min_item_repetitions;
        this.min_item_quality_level = min_item_quality_level;           
    }

    addCategory(categoryId: string, worker_assignment: number){
        this.categories.push(new Category(categoryId, new Array<string>(), worker_assignment))
    }

    addItems(docs: Array<JSON>, idAttribute: string){
        for(let i = 0; i < docs.length; i++) {
            let item_id = docs[i][idAttribute];
            let item_categories = new Array<ItemCategory>()
            for(let category of this.categories){
                if(!category.getLevels().includes(docs[i][`${category.getId()}`]))
                    category.addLevel(docs[i][`${category.getId()}`])
                item_categories.push(new ItemCategory(category.getId(), docs[i][`${category.getId()}`]))
            }
            this.items.push(new Item(item_id, item_categories));
        }
    }

    createProperties(){
        this.properties.push(new Property("p1", ["l1"], 1));
    }

    addWorkers(workers_number: number){
        /**
         * At the moment all the workers have only one property (p1) with the same level (l1)
         */
        let num_workers = workers_number
        let workers_expertise = 0;
        for(let i = 0; i < num_workers; i++){
            let worker_id = `W${i}`;
            let worker_properties = new Array<WorkerProperty>();
            for(let property of this.properties){
                worker_properties?.push(new WorkerProperty(property.getId(), property.getLevels()?.at(0)))
            }
            this.workers.push(new HitWorker(worker_id, workers_expertise, worker_properties));
        }
    }

}

class Category{
    id: string;
    levels: Array<string>;

    worker_assignments: number;

    constructor(id: string, levels: Array<string>, worker_assignments: number){
        this.id = id;
        this.levels = levels;
        this.worker_assignments = worker_assignments;
    }

    getId(): string{
        return this.id;
    }
    
    getLevels(): Array<string>{
        return this.levels;
    }

    addLevel(level: string) {
        this.levels.push(level)
    }

    getWorkerAssignments(): number{
        return this.worker_assignments;
    }

    setWorkerAssignments(worker_assignments: number) {
        this.worker_assignments = worker_assignments
    }
}

class Property{

    id: string;
    levels: Array<string>;
    item_assignments: number;

    constructor(id: string, levels: Array<string>, item_assignments: number){
        this.id = id;
        this.levels = levels;
        this.item_assignments = item_assignments;
    }

    getId(): string{
        return this.id;
    }

    getLevels(): Array<string>{
        return this.levels;
    }

    getItemAssignment(): number{
        return this.item_assignments;
    }
}

class Item{
    
    id: string;
    categories: Array<ItemCategory>;
    
    constructor(id: string, categories: Array<ItemCategory>){
        this.id = id;
        this.categories = categories;
    }

    getId(){
        return this.id;
    }

    getCategories(){
        return this.categories;
    }

    setCategories(categories: Array<ItemCategory>){
        this.categories = categories;
    }
}

class ItemCategory{
    
    id: string;
    level: string;

    constructor(id: string, level: string){
        this.id = id;
        this.level = level;
    }

    getId(){
        return this.id;
    }

    getLevel(){
        return this.level;
    }
}

export class HitWorker{

    id: string;
    expertise: number;
    properties: Array<WorkerProperty>;

    constructor(id: string, expertise: number, properties: Array<WorkerProperty>){
        this.id = id;
        this.expertise = expertise;
        this.properties = properties;
    }
}

class WorkerProperty{
    
    id: string;
    level: string;

    constructor(id: string, level: string){
        this.id = id;
        this.level = level;
    }
}