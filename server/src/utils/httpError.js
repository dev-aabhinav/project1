/**
 * An error that carries an HTTP status. Throw it anywhere:
 *   throw new HttpError(409, "Email already registered");
 * The central error handler turns it into { error, details? } with that status.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Converts ANY error (ours, Express's, Mongoose's, MongoDB's) into an HttpError,
 * so the error handler only has to deal with one shape.
 */
function toHttpError(err) {
  if (err instanceof HttpError) {
    return err;
  }

  // express.json(): body is not valid JSON / body is over the size limit.
  if (err.type === "entity.parse.failed") {
    return new HttpError(400, "Malformed JSON body");
  }

  if (err.type === "entity.too.large") {
    return new HttpError(413, "Request body too large");
  }

  // Mongoose schema validation failed (required, maxlength, match...).
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    return new HttpError(400, "Validation failed", details);
  }

  // Mongoose could not cast a value, e.g. "abc" is not a valid ObjectId.
  if (err.name === "CastError") {
    return new HttpError(400, `Invalid ${err.path}`);
  }

  // MongoDB unique index violation (E11000), e.g. email already used.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "value";
    return new HttpError(409, `${field} already exists`);
  }

  // Other library errors that carry a 4xx status (e.g. 415 unsupported charset).
  // Libraries set `expose: true` when the message is safe to show to clients.
  const status = err.status || err.statusCode;

  if (status >= 400 && status < 500) {
    return new HttpError(status, err.expose ? err.message : "Bad request");
  }

  // Anything else: unexpected. Never expose its message to the client.
  return new HttpError(500, "Internal server error");
}

module.exports = { HttpError, toHttpError };
