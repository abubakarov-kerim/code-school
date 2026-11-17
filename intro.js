'use strict';
(() => {
  function start(){
  if(document.querySelector('.school-intro'))return;
  const root=document.documentElement;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches)return;
  const intro=document.createElement('div');
  intro.className='school-intro';intro.setAttribute('role','dialog');intro.setAttribute('aria-modal','true');intro.setAttribute('aria-label','Добро пожаловать в школу программирования');
  intro.innerHTML='<div class="intro-door intro-door-top"></div><div class="intro-door intro-door-bottom"></div><div class="intro-assembly" aria-hidden="true"><div class="intro-emblem"><span>[</span><span>/</span><span>]</span><i></i></div><div class="intro-school"><strong>ШКОЛА</strong><span>ПРОГРАММИРОВАНИЯ</span></div></div><div class="intro-seam" aria-hidden="true"></div><button type="button" class="intro-skip">Пропустить вступление ↗</button>';
  document.body.append(intro);
  const previous=document.activeElement;
  const siblings=[...document.body.children].filter(el=>el!==intro&&el.tagName!=='SCRIPT');
  const inertBefore=siblings.map(el=>el.inert);
  siblings.forEach(el=>el.inert=true);
  root.classList.add('intro-running');
  const skip=intro.querySelector('button');skip.focus({preventScroll:true});
  let finished=false,opening=false;
  const timers=[];
  const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
  function cleanup(){
    if(finished)return;finished=true;timers.forEach(clearTimeout);
    siblings.forEach((el,i)=>el.inert=inertBefore[i]);
    root.classList.remove('intro-running');intro.remove();
    if(previous&&previous!==document.body&&previous.isConnected)previous.focus({preventScroll:true});
    else document.getElementById('main')?.focus({preventScroll:true});
    document.removeEventListener('keydown',onKey);
    if(reduced.removeEventListener)reduced.removeEventListener('change',onReduced);
  }
  function open(){if(opening)return;opening=true;intro.classList.add('is-opening');later(cleanup,1050);}
  function onKey(event){if(event.key==='Escape'){event.preventDefault();open();}if(event.key==='Tab'){event.preventDefault();skip.focus({preventScroll:true});}}
  function onReduced(){if(reduced.matches)cleanup();}
  skip.addEventListener('click',open);document.addEventListener('keydown',onKey);
  if(reduced.addEventListener)reduced.addEventListener('change',onReduced);
  later(open,2400);later(cleanup,4500);
  }
  start();
})();
