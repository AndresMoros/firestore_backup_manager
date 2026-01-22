function automaticBackups() {
    // Check if it's Saturday (6) or Sunday (0)
    const today = new Date();
    const dayOfWeek = today.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        Logger.log(`⏭️ Backup skipped - today is ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}`);
        return;
    }

    const raw_collection = getProjectProperties().collection_name;

    let collections_to_save;
    try {
        collections_to_save = JSON.parse(raw_collection);
    } catch (e) {
        Logger.log("ERROR: collection_name no tiene un formato JSON válido");
        return;
    }

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
