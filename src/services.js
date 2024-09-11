const got = require("got");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require('uuid');

// Retrieve configurations from the .env file.
dotenv.config();
const mattrIssuerId = process.env.MATTR_CREDENTIAL_ISSUER_ID;
const matterClientId = process.env.MATTR_CLIENT_ID;
const matterClientSecret = process.env.MATTR_CLIENT_SECRET;
const mattrTenantDomainUrl = process.env.MATTR_TENANT_DOMAIN_URL;
const mattrTempleId = process.env.MATTR_TEMPLATE_ID;
const mattrVerifierDid = process.env.MATTR_VERIFIER_DID;
const qrBaseURL = process.env.QR_BASE_URL;
const callbackURL = process.env.CALLBACK_URL;

var jwsUrls = {};

const getCredentials = async function() {
  var qrCode = null;
  // TODO: Need to modify this method with the new mattr workflow & APIs.
  if (mattrIssuerId != undefined ) {
    var url = `${mattrTenantDomain}.vii.mattr.global/ext/oidc/v1/issuers/${mattrIssuerId}`;
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
                "audience": mattrTenantDomainUrl,
                "grant_type": "client_credentials"
            },
            responseType: 'json'
        }).json();
    var token = tokenResponse.access_token;
    console.log("Retrieved access token successfully.");

    // Create a Presentation Request
    var challenge = uuidv4();
    var presentationResponse = await got.post(`${mattrTenantDomainUrl}/v2/credentials/web-semantic/presentations/requests`,
        {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            json: {
                "challenge": challenge,
                "did": mattrVerifierDid,
                "templateId": mattrTempleId,
                "callbackUrl": callbackURL
            },
            responseType: 'json'
    });
    console.log("Create Presentation Request statusCode: ", presentationResponse.statusCode);
    const didcommUri = presentationResponse.body.didcommUri;
    var qrCode = qrBaseURL + didcommUri;
    console.log("The URL encoded in this QR code", didcommUri);

    return { qrCode, challenge };
}

/**
 * Get JWS URL for given challenge.
 *
 * @param challenge  Challenge that used to create JWS URL.
 * @return JWS URL.
 */
const getJwsUrl = async function(challenge) {

    // TODO: Find usage and improve for new workflow.
    return jwsUrls[challenge];
}

module.exports = { getCredentials, validateCredentials, getJwsUrl };