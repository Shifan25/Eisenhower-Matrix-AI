import { watchTasks, addTaskRemote, updateTaskRemote, deleteTaskRemote, auth, loadProfile, saveProfile } from "./firebase.js";
import { watchAuth, login, logout } from "./auth.js";

const THEME_KEY = 'eisenhower_theme';
let tasks = [];
let profile = { importance:'' };

// Theme
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

// Auth
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

// Profile save
document.getElementById('save-profile').onclick = async ()=>{
  if(!auth.currentUser){ alert('Login first'); return; }
  profile.importance = document.getElementById('importanceText').value;
  await saveProfile(auth.currentUser.uid, profile);
  alert('Profile saved');
};

// Helpers
function getQuadrant(task){
  if(task.urgent && task.important) return 'q1';
  if(!task.urgent && task.important) return 'q2';
  if(task.urgent && !task.important) return 'q3';
  return 'q4';
}
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', render);

// >>> NEW: category filter
const categoryFilter = document.getElementById('category-filter');
categoryFilter.addEventListener('change', render);

function span(t){ const s=document.createElement('span'); s.textContent=t; return s; }
function button(t,c,h){ const b=document.createElement('button'); b.textContent=t; b.className=c; b.type='button'; b.onclick=h; return b; }

// Render
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
    // Always count for progress
    categoryCounts[cat] = categoryCounts[cat] || {total:0,done:0};
    categoryCounts[cat].total++; if(task.done) categoryCounts[cat].done++;

    // >>> NEW: apply category filter (after counting so progress shows all)
    const selectedCat = categoryFilter.value;
    if (selectedCat && cat !== selectedCat) return;

    // Text search filter
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
      document.getElementById('completed-list').
