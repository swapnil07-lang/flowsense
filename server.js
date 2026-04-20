console.log("STARTING FILE");

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Working 🚀");
});

app.listen(8080, () => {
  console.log("SERVER STARTED ON 8080");
});