// app.js - main UI logic (AI Eisenhower)
import { watchTasks, addTaskRemote, updateTaskRemote, deleteTaskRemote, auth, loadProfile, saveProfile } from "./firebase.js";
import { watchAuth, login, logout } from "./auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

const appFirebase = initializeApp(firebaseConfig); // functions needs same app
const functions = getFunctions(appFirebase);

const THEME_KEY = 'eisenhower_theme';
let tasks = [];
let profile = { importance:'' };

// ---- THEME ----
function applyTheme(){
  const pref = localStorage.getItem(THEME_KEY);
  if(pref === 'dark') document.documentElement.classList.add('dark');
  else if(pref === 'light') document.documentElement.classList.remove('dark');
}
applyTheme();
document.getElementById('theme-toggle').addEventListener('click', ()=>{
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark? 'dark':'light');
});

// ---- AUTH ----
watchAuth(async user=>{
  if(!user){
    document.getElementById('user-info').textContent = '';
    document.getElementById('logout-btn').style.display='none';
    document.getElementById('login-btn').style.display='inline-block';
    tasks=[]; render(); return;
  }
  document.getElementById('user-info').textContent = user.email;
  document.getElementById('logout-btn').style.display='inline-block';
  document.getElementById('login-btn').style.display='none';
  profile = await loadProfile(user.uid);
  document.getElementById('importanceText').value = profile.importance || '';
  watchTasks(remote=>{ tasks = remote; render(); });
});
document.getElementById('login-btn').onclick = ()=>login(
  (document.getElementById('email').value||'').trim(),
  document.getElementById('password').value
);
document.getElementById('logout-btn').onclick = ()=>logout();

// ---- PROFILE ----
document.getElementById('save-profile').onclick = async ()=>{
  if(!auth.currentUser){ alert('Login first'); return; }
  profile.importance = document.getElementById('importanceText').value;
  await saveProfile(auth.currentUser.uid, profile);
  alert('Profile saved');
};

// ---- TASK LOGIC ----
function getQuadrant(task){
  if(task.urgent && task.important) return 'q1';
  if(!task.urgent && task.important) return 'q2';
  if(task.urgent && !task.important) return 'q3';
  return 'q4';
}
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', render);

function span(text){ const s=document.createElement('span'); s.textContent=text; return s; }
function button(text,cls,handler){ const b=document.createElement('button'); b.textContent=text; b.className=cls; b.type='button'; b.onclick=handler; return b; }

function render(){
  const filter = searchInput.value.toLowerCase();
  const counts={q1:{total:0,done:0},q2:{total:0,done:0},q3:{total:0,done:0},q4:{total:0,done:0}};
  ['q1','q2','q3','q4','completed-list'].forEach(id=>document.getElementById(id).innerHTML='');
  const today = new Date().toISOString().split('T')[0];
  const categoryCounts = {};

  tasks.sort((a,b)=>{
    if(a.done!==b.done) return a.done?1:-1;
    return (a.dueDate||'').localeCompare(b.dueDate||'');
  });

  tasks.forEach(task=>{
    const cat = task.category || 'General';
    categoryCounts[cat] = categoryCounts[cat] || {total:0,done:0};
    categoryCounts[cat].total++; if(task.done) categoryCounts[cat].done++;

    if(filter && !task.title.toLowerCase().includes(filter) && !task.description?.toLowerCase().includes(filter)) return;

    const li=document.createElement('li');
    li.className='task-item';
    if(task.done) li.classList.add('completed');
    if(task.dueDate && task.dueDate < today) li.classList.add('overdue');
    li.dataset.id=task.id;

    const title=document.createElement('strong'); title.textContent=task.title; li.appendChild(title);
    if(task.description){ const d=document.createElement('div'); d.className='desc'; d.textContent=task.description; li.appendChild(d); }

    const meta=document.createElement('div'); meta.className='meta';
    if(task.dueDate) meta.appendChild(span('Due '+task.dueDate));
    meta.appendChild(span(task.important?'Important':'Not Important'));
    meta.appendChild(span(task.urgent?'Urgent':'Not Urgent'));
    meta.appendChild(span('Cat: '+cat));
    li.appendChild(meta);

    const actions=document.createElement('div'); actions.className='actions';
    actions.appendChild(button(task.done?'Undo':'Done','toggle',()=>toggleDone(task)));
    actions.appendChild(button('Edit','edit',()=>fillForm(task)));
    actions.appendChild(button('Archive','edit',()=>archiveTask(task)));
    actions.appendChild(button('Delete','delete',()=>removeTask(task.id)));
    actions.appendChild(button('Calendar','cal',()=>downloadICS(task)));
    li.appendChild(actions);

    li.draggable=true;
    li.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',task.id); li.classList.add('dragging'); });
    li.addEventListener('dragend',()=>li.classList.remove('dragging'));

    if(task.done){
      document.getElementById('completed-list').appendChild(li);
    } else {
      const q = getQuadrant(task);
      counts[q].total++; if(task.done) counts[q].done++;
      document.getElementById(q).appendChild(li);
    }
  });

  Object.entries(counts).forEach(([k,v])=>{
    document.getElementById('count-'+k).textContent=`${v.done}/${v.total}`;
  });
  document.getElementById('categories').innerHTML = Object.entries(categoryCounts)
    .map(([c,v])=>`<div>${c}: ${v.done}/${v.total}</div>`).join('');
}

async function toggleDone(task){ task.done=!task.done; await updateTaskRemote(task); }
async function archiveTask(task){ task.archived=true; await updateTaskRemote(task); }
async function removeTask(id){ if(confirm('Delete this task?')) await deleteTaskRemote(id); }

function resetForm(){
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value='';
  document.getElementById('save-btn').textContent='Save Task';
}
document.getElementById('reset-btn').addEventListener('click', resetForm);
document.getElementById('fab').addEventListener('click', ()=>{ resetForm(); document.getElementById('title').focus(); window.scrollTo({top:0,behavior:'smooth'}); });

function fillForm(task){
  document.getElementById('task-id').value=task.id;
  document.getElementById('title').value=task.title;
  document.getElementById('description').value=task.description||'';
  document.getElementById('due-date').value=task.dueDate||'';
  document.getElementById('important').checked=task.important;
  document.getElementById('urgent').checked=task.urgent;
  document.getElementById('category').value=task.category||'General';
  document.getElementById('save-btn').textContent='Update Task';
  window.scrollTo({top:0,behavior:'smooth'});
}

document.getElementById('task-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!auth.currentUser){ alert('Login first'); return; }
  const idField=document.getElementById('task-id');
  const existing=tasks.find(t=>t.id===idField.value);
  const task={
    id: existing? existing.id : undefined,
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description').value.trim(),
    dueDate: document.getElementById('due-date').value,
    important: document.getElementById('important').checked,
    urgent: document.getElementById('urgent').checked,
    category: document.getElementById('category').value,
    done: existing? existing.done : false
  };
  if(!task.title){ alert('Title required'); return; }
  if(existing) await updateTaskRemote(task); else await addTaskRemote(task);
  resetForm();
});

// Drag & Drop quadrant move
document.querySelectorAll('.quadrant').forEach(q=>{
  q.addEventListener('dragover',e=>{ e.preventDefault(); q.classList.add('drag-over'); });
  q.addEventListener('dragleave',()=>q.classList.remove('drag-over'));
  q.addEventListener('drop',async e=>{
    e.preventDefault(); q.classList.remove('drag-over');
    const id=e.dataTransfer.getData('text/plain'); const task=tasks.find(t=>t.id===id); if(!task) return;
    const quad=q.getAttribute('data-quadrant');
    if(quad==='q1'){ task.urgent=true; task.important=true; }
    if(quad==='q2'){ task.urgent=false; task.important=true; }
    if(quad==='q3'){ task.urgent=true; task.important=false; }
    if(quad==='q4'){ task.urgent=false; task.important=false; }
    await updateTaskRemote(task);
  });
});

// Voice to Tasks
document.getElementById('voice-btn').onclick = ()=>{
  if(!('webkitSpeechRecognition' in window)){ alert('Speech not supported in this browser'); return; }
  if(!auth.currentUser){ alert('Login first'); return; }
  const r=new webkitSpeechRecognition(); r.lang='en-US'; r.continuous=false; r.interimResults=false; r.start();
  r.onresult= async e=>{
    const text=e.results[0][0].transcript;
    text.split(/(?: and |,|\\n)/i).forEach(async part=>{
      const title=part.trim(); if(title) await addTaskRemote({title,description:'',dueDate:'',important:false,urgent:false,category:'General',done:false});
    });
  };
};

// Calendar ICS
function downloadICS(task){
  const dt = task.dueDate? task.dueDate.replace(/-/g,'') : new Date().toISOString().split('T')[0].replace(/-/g,'');
  const ics=`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${task.title}
DESCRIPTION:${task.description||''}
DTSTART;VALUE=DATE:${dt}
DTEND;VALUE=DATE:${dt}
END:VEVENT
END:VCALENDAR`;
  const blob=new Blob([ics],{type:'text/calendar'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${task.title}.ics`; a.click();
}

// Clear local settings (does not delete tasks)
document.getElementById('clear-all').addEventListener('click',()=>{
  if(confirm('This will clear theme preference + profile text locally. Tasks remain in cloud. Continue?')){
    localStorage.removeItem(THEME_KEY);
    document.getElementById('importanceText').value='';
    alert('Local settings cleared.');
  }
});

// AI Prioritization
document.getElementById('ai-btn').addEventListener('click', async ()=>{
  if(!auth.currentUser){ alert('Login first'); return; }
  const fn=httpsCallable(functions,'prioritizeTasks');
  try{
    document.getElementById('ai-btn').disabled=true;
    await fn();
    alert('AI updated tasks');
  }catch(err){ alert('AI error: '+err.message); }
  finally{ document.getElementById('ai-btn').disabled=false; }
});

render();
