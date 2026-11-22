// Loads (registers) every Mongoose model in one place.
// server.js requires this BEFORE connectDB(), so connectDB() can build all their indexes.
require("./User");
require("./Follow");
