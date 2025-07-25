// firebase.js
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, where, setDoc, getDoc,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence (cache). If another tab already has it, ignore error.
enableIndexedDbPersistence(db).catch(err => {
  console.warn("Persistence error:", err.code); // e.g. 'failed-precondition' or 'unimplemented'
});

// ----- Tasks -----
export function watchTasks(callback){
  if(!auth.currentUser){ callback([]); return; }
  const q = query(
    collection(db,'tasks'),
    where('user','==',auth.currentUser.uid),
    where('archived','==',false)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addTaskRemote(task){
  const { id, ...data } = task;   // drop possible id
  await addDoc(collection(db,'tasks'), { ...data, user: auth.currentUser.uid, archived:false });
}

export async function updateTaskRemote(task){
  const { id, ...data } = task;
  await updateDoc(doc(db,'tasks', id), data);
}

export async function deleteTaskRemote(id){
  await deleteDoc(doc(db,'tasks', id));
}

// ----- Profile -----
export async function loadProfile(uid){
  const snap = await getDoc(doc(db,'profiles', uid));
  return snap.exists() ? snap.data() : { importance:'' };
}

export async function saveProfile(uid, data){
  await setDoc(doc(db,'profiles', uid), data, { merge:true });
}
