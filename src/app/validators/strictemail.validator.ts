import { Directive } from '@angular/core';
import { NG_VALIDATORS, Validator, AbstractControl } from '@angular/forms';
import { isEmail } from 'validator';

@Directive({
  selector: '[strictemail]',
  providers: [{ provide: NG_VALIDATORS, useExisting: StrictEmailValidator, multi: true }]
})
export class StrictEmailValidator implements Validator {

  validate(control: AbstractControl) {

    if ( ! control.value || typeof control.value !== 'string' ) return null;

    return ! isEmail(control.value) ? { strictemail: { value: `Invalid email format!` } } : null;

  }

}
