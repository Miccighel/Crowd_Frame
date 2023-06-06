import { Component, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, NgForm } from "@angular/forms";
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

@Component({
    selector: "chat-comment-modal",
    templateUrl: "chat-comment-modal.component.html",
    styleUrls: ["./chat-comment-modal.component.css"],
})
export class ChatCommentModalComponent implements OnInit {
    public inMessage: string;
    public outMessage: string;

    public inputToken: string;
    public outputToken: string;

    public comment: string = "";
    public commentFG: FormGroup;
    @ViewChild("commentNgForm") commentNgForm: NgForm;

    constructor(
        public activeModal: NgbActiveModal,
        private _formBuilder: FormBuilder
    ) { }
    ngOnInit() {
        this.commentFG = this._formBuilder.group({
            comment: [""],
        });
    }

    public addComment() {
        this.comment = this.commentFG.controls.comment.value;
        this.activeModal.close(this.comment);
    }
}
