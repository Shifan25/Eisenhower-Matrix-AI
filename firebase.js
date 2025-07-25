import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, where, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);

// Live tasks (not archived)
export function watchTasks(callback){
  if(!auth.currentUser){ callback([]); return; }
  const q = query(collection(db,'tasks'),
    where('user','==',auth.currentUser.uid),
    where('archived','==',false)
  );
  return onSnapshot(q, snap=>{
    callback(snap.docs.map(d=>({id:d.id,...d.data()})));
  });
}
export async function addTaskRemote(task){
  const { id, ...data } = task;
  await addDoc(collection(db,'tasks'), { ...data, user: auth.currentUser.uid, archived:false });
}
export async function updateTaskRemote(task){
  const { id, ...data } = task;
  await updateDoc(doc(db,'tasks',id), data);
}
export async function deleteTaskRemote(id){
  await deleteDoc(doc(db,'tasks',id));
}

// Profile (just stored text)
export async function loadProfile(uid){
  const snap = await getDoc(doc(db,'profiles',uid));
  return snap.exists()? snap.data(): { importance:'' };
}
export async function saveProfile(uid,data){
  await setDoc(doc(db,'profiles',uid), data, { merge:true });
}
