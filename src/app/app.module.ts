/* Core Angular imports */
import {NgModule, APP_INITIALIZER} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {HttpClientModule} from '@angular/common/http';
import {ReactiveFormsModule, FormsModule} from '@angular/forms';

/* Third-party module imports */
import {NgxUiLoaderModule} from 'ngx-ui-loader';
import {CountdownModule} from 'ngx-countdown';
import {NgxFileHelpersModule} from 'ngx-file-helpers';
import {ColorPickerModule} from 'ngx-color-picker';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {AngularEditorModule} from '@kolkov/angular-editor';

/* Custom module imports */
import {MaterialModule} from './app-material.module'; // Ensure the path is correct
import {AppRoutingModule} from './app-routing.module';

/* Components imports */
import {BaseComponent} from "./components/base/base.component";
import {SkeletonComponent} from "./components/skeleton/skeleton.component";
import {SearchEngineBodyComponent} from "./components/skeleton/document/dimension/search-engine/search-engine-body/search-engine-body.component";
import {PreRetrievedResultSummaryComponent} from './components/skeleton/document/dimension/search-engine/pre-retrieved-result-summary/pre-retrieved-result-summary.component';
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
import {ButtonDirective, SearchEngineBodyDirective, InputDirective, RadioDirective, SkeletonDirective} from "./components/skeleton/skeleton.directive";

/* Pipes imports */
import {TruncatePipe} from "./pipes/truncatePipe";

/* RxJS imports */
import {from, Observable} from "rxjs";
import {tap} from "rxjs/operators";

/* Initializer function to preload configurations */
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
        BaseComponent,
        SkeletonComponent,
        SearchEngineBodyComponent,
        PreRetrievedResultSummaryComponent,
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
        HttpClientModule,
        ReactiveFormsModule,
        FormsModule,
        AngularEditorModule,
        MaterialModule,
        NgbModule,
        CountdownModule,
        NgxFileHelpersModule,
        ColorPickerModule,
        NgxUiLoaderModule,
        AppRoutingModule  // Always keep AppRoutingModule as the last import
    ],
    providers: [
        SectionService,
        {
            provide: APP_INITIALIZER,
            useFactory: initActionLogger,
            deps: [ActionLogger],
            multi: true,
        },
    ],
    bootstrap: [BaseComponent],  // Root component to bootstrap
})

export class AppModule {}