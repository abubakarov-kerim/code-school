'use strict';
(() => {
  const ids=new Set(['javascript','python','html','java','cpp','csharp','typescript','go','sql','rust','php','kotlin','swift','dart','c','ruby','r','scala','lua','bash']);
  const state={uid:null,status:'idle',known:new Set(),busy:false,epoch:0,timer:0};
  const key=(uid,k)=>'school-user-'+uid+'-'+k;
  function read(uid,k,fallback){try{return JSON.parse(localStorage.getItem(key(uid,k)))??fallback;}catch{return fallback;}}
  function write(uid,k,value){try{localStorage.setItem(key(uid,k),JSON.stringify(value));return true;}catch{return false;}}
  function doneMap(value){return Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).filter(([k,v])=>{const m=/^([a-z]+)-([0-5])$/.exec(k);return v===true&&m&&ids.has(m[1]);}));}
  function pending(uid){const raw=read(uid,'sync-enroll',{});return Object.fromEntries(Object.entries(raw&&typeof raw==='object'?raw:{}).filter(([k,v])=>ids.has(k)&&typeof v==='boolean'));}
  function applyRows(uid,rows){
    const done=doneMap(read(uid,'done',{})),perCourse={};
    for(const row of rows){if(!ids.has(row.course_id)||!Number.isInteger(row.lesson_index)||row.lesson_index<0||row.lesson_index>5)continue;const k=row.course_id+'-'+row.lesson_index;done[k]=true;state.known.add(k);(perCourse[row.course_id]??=[]).push(Date.parse(row.completed_at));}
    const dates={};for(const [course,values]of Object.entries(perCourse))if(values.length===6&&values.every(Number.isFinite))dates[course]=Math.max(...values);
    if(!write(uid,'done',done)||!write(uid,'course-completions',dates))throw Error('Local storage unavailable');
  }
  function paint(){const node=document.getElementById('learning-sync-text');if(!node)return;node.textContent=({loading:'Загружаем учебный прогресс…',saving:'Сохраняем прогресс в облаке…',synced:'Учебный прогресс сохранён в облаке.',pending:'Изменения сохранены на устройстве. Отправка в облако ожидает соединения.',error:'Не удалось загрузить прогресс. Данные на устройстве сохранены.'})[state.status]||'';const button=document.getElementById('learning-sync-retry');if(button)button.hidden=!['pending','error'].includes(state.status);}
  function banner(){return window.SchoolAccount?.state.user?'<div class="learning-sync" role="status"><span id="learning-sync-text"></span><button id="learning-sync-retry" type="button" hidden>Повторить синхронизацию</button></div>':'';}
  function bind(){paint();document.getElementById('learning-sync-retry')?.addEventListener('click',async()=>{try{await load(state.uid);paint();}catch{state.status='error';paint();}});}
  function schedule(){clearTimeout(state.timer);state.timer=setTimeout(flush,600);}
  async function load(uid){
    const epoch=++state.epoch;state.uid=uid;state.status='loading';state.known=new Set();paint();
    const client=window.SchoolAccount?.getClient();if(!uid||!client)return;
    try{
      const [lessons,enrollments]=await Promise.all([client.from('school_lesson_completions').select('course_id,lesson_index,completed_at').eq('user_id',uid),client.from('school_course_enrollments').select('course_id,is_enrolled').eq('user_id',uid)]);
      if(lessons.error)throw lessons.error;if(enrollments.error)throw enrollments.error;if(epoch!==state.epoch)return;
      applyRows(uid,lessons.data||[]);
      const local=read(uid,'enrolled',[]),changes=pending(uid),enrolled=new Set((enrollments.data||[]).filter(r=>r.is_enrolled&&ids.has(r.course_id)).map(r=>r.course_id));
      if(!(enrollments.data||[]).length&&!read(uid,'learning-seeded',false)&&Array.isArray(local)){for(const id of local)if(ids.has(id)){changes[id]=true;enrolled.add(id);}if(!write(uid,'sync-enroll',changes))throw Error('Local storage unavailable');}
      for(const [id,on]of Object.entries(changes))on?enrolled.add(id):enrolled.delete(id);
      if(!write(uid,'enrolled',[...enrolled])||!write(uid,'learning-seeded',true))throw Error('Local storage unavailable');
      state.status='synced';paint();schedule();
    }catch{if(epoch===state.epoch){state.status='error';paint();}}
  }
  function changed(entries,previous){
    const uid=state.uid;if(!uid||window.SchoolAccount?.state.user?.id!==uid)return;
    for(const [k,value]of entries){if(k==='enrolled'){
      let before=[];try{before=JSON.parse(previous.find(([name])=>name===k)?.[1]||'[]');}catch{}
      const old=new Set(Array.isArray(before)?before:[]),next=new Set(Array.isArray(value)?value:[]),changes=pending(uid);
      for(const id of ids)if(old.has(id)!==next.has(id))changes[id]=next.has(id);
      if(!write(uid,'sync-enroll',changes)){state.status='error';paint();return;}
    }}
    if(entries.some(([k])=>['done','enrolled'].includes(k))){state.status='saving';paint();schedule();}
  }
  async function flush(){
    const uid=state.uid,epoch=state.epoch,client=window.SchoolAccount?.getClient();
    if(!uid||!client||state.busy||window.SchoolAccount.state.user?.id!==uid)return;
    const done=doneMap(read(uid,'done',{})),changes=pending(uid),missing=Object.keys(done).filter(k=>!state.known.has(k));
    if(!missing.length&&!Object.keys(changes).length){if(state.status!=='error')state.status='synced';paint();return;}
    state.busy=true;state.status='saving';paint();
    try{
      if(missing.length){const rows=missing.map(k=>{const [course,index]=k.split('-');return {user_id:uid,course_id:course,lesson_index:Number(index)};});const result=await client.from('school_lesson_completions').upsert(rows,{onConflict:'user_id,course_id,lesson_index',ignoreDuplicates:true});if(result.error)throw result.error;}
      for(const [course,is_enrolled]of Object.entries(changes)){
        if(epoch!==state.epoch)return;
        const result=await client.from('school_course_enrollments').upsert({user_id:uid,course_id:course,is_enrolled},{onConflict:'user_id,course_id'});if(result.error)throw result.error;
        const current=pending(uid);if(current[course]===is_enrolled){delete current[course];if(!write(uid,'sync-enroll',current))throw Error('Local storage unavailable');}
      }
      const refresh=await client.from('school_lesson_completions').select('course_id,lesson_index,completed_at').eq('user_id',uid);if(refresh.error)throw refresh.error;if(epoch!==state.epoch)return;
      applyRows(uid,refresh.data||[]);state.status='synced';
    }catch{if(epoch===state.epoch)state.status='pending';}
    finally{state.busy=false;if(epoch!==state.epoch&&state.uid)schedule();if(epoch===state.epoch){paint();if(state.status==='synced'&&(Object.keys(pending(uid)).length||Object.keys(doneMap(read(uid,'done',{}))).some(k=>!state.known.has(k))))schedule();}}
  }
  function clear(){clearTimeout(state.timer);state.epoch++;state.uid=null;state.status='idle';state.known=new Set();}
  window.addEventListener('online',()=>{if(state.uid)load(state.uid);});
  window.SchoolLearning={load,clear,changed,banner,bind,state,flush};
})();
