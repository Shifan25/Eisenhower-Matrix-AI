// auth.js
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "./firebase.js";   // reuse the app/auth created in firebase.js

export function watchAuth(callback){
  onAuthStateChanged(auth, user => callback(user));
}

export async function login(email, password){
  try {
    if(!email || !password){
      alert("Enter email and password.");
      return;
    }
    if(password.length < 6){
      alert("Password must be at least 6 characters.");
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e){
    console.error("Login error:", e.code, e.message);
    if(e.code === 'auth/user-not-found'){
      // create account automatically
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch(e2){
        console.error("Signup error:", e2.code, e2.message);
        alert(e2.code + ": " + e2.message);
      }
    } else {
      alert(e.code + ": " + e.message);
    }
  }
}

export function logout(){
  return signOut(auth);
}
