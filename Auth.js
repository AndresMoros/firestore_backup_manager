/**
 * Generates an Access Token using the Service Account Private Key and JWT assertion.
 * @param {object} saKey The parsed service account JSON object.
 * @returns {string} The OAuth 2.0 Access Token.
 */
function getServiceAccessToken(saKey) {
  Logger.log("AUTH PHASE: Generating Access Token using Service Account...");
  const GOOGLE_AUTH_URL = saKey.token_uri; // https://oauth2.googleapis.com/token
  const JWT_SCOPE = "https://www.googleapis.com/auth/datastore"; // Scope for Firestore
  const AUDIENCE = GOOGLE_AUTH_URL;

  // JWT Header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // JWT Claim Set (Payload)
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: saKey.client_email, // Issuer
    scope: JWT_SCOPE, // Scope
    aud: AUDIENCE, // Audience
    iat: now, // Issued at
    exp: now + 3600, // Expiration time (1 hour = 3600 seconds)
  };

  // 1. Encode Header and Claim Set
  const headerBase64 = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  const claimSetBase64 = Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
  const signatureInput = headerBase64 + "." + claimSetBase64;

  // 2. Sign the Input using the Private Key
  // CRUCIAL CHANGE: Prepare the private key format required by computeRsaSha256Signature.
  // We MUST keep the BEGIN/END markers AND the line breaks (\n).
  // The previous attempts to remove everything caused the "Invalid argument: key" error.
  const privateKey = saKey.private_key;

  // Compute signature
  const signature = Utilities.computeRsaSha256Signature(
    signatureInput,
    privateKey
  );

  // 3. Assemble the final JWT
  const signatureBase64 = Utilities.base64EncodeWebSafe(signature);
  const jwt = signatureInput + "." + signatureBase64;

  // 4. Exchange JWT for Access Token
  const payload = {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  };

  // Format payload for x-www-form-urlencoded
  const formPayload = Object.keys(payload)
    .map(
      (key) =>
        encodeURIComponent(key) + "=" + encodeURIComponent(payload[key])
    )
    .join("&");

  const options = {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: formPayload,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(GOOGLE_AUTH_URL, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    Logger.log(
      `AUTH ERROR: Failed to get access token (Code ${responseCode}). Response: ${responseText}`
    );
    throw new Error(
      "Authentication failed. Check SERVICE_ACCOUNT_KEY_JSON property and permissions."
    );
  }

  const tokenData = JSON.parse(responseText);

  if (!tokenData.access_token) {
    throw new Error("Authentication failed: Access token missing in response.");
  }

  Logger.log("AUTH PHASE: Access Token generated successfully.");
  return tokenData.access_token;
}

/**
 * Function to get the project's pre-configurated properties.
 * @param {None} None No parameters needed.
 * @returns {Object} An Object with the properties of the project.
 */

function getProjectProperties() {
  // Get properties from the project configuration
  const PROPERTIES = PropertiesService.getScriptProperties();

  const FIREBASE_PROJECT_ID = PROPERTIES.getProperty("FIREBASE_PROJECT_ID");
  const COLLECTION_NAME = PROPERTIES.getProperty("COLLECTION_NAME");
  const BACKUP_FOLDER_ID = PROPERTIES.getProperty("BACKUP_FOLDER_ID");
  const SERVICE_ACCOUNT_KEY_JSON = PROPERTIES.getProperty(
    "SERVICE_ACCOUNT_KEY_JSON"
  ); // NEW REQUIRED PROPERTY

  if (!SERVICE_ACCOUNT_KEY_JSON) {
    throw new Error(
      "Configuration error: SERVICE_ACCOUNT_KEY_JSON property is missing."
    );
  }

  return {
    firebase_project_id: FIREBASE_PROJECT_ID,
    collection_name: COLLECTION_NAME,
    backup_folder_id: BACKUP_FOLDER_ID,
    service_account_key: JSON.parse(SERVICE_ACCOUNT_KEY_JSON), // Parse the JSON string
  };
}