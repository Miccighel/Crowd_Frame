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
    constructor(docs: Array<JSON>, min_item_repetitions: number, min_item_quality_level: number){
        /* Generation of a random id is given by the current date and a random number in the interval 0:100000 */
        this.id = (Date.now() + Math.floor(Math.random() * 100000)).toString();
        
        this.min_item_repetitions = min_item_repetitions;
        this.min_item_quality_level = min_item_quality_level;

        /* Instantiation of the properties of the request */ 
        this.createProperties();

        /* Instantiation of the categories from a sample of the given documents */ 
        this.createCategoriesFromDocs(docs);

        if(this.checkCategoriesWorkerAssignment()){
            // Instantiation of the items from the given array of documents
            this.createItems(docs);

            // Instantiation of a minimum number of 'fake' workers that is needed
            // to get a correct assignment
            this.createWorkers();

        }else{
            console.log("The request cannot be created because categories settings are incompatible (Check worker_assignments values)")
        }            
    }

    createProperties(){
        this.properties.push(new Property("p1", ["l1"], 1));
    }

    createCategoriesFromDocs(docs: Array<JSON>){
        let possibleCategories = ['party']
        let doc_sample = docs[0];
        let categories = Object.keys(doc_sample).filter((el) => possibleCategories.includes(el))
        
        for (let c of categories){
            let values = new Array<string>();
            for(let i = 0; i < docs.length; i++)
                if(!values.includes(docs[i][c])) values.push(docs[i][c]);
            this.categories.push(new Category(c, values, 1))
        }
    }

    checkCategoriesWorkerAssignment(){
        let hit_lengths = new Array()
        for(let cat of this.categories)
            hit_lengths.push(cat.getLevels().length*cat.getWorkerAssignments());
        return hit_lengths.every(value => value == hit_lengths[0])
    }

    createItems(docs: Array<JSON>){
        for(let i = 0; i < docs.length; i++){
            let item_id = docs[i]["id"];
            let item_categories = new Array<ItemCategory>(); 
            for(let category of this.categories){
                    item_categories.push(new ItemCategory(category.getId(), docs[i][`${category.getId()}`]))
            }
            this.items.push(new Item(item_id, item_categories));
        }
    }

    createWorkers(){
        /**
         * At the moment all the workers have only one propery (p1) with the same level (l1)
         */
        let workers_length = this.getMinimumWorkersNumber();
        console.log(`Minimum number of workers needed: ${workers_length}`)
        let workers_expertise = 0;
        for(let i = 0; i < workers_length; i++){
            let worker_id = `W${i}`;
            let worker_properties = new Array<WorkerProperty>();
            for(let property of this.properties){
                worker_properties.push(new WorkerProperty(property.getId(), property.getLevels().at(0)))
            }
            this.workers.push(new HitWorker(worker_id, workers_expertise, worker_properties));
        }
    }

    getMinimumWorkersNumber(): number{
        let cat = new Map();
        for(let category of this.categories){
            let level_map = new Map();
            for(let level of category.getLevels()){
                level_map.set(level, new Array<string>());
            }
            cat.set(category.getId(), level_map);
        }
        for(let item of this.items){
            for(let c of item.getCategories()){
                let c_id = c.getId();
                let c_level = c.getLevel();

                cat.get(c_id).get(c_level).push(item.getId());
            }
        }
        let max = 0;
        cat.forEach((levels) => {
            levels.forEach(docs => {
                if(docs.length > max) max = docs.length;
            });
        })
        return max * this.min_item_repetitions;
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

    getWorkerAssignments(): number{
        return this.worker_assignments;
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