const got = require("got");
const dotenv = require("dotenv");

dotenv.config();
const mattrIssuerId = process.env.MATTR_CREDENTIAL_ISSUER_ID;
const matterClientId = process.env.MATTR_CLIENT_ID;
const matterClientSecret = process.env.MATTR_CLIENT_SECRET;
const mattrTenantDomain = process.env.MATTR_TENANT_DOMAIN;
const mattrVerifierID = process.env.MATTR_VERIFIER_ID;
const mattrTempleID = process.env.MATTR_TEMPLATE_ID;

var baseURL = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data="

const getCredentials = async function() {
  var qrCode = null;
  if (mattrIssuerId != undefined ) {
    var url = `https://${mattrTenantDomain}.vii.mattr.global/ext/oidc/v1/issuers/${mattrIssuerId}`;
    qrCode = `${baseURL}openid://discovery?issuer=${url}`;
  }
  console.log(qrCode);
  return qrCode;
}

// validate mattr verifiable credentials
const validateCredentials = async function(ngrokUrl) {
    console.log(ngrokUrl);
    const getAccessTokenPayload = {
      "client_id": matterClientId,
      "client_secret": matterClientSecret,
      "audience": "https://vii.mattr.global",
      "grant_type": "client_credentials"
    };
    var tokenResponse = await got.post("https://auth.mattr.global/oauth/token",
      { json: getAccessTokenPayload }).json();

    var token = tokenResponse.access_token;
    console.log("Retrieved access token", tokenResponse.access_token);

    // Provision Presentation Request
    var presentationRequest = await got.post(`https://${mattrTenantDomain}.vii.mattr.global/core/v1/presentations/requests`,
        {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            json: {
                "challenge": "GW8FGpP6jhFrl37yQZIM6w",
                "did": mattrVerifierID,
                "templateId": mattrTempleID,
                "callbackUrl": `${ngrokUrl}/callback`
            },
            responseType: 'json'
    });
    console.log("Create Presentation Request statusCode: ", presentationRequest.statusCode);
    const requestPayload = presentationRequest.body.request;
    console.log(requestPayload, '\n');

    // Get DIDUrl from Verifier DID Doc
    var dids = `https://${mattrTenantDomain}.vii.mattr.global/core/v1/dids/` + mattrVerifierID
    console.log("Looking up DID Doc from Verifier DID :", dids);

    response = await got.get(dids, {

        headers: {
            "Authorization": `Bearer ${token}`
        },
        responseType: 'json'
    });
    console.log("Public key from DID Doc found, DIDUrl is: " , response.body.didDocument.authentication[0], '\n');
    const didUrl = response.body.didDocument.authentication[0];


   // Sign payload
    var signMes = `https://${mattrTenantDomain}.vii.mattr.global/core/v1/messaging/sign`
    console.log("Signing the Presentation Request payload at: " , signMes);

    response = await got.post(signMes, {

        headers: {
            "Authorization": `Bearer ${token}`
        },
        json: {
            "didUrl": didUrl,
            "payload": requestPayload
        },
        responseType: 'json'
    });
    const jws = response.body
    console.log("The signed Presentation Request message is: ", jws, '\n');

    jwsUrl = `https://${mattrTenantDomain}.vii.mattr.global/?request=${jws}`;

    var didcommUrl = `didcomm://${ngrokUrl}/qr`;
    console.log("The URL encoded in this QR code" , didcommUrl);

    return `${baseURL}${didcommUrl}`;
}

module.exports = { getCredentials, validateCredentials };