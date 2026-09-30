import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  projectId: "gen-lang-client-0822992934",
  appId: "1:957846325474:web:dc4513268088981e14b6bb",
  apiKey: "AIzaSyDjNBHI1MoWyYuJNvGxw_cdzNcEuEujX-A",
  authDomain: "gen-lang-client-0822992934.firebaseapp.com",
  storageBucket: "gen-lang-client-0822992934.firebasestorage.app",
  messagingSenderId: "957846325474",
  measurementId: "",
  oAuthClientId: "957846325474-nddptick8126lgsp8e190mdu8iivvld3.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
