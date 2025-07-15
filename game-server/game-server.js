import express from "express";
const app = express();
const PORT = 3000;

import sessionRouter from "./session-routes.js";

// Middleware to parse JSON bodies
app.use(express.json());

// Register the router
app.use("/api", sessionRouter);

app.get("/", (req, res) => {
  res.send("It works!");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
