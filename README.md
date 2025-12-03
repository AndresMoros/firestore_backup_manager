# Firestore Backup Manager
## Google AppScript application with a web interface to back up Firestore in Firebase

---

## Project Overview

**Firestore Backup Manager** is a robust and easy-to-use solution, developed in **Google AppScript**, that provides a web interface to **manage backups** of your **Firestore** collections in Firebase.

The project is designed for developers and database administrators looking for a reliable method to:
1.  **Create and save backups** of Firestore collections.
2.  **Restore or create collections** from existing backup files.

All backups are securely stored as **JSON** files within a specific folder in your **Google Drive**.

---

## Key Features

* **Secure Authentication:** Uses a Google **Service Account** (from the Firebase project) for secure authentication and data access.
* **Google Drive Management:** Saves all backups to a **designated Google Drive folder** (the application can create one if not specified).
* **Interactive Web Interface:** A simple and practical user interface allows developers to:
    * Run manual backups instantly.
    * Restore collections or create new ones based on a Drive JSON file ID.
* **Scheduled Triggers:** Allows you to set up AppScript **triggers** to automate periodic backups.

---

## Technology Stack

This project leverages the power of the Google and Firebase ecosystem:

* **Google AppScript:** Development environment for creating the web *backend* and *frontend* logic.
* **Firestore (Firebase):** The target NoSQL database and source of the backups.
* **JavaScript:** Used for the application logic and web user interface.
* **External Library:** The **Firestore Google AppScript** project is used to facilitate the connection to the database.
    * **Repository:** `https://github.com/grahamearley/FirestoreGoogleAppsScript`

---

## ⚙️ Installation and Configuration

For the **Firestore Backup Manager** to function correctly, you need to configure the **Script Properties** of your Google AppScript project.

**🚨 Configuration Steps:**

1.  **Clone or Copy the Code:** Transfer the code from this project to your Google AppScript environment.
2.  **Configure the Service Account:** Create a **Service Account** in your Firebase/Google Cloud project and download the key's JSON file.
3.  **Set Properties:** In your AppScript project, navigate to **Script Properties** and add the following values:

| Property | Description | Required |
| :--- | :--- | :--- |
| `SERVICE_ACCOUNT_KEY_JSON` | The complete content of the Service Account JSON file. | **Yes** |
| `FIREBASE_WEB_API_KEY` | The web API Key of your Firebase project. | **Yes** |
| `FIREBASE_PROJECT_ID` | The ID of your Firebase project (e.g., `my-project-12345`). | **Yes** |
| `COLLECTION_NAME` | The name of the collection to be backed up (e.g., `users`). | **Yes** |
| `BACKUP_FOLDER_ID` | The ID of the Google Drive folder where backups will be saved. | No (If omitted, the app creates a folder.) |

4.  **Deploy the Web App:** Deploy the project as a web application to access the interactive interface.
5.  **Create Triggers (Optional):** Configure AppScript *triggers* to automate the execution of the backup function.
