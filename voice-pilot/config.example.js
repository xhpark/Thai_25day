// Copy this file to config.js for a real deployment.
// Do not commit real project IDs, API keys, or approved user identifiers.
window.VOICE_PILOT_CONFIG = {
  firebase: {
    apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
    authDomain: "REPLACE_WITH_PROJECT.firebaseapp.com",
    projectId: "REPLACE_WITH_PROJECT_ID",
    appId: "REPLACE_WITH_FIREBASE_APP_ID"
  },
  auth: {
    provider: "email_password",
    approvedUids: ["REPLACE_WITH_APPROVED_FIREBASE_UID"],
    adminUids: ["REPLACE_WITH_ADMIN_FIREBASE_UID"]
  },
  stt: {
    apiBaseUrl: "https://REPLACE_WITH_CLOUD_RUN_URL",
    websocketUrl: "wss://REPLACE_WITH_CLOUD_RUN_URL/ws/stt",
    maxRecordingMs: 4000,
    connectTimeoutMs: 2500
  }
};
