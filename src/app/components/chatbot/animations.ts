import { animate, style, transition, trigger } from '@angular/animations'

export const fadeIn = trigger('fadeIn', [
  transition(':enter', [
    style({opacity: 0}),
    animate(500 )
  ]),
  transition(':leave', [
    style({opacity: 100}),
    animate(1)
  ]),
])
