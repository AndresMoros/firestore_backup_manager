function automaticBackups() {
    const collections_to_save = getProjectProperties().collection_name;
    
    if (!Array.isArray(collections_to_save)) {
        Logger.log("ERROR: collection_name must be an array");
        return;
    }
    
    collections_to_save.forEach((collection, index) => {
        try {
            Logger.log(`[${index + 1}/${collections_to_save.length}] Starting backup for: ${collection}`);
            backupFirestoreToDriveSimple(collection);
            Logger.log(`✅ Backup completed for ${collection}`);
        } catch (error) {
            Logger.log(`❌ Error during ${collection}'s backup: ${error.toString()}`);
        }
    });
}