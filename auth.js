import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export function watchAuth(callback){
  onAuthStateChanged(auth, user => callback(user));
}
export async function login(email, pass){
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e){
    if(e.code === 'auth/user-not-found'){
      await createUserWithEmailAndPassword(auth, email, pass);
    } else {
      alert(e.message);
    }
  }
}
export function logout(){ signOut(auth); }
