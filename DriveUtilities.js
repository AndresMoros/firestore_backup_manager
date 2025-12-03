/**
 * 📢 DIAGNOSTIC FUNCTION: Run this function to force the Drive permissions window if necessary.
 */
function checkDrivePermissions() {
  Logger.log("Starting Drive permissions check...");
  try {
    // We try to get 10 files from your Drive. This line guarantees that the permissions request is triggered.
    const files = DriveApp.getFiles();
    let count = 0;
    while (files.hasNext() && count < 10) {
      files.next();
      count++;
    }
    Logger.log(
      `✅ Drive permissions confirmed. ${count} sample files were found.`,
    );
  } catch (e) {
    Logger.log(`❌ Unexpected error checking permissions: ${e.toString()}`);
  }
}

/**
 * Searches for a folder by ID or by name.
 * Prioritizes using the folder ID if provided. If the ID fails, it falls back to searching/creating by name.
 * @param {string} folderName The name of the folder to search for or create (used if folderId is not provided or invalid).
 * @param {string|null} [folderId] Optional: The ID of a specific folder to use.
 * @returns {DriveApp.Folder} The Folder object.
 */
function getOrCreateFolder(folderName, folderId) {
  if (folderId) {
    Logger.log(
      `FOLDER PHASE: Attempting to use provided Folder ID: ${folderId}`,
    );
    try {
      const folder = DriveApp.getFolderById(folderId);
      Logger.log(`FOLDER PHASE: Folder ID found and used: ${folder.getName()}`);
      return folder;
    } catch (e) {
      Logger.log(
        `FOLDER PHASE: WARNING: Provided Folder ID (${folderId}) is invalid or inaccessible. Falling back to name-based search.`,
      );
      // If ID fails, continue to name-based logic below
    }
  }

  Logger.log(
    `FOLDER PHASE: Searching for or creating the folder by name: ${folderName}`,
  );

  // 1. Try to find the existing folder by name
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    // 2. If it exists, return the first folder found
    const existingFolder = folders.next();
    Logger.log(
      `FOLDER PHASE: Folder found by Name: ${existingFolder.getName()} (ID: ${existingFolder.getId()})`,
    );
    return existingFolder;
  } else {
    // 3. If it doesn't exist, create a new folder in the Drive root
    Logger.log(
      `FOLDER PHASE: Folder not found by Name. Creating a new folder.`,
    );
    const newFolder = DriveApp.createFolder(folderName);
    Logger.log(
      `FOLDER PHASE: Folder created successfully: ${newFolder.getName()}`,
    );
    return newFolder;
  }
}
