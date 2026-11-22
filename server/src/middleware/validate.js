const { HttpError } = require("../utils/httpError");

const SOURCES = ["body", "query", "params"];

/**
 * Returns middleware that validates one part of the request against a zod schema:
 *   validate(schema)            -> req.body
 *   validate(schema, "query")   -> req.query   (?limit=20&cursor=...)
 *   validate(schema, "params")  -> req.params  (/users/:username)
 *
 * The parsed result (trimmed, lowercased, coerced, unknown fields removed) is stored in
 * req.valid[source]; controllers read from there. In Express 5, req.query is a getter and
 * assigning to it is SILENTLY ignored, so "replacing" it would leave the raw input in place.
 * For the body we also replace req.body (the auth controllers read it directly).
 */
function validate(schema, source = "body") {
  if (!SOURCES.includes(source)) {
    throw new Error(`validate(): unknown source "${source}"`);
  }

  return (req, res, next) => {
    // No JSON body -> req.body is undefined in Express 5; validate {} so each field is reported.
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      throw new HttpError(400, "Validation failed", details);
    }

    req.valid = { ...req.valid, [source]: result.data };

    if (source === "body") {
      req.body = result.data;
    }

    next();
  };
}

module.exports = { validate };
