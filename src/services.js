const got = require("got");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require('uuid');

// Retrieve configurations from the .env file.
dotenv.config();
const host = process.env.HOST;
const rootUrl = process.env.ROOT_URL;
const mattrIssuerId = process.env.MATTR_CREDENTIAL_ISSUER_ID;
const matterClientId = process.env.MATTR_CLIENT_ID;
const matterClientSecret = process.env.MATTR_CLIENT_SECRET;
const mattrTenantDomain = process.env.MATTR_TENANT_DOMAIN;
const mattrNonBLSDidId = process.env.MATTR_NON_BLS_DID_ID;
const mattrTempleId = process.env.MATTR_TEMPLATE_ID;
const qrBaseURL = process.env.QR_BASE_URL;

var jwsUrls = {};

const getCredentials = async function() {
  var qrCode = null;
  if (mattrIssuerId != undefined ) {
    var url = `https://${mattrTenantDomain}.vii.mattr.global/ext/oidc/v1/issuers/${mattrIssuerId}`;
    qrCode = `${qrBaseURL}openid://discovery?issuer=${url}`;
  }
  console.log(qrCode);
  return qrCode;
}

/**
 * Create QR code for MATTR credentials validation.
 *
 * @return QR code and the challenge.
 */
const validateCredentials = async function() {

    // Get a access token for MATTR tenant.
    var tokenResponse = await got.post("https://auth.mattr.global/oauth/token",
        {
            json: {
                "client_id": matterClientId,
                "client_secret": matterClientSecret,
                "audience": "https://vii.mattr.global",
                "grant_type": "client_credentials"
            },
            responseType: 'json'
        }).json();
    var token = tokenResponse.access_token;
    console.log("Retrieved access token successfully.");

    // Create a Presentation Request
    var challenge = uuidv4();
    var presentationResponse = await got.post(`https://${mattrTenantDomain}.vii.mattr.global/core/v1/presentations/requests`,
        {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            json: {
                "challenge": challenge,
                "did": mattrNonBLSDidId,
                "templateId": mattrTempleId,
                "callbackUrl": `${host}/callback`
            },
            responseType: 'json'
    });
    console.log("Create Presentation Request statusCode: ", presentationResponse.statusCode);
    const requestPayload = presentationResponse.body.request;

    // Get DIDUrl from Verifier DID Doc
    var DIDResponse = await got.get(`https://${mattrTenantDomain}.vii.mattr.global/core/v1/dids/` + mattrNonBLSDidId,
        {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            responseType: 'json'
        });
    const didUrl = DIDResponse.body.didDocument.authentication[0];
    console.log("Public key from DID Doc found, DIDUrl is: " , didUrl);

   // Sign payload
    var signMesResponse = await got.post(`https://${mattrTenantDomain}.vii.mattr.global/core/v1/messaging/sign`,
        {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            json: {
                "didUrl": didUrl,
                "payload": requestPayload
            },
            responseType: 'json'
        });
    const jws = signMesResponse.body
    console.log("The signed Presentation Request message is: ", jws, '\n');

    //Add JWS URL to JWS URL list.
    jwsUrls[challenge] = `https://${mattrTenantDomain}.vii.mattr.global/?request=${jws}`;

    var qrCode = `${qrBaseURL}didcomm://${host}/qr/?challenge=${challenge}`;

    return { qrCode, challenge };
}

/**
 * Get JWS URL for given challenge.
 *
 * @param challenge  Challenge that used to create JWS URL.
 * @return JWS URL.
 */
const getJwsUrl = async function(challenge) {

    return jwsUrls[challenge];
}

module.exports = { getCredentials, validateCredentials, getJwsUrl };