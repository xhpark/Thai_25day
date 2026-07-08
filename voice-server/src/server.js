import http from "node:http";
import crypto from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Firestore } from "@google-cloud/firestore";
import { v1 as speechV1 } from "@google-cloud/speech";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

const PORT = Number(process.env.PORT || 8080);
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const SPEECH_LOCATION = process.env.SPEECH_LOCATION || "global";
const SPEECH_RECOGNIZER = process.env.SPEECH_RECOGNIZER || "_";
const APPROVED_UIDS = new Set(splitEnv(process.env.APPROVED_UIDS));
const FIRESTORE_COLLECTION = process.env.FIRESTORE_COLLECTION || "pronunciationAttempts";
const WEBAUTHN_CREDENTIALS_COLLECTION = process.env.WEBAUTHN_CREDENTIALS_COLLECTION || "voicePilotCredentials";
const WEBAUTHN_CHALLENGES_COLLECTION = process.env.WEBAUTHN_CHALLENGES_COLLECTION || "voicePilotChallenges";
const RP_ID = process.env.RP_ID || "localhost";
const RP_NAME = process.env.RP_NAME || "Thai Voice Pilot";
const EXPECTED_ORIGIN = process.env.EXPECTED_ORIGIN || `https://${RP_ID}`;
const ALLOWED_ORIGINS = new Set([EXPECTED_ORIGIN, ...splitEnv(process.env.ALLOWED_ORIGINS)]);
const PILOT_SESSION_SECRET = process.env.PILOT_SESSION_SECRET || "";
const PILOT_SESSION_TTL_SECONDS = Number(process.env.PILOT_SESSION_TTL_SECONDS || 600);
const REVIEW_SESSION_TTL_SECONDS = Number(process.env.REVIEW_SESSION_TTL_SECONDS || 300);
const REVIEW_RATE_LIMIT_PER_HOUR = Number(process.env.REVIEW_RATE_LIMIT_PER_HOUR || 120);
const MAX_AUDIO_MS = Number(process.env.MAX_AUDIO_MS || 4000);
const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES || 524288);
const REVIEW_ALLOWED_PHRASES_BY_DAY = new Map([
  [21, ["17", "18", "19", "20", "21", "22", "23", "24"]],
  [22, ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "8", "9", "10", "10-2", "11", "12", "13", "14", "15", "16"]],
  [23, ["17", "18", "19", "20", "21", "22", "23", "24"]],
  [24, ["1", "2-1", "2-2", "3", "4", "5-1", "5-2", "6", "7", "8", "9", "10", "10-2", "11", "12", "13", "14", "15", "16"]],
  [25, ["17", "18", "19", "20", "21", "22", "23", "24"]]
]);
const REVIEW_ALLOWED_THAI_BY_PHRASE = new Map([
  ["1", ["สวัสดีครับ", "สวัสดีค่ะ"]],
  ["2-1", ["สวัสดีตอนเช้าครับ", "สวัสดีตอนเช้าค่ะ"]],
  ["2-2", ["สวัสดีตอนเย็นครับ", "สวัสดีตอนเย็นค่ะ"]],
  ["3", ["ขอบคุณมากครับ", "ขอบคุณมากค่ะ"]],
  ["4", ["ไม่เป็นไรครับ", "ไม่เป็นไรค่ะ"]],
  ["5-1", ["ใช่ครับ", "ใช่ค่ะ"]],
  ["5-2", ["ไม่ใช่ครับ", "ไม่ใช่ค่ะ"]],
  ["6", ["ขอโทษครับ", "ขอโทษค่ะ"]],
  ["7", ["ไม่เป็นไรครับ", "ไม่เป็นไรค่ะ"]],
  ["8", ["คุณชื่ออะไรครับ", "คุณชื่ออะไรคะ"]],
  ["9", ["ผมชื่อ ~ ครับ", "ฉันชื่อ ~ ค่ะ"]],
  ["10", ["คุณอายุเท่าไหร่ครับ", "คุณอายุเท่าไหร่คะ"]],
  ["10-2", ["ผมอายุ ~ ปีครับ", "ฉันอายุ ~ ปีค่ะ"]],
  ["11", ["ห้องน้ำอยู่ที่ไหนครับ", "ห้องน้ำอยู่ที่ไหนคะ"]],
  ["12", ["ทานให้อร่อยนะครับ", "ทานให้อร่อยนะคะ"]],
  ["13", ["อร่อยมากจริง ๆ ครับ", "อร่อยมากจริง ๆ ค่ะ"]],
  ["14", ["เก่งมากครับ", "เก่งมากค่ะ"]],
  ["15", ["ลาก่อนครับ", "ลาก่อนค่ะ"]],
  ["16", ["แล้วพบกันใหม่ครับ", "แล้วพบกันใหม่ค่ะ"]],
  ["17", ["พระเยซูทรงรักคุณครับ", "พระเยซูทรงรักคุณค่ะ"]],
  ["18", ["พระเจ้าทรงรักคุณครับ", "พระเจ้าทรงรักคุณค่ะ"]],
  ["19", ["ขอพระเจ้าอวยพรคุณครับ", "ขอพระเจ้าอวยพรคุณค่ะ"]],
  ["20", ["พระเจ้าทรงเป็นความรักครับ", "พระเจ้าทรงเป็นความรักค่ะ"]],
  ["21", ["เชื่อในพระเยซูครับ", "เชื่อในพระเยซูค่ะ"]],
  ["22", ["พวกเรารักคุณครับ", "พวกเรารักคุณค่ะ"]],
  ["23", ["ผมจะอธิษฐานให้คุณครับ", "ฉันจะอธิษฐานให้คุณค่ะ"]],
  ["24", ["มาร้องเพลงสรรเสริญด้วยกันครับ", "มาร้องเพลงสรรเสริญด้วยกันค่ะ"]]
]);
const reviewRateLimits = new Map();

initializeApp();
const auth = getAuth();
const firestore = new Firestore();
const speechClient = new speechV1.SpeechClient();

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    writeJson(request, response, 204, {});
    return;
  }

  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname.replace(/\/$/, "") || "/";
  if (requestPath === "/healthz") {
    writeJson(request, response, 200, { ok: true, service: "thai-voice-pilot-server" });
    return;
  }

  try {
    const routeHandled = await routeHttp(request, response);
    if (routeHandled) return;
    writeJson(request, response, 404, { error: "not_found" });
  } catch (error) {
    writeJson(request, response, statusForError(error), { error: safeError(error) });
  }
});

const wss = new WebSocketServer({ server, path: "/ws/stt", maxPayload: MAX_AUDIO_BYTES });

wss.on("connection", (ws) => {
  const session = {
    uid: null,
    email: null,
    targetThai: "",
    targetKorean: "",
    day: null,
    phraseId: null,
    mode: "iphone_pilot",
    anonymous: false,
    audioEncoding: "",
    sampleRateHertz: 0,
    transcript: "",
    interimTranscript: "",
    saved: false,
    audioBytes: 0,
    startedAt: Date.now(),
    speechStream: null,
    closed: false,
    speechFailed: false,
    errorSent: false
  };

  ws.on("message", async (message, isBinary) => {
    try {
      if (!isBinary) {
        await handleControlMessage(ws, session, message.toString("utf8"));
        return;
      }
      handleAudioChunk(ws, session, message);
    } catch (error) {
      sendSpeechError(ws, session, error);
      closeSpeechStream(session);
    }
  });

  ws.on("close", () => closeSpeechStream(session));
  ws.on("error", () => closeSpeechStream(session));
});

server.listen(PORT, () => {
  console.log(`thai voice pilot server listening on ${PORT}`);
});

async function handleControlMessage(ws, session, raw) {
  const payload = JSON.parse(raw);
  if (payload.type === "start") {
    await startSession(ws, session, payload);
    return;
  }
  if (payload.type === "end") {
    await finishSession(ws, session);
  }
}

async function startSession(ws, session, payload) {
  if (session.uid) throw new Error("session_already_started");
  if (!payload.sessionToken) throw new Error("missing_pilot_session_token");
  if (!PROJECT_ID) throw new Error("missing_google_cloud_project");

  const verifiedSession = verifyPilotSessionToken(payload.sessionToken);
  if (verifiedSession.mode === "final_review") {
    assertReviewStartMatchesToken(payload, verifiedSession);
  }
  const uid = verifiedSession.uid;

  session.uid = uid;
  session.email = verifiedSession.email || "";
  session.targetThai = String(payload.targetThai || "").slice(0, 200);
  session.targetKorean = String(payload.targetKorean || "").slice(0, 200);
  session.day = Number(payload.day || 0);
  session.phraseId = String(payload.phraseId || "").slice(0, 80);
  session.mode = verifiedSession.mode || "iphone_pilot";
  session.anonymous = Boolean(verifiedSession.anonymous);
  session.startedAt = Date.now();
  session.audioEncoding = String(payload.audioEncoding || "").toUpperCase();
  session.sampleRateHertz = Number(payload.sampleRateHertz || 0);

  session.speechStream = speechClient
    .streamingRecognize({
      config: recognitionConfig(session),
      interimResults: true
    })
    .on("data", (response) => handleSpeechResponse(ws, session, response))
    .on("error", (error) => {
      sendSpeechError(ws, session, error);
      closeSpeechStream(session);
    })
    .on("end", () => {
      if (!session.closed) send(ws, { type: "stream_end" });
    });

  send(ws, { type: "ready" });
}

function recognitionConfig(session) {
  if (session.audioEncoding === "LINEAR16" && session.sampleRateHertz >= 8000) {
    return {
      encoding: "LINEAR16",
      sampleRateHertz: Math.round(session.sampleRateHertz),
      audioChannelCount: 1,
      languageCode: "th-TH",
      model: "latest_short",
      enableAutomaticPunctuation: false
    };
  }
  return {
    encoding: "ENCODING_UNSPECIFIED",
    languageCode: "th-TH",
    model: "latest_short",
    enableAutomaticPunctuation: false
  };
}

function handleAudioChunk(ws, session, chunk) {
  if (session.speechFailed || session.closed) return;
  if (!session.uid || !session.speechStream) throw new Error("session_not_started");
  if (session.speechStream.destroyed || session.speechStream.writableEnded || session.speechStream.writableDestroyed) {
    session.speechFailed = true;
    return;
  }
  if (Date.now() - session.startedAt > MAX_AUDIO_MS + 2500) throw new Error("recording_window_expired");
  session.audioBytes += chunk.byteLength;
  if (session.audioBytes > MAX_AUDIO_BYTES) throw new Error("audio_too_large");

  try {
    session.speechStream.write(chunk);
  } catch (error) {
    sendSpeechError(ws, session, error);
    closeSpeechStream(session);
  }
}

function handleSpeechResponse(ws, session, response) {
  const result = response.results?.[0];
  const alternative = result?.alternatives?.[0];
  const transcript = alternative?.transcript || "";
  if (!transcript) return;

  if (result.isFinal) {
    session.transcript = transcript;
    const score = scoreTranscript(session.targetThai, transcript);
    send(ws, { type: "final", transcript, score });
  } else {
    session.interimTranscript = transcript;
    send(ws, { type: "interim", transcript });
  }
}

async function finishSession(ws, session) {
  if (!session.uid) throw new Error("session_not_started");
  if (session.speechFailed) {
    return;
  }
  closeSpeechStream(session);

  setTimeout(() => {
    persistSession(ws, session).catch((error) => send(ws, { type: "error", message: safeError(error) }));
  }, 900);
}

async function persistSession(ws, session) {
  if (session.saved) return;
  session.saved = true;
  const transcript = session.transcript || session.interimTranscript || "";
  const score = scoreTranscript(session.targetThai, transcript);
  if (!transcript) {
    send(ws, { type: "no_speech", transcript: "", score: null });
    return;
  }
  if (transcript) {
    await firestore.collection(FIRESTORE_COLLECTION).add({
      uid: session.uid,
      email: session.email,
      mode: session.mode,
      anonymous: session.anonymous,
      day: session.day,
      phraseId: session.phraseId,
      targetThai: session.targetThai,
      targetKorean: session.targetKorean,
      transcript,
      score,
      audioStored: false,
      createdAt: FieldValue.serverTimestamp()
    });
  }
  send(ws, { type: "saved", transcript, score });
}

function closeSpeechStream(session) {
  if (session.closed) return;
  session.closed = true;
  if (session.speechStream) {
    if (!session.speechStream.destroyed && !session.speechStream.writableEnded && !session.speechStream.writableDestroyed) {
      session.speechStream.end();
    }
    session.speechStream = null;
  }
}

function sendSpeechError(ws, session, error) {
  const message = safeError(error);
  const reason = error?.reason || error?.statusDetails?.[0]?.reason || error?.errorInfoMetadata?.method || "";
  const detail = reason ? `${message} ${reason}` : message;
  console.error("speech_stream_error", detail);
  session.speechFailed = true;
  if (!session.errorSent) {
    send(ws, { type: "error", message: detail });
    session.errorSent = true;
  }
}

async function routeHttp(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method !== "POST") return false;

  if (url.pathname === "/review/session") {
    const body = await readJson(request);
    const result = createReviewSession(request, body);
    writeJson(request, response, 200, result);
    return true;
  }

  if (url.pathname === "/webauthn/register/options") {
    const user = await verifyApprovedRequest(request);
    const options = await createRegistrationOptions(user);
    writeJson(request, response, 200, options);
    return true;
  }

  if (url.pathname === "/webauthn/status") {
    const user = await verifyApprovedRequest(request);
    const credentials = await listCredentials(user.uid);
    writeJson(request, response, 200, { registered: credentials.length > 0, credentialCount: credentials.length });
    return true;
  }

  if (url.pathname === "/webauthn/register/verify") {
    const user = await verifyApprovedRequest(request);
    const body = await readJson(request);
    const result = await verifyRegistration(user, body);
    writeJson(request, response, 200, result);
    return true;
  }

  if (url.pathname === "/webauthn/auth/options") {
    const user = await verifyApprovedRequest(request);
    const options = await createAuthenticationOptions(user);
    writeJson(request, response, 200, options);
    return true;
  }

  if (url.pathname === "/webauthn/auth/verify") {
    const user = await verifyApprovedRequest(request);
    const body = await readJson(request);
    const result = await verifyAuthentication(user, body);
    writeJson(request, response, 200, result);
    return true;
  }

  return false;
}

function createReviewSession(request, body) {
  assertReviewRateLimit(request);
  const day = Number(body.day || 0);
  const phraseId = String(body.phraseId || "").slice(0, 80);
  const targetThai = String(body.targetThai || "").trim().slice(0, 200);
  const targetKorean = String(body.targetKorean || "").trim().slice(0, 200);
  const lessonId = String(body.lessonId || "").slice(0, 80);
  const speaker = String(body.speaker || "").slice(0, 20);
  if (!isAllowedReviewPhrase(day, phraseId)) throw new Error("review_phrase_not_allowed");
  if (!targetThai) throw new Error("missing_review_target_thai");
  if (!isAllowedReviewThai(phraseId, targetThai)) throw new Error("review_target_not_allowed");

  const anonymousId = String(body.anonymousId || "").slice(0, 80);
  const anonymousHash = anonymousId
    ? crypto.createHash("sha256").update(`review:${anonymousId}`).digest("hex").slice(0, 24)
    : "anonymous";
  const payload = {
    uid: `anonymous_review:${anonymousHash}`,
    email: "",
    mode: "final_review",
    anonymous: true,
    day,
    phraseId,
    targetThai,
    targetKorean,
    lessonId,
    speaker,
    exp: Math.floor(Date.now() / 1000) + REVIEW_SESSION_TTL_SECONDS
  };
  return {
    sessionToken: signSessionPayload(payload),
    expiresInSeconds: REVIEW_SESSION_TTL_SECONDS
  };
}

function assertReviewRateLimit(request) {
  const key = clientIp(request);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (reviewRateLimits.get(key) || []).filter((time) => now - time < windowMs);
  if (hits.length >= REVIEW_RATE_LIMIT_PER_HOUR) throw new Error("review_rate_limited");
  hits.push(now);
  reviewRateLimits.set(key, hits);
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function isAllowedReviewPhrase(day, phraseId) {
  const allowed = REVIEW_ALLOWED_PHRASES_BY_DAY.get(Number(day));
  return Boolean(allowed && allowed.includes(String(phraseId)));
}

function isAllowedReviewThai(phraseId, targetThai) {
  const allowed = REVIEW_ALLOWED_THAI_BY_PHRASE.get(String(phraseId));
  return Boolean(allowed && allowed.includes(String(targetThai || "").trim()));
}

function assertReviewStartMatchesToken(payload, verifiedSession) {
  const day = Number(payload.day || 0);
  const phraseId = String(payload.phraseId || "");
  const targetThai = String(payload.targetThai || "").trim();
  if (day !== Number(verifiedSession.day)) throw new Error("review_session_day_mismatch");
  if (phraseId !== String(verifiedSession.phraseId)) throw new Error("review_session_phrase_mismatch");
  if (targetThai !== String(verifiedSession.targetThai || "").trim()) throw new Error("review_session_target_mismatch");
  if (!isAllowedReviewPhrase(day, phraseId)) throw new Error("review_phrase_not_allowed");
  if (!isAllowedReviewThai(phraseId, targetThai)) throw new Error("review_target_not_allowed");
}

async function verifyApprovedRequest(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("missing_auth_token");
  const decoded = await auth.verifyIdToken(token);
  if (!APPROVED_UIDS.has(decoded.uid)) throw new Error("not_approved_user");
  return {
    uid: decoded.uid,
    email: decoded.email || decoded.uid
  };
}

async function createRegistrationOptions(user) {
  const credentials = await listCredentials(user.uid);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(user.uid),
    userName: user.email,
    userDisplayName: user.email,
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      type: "public-key",
      transports: credential.transports || []
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred"
    }
  });

  await storeChallenge(user.uid, "registration", options.challenge);
  return options;
}

async function verifyRegistration(user, body) {
  const expectedChallenge = await readChallenge(user.uid, "registration");
  const verification = await verifyRegistrationResponse({
    response: body.credential,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false
  });

  if (!verification.verified || !verification.registrationInfo) throw new Error("webauthn_registration_failed");

  const credential = normalizeRegistrationCredential(verification.registrationInfo);
  await firestore.collection(WEBAUTHN_CREDENTIALS_COLLECTION).doc(`${user.uid}_${credential.credentialId}`).set({
    uid: user.uid,
    email: user.email,
    credentialId: credential.credentialId,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: credential.transports,
    createdAt: FieldValue.serverTimestamp(),
    lastVerifiedAt: null,
    revoked: false
  });
  await deleteChallenge(user.uid, "registration");

  return {
    verified: true,
    credentialId: credential.credentialId
  };
}

async function createAuthenticationOptions(user) {
  const credentials = await listCredentials(user.uid);
  if (!credentials.length) throw new Error("no_registered_iphone");

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      type: "public-key",
      transports: credential.transports || []
    })),
    userVerification: "preferred"
  });

  await storeChallenge(user.uid, "authentication", options.challenge);
  return options;
}

async function verifyAuthentication(user, body) {
  const expectedChallenge = await readChallenge(user.uid, "authentication");
  const credentialId = body.credential?.id;
  const credential = await readCredential(user.uid, credentialId);
  if (!credential) throw new Error("registered_iphone_not_found");

  const verification = await verifyAuthenticationResponse({
    response: body.credential,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.credentialId,
      publicKey: Buffer.from(credential.publicKey, "base64url"),
      counter: credential.counter,
      transports: credential.transports || []
    },
    requireUserVerification: false
  });

  if (!verification.verified) throw new Error("webauthn_authentication_failed");

  const newCounter = verification.authenticationInfo?.newCounter ?? credential.counter;
  await firestore.collection(WEBAUTHN_CREDENTIALS_COLLECTION).doc(`${user.uid}_${credential.credentialId}`).update({
    counter: newCounter,
    lastVerifiedAt: FieldValue.serverTimestamp()
  });
  await deleteChallenge(user.uid, "authentication");

  return {
    verified: true,
    pilotSessionToken: createPilotSessionToken(user)
  };
}

function normalizeRegistrationCredential(registrationInfo) {
  const credential = registrationInfo.credential || {};
  const credentialId = credential.id || registrationInfo.credentialID;
  const publicKey = credential.publicKey || registrationInfo.credentialPublicKey;
  const counter = credential.counter ?? registrationInfo.counter ?? 0;
  const transports = credential.transports || registrationInfo.transports || [];
  if (!credentialId || !publicKey) throw new Error("webauthn_credential_missing");

  return {
    credentialId: typeof credentialId === "string" ? credentialId : Buffer.from(credentialId).toString("base64url"),
    publicKey: typeof publicKey === "string" ? publicKey : Buffer.from(publicKey).toString("base64url"),
    counter,
    transports
  };
}

async function listCredentials(uid) {
  const snapshot = await firestore
    .collection(WEBAUTHN_CREDENTIALS_COLLECTION)
    .where("uid", "==", uid)
    .where("revoked", "==", false)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

async function readCredential(uid, credentialId) {
  if (!credentialId) return null;
  const doc = await firestore.collection(WEBAUTHN_CREDENTIALS_COLLECTION).doc(`${uid}_${credentialId}`).get();
  if (!doc.exists) return null;
  const credential = doc.data();
  return credential?.revoked ? null : credential;
}

async function storeChallenge(uid, type, challenge) {
  await firestore.collection(WEBAUTHN_CHALLENGES_COLLECTION).doc(`${uid}_${type}`).set({
    uid,
    type,
    challenge,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function readChallenge(uid, type) {
  const doc = await firestore.collection(WEBAUTHN_CHALLENGES_COLLECTION).doc(`${uid}_${type}`).get();
  if (!doc.exists) throw new Error("webauthn_challenge_missing");
  return doc.data().challenge;
}

async function deleteChallenge(uid, type) {
  await firestore.collection(WEBAUTHN_CHALLENGES_COLLECTION).doc(`${uid}_${type}`).delete();
}

function createPilotSessionToken(user) {
  if (!PILOT_SESSION_SECRET) throw new Error("missing_pilot_session_secret");
  const payload = {
    uid: user.uid,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + PILOT_SESSION_TTL_SECONDS
  };
  return signSessionPayload(payload);
}

function signSessionPayload(payload) {
  if (!PILOT_SESSION_SECRET) throw new Error("missing_pilot_session_secret");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", PILOT_SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyPilotSessionToken(token) {
  if (!PILOT_SESSION_SECRET) throw new Error("missing_pilot_session_secret");
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) throw new Error("invalid_pilot_session_token");
  const expected = crypto.createHmac("sha256", PILOT_SESSION_SECRET).update(encodedPayload).digest("base64url");
  if (signature.length !== expected.length) throw new Error("invalid_pilot_session_token");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("invalid_pilot_session_token");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (!payload.uid || payload.exp < Math.floor(Date.now() / 1000)) throw new Error("expired_pilot_session_token");
  if (payload.mode === "final_review") {
    if (!payload.anonymous) throw new Error("invalid_review_session_token");
    if (!isAllowedReviewPhrase(payload.day, payload.phraseId)) throw new Error("review_phrase_not_allowed");
    return payload;
  }
  if (!APPROVED_UIDS.has(payload.uid)) throw new Error("not_approved_user");
  return payload;
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw new Error("request_too_large");
  }
  return raw ? JSON.parse(raw) : {};
}

function writeJson(request, response, status, payload) {
  const origin = request?.headers?.origin || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : EXPECTED_ORIGIN;
  response.writeHead(status, {
    "access-control-allow-origin": allowOrigin,
    "vary": "Origin",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "content-type": "application/json"
  });
  if (status === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload));
}

function statusForError(error) {
  const message = error?.message || "";
  if (message.includes("missing_auth") || message.includes("invalid") || message.includes("expired")) return 401;
  if (message.includes("not_approved") || message.includes("not_found") || message.includes("no_registered")) return 403;
  return 400;
}

function scoreTranscript(targetThai, transcript) {
  const target = normalizeThai(targetThai);
  const heard = normalizeThai(transcript);
  if (!target || !heard) return 0;
  if (target === heard) return 100;
  const distance = levenshteinDistance(target, heard);
  const maxLength = Math.max(target.length, heard.length);
  return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}

function normalizeThai(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[.,!?ๆ]/g, "").trim();
}

function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function splitEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeError(error) {
  const message = error?.message || String(error);
  if (message.includes("Firebase ID token")) return "auth_token_invalid";
  return message.replace(/[^\w가-힣 .:-]/g, "").slice(0, 160);
}
