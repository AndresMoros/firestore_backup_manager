/**
 * Apps Script code to back up a Firestore collection to Google Drive
 * using the Firestore REST API (UrlFetchApp) with Service Account Authentication (JWT).
 *
 * REQUIRED CONFIGURATION (must be set in Script Properties):
 * 1. FIREBASE_PROJECT_ID: Your Firebase project ID.
 * 2. COLLECTION_NAME: The name of the collection to back up
 * 3. SERVICE_ACCOUNT_KEY_JSON: The full JSON content of your Google Cloud Service Account Key.
 * 4. BACKUP_FOLDER_ID (OPTIONAL): If provided, the script will use this specific Drive Folder ID instead of searching/creating by name.
 *
 * NOTE: This version uses Service Account authentication and pagination.
 */

const PAGE_SIZE = 1000; // Batch of documents to request in each query
const DRIVE_FOLDER_NAME = "Firestore Backups"; // Name of the folder to be created/searched for in Drive (Fallback if ID is missing)

/**
 * Recursive function to transform the Firebase REST API field format
 * to a standard JSON/JavaScript object.
 * @param {object} field Firebase field object (e.g., { stringValue: '...' } or { mapValue: {...} })
 * @returns {*} The cleaned value (string, number, array, object, etc.)
 */
function extractFieldValue(field) {
  if (!field || typeof field !== "object") return null;

  // The value type is the object's only key (e.g., 'stringValue', 'mapValue')
  const type = Object.keys(field)[0];
  const value = field[type];

  switch (type) {
    case "stringValue":
    case "integerValue":
    case "doubleValue":
    case "booleanValue":
    case "timestampValue":
      return value; // Simple values

    case "nullValue":
    case "undefinedValue":
      return null;

    case "arrayValue":
      // If it's an array, map each value recursively
      if (value.values) {
        // Map each element of the array, which can be a mapValue, stringValue, etc.
        return value.values.map((item) => extractFieldValue(item));
      }
      return [];

    case "mapValue":
      // If it's a map (object), iterate over its fields recursively
      const map = {};
      if (value.fields) {
        for (const key in value.fields) {
          // Calls extractFieldValue for each map field
          map[key] = extractFieldValue(value.fields[key]);
        }
      }
      return map;

    default:
      // Return the value as is if the type is unrecognized
      Logger.log("WARNING: Unrecognized Firestore field type: " + type);
      return value;
  }
}

/**
 * Function that performs a single GET request to the Firestore API
 * and handles pagination with a token.
 * @param {string} accessToken The OAuth 2.0 Bearer token.
 * @param {string} nextPageToken Token to get the next page of results.
 * @returns {object} Object with the data (documents) and the nextPageToken.
 */
function fetchFirestorePage(props, accessToken, nextPageToken) {
  const { firebase_project_id, collection_name } = props;

  let apiUrl = `https://firestore.googleapis.com/v1/projects/${firebase_project_id}/databases/(default)/documents/${collection_name}?pageSize=${PAGE_SIZE}`;

  if (nextPageToken) {
    apiUrl += `&pageToken=${nextPageToken}`;
    Logger.log(
      `...Fetching next page with token: ${nextPageToken.substring(0, 15)}...`,
    );
  } else {
    Logger.log(`Starting fetching first page (limit: ${PAGE_SIZE})...`);
  }

  const options = {
    method: "get",
    muteHttpExceptions: true,
    // CRUCIAL: Add the Authorization header with the Bearer token
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    Logger.log(
      `[HTTP Error ${responseCode}] Pagination failed. Response: ${responseText}`,
    );
    throw new Error(
      `Error in Firestore API (Code ${responseCode}). Check service account permissions (roles/datastore.viewer). See log for details.`,
    );
  }

  // If the response is empty (possibly the last page with no documents), we return an empty object to terminate the loop.
  if (!responseText) return {};

  return JSON.parse(responseText);
}

/**
 * Main function to perform the backup with Pagination.
 */
function backupFirestoreToDrivePaginated() {
  let accessToken;
  let allDocuments = [];
  let nextPageToken = null;
  let pageCount = 0;

  // Try to get properties first (might throw if SERVICE_ACCOUNT_KEY_JSON is invalid)
  const props = getProjectProperties();
  const { collection_name } = props;

  try {
    // 0. AUTHENTICATION PHASE: Get the token first
    accessToken = getServiceAccessToken(props.service_account_key);

    // 1. DATA READING PHASE (Paginacion)
    Logger.log("PHASE 1: Starting Firestore data reading...");
    do {
      pageCount++;
      // NEW CALL: Pass the access token
      const pageResult = fetchFirestorePage(props, accessToken, nextPageToken);

      const documents = pageResult.documents || [];
      nextPageToken = pageResult.nextPageToken || null;

      Logger.log(
        `Page ${pageCount} fetched. Documents received: ${
          documents.length
        }. More pages: ${!!nextPageToken}`,
      );

      // Processing the documents for this page
      documents.forEach((doc) => {
        const docData = {};
        const fields = doc.fields;

        if (fields) {
          for (const key in fields) {
            if (fields.hasOwnProperty(key)) {
              // WE USE THE CLEANUP FUNCTION
              docData[key] = extractFieldValue(fields[key]);
            }
          }
        }

        const docName = doc.name;
        docData.docId = docName.split("/").pop();

        allDocuments.push(docData);
      });
    } while (nextPageToken); // Repeat while there is a next page token

    // DIAGNOSTIC: Confirm that the data has been loaded and cleaned.
    Logger.log(
      `DIAGNOSTIC: All ${allDocuments.length} documents loaded and ready to save.`,
    );

    // 2. DRIVE SAVING PHASE
    Logger.log("PHASE 2: Starting save to Google Drive.");
    let backupFolder;

    try {
      // 2.1 Get or create the backup folder. We pass both the name and the optional ID.
      backupFolder = getOrCreateFolder(
        DRIVE_FOLDER_NAME,
        props.backup_folder_id,
      );

      // 2.2 Prepare the JSON file
      const jsonString = JSON.stringify(allDocuments, null, 2);

      const timestamp = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyyMMdd_HHmmss",
      );
      const fileName = `${collection_name}_backup_${timestamp}.json`;

      Logger.log("SAVING PHASE: Creating JSON file...");

      // We use 'application/json' as the MimeType.
      backupFolder.createFile(fileName, jsonString, "application/json");

      Logger.log("SAVING PHASE: File created successfully.");

      Logger.log(
        `✅ Backup created successfully: ${fileName} with ${
          allDocuments.length
        } records in folder: ${backupFolder.getName()}.`,
      );
    } catch (e) {
      // We catch Drive errors, which now should only be due to permissions or server errors
      if (e.message && e.message.includes("Authorization is required")) {
        Logger.log(
          `❌ CRITICAL AUTHORIZATION ERROR: The script needs permission to access and/or create folders in Google Drive. Please perform RE-AUTHORIZATION.`,
        );
      } else {
        Logger.log(`❌ ERROR SAVING TO DRIVE: ${e.toString()}`);
      }
    }
  } catch (e) {
    // This will catch errors from Authentication, UrlFetchApp, Firestore API, or JSON.parse
    Logger.log(`❌ FINAL ERROR: ${e.toString()}`);
  }
}

// -------------------------------------------------------------
// Compatibility function to run from the editor (Run this one!)
// -------------------------------------------------------------
function backupFirestoreToDriveSimple() {
  backupFirestoreToDrivePaginated();
}
