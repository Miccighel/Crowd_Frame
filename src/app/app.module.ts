/* Core imports */
import {BrowserModule} from "@angular/platform-browser";
import {APP_INITIALIZER, NgModule} from "@angular/core";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {HttpClientModule} from "@angular/common/http";
import {from, Observable} from "rxjs";
import {tap} from "rxjs/operators";
/* Reactive forms imports */
import {ReactiveFormsModule, FormsModule} from "@angular/forms";
/* Angular Material imports */
import {MatRadioModule} from "@angular/material/radio";
import {MatCardModule} from "@angular/material/card";
import {MatInputModule} from "@angular/material/input";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {MatButtonModule} from "@angular/material/button";
import {MatStepperModule} from "@angular/material/stepper";
import {MatDividerModule} from "@angular/material/divider";
import {MatTabsModule} from "@angular/material/tabs";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatListModule} from "@angular/material/list";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {MatBadgeModule} from "@angular/material/badge";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatIconModule} from "@angular/material/icon";
import {MatTreeModule} from "@angular/material/tree";
import {MatDialogModule} from "@angular/material/dialog";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatSliderModule} from "@angular/material/slider";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatChipsModule} from "@angular/material/chips";
import {MatProgressBarModule} from "@angular/material/progress-bar";
/* Components imports */
import {SkeletonComponent} from "./components/skeleton/skeleton.component";
import {SearchEngineBodyComponent, SummaryDialog} from "./components/skeleton/document/dimension/search-engine/search-engine-body/search-engine-body.component";
import {InstructionsComponent, InstructionsDialog} from "./components/skeleton/instructions/instructions.component";
import {GeneratorComponent} from "./components/generator/generator.component";
import {LoaderComponent} from "./components/loader/loader.component";
import {QuestionnaireComponent} from "./components/skeleton/questionnaire/questionnaire.component";
import {WorkerChecksStepComponent} from "./components/generator/generator-steps/worker-checks-step/worker-checks-step.component";
import {QuestionnaireStepComponent} from "./components/generator/generator-steps/questionnaire-step/questionnaire-step.component";
import {InstructionsGeneralStep} from "./components/generator/generator-steps/instructions-general-step/instructions-general-step.component";
import {InstructionsEvaluationStepComponent} from "./components/generator/generator-steps/instructions-evaluation-step/instructions-evaluation-step.component";
import {SearchEngineStepComponent} from "./components/generator/generator-steps/search-engine-step/search-engine-step.component";
import {DimensionsStepComponent} from "./components/generator/generator-steps/dimensions-step/dimensions-step.component";
import {TaskSettingsStepComponent} from "./components/generator/generator-steps/task-settings-step/task-settings-step.component";
import {SummaryStepComponent} from "./components/generator/generator-steps/summary-step/summary-step.component";
import {OutcomeSectionComponent} from "./components/skeleton/outcome/outcome-section.component";
import {AnnotatorLawsComponent} from "./components/skeleton/document/elements/annotator-laws/annotator-laws.component";
import {AnnotatorOptionsComponent} from "./components/skeleton/document/elements/annotator-options/annotator-options.component";
import {ElementPointwiseComponent} from "./components/skeleton/document/elements/element-pointwise/element-pointwise.component";
import {DimensionComponent} from "./components/skeleton/document/dimension/dimension.component";
import {SearchEngineComponent} from "./components/skeleton/document/dimension/search-engine/search-engine.component";
import {ElementPairwiseComponent} from "./components/skeleton/document/elements/element-pairwise/element-pairwise.component";
import {DocumentComponent} from "./components/skeleton/document/document.component";
import {ErrorMessageComponent} from "./components/shared/error-message/error-message.component";
import {ChatAvatarComponent} from "./components/chatbot/chat-avatar/chat-avatar.component";
import {ChatWidgetComponent} from "./components/chatbot/chat-widget/chat-widget.component";
import {ChatCommentModalComponent} from "./components/chatbot/chat-modals/chat-comment-modal/chat-comment-modal.component";
import {ChatInstructionModalComponent} from "./components/chatbot/chat-modals/chat-instruction-modal/chat-instruction-modal.component";
import {ChatInputTextComponent} from "./components/chatbot/chat-inputs/chat-input-text/chat-input-text.component";
import {ChatInputMagnitudeComponent} from "./components/chatbot/chat-inputs/chat-input-magnitude/chat-input-magnitude.component";
import {ChatInputIntervalComponent} from "./components/chatbot/chat-inputs/chat-input-interval/chat-input-interval.component";
import {ChatInputSelectComponent} from "./components/chatbot/chat-inputs/chat-input-select/chat-input-select.component";
import {ChatInputButtonComponent} from "./components/chatbot/chat-inputs/chat-input-button/chat-input-button.component";
import {ChatUrlInputComponent} from "./components/chatbot/chat-inputs/chat-input-url/chat-input-url.component";
/* Services imports */
import {SectionService} from "./services/section.service";
import {ActionLogger} from "./services/userActionLogger.service";
/* Directives imports */
import {ButtonDirective, SearchEngineBodyDirective, InputDirective, RadioDirective, SkeletonDirective,} from "./components/skeleton/skeleton.directive";
/* Pipes import */
import {TruncatePipe} from "./pipes/truncatePipe";
/* Other imports */
import {NgxUiLoaderModule} from "ngx-ui-loader";
import {CountdownModule} from "ngx-countdown";
import {NgxFileHelpersModule} from "ngx-file-helpers";
import {ColorPickerModule} from "ngx-color-picker";
import {NgbModule} from "@ng-bootstrap/ng-bootstrap";
import {AngularEditorModule} from "@kolkov/angular-editor";

function initActionLogger(actionLogger: ActionLogger): () => Observable<any> {
    return () =>
        from(actionLogger.downloadOpt()).pipe(
            tap((data) => {
                actionLogger.opt = data["logger_option"];
                actionLogger.isActive = data["logger"];
                actionLogger.endpoint = data["server_endpoint"];
            })
        );
}

@NgModule({
    declarations: [
        SkeletonComponent,
        SearchEngineBodyComponent,
        SummaryDialog,
        TruncatePipe,
        InstructionsComponent,
        InstructionsDialog,
        GeneratorComponent,
        LoaderComponent,
        ButtonDirective,
        SkeletonDirective,
        InputDirective,
        RadioDirective,
        SearchEngineBodyDirective,
        QuestionnaireComponent,
        WorkerChecksStepComponent,
        QuestionnaireStepComponent,
        InstructionsGeneralStep,
        SearchEngineStepComponent,
        DimensionsStepComponent,
        TaskSettingsStepComponent,
        SummaryStepComponent,
        OutcomeSectionComponent,
        AnnotatorLawsComponent,
        AnnotatorOptionsComponent,
        ElementPointwiseComponent,
        DimensionComponent,
        SearchEngineComponent,
        ElementPairwiseComponent,
        DocumentComponent,
        InstructionsEvaluationStepComponent,
        ErrorMessageComponent,
        ChatAvatarComponent,
        ChatInputTextComponent,
        ChatWidgetComponent,
        ChatInputMagnitudeComponent,
        ChatInputIntervalComponent,
        ChatInputButtonComponent,
        ChatInputSelectComponent,
        ChatCommentModalComponent,
        ChatInstructionModalComponent,
        ChatUrlInputComponent,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        MatCardModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatStepperModule,
        MatRadioModule,
        MatDividerModule,
        MatTabsModule,
        MatFormFieldModule,
        MatGridListModule,
        MatListModule,
        MatToolbarModule,
        ReactiveFormsModule,
        FormsModule,
        NgxUiLoaderModule,
        HttpClientModule,
        BrowserModule,
        MatButtonModule,
        MatIconModule,
        MatPaginatorModule,
        MatTreeModule,
        MatTableModule,
        MatPaginatorModule,
        MatExpansionModule,
        MatSnackBarModule,
        MatBadgeModule,
        MatProgressSpinnerModule,
        MatSliderModule,
        MatDividerModule,
        NgxUiLoaderModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatCheckboxModule,
        MatTooltipModule,
        CountdownModule,
        MatSlideToggleModule,
        NgxFileHelpersModule,
        ColorPickerModule,
        MatProgressBarModule,
        MatChipsModule,
        AngularEditorModule,
        NgbModule,
    ],

    providers: [
        {
            provide: APP_INITIALIZER,
            useFactory: initActionLogger,
            deps: [ActionLogger],
            multi: true,
        },
        SectionService,
    ],
    bootstrap: [LoaderComponent],
})

export class AppModule {}