/**
 * Apps Script code to interact with Firestore
 * using the Firestore REST API (UrlFetchApp) with Service Account Authentication (JWT).
 *
 * REQUIRED CONFIGURATION (must be set in Script Properties):
 * 1. FIREBASE_PROJECT_ID: Your Firebase project ID.
 * 2. COLLECTION_NAME: The name of the collection to restore (if not present it will create a new one).
 * 3. SERVICE_ACCOUNT_KEY_JSON: The full JSON content of your Google Cloud Service Account Key.
 * 4. BACKUP_FOLDER_ID: The script will use this specific Drive Folder ID
 *
 * NOTE: This version uses Service Account authentication
 */


/**
 * Executes the Firestore restoration based on user input from the HTML form.
 * @param {string} mode 'overwrite' (PATCH existing) or 'new' (PATCH to new name).
 * @param {string} collectionName The target collection name.
 * @param {string} fileId The Drive File ID of the backup JSON file.
 * @param {string} projectId The Firebase Project ID supplied by the user. // <-- NEW PARAMETER
 * @returns {string} Status message.
 */
function executeRestore(mode, collectionName, fileId, projectId) {
    // 0. GET PROPERTIES (Access Token and Service Account Key are read from properties)
    const props = getProjectProperties();
    
    // Override key properties with user-supplied values
    props.collection_name = collectionName; 
    props.firebase_project_id = projectId; // <-- USE THE USER'S PROJECT ID
    
    // Now 'props' contains all configuration needed for the restore
    return restoreFirestoreFromDriveCore(fileId, props);
}

/**
 * Converts a simple JavaScript value (string, number, boolean) or complex
 * (Date, array, object) to the field format required by the Firestore REST API.
 * @param {any} value The value to convert.
 * @returns {object} The field object with Firestore type (e.g., {stringValue: '...'})
 */
function formatToFirestoreField(value) {
    if (value === null) {
        return { 'nullValue': null };
    }
    if (typeof value === 'boolean') {
        return { 'booleanValue': value };
    }
    if (typeof value === 'number') {
        // Use integerValue for integers and doubleValue for decimals
        if (Number.isInteger(value)) {
            // Firestore REST API requires integers to be sent as strings
            return { 'integerValue': value.toString() }; 
        }
        return { 'doubleValue': value };
    }
    if (typeof value === 'string') {
        // Try to detect and format ISO timestamps (like those produced by a backup)
        // Example: 2023-10-27T10:00:00.000Z
        if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(value)) {
            return { 'timestampValue': value };
        }
        return { 'stringValue': value };
    }
    
    // Handling Complex Types (Array and Map/Object)
    
    if (Array.isArray(value)) {
        // Recursively map each element of the array
        const arrayValues = value.map(formatToFirestoreField);
        return {
            'arrayValue': {
                'values': arrayValues
            }
        };
    }

    if (typeof value === 'object' && value !== null) {
        // Recursively map each field of the object (Map/Sub-document)
        const mapFields = {};
        for (const key in value) {
            if (value.hasOwnProperty(key)) {
                mapFields[key] = formatToFirestoreField(value[key]);
            }
        }
        return {
            'mapValue': {
                'fields': mapFields
            }
        };
    }

    // Fallback for unsupported types
    Logger.log('Unsupported data type encountered: ' + typeof value);
    return { 'nullValue': null };
}


 /**
  * RESTORATION CORE FUNCTION
  * Performs the actual restoration using the Service Account token.
  * @param {string} fileId The Drive File ID of the backup JSON file.
  * @param {object} props Object containing firebase_project_id, collection_name, and service_account_key.
  * @returns {string} Status message.
  */
function restoreFirestoreFromDriveCore(fileId, props) {
    let accessToken;
    let documentsToRestore; // Variable declared here to be accessible across the scope
    
    // Use the collection and project ID from the props object
    const { firebase_project_id, collection_name } = props;
    
    try {
        // 1. AUTHENTICATION
        // Ensure getServiceAccessToken is available and working
        accessToken = getServiceAccessToken(props.service_account_key);
        Logger.log("Authentication successful.");

        // 2. DRIVE READING PHASE (Robust error handling)
        Logger.log(`PHASE 1: Starting file read for ID: ${fileId}`);
        let content;
        
        try {
            // Try to get the file by ID
            const file = DriveApp.getFileById(fileId); 
            
            // Verify the file is valid or the ID is correct
            if (!file) {
                 throw new Error(`Drive file not found or ID is invalid: ${fileId}`);
            }
            
            // Try to read the content
            content = file.getBlob().getDataAsString();
            
        } catch (e) {
            // Catch DriveApp-specific errors (Permissions, invalid ID, etc.)
            Logger.log(`DRIVE ERROR: Failed to read file ${fileId}. Error: ${e.message}`);
            // Rethrow with a clear message about the source of the problem
            throw new Error(`Could not read the Drive file. Verify the ID (${fileId}) and your account's access permissions.`);
        }
        
        // Content verification
        if (!content || content.trim().length === 0) {
            throw new Error("The Drive file is empty or does not contain JSON data.");
        }
        
        // Parse JSON
        documentsToRestore = JSON.parse(content);
        
        Logger.log(`File read. Found ${documentsToRestore.length} documents to restore.`);

        // 3. FIRESTORE WRITING PHASE (Patching each document)
        Logger.log("PHASE 2: Starting restoration (PATCH operations)...");
        let successCount = 0;
        
        documentsToRestore.forEach(docData => {
            const docId = docData.docId;
            delete docData.docId;

            // Field formatting (ensure formatToFirestoreField is available)
            const formattedFields = {};
            for (const key in docData) {
                if (docData.hasOwnProperty(key)) {
                    // Ensure formatToFirestoreField is defined and working
                    formattedFields[key] = formatToFirestoreField(docData[key]);
                }
            }
            
            const payload = { fields: formattedFields };
            
            // Build the Firestore REST API URL
            const apiUrl = `https://firestore.googleapis.com/v1/projects/${firebase_project_id}/databases/(default)/documents/${collection_name}/${docId}`;

            const options = {
                method: "PATCH",
                muteHttpExceptions: true,
                headers: {
                    Authorization: "Bearer " + accessToken,
                    "Content-Type": "application/json",
                },
                payload: JSON.stringify(payload),
            };

            const response = UrlFetchApp.fetch(apiUrl, options);
            const responseCode = response.getResponseCode();

            if (responseCode === 200) {
                successCount++;
            } else {
                const responseText = response.getContentText();
                Logger.log(`[Error PATCH ${docId}] Code: ${responseCode}, Response: ${responseText}`);
            }
        });
        
        return `Restore complete. ${successCount} documents restored/updated in '${collection_name}'.`;

    } catch (e) {
        // Catch general errors from Auth, JSON.parse, or rethrown errors
        const errorMessage = e.message && e.message.includes("Restore failed") 
                             ? e.message 
                             : `Restore failed: Check the Service Key, Project ID, or Firestore permissions. Cause: ${e.message}`;
                             
        Logger.log(`❌ FINAL RESTORATION ERROR: ${e.toString()}`);
        throw new Error(errorMessage);
    }
}