import { badRequest } from '../services/api/responseBuilder.js';
export function validate(validatorFn) {
  return function(req, res, next) {
    var err = validatorFn(req);
    if (err) return badRequest(res, err.code, err.message, err.details);
    next();
  };
}
