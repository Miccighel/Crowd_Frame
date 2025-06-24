import { Component, Input } from '@angular/core'

@Component({
    selector: 'chat-avatar',
    templateUrl: 'chat-avatar.component.html',
    styleUrls: ['chat-avatar.component.css'],
    standalone: false
})

export class ChatAvatarComponent {
  @Input() public image!: string
}
