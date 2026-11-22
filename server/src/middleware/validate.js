const { HttpError } = require("../utils/httpError");

/**
 * Returns middleware that validates req.body against a zod schema.
 * On success, req.body is REPLACED by the parsed result: trimmed, lowercased,
 * and with every field the schema doesn't know removed.
 * On failure, throws a 400 listing every problem.
 */
function validate(schema) {
  return (req, res, next) => {
    // No JSON body at all -> req.body is undefined in Express 5; validate {} instead,
    // so the client gets "X is required" for each field rather than one vague error.
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      throw new HttpError(400, "Validation failed", details);
    }

    req.body = result.data;
    next();
  };
}

module.exports = { validate };
