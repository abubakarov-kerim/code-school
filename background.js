'use strict';
(() => {
  const canvas = document.getElementById('fluid-background');
  if (!canvas) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const controls = 'button,a,input,textarea,select,summary,label,iframe,[role="button"],[role="tab"],[contenteditable="true"]';
  let gl;
  try { gl = canvas.getContext('webgl', {alpha:true,premultipliedAlpha:false,antialias:true,depth:false,stencil:false,powerPreference:'low-power',preserveDrawingBuffer:false}); } catch { return; }
  if (!gl) return;
  const vertex = `attribute vec3 a_position;void main(){gl_Position=vec4(a_position,1.);}`;
  const fragment = `precision mediump float;
    uniform vec2 u_resolution;uniform vec2 u_pointer;uniform float u_time;uniform float u_light;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec2 uv=gl_FragCoord.xy/u_resolution;
      vec2 p=(gl_FragCoord.xy-.5*u_resolution)/u_resolution.y;
      p-=(u_pointer-.5)*.12;
      float t=(u_time-16.)*.075+3.84;
      vec3 color=vec3(0.);float coverage=0.;
      // Wide folded ribbons, each with a travelling illuminated edge.
      for(int i=0;i<4;i++){
        float k=float(i);
        float x=p.x-.28+k*.055;
        float center=.38*sin(x*1.9+t+k*.72)+.14*sin(x*3.2-t*.55+k)-.08;
        float width=.13+.075*sin(x*1.4+t*.6+k*.9);
        float d=(p.y-center+k*.14)/width;
        float body=1.-smoothstep(.94,1.,abs(d));
        float fold=pow(max(0.,1.-abs(d)),.7);
        float edge=exp(-abs(abs(d)-.92)*75.);
        float seam=exp(-abs(d-.28*sin(x*2.+t+k))*65.);
        float sweep=.5+.5*sin(x*3.-t*1.6+k*1.9);
        vec3 steel=mix(vec3(.012,.025,.08),vec3(.055,.12,.30),fold);
        steel+=vec3(.17,.30,.58)*pow(fold,8.)*(.3+sweep*.7);
        vec3 lit=steel+vec3(.24,.40,.82)*(edge*.85+seam*.18);
        vec3 day=mix(vec3(.70,.79,.90),vec3(.94,.97,1.),fold)+vec3(.03,.06,.12)*edge;
        lit=mix(lit,day,u_light);
        float alpha=body*mix(.92,.52,u_light);
        color=mix(color,lit,alpha);coverage=coverage+alpha*(1.-coverage);
        float glow=exp(-abs(abs(d)-1.)*10.)*.11;
        color+=vec3(.025,.08,.28)*glow*(1.-u_light*.8);
        coverage=max(coverage,glow);
      }
      float vignette=smoothstep(-.9,-.05,p.x)*(1.-smoothstep(.7,1.2,abs(p.y)));
      vec2 cell=floor((p+vec2(t*.025,0.))*90.);
      float star=step(.996,hash(cell))*(1.-smoothstep(.0,.08,length(fract((p+vec2(t*.025,0.))*90.)-.5)));
      color+=vec3(.22,.35,.67)*star*.6;coverage=max(coverage,star*.5);
      color=mix(color,color/max(coverage,.001),u_light);
      gl_FragColor=vec4(color,clamp(coverage*vignette,0.,1.));
    }`;
  let program;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Shader unavailable');}return shader;};
  try {
    program=gl.createProgram();const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('WebGL unavailable');gl.useProgram(program);
  } catch { return; }
  const vertices=[-1,-1,0,1,-1,0,-1,1,0,-1,1,0,1,-1,0,1,1,0];
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,0,0);gl.clearColor(0,0,0,0);
  const uniform={resolution:gl.getUniformLocation(program,'u_resolution'),pointer:gl.getUniformLocation(program,'u_pointer'),time:gl.getUniformLocation(program,'u_time'),light:gl.getUniformLocation(program,'u_light')};
  let current={x:.72,y:.52},target={...current},blocked=false,raf=0,last=0,time=16,lost=false;
  function resize(){const ratio=Math.min(window.devicePixelRatio||1,1.8,1500/innerWidth,1000/innerHeight);canvas.width=Math.max(1,Math.round(innerWidth*ratio));canvas.height=Math.max(1,Math.round(innerHeight*ratio));gl.viewport(0,0,canvas.width,canvas.height);if(reduced.matches)draw(0);}
  function draw(stamp){if(lost)return;const dt=last?Math.min(100,stamp-last):40;last=stamp;if(!reduced.matches)time+=dt/1000;if(fine.matches&&!blocked&&!reduced.matches){const smoothing=1-Math.exp(-dt/1600);const dx=(target.x-current.x)*smoothing,dy=(target.y-current.y)*smoothing;const distance=Math.hypot(dx,dy),step=.055*dt/1000;const scale=distance>step?step/distance:1;current.x+=dx*scale;current.y+=dy*scale;}gl.uniform2f(uniform.resolution,canvas.width,canvas.height);gl.uniform2f(uniform.pointer,current.x,current.y);gl.uniform1f(uniform.time,time);gl.uniform1f(uniform.light,root.dataset.theme==='light'?1:0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,vertices.length/3);}
  function frame(stamp){raf=0;if(document.hidden||lost||reduced.matches)return;if(stamp-last>=(fine.matches?40:65))draw(stamp);raf=requestAnimationFrame(frame);}
  function restart(){cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden&&!lost){draw(0);if(!reduced.matches)raf=requestAnimationFrame(frame);}}
  document.addEventListener('pointermove',event=>{if(!fine.matches||reduced.matches)return;blocked=!!event.target.closest?.(controls);if(!blocked){target.x=event.clientX/innerWidth;target.y=1-event.clientY/innerHeight;}},{passive:true});
  document.addEventListener('pointerover',event=>{blocked=!!event.target.closest?.(controls);if(blocked)target={...current};},{passive:true});
  document.addEventListener('visibilitychange',restart);
  window.addEventListener('resize',resize,{passive:true});
  if(reduced.addEventListener)reduced.addEventListener('change',restart);else reduced.addListener(restart);
  new MutationObserver(()=>{if(reduced.matches||document.hidden)draw(0);}).observe(root,{attributes:true,attributeFilter:['data-theme']});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);root.classList.remove('has-fluid');});
  resize();root.classList.add('has-fluid');restart();
})();
