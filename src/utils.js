function requestLogger(req) {
  var dateFormatted = new Date().toISOString().replace("T", " ");
  var h1 = "//***************************************************************";
  console.log(
    `${h1}\n${dateFormatted}: ${req.method} ${req.protocol}://${req.headers["host"]}${req.originalUrl}`
  );
  console.log(`Headers:`);
  console.log(req.headers);
  console.log(`${h1}\n`);
}

module.exports = { requestLogger };
