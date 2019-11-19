import { Directive, Input } from '@angular/core';
import { NG_VALIDATORS, Validator, AbstractControl } from '@angular/forms';

@Directive({
  selector: '[linelimiter]',
  providers: [{ provide: NG_VALIDATORS, useExisting: LineLimiterValidator, multi: true }]
})
export class LineLimiterValidator implements Validator {

  @Input('linelimiter') limit: string;

  validate(control: AbstractControl) {

    if ( ! control.value || typeof control.value !== 'string' || isNaN(+this.limit) ) return null;

    const newlines = control.value.match(/\n/g);

    return newlines && newlines.length > +this.limit - 1 ? { linelimiter: { value: `Value has more than ${+this.limit} lines!` } } : null;

  }

}
