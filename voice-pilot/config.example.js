// Copy this file to config.js for a real deployment.
// Do not commit approved user identifiers or server secrets.
window.VOICE_PILOT_CONFIG = {
  firebase: {
    apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
    authDomain: "REPLACE_WITH_PROJECT.firebaseapp.com",
    projectId: "REPLACE_WITH_PROJECT_ID",
    appId: "REPLACE_WITH_FIREBASE_APP_ID"
  },
  auth: {
    provider: "email_password",
    // Keep this empty for public hosting and let Cloud Run enforce the allowlist.
    approvedUids: [],
    adminUids: []
  },
  stt: {
    apiBaseUrl: "https://REPLACE_WITH_CLOUD_RUN_URL",
    websocketUrl: "wss://REPLACE_WITH_CLOUD_RUN_URL/ws/stt",
    maxRecordingMs: 4000,
    connectTimeoutMs: 2500
  }
};
