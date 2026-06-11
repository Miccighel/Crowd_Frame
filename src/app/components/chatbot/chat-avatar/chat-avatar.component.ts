import { Component, Input, ChangeDetectionStrategy } from '@angular/core'

@Component({
    selector: 'chat-avatar',
    templateUrl: 'chat-avatar.component.html',
    styleUrls: ['chat-avatar.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class ChatAvatarComponent {
  @Input() public image!: string
}
