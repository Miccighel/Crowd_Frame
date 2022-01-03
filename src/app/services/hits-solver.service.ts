import { HttpClient } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HitResponse } from '../models/hitResponse';
import { HitRequest } from '../models/hitRequest';
import { HitSolution } from '../models/hitSolution';
import { Assignment } from '../models/hitSolution';

@Injectable({
  providedIn: 'root'
})
export class HitsSolverService {

  //solverEndPointRunner = "http://158.110.146.213:18080/runner/BSA/";
  //solverEndPointRunner = "https://7c28926d-149b-4908-9999-fe2f66231d65.mock.pstmn.io/runner/BSA";
  solverEndPointRunner = "http://localhost:18080/runner/BSA";

  //solverEndPoint = "http://158.110.146.213:18080";
  //solverEndPoint = "https://7c28926d-149b-4908-9999-fe2f66231d65.mock.pstmn.io";
  solverEndPoint = "http://localhost:18080";

  selectedRunner: string;

  runnersList: Array<string>

  client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  getSolverConfiguration(): Observable<JSON>{
    return this.client.get<JSON>(this.solverEndPoint);
  }

  setRunnerList(response){
    this.runnersList = response.runners;
    this.setRunner(0)
  }

  setRunner(idx: number){
    this.selectedRunner = this.runnersList[idx];
  }

  getRunner(){
    this.selectedRunner;
  }

  getRunnerParameters(): Observable<JSON>{
    let url = `${this.solverEndPoint}${this.selectedRunner}`;
    return this.client.get<JSON>(url)
  }

  createRequest(docs: Array<JSON>, min_item_rep: number, min_item_quality_level: number): HitRequest{
    return new HitRequest(docs, min_item_rep, min_item_quality_level);
  }
  
  submitRequest(req: HitRequest): Observable<HitResponse>{
    let head = new HttpHeaders(
      {
          'Content-Type': 'application/json',
          'Accept': '*/*'
    });
    return this.client.post<HitResponse>(this.solverEndPointRunner, req,
      {headers: head});
  }

  checkSolutionStatus(url: string): Observable<JSON>{
    return this.client.get<JSON>(`${this.solverEndPoint}${url}`)
  }

  getSolution(task_id: string): Observable<HitSolution>{
    return this.client.get<HitSolution>(`${this.solverEndPoint}/solution/${task_id}`)
  }

  /**
   * This function choose randomly an assignment from assignments array
   * and then builds a hit using the array of JSON docs
   */
  createHit(response: HitSolution, docs: Array<JSON>){
    let idx = Math.floor(Math.random() * (response.solution.Workers.length));
    let assignment = response.solution.Workers[idx].Assignments;

    let dcms = new Array();
    for(let item of assignment){
      let doc = this.getDocument(docs, item)
      dcms.push(doc);
    }
    let hit = {
      documents_number: dcms.length,
      documents: dcms,
      unit_id: `unit_${idx}`,
      token_input: 'ABCDEFGHILM',
      token_output: 'MNOPQRSTUVZ'
    };
    
    return hit;
  }

  createHits(response: HitSolution, docs: Array<JSON>){
    let hits = []
    let assignments = response.solution.Workers;
    for(let assignment of assignments){
      let dcms = []
      for(let item of assignment.Assignments){
        let doc = this.getDocument(docs, item)
        dcms.push(doc)
      }
      let hit = {
        documents_number: dcms.length,
        documents: dcms,
        unit_id: `unit_${assignments.indexOf(assignment)}`,
        token_input: 'ABCDEFGHILM',
        token_output: 'MNOPQRSTUVZ'
      }
      hits.push(hit)
    }
    return hits
  }

  getDocument(docs: Array<JSON>, id: string): JSON{
    for(let doc of docs){
      if (doc['id'] == id) return doc;
    }
  }

}
