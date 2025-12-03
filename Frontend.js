/**
 * Front-end functions
 */

function doGet() {
  let template = HtmlService.createTemplateFromFile("index");

  // You can pass data to the HTML template using template variables
  return template.evaluate();
}

function includeCSS(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function includeJS(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/**
 * Fetches a segment of backup files for pagination, sorted by date (newest first).
 * @param {number} start The starting index (zero-based).
 * @param {number} limit The maximum number of elements to return (always 10).
 * @returns {object} An object containing the paginated file data and the total file count.
 */
function getBackupFiles(start, limit) {
  try {
    const folderId = getProjectProperties().backup_folder_id;
    if (!folderId) {
      throw new Error("Backup folder ID is not configured in project properties.");
    }

    const BACKUP_FOLDER = DriveApp.getFolderById(folderId);
    let files_iterator = BACKUP_FOLDER.getFiles();
    let all_files_array = [];

    // 1. Get ALL data and convert the date string back to a Date object for sorting
    while (files_iterator.hasNext()) {
      const file = files_iterator.next();
      all_files_array.push({
        date: file.getDateCreated(), // Keep it as a Date object initially
        name: file.getName(),
        size: `${(file.getSize() / 1024).toFixed(2)} KB`,
        id: file.getId(),
      });
    }
    
    // 2. CRUCIAL: Sort the array by date descending (newest first)
    all_files_array.sort((a, b) => {
      // We subtract Date objects; the result is milliseconds.
      // b.date - a.date ensures descending order (newest first)
      return b.date - a.date; 
    });

    const totalCount = all_files_array.length;
    
    // 3. Convert Date objects to strings for safe serialization before returning
    const serializableFiles = all_files_array.map(file => {
        return {
            ...file, // Keep all existing properties (name, size, id)
            date: file.date.toString() // Convert the Date object to string
        };
    });

    // 4. Apply pagination (SLICE) to the sorted, serializable array
    const paginatedFiles = serializableFiles.slice(start, start + limit);

    // 5. Return the sliced data and the total count
    return {
      files: paginatedFiles,
      total: totalCount
    };

  } catch (e) {
    Logger.log("Critical error in getBackupFiles (sorted): " + e.toString());
    return { files: [], total: 0 }; 
  }
}

/**
 * Generate and url for the selected files
 * @param {string} fileId // file id on Drive
 * @returns {string}      // download url to get the actual file 
 */
function generateDownloadUrl(fileId) {
  try {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    return downloadUrl;
  } catch (e) {
    Logger.log("Error to generate the download link " + fileId + ": " + e.toString());
    throw new Error("Dowload link generation error. Make sure the file exist or you have permissions on it");
  }
} 