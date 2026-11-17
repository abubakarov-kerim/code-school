'use strict';
(() => {
  const config=window.SCHOOL_SUPABASE||{};
  const enabled=/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url||'')&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||'');
  const state={enabled,ready:!enabled,user:null,profile:null,error:'',recovery:false};
  let client=null,generation=0,loadedUser=null;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const announce=()=>window.dispatchEvent(new CustomEvent('school-account-change'));
  const fail=error=>{
    const text=String(error?.message||'');
    if(/invalid login credentials/i.test(text))return 'Неверная почта или пароль.';
    if(/email not confirmed/i.test(text))return 'Подтверди почту по ссылке из письма.';
    if(/rate limit|too many/i.test(text))return 'Слишком много попыток. Подожди несколько минут.';
    if(/email address.*not authorized|email.*not allowed|smtp/i.test(text))return 'Отправка писем для этого адреса ещё не настроена. Для теста нужен адрес участника проекта Supabase.';
    if(/already registered/i.test(text))return 'Этот адрес уже зарегистрирован. Попробуй войти или восстановить пароль.';
    if(/password.*(?:weak|least)|weak.*password/i.test(text))return 'Нужен более надёжный пароль: минимум 12 символов.';
    if(/fetch|network|timeout|abort/i.test(text))return 'Нет связи с базой. Проверь интернет и повтори. Данные формы не потеряны.';
    return 'Не удалось выполнить действие. Повтори позже. Если ошибка сохраняется, сообщи преподавателю.';
  };
  async function load(session,event){
    const token=++generation;
    const user=session?.user||null;
    const changed=loadedUser!==(user?.id||null);
    if(changed)state.profile=null;
    state.user=user;state.error='';
    if(event==='PASSWORD_RECOVERY')state.recovery=true;
    if(!user){window.SchoolLearning?.clear();state.profile=null;loadedUser=null;state.ready=true;state.recovery=false;announce();return;}
    if(!changed&&state.ready&&event!=='PASSWORD_RECOVERY')return;
    state.ready=false;announce();
    try{
      const {data,error}=await client.from('school_profiles').select('full_name,about,avatar_data').eq('id',user.id).maybeSingle();
      if(error)throw error;if(token!==generation)return;
      state.profile=data?{name:data.full_name,about:data.about,avatar:data.avatar_data}:{name:String(user.user_metadata?.full_name||'').slice(0,100),about:'',avatar:''};
      await window.SchoolLearning?.load(user.id);if(token!==generation)return;
      loadedUser=user.id;
    }catch(error){if(token!==generation)return;state.profile=null;state.error=fail(error);}
    if(token===generation){state.ready=true;announce();}
  }
  function panel(){
    if(!state.ready)return '<div class="container page"><div class="panel stack"><h1 class="page-title">Личный кабинет</h1><p role="status">Подключаем твой аккаунт…</p></div></div>';
    if(state.error)return `<div class="container page"><div class="panel stack"><h1 class="page-title">Связь с аккаунтом</h1><p role="alert">${escape(state.error)}</p><button class="button" id="account-retry">Повторить подключение</button><button class="button secondary" id="account-signout">Выйти из аккаунта</button></div></div>`;
    const recovery=state.recovery;
    return `<div class="container page account-page"><a class="crumb" href="index.html">← Главная</a><h1 class="page-title">${recovery?'Новый пароль':'Вход в школу'}</h1><p class="lead">${recovery?'Задай новый пароль для своего аккаунта.':'Один профиль на телефоне и компьютере.'}</p><div class="notice">Пробное подключение Supabase. Используй тестовое имя и не добавляй личные сведения. В облаке сохраняются профиль и учебный прогресс. Код, проекты и заметки пока остаются на устройстве.</div><form class="panel stack account-form" id="account-form"><div class="account-tabs" role="group" aria-label="Действие с аккаунтом">${recovery?'':'<button class="filter active" type="button" data-auth-mode="login">Войти</button><button class="filter" type="button" data-auth-mode="signup">Регистрация</button><button class="filter" type="button" data-auth-mode="reset">Забыли пароль?</button>'}</div><label id="account-name-label" hidden>Фамилия и имя, тестовые<input id="account-name" maxlength="100" autocomplete="name" placeholder="Тестов Тест"></label><label id="account-email-label" ${recovery?'hidden':''}>Почта<input type="email" id="account-email" autocomplete="email" maxlength="254" ${recovery?'':'required'}></label><label id="account-password-label">Пароль<input id="account-password" aria-label="Пароль" type="password" autocomplete="${recovery?'new-password':'current-password'}" minlength="${recovery?'12':'1'}" maxlength="128" required><button type="button" class="password-eye" id="account-password-toggle" aria-label="Показать пароль" aria-controls="account-password" aria-pressed="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-strike" d="m4 4 16 16"/></svg></button></label><p class="muted" id="account-password-hint" hidden>Минимум 12 символов. Не используй пароль от других сервисов.</p><p class="muted" id="account-mail-hint" hidden>На бесплатном тестовом проекте отправка писем пока ограничена адресами участников Supabase. Подтверждение и восстановление почты требуют настройки отправителя.</p><button class="button" id="account-submit" type="submit">${recovery?'Сохранить пароль':'Войти'}</button><p class="account-feedback" id="account-feedback" role="status" aria-live="polite"></p></form></div>`;
  }
  function bind(){
    document.getElementById('account-retry')?.addEventListener('click',()=>{loadedUser=null;boot();});
    document.getElementById('account-signout')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await signout();}catch(error){button.disabled=false;const feedback=document.getElementById('account-feedback');if(feedback)feedback.textContent=fail(error);else if(typeof toast==='function')toast(fail(error));}});
    const form=document.getElementById('account-form');if(!form)return;
    let mode=state.recovery?'recovery':'login',busy=false;
    const feedback=document.getElementById('account-feedback');
    const email=document.getElementById('account-email'),password=document.getElementById('account-password');
    const eye=document.getElementById('account-password-toggle');
    const hidePassword=()=>{password.type='password';eye.setAttribute('aria-pressed','false');eye.setAttribute('aria-label','Показать пароль');};
    eye.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';eye.setAttribute('aria-pressed',String(show));eye.setAttribute('aria-label',show?'Скрыть пароль':'Показать пароль');password.focus({preventScroll:true});});
    form.querySelectorAll('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>{
      if(busy)return;hidePassword();mode=button.dataset.authMode;feedback.textContent='';
      form.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b===button));
      document.getElementById('account-name-label').hidden=mode!=='signup';
      document.getElementById('account-name').required=mode==='signup';
      document.getElementById('account-password-label').hidden=mode==='reset';password.required=mode!=='reset';password.minLength=mode==='signup'?12:1;password.autocomplete=mode==='signup'?'new-password':'current-password';
      document.getElementById('account-password-hint').hidden=mode!=='signup';document.getElementById('account-mail-hint').hidden=mode==='login';
      document.getElementById('account-submit').textContent=mode==='signup'?'Создать тестовый аккаунт':mode==='reset'?'Отправить письмо':'Войти';
    }));
    form.onsubmit=async event=>{
      event.preventDefault();if(busy||!client)return;
      const name=document.getElementById('account-name').value.trim();
      if(mode==='signup'&&name.split(/\s+/).length<2){feedback.textContent='Укажи тестовые фамилию и имя.';return;}
      hidePassword();busy=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);feedback.textContent='Подключаемся…';
      try{
        const redirect=new URL('index.html?view=profile',location.href).href;
        if(mode==='login'){
          const {data,error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(error)throw error;
          password.value='';await load(data.session,'SIGNED_IN');
        }else if(mode==='signup'){
          const {data,error}=await client.auth.signUp({email:email.value.trim(),password:password.value,options:{emailRedirectTo:redirect,data:{full_name:name}}});if(error)throw error;
          password.value='';
          if(data.session){await load(data.session,'SIGNED_IN');await saveProfile({name,about:'',avatar:''});}
          else feedback.textContent='Проверь почту и подтверди регистрацию. Если письма нет, отправку для твоего адреса нужно настроить в проекте.';
        }else if(mode==='reset'){
          const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:redirect});if(error)throw error;
          feedback.textContent='Если адрес зарегистрирован и отправка настроена, придёт письмо для восстановления.';
        }else{
          const {error}=await client.auth.updateUser({password:password.value});if(error)throw error;
          password.value='';state.recovery=false;announce();
        }
      }catch(error){feedback.textContent=fail(error);}
      finally{busy=false;buttons.forEach(b=>b.disabled=false);}
    };
  }
  async function saveProfile(profile){
    if(!client||!state.user)throw Error('Not authenticated');
    const uid=state.user.id;
    if(profile.name.length>100||profile.about.length>1000||profile.avatar.length>160000)throw Error('Profile too large');
    const payload={full_name:profile.name,about:profile.about,avatar_data:profile.avatar};
    const existing=await client.from('school_profiles').select('id').eq('id',uid).maybeSingle();if(existing.error)throw existing.error;
    const result=existing.data?await client.from('school_profiles').update(payload).eq('id',uid).select('full_name,about,avatar_data').single():await client.from('school_profiles').insert({id:uid,...payload}).select('full_name,about,avatar_data').single();
    if(result.error)throw result.error;if(state.user?.id!==uid)throw Error('Session changed');
    state.profile={name:result.data.full_name,about:result.data.about,avatar:result.data.avatar_data};return state.profile;
  }
  async function signout(){const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await load(null,'SIGNED_OUT');}
  async function boot(){
    if(!enabled)return;
    try{
      if(!window.supabase?.createClient)throw Error('Network SDK unavailable');
      if(!client){client=window.supabase.createClient(config.url,config.publishableKey,{global:{fetch:async(input,options={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);const abort=()=>controller.abort();if(options.signal?.aborted)controller.abort();options.signal?.addEventListener('abort',abort,{once:true});try{return await fetch(input,{...options,signal:controller.signal});}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}}},auth:{storageKey:'school-account-session',flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});client.auth.onAuthStateChange((event,session)=>setTimeout(()=>load(session,event),0));}
      const {data,error}=await client.auth.getSession();if(error)throw error;await load(data.session,'INITIAL_SESSION');
    }catch(error){state.ready=true;state.error=fail(error);announce();}
  }
  window.SchoolAccount={state,panel,bind,saveProfile,signout,errorMessage:fail,boot,getClient:()=>client};
  boot();
})();
