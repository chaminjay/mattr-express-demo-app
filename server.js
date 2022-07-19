const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");
const ngrok = require("ngrok");
var session = require("express-session");

const service = require("./src/services");
const { requestLogger } = require("./src/utils");

// express app
const app = express();

// express router
const router = express();

// register view engine
app.set("view engine", "ejs");

let ngrokUrl = null;
let callbackState = {};

// Launch the Express server
(async function bootstrap() {
  // Load environment variables
  dotenv.config();
  const port = process.env.PORT || "3000";
  ngrokUrl = await ngrok.connect(port);

  app.listen(port, () => {
    console.log(`Mattr Verifiable Credential Issuer`);
    console.log(`Local: http://localhost:${port}`);
  });
})().catch((err) => {
  console.error("Failed to launch server", err);
  process.exit(1);
});

// middleware & static files

// Set up a simple server side session store.
// The session store will briefly cache issuance requests
// to facilitate QR code scanning.
var sessionStore = new session.MemoryStore();
app.use(
  session({
    secret: "cookie-secret-key",
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
  })
);
app.use(router);
app.use(express.static("public"));
// router.use(bodyParser.json());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Authorization, Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

module.exports.sessionStore = sessionStore;
module.exports.app = app;

// routes
router.post("/callback", function (req, res) {
  var body = "";
  req.on("data", function (data) {
    body += data;
  });
  req.on("end", function () {
    requestLogger(req);
    var callbackResponse = JSON.parse(body.toString());
    sessionStore.get(callbackState.id, (error, session) => {
      var cacheData = {
        status: "verified",
        callbackResponse: callbackResponse,
      };
      session.sessionData = cacheData;
      sessionStore.set(callbackState.id, session, (error) => {
        res.send();
      });
      console.log("Session: ", session);
    });
  });
  console.log("\n Data from the Presentation is shown below \n", body);
  res.send(body);
});

app.get("/api/verifier/presentation-response", async (req, res) => {
  var id = req.query.id;
  requestLogger(req);
  sessionStore.get(id, (error, session) => {
    if (session && session.sessionData) {
      console.log(
        `status: ${session.sessionData.status}, callbackResponse: ${session.sessionData.callbackResponse}`
      );
      res.status(200).json(session.sessionData);
    }
  });
});

router.get("/", async (req, res) => {
  requestLogger(req);
  res.render("index");
});

router.get("/qr", function (req, res) {
  requestLogger(req);
  const body = res.body;
  console.log("jws url: ", jwsUrl);
  res.redirect(jwsUrl);
});

router.get("/claims", async (req, res) => {
  requestLogger(req);
  res.render("claims");
});

// Get QR code for retrieving verifiable credentials.
router.get(
  "/present/getVerifiableCredentials",
  express.json(),
  async (req, res, next) => {
    requestLogger(req);
    try {
      console.log("Presenting QR Code");
      const qrCode = await service.getCredentials();
      res.send(qrCode);
    } catch (err) {
      console.error("Failed to present QR code", err, err?.response?.body);
      next(err);
    }
  }
);

// Get QR code for validating credentials.
router.get(
  "/present/validateCredentials",
  express.json(),
  async (req, res, next) => {
    requestLogger(req);
    var id = req.session.id;
    // prep a session state of 0
    sessionStore.get(id, (error, session) => {
      var sessionData = {
        status: 0,
        message: "Verification process initiated.",
      };
      if (session) {
        session.sessionData = sessionData;
        sessionStore.set(id, session);
        callbackState.id = id;
        console.log("Session: ", session);
      }
    });
    try {
      console.log("Presenting QR Code");
      const qrCode = await service.validateCredentials(ngrokUrl);
      res.status(200).json({ id: id, qrCode: qrCode });
    } catch (err) {
      console.error("Failed to present QR code", err, err?.response?.body);
      next(err);
    }
  }
);

// 404 page
app.use((req, res) => {
  requestLogger(req);
  res.status(404).render("404", { title: "404" });
});
