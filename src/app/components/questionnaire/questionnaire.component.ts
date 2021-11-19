import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Questionnaire} from "../../models/questionnaire";
import {FormGroup} from "@angular/forms";
import {SectionService} from "../../services/section.service";

@Component({
  selector: 'app-questionnaire',
  templateUrl: './questionnaire.component.html',
  styleUrls: ['./questionnaire.component.scss']
})
export class QuestionnaireComponent implements OnInit {

  /* Service to track current section */
  sectionService: SectionService

  @Input() step: number
  @Input() position: string
  @Input() documentsAmount: number
  @Input() questionnaire: Questionnaire
  @Input() questionnaireAmount:number
  @Input() questionnaireAmountStart:number
  @Input() questionnaireAmountEnd:number
  @Input() questionnaireForm: FormGroup

  @Output() questionnaireFilled: EventEmitter<Object>;

  constructor(
      sectionService: SectionService
  ) {
    this.sectionService = sectionService
    this.questionnaireFilled = new EventEmitter<Object>()
  }

  ngOnInit(): void {}

  public emitQuestionnaireFilled(action, step){
    this.questionnaireFilled.emit({
      "questionnaireForm": this.questionnaireForm,
      "action": action,
      "step": step
    });
  }

  /*
     * This function retrieves the string associated to an error code thrown by a form field validator.
     */
    public checkFormControl(form: FormGroup, field: string, key: string): boolean {
        return form.get(field).hasError(key);
    }

}
