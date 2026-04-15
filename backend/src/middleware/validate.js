// middleware/validate.js
const { AppError } = require('../utils/errors');

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => d.message).join('; ');
      return next(new AppError(`Validation failed: ${details}`, 400));
    }
    req.body = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map(d => d.message).join('; ');
      return next(new AppError(`Invalid query params: ${details}`, 400));
    }
    req.query = value;
    next();
  };
}

module.exports = { validate, validateQuery };
