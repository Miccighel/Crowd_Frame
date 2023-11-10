import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HitResponse } from '../models/solver/hitResponse';
import { HitRequest } from '../models/solver/hitRequest';
import { HitSolution } from '../models/solver/hitSolution';

@Injectable({
  providedIn: 'root'
})

export class HitsSolverService {

  solverEndPoint: string;
  selectedRunner: string;
  runners: Array<string>
  client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  getSolverConfiguration(config): Observable<JSON>{
    this.solverEndPoint = config.environment.hit_solver_endpoint
    return this.client.get<JSON>(this.solverEndPoint);
  }

  setRunners(response){
    this.runners = response.runners;
    this.setRunner(0)
  }

  setRunner(idx: number){
    this.selectedRunner = this.runners[idx];
  }

  getRunner(){
    this.selectedRunner;
  }

  getRunnerParameters(): Observable<JSON>{
    let url = `${this.solverEndPoint}${this.selectedRunner}`;
    return this.client.get<JSON>(url)
  }

  createRequest(docs: Array<JSON>, identificationAttribute: string, min_item_rep: number, min_item_quality_level: number, categories: Array<string>, worker_assignment: Array<Object>, num_workers: number): HitRequest{
    let req = new HitRequest(min_item_rep, min_item_quality_level)
    categories.forEach(category => {
      req.addCategory(category, worker_assignment[category])
    })
    req.addItems(docs, identificationAttribute)
    req.createProperties()
    req.addWorkers(num_workers)

    return req
  }
  
  submitRequest(req: HitRequest): Observable<HitResponse>{
    let head = new HttpHeaders(
      {
          'Content-Type': 'application/json',
          'Accept': '*/*'
    });
    let url = `${this.solverEndPoint}${this.selectedRunner}`
    return this.client.post<HitResponse>(url, req,
      {headers: head});
  }

  checkSolutionStatus(url: string): Observable<JSON>{
    return this.client.get<JSON>(`${this.solverEndPoint}${url}`)
  }

  getSolution(task_id: string): Observable<HitSolution>{
    return this.client.get<HitSolution>(`${this.solverEndPoint}/solution/${task_id}`)
  }

  generateToken(length: number){
    let token = ""
    let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for(let i = 0; i < length; i++){
      token += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return token
  }

  addToken(length: number, tokens: Array<string>){  
    let token = this.generateToken(length)
    while(tokens.includes(token)) token = this.generateToken(11)
    return token
  }

  createHits(response: HitSolution, docs: Array<JSON>, identificationAttribute: string){
    let hits = []
    let assignments = response.solution.Workers;

    let generated_tokens = []
    for(let assignment of assignments){
      let dcms = []
      for(let item of assignment.Assignments){
        let doc = this.getDocument(docs, item, identificationAttribute)
        dcms.push(doc)
      }

      let tokenInput = this.addToken(11, generated_tokens)
      let tokenOutput = this.addToken(11, generated_tokens)

      let hit = {
        documents_number: dcms.length,
        documents: dcms,
        unit_id: `unit_${assignments.indexOf(assignment)}`,
        token_input: tokenInput,
        token_output: tokenOutput
      }
      hits.push(hit)
    }
    return hits
  }

  getDocument(docs: Array<JSON>, id: string, identificationAttribute: string): JSON{
    for(let doc of docs){
      if (doc[identificationAttribute] == id) return doc;
    }
  }

}
