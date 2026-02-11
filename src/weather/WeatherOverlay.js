(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ClockManager.js'), require('./WeatherService.js'));
  } else {
    root.WeatherOverlay = factory(root.ClockManager, root.WeatherService);
  }
})(typeof self !== 'undefined' ? self : this, function (ClockManager, WeatherService) {
  function isLocalStorageLike(obj) {
    return obj && typeof obj.getItem === 'function' && typeof obj.setItem === 'function' && typeof obj.removeItem === 'function';
  }
  function toStorage(storage) {
    if (isLocalStorageLike(storage)) return storage;
    if (typeof localStorage !== 'undefined' && isLocalStorageLike(localStorage)) return localStorage;
    return {
      _m: new Map(),
      getItem(k){return this._m.has(k)?this._m.get(k):null;},
      setItem(k,v){this._m.set(k,String(v));},
      removeItem(k){this._m.delete(k);} ,
    };
  }
  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function easeInOutQuad(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function hash(n){let x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);} 
  function noise2d(x,y){const i=Math.floor(x),j=Math.floor(y);const u=x-i,v=y-j;const a=hash(i*37.2+j*17.7),b=hash((i+1)*37.2+j*17.7),c=hash(i*37.2+(j+1)*17.7),d=hash((i+1)*37.2+(j+1)*17.7);const sx=u*u*(3-2*u),sy=v*v*(3-2*v);const p= a*(1-sx)+b*sx; const q= c*(1-sx)+d*sx; return p*(1-sy)+q*sy;}
  function colorForTempC(t){const clamped=clamp(t,-10,35);const k=(clamped+10)/45;const r=Math.round(lerp(0,255,k));const g=Math.round(lerp(80,200,k));const b=Math.round(lerp(255,0,k));return `rgba(${r},${g},${b},0.9)`;}

  class Emitter{constructor(){this._m=new Map();}on(t,fn){if(!this._m.has(t))this._m.set(t,new Set());this._m.get(t).add(fn);return()=>this.off(t,fn);}off(t,fn){const s=this._m.get(t);if(!s)return;s.delete(fn);if(s.size===0)this._m.delete(t);}emit(t,v){const s=this._m.get(t);if(!s)return;for(const fn of Array.from(s)){try{fn(v)}catch(_){}}}}

  class WeatherOverlay{
    constructor(opts={}){
      const {
        service,
        clock,
        lat=-33.925,
        lon=18.424,
        storage,
        id='default',
        initialState,
      }=opts;
      this._id=String(id||'default');
      this._storage=toStorage(storage);
      this._svc=service instanceof WeatherService? service : (service? service : null);
      this._clock=clock instanceof ClockManager? clock : (clock? clock : new ClockManager());
      this._state=this._loadState(initialState);
      this._em=new Emitter();
      this._mounted=false;
      this._root=null;this._canvas=null;this._ctx=null;this._sidebar=null;this._resizeHandle=null;
      this._lat=lat;this._lon=lon;
      this._particles=[];this._lastTick=0;this._data=null;this._dpr= (typeof devicePixelRatio!=='undefined'? Math.max(1,Math.min(3,devicePixelRatio)) : 1);
      this._offTick=null;this._dtEma=16.7;this._quality=1;this._hover=false;this._offBaseCanvas=null;this._offBaseCtx=null;this._lastBaseSnap=null;this._keyHandler=null;this._rain=null;this._errEl=null;this._offSvc=null;
    }

    on(t,fn){return this._em.on(t,fn)}
    off(t,fn){return this._em.off(t,fn)}

    mount(parent){
      if(this._mounted) return this;
      const doc= parent && parent.ownerDocument? parent.ownerDocument: (typeof document!=='undefined'? document: null);
      if(!doc) throw new Error('No document available');
      if(typeof window!=='undefined'){
        const href='./src/weather/weather-overlay.css';
        const prev=Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some(l=> (l.getAttribute('href')||'').includes('weather-overlay.css'));
        if(!prev){ const link=doc.createElement('link'); link.rel='stylesheet'; link.href=href; doc.head.appendChild(link); }
      }
      const root=doc.createElement('div');
      root.className='weather-overlay'+(this._state.pinned?' pinned':'');
      root.style.left=this._state.left+'px';
      root.style.top=this._state.top+'px';
      root.style.width=(this._state.width? Math.max(1,this._state.width): '')+'px';
      root.style.height=(this._state.height? Math.max(1,this._state.height): '')+'px';

      const header=doc.createElement('div'); header.className='weather-overlay__header'; this._header=header;
      const title=doc.createElement('div'); title.className='weather-overlay__title'; title.textContent='Weather Overlay';
      const badge=doc.createElement('span'); badge.className='weather-overlay__badge'; badge.textContent=this._clock.mode==='realtime'?'Realtime':'Simulation'; title.appendChild(badge);
      const controls=doc.createElement('div'); controls.className='weather-overlay__controls';
      const pinBtn=doc.createElement('button'); pinBtn.className='weather-overlay__btn'; pinBtn.title='Pin/Unpin'; pinBtn.textContent=this._state.pinned?'Pinned':'Unpinned';
      controls.appendChild(pinBtn);
      header.appendChild(title); header.appendChild(controls);

      const body=doc.createElement('div'); body.className='weather-overlay__body';
      const canvasWrap=doc.createElement('div'); canvasWrap.className='weather-overlay__canvas-wrap'; this._canvasWrap=canvasWrap;
      const canvas=doc.createElement('canvas'); canvas.className='weather-overlay__canvas'; canvasWrap.appendChild(canvas);
      const uiWrap=doc.createElement('div'); uiWrap.style.position='absolute'; uiWrap.style.inset='0'; uiWrap.style.display='flex'; uiWrap.style.flexDirection='column'; uiWrap.style.gap='8px'; uiWrap.style.padding='10px';
      const legends=doc.createElement('div'); legends.className='wo-legends'; legends.style.display='flex'; legends.style.flexDirection='column'; legends.style.gap='8px';
      const hover=doc.createElement('div'); hover.className='wo-hover'; hover.style.alignSelf='flex-start'; hover.style.background='rgba(2,6,23,0.45)'; hover.style.color='#fff'; hover.style.border='1px solid rgba(255,255,255,0.08)'; hover.style.borderRadius='8px'; hover.style.fontSize='11px'; hover.style.padding='6px 8px'; hover.textContent='';
      uiWrap.appendChild(hover); uiWrap.appendChild(legends); canvasWrap.appendChild(uiWrap); this._legendWrap=legends; this._hoverEl=hover;
      const sidebar=doc.createElement('div'); sidebar.className='weather-overlay__sidebar';

      const layersSec=doc.createElement('div'); layersSec.className='weather-overlay__section';
      const layersTitle=doc.createElement('div'); layersTitle.className='weather-overlay__section-title'; layersTitle.textContent='Layers';
      layersSec.appendChild(layersTitle);
      const layerDefs=[
        {key:'temperature',label:'Temperature'},
        {key:'precipitation',label:'Precipitation'},
        {key:'wind',label:'Wind'},
        {key:'clouds',label:'Clouds'},
      ];
      for(const def of layerDefs){
        const row=doc.createElement('label'); row.className='weather-toggle';
        const cb=doc.createElement('input'); cb.type='checkbox'; cb.checked=!!this._state.layers[def.key];
        const span=doc.createElement('span'); span.className='weather-toggle__label'; span.textContent=def.label;
        row.appendChild(cb); row.appendChild(span);
        cb.addEventListener('change',()=>{ this._state.layers[def.key]=!!cb.checked; this._saveState(); this._renderLegends(); this._em.emit('layerchange',{key:def.key,enabled:cb.checked}); });
        sidebar.appendChild(row);
      }

      const footer=doc.createElement('div'); footer.className='weather-overlay__footer'; footer.style.display='none'; this._footer=footer;
      const clockBox=doc.createElement('div'); clockBox.className='weather-overlay__clock';
      const modeBtn=doc.createElement('button'); modeBtn.className='weather-overlay__mode'; modeBtn.textContent=this._clock.mode==='realtime'?'Realtime':'Simulation';
      const rateRange=doc.createElement('input'); rateRange.type='range'; rateRange.min='0.5'; rateRange.max='10'; rateRange.step='0.5'; rateRange.value=String(this._clock.rate||1); rateRange.className='weather-overlay__range';
      clockBox.appendChild(modeBtn); clockBox.appendChild(rateRange);
      const meta=doc.createElement('div'); meta.className='weather-overlay__badge'; meta.textContent='--';
      footer.appendChild(clockBox); footer.appendChild(meta);

      const resizeHandle=doc.createElement('div'); resizeHandle.className='weather-overlay__resize';

      body.appendChild(canvasWrap); body.appendChild(sidebar);
      root.appendChild(header); const err=doc.createElement('div'); err.className='weather-overlay__error'; root.appendChild(err); root.appendChild(body); root.appendChild(footer); root.appendChild(resizeHandle); this._errEl=err;

      const startDrag=(e)=>{ if(e.button!==0)return; dragging=true; sx=e.clientX; sy=e.clientY; sl=parseFloat(root.style.left)||0; st=parseFloat(root.style.top)||0; header.style.cursor='grabbing'; e.preventDefault(); };
      const onDrag=(e)=>{ if(!dragging)return; const dx=e.clientX-sx,dy=e.clientY-sy; const nl=clamp(sl+dx,0, (doc.documentElement.clientWidth-40)); const nt=clamp(st+dy,0,(doc.documentElement.clientHeight-40)); root.style.left=nl+'px'; root.style.top=nt+'px'; this._state.left=nl; this._state.top=nt; this._saveState(); };
      const endDrag=()=>{ if(!dragging)return; dragging=false; header.style.cursor='grab'; this._state.left=parseFloat(root.style.left)||this._state.left; this._state.top=parseFloat(root.style.top)||this._state.top; this._saveState(); this._em.emit('move',{left:this._state.left,top:this._state.top}); };

      const startResize=(e)=>{ if(e.button!==0)return; resizing=true; sx=e.clientX; sy=e.clientY; sw=root.clientWidth; sh=root.clientHeight; e.preventDefault(); };
      const onResize=(e)=>{ if(!resizing)return; const dx=e.clientX-sx, dy=e.clientY-sy; const nw=Math.max(260, sw+dx); const nh=Math.max(180, sh+dy); root.style.width=nw+'px'; root.style.height=nh+'px'; const r=root.getBoundingClientRect(); this._state.width=Math.round(r.width); this._state.height=Math.round(r.height); this._saveState(); this._scheduleResizeCanvas(); };
      const endResize=()=>{ if(!resizing)return; resizing=false; const r=root.getBoundingClientRect(); this._state.width=Math.round(r.width); this._state.height=Math.round(r.height); this._saveState(); this._em.emit('resize',{width:this._state.width,height:this._state.height}); };

      let dragging=false,resizing=false,sx=0,sy=0,sl=0,st=0,sw=0,sh=0;
      header.addEventListener('mousedown',startDrag);
      doc.addEventListener('mousemove',onDrag);
      doc.addEventListener('mouseup',endDrag);
      resizeHandle.addEventListener('mousedown',startResize);
      doc.addEventListener('mousemove',onResize);
      doc.addEventListener('mouseup',endResize);

      pinBtn.addEventListener('click',()=>{ this._state.pinned=!this._state.pinned; root.classList.toggle('pinned',this._state.pinned); pinBtn.textContent=this._state.pinned?'Pinned':'Unpinned'; this._saveState(); this._em.emit(this._state.pinned?'pin':'unpin',{}); });
      
      modeBtn.addEventListener('click',()=>{ const m=this._clock.mode==='realtime'?'simulation':'realtime'; this._clock.setMode(m); modeBtn.textContent=m==='realtime'?'Realtime':'Simulation'; badge.textContent=modeBtn.textContent; this._state.mode=m; this._saveState(); this._em.emit('mode',{mode:m}); });
      rateRange.addEventListener('input',()=>{ const r=Number(rateRange.value)||1; this._clock.setRate(r); this._state.rate=this._clock.rate; this._saveState(); this._em.emit('rate',{rate:this._clock.rate}); });

      parent=(parent||doc.body); parent.appendChild(root);
      if (typeof requestAnimationFrame!=='undefined') { requestAnimationFrame(()=>{ root.style.left=this._state.left+'px'; root.style.top=this._state.top+'px'; if(this._state.width) root.style.width=Math.max(1,this._state.width)+'px'; if(this._state.height) root.style.height=Math.max(1,this._state.height)+'px';
        const vw = doc.documentElement.clientWidth || window.innerWidth || 1280;
        const vh = doc.documentElement.clientHeight || window.innerHeight || 720;
        const rb = root.getBoundingClientRect();
        let nl = Math.min(Math.max(parseFloat(root.style.left)||0, 0), Math.max(0, vw - Math.max(200, rb.width||360) - 10));
        let nt = Math.min(Math.max(parseFloat(root.style.top)||0, 0), Math.max(0, vh - Math.max(150, rb.height||260) - 10));
        if (rb.left > vw || rb.top > vh || rb.right < 0 || rb.bottom < 0) { nl = 80; nt = 80; }
        root.style.left = nl + 'px'; root.style.top = nt + 'px'; this._state.left = nl; this._state.top = nt; this._saveState();
      }); }

      this._root=root; this._canvas=canvas; this._ctx=canvas.getContext('2d'); this._sidebar=sidebar; this._resizeHandle=resizeHandle;
      this._mounted=true;
      if(this._svc && typeof this._svc.on==='function'){ const evs=['request','response','error','revalidate_start','revalidate_success','revalidate_error','cache_hit','cache_miss','fallback_cache']; const offs=[]; for(const ev of evs){ offs.push(this._svc.on(ev,(p)=>this._em.emit('service',{event:ev,payload:p}))); } this._offSvc=()=>{ for(const off of offs){ try{ off(); }catch(_){ } } }; }

      this._resizeCanvas();
      if (typeof requestAnimationFrame!=='undefined') { requestAnimationFrame(()=>this._resizeCanvas()); }
      this._attachClock(meta);
      this._renderLegends();
      this._fetchData();

      window.addEventListener('resize',()=>this._scheduleResizeCanvas());
      root.addEventListener('mouseenter',()=>{this._hover=true;});
      root.addEventListener('mouseleave',()=>{this._hover=false;});
      this._keyHandler=(e)=>{ if(e.defaultPrevented) return; if(e.ctrlKey||e.metaKey||e.altKey) return; const tag=(e.target&&e.target.tagName)||''; if(/INPUT|TEXTAREA|SELECT/.test(tag)) return; if(!this._hover && !(this._root&&this._root.contains(e.target))) return; const k=e.key; if(k==='p'||k==='P'){ this._state.pinned=!this._state.pinned; this._root.classList.toggle('pinned',this._state.pinned); pinBtn.textContent=this._state.pinned?'Pinned':'Unpinned'; this._saveState(); this._em.emit(this._state.pinned?'pin':'unpin',{}); e.preventDefault(); return; } if(k==='m'||k==='M'){ const m=this._clock.mode==='realtime'?'simulation':'realtime'; this._clock.setMode(m); modeBtn.textContent=m==='realtime'?'Realtime':'Simulation'; badge.textContent=modeBtn.textContent; this._state.mode=m; this._saveState(); this._em.emit('mode',{mode:m}); e.preventDefault(); return; } if(k==='['||k===']'){ const delta=k===']'?0.5:-0.5; const r=clamp((this._clock.rate||1)+delta,0.5,10); this._clock.setRate(r); rateRange.value=String(this._clock.rate); this._state.rate=this._clock.rate; this._saveState(); this._em.emit('rate',{rate:this._clock.rate}); e.preventDefault(); return; } };
      doc.addEventListener('keydown',this._keyHandler);
      this._em.emit('mount',{});
      return this;
    }

    destroy(){
      if(!this._mounted) return;
      if(this._offTick) { this._offTick(); this._offTick=null; }
      if(this._offSvc){ try{ this._offSvc(); }catch(_){ } this._offSvc=null; }
      if(typeof document!=='undefined' && this._keyHandler){ document.removeEventListener('keydown', this._keyHandler); this._keyHandler=null; }
      if(this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
      this._mounted=false; this._em.emit('unmount',{});
    }

    _attachClock(metaEl){
      const fmt=(ms)=>{const d=new Date(ms);const hh=String(d.getHours()).padStart(2,'0');const mm=String(d.getMinutes()).padStart(2,'0');const ss=String(d.getSeconds()).padStart(2,'0');return `${hh}:${mm}:${ss}`};
      if(this._offTick) this._offTick();
      this._offTick=this._clock.on('tick', (e)=>{ this._lastTick=e.time; this._updateQuality(e.wallDt,e.hidden); metaEl.textContent=(this._data && this._data.current? `${Math.round(this._data.current.temp)}° ${this._data.current.weather? this._data.current.weather.main: ''}`:'--')+` · ${e.mode==='realtime'?'RT':'SIM'} ${e.rate.toFixed(1)}x · ${fmt(e.time)}`; this._render(e.time,e.hidden); });
      this._clock.start();
    }

    _formatError(err,usedCache){ const c=(err&&err.code)||'UNKNOWN'; let msg=''; let lvl='err'; if(c==='UNAUTHENTICATED'){ msg='OpenWeather API key is invalid. Configure a valid key.'; lvl='err'; } else if(c==='RATE_LIMIT'){ msg='OpenWeather rate limit reached. Retrying later.'; lvl='warn'; } else if(c==='NETWORK'){ msg='Network error or offline. Will retry automatically.'; lvl='warn'; } else if(c==='SERVER'){ msg='Weather service unavailable (5xx).'; lvl='warn'; } else if(c==='HTTP'){ msg='Request failed.'; lvl='warn'; } else { msg='Unexpected error.'; lvl='warn'; } if(usedCache) msg+=' Using cached data.'; return {text:msg,level:lvl}; }

    _showError(text,level){ if(!this._errEl) return; if(!text){ this._errEl.style.display='none'; this._errEl.textContent=''; this._errEl.classList.remove('is-warn','is-err'); return; } this._errEl.textContent=text; this._errEl.classList.remove('is-warn','is-err'); this._errEl.classList.add(level==='warn'?'is-warn':'is-err'); this._errEl.style.display='block'; }

    async _fetchData(){
      if(!this._svc) return;
      this._showError(null);
      this._em.emit('telemetry',{type:'fetch',phase:'start'});
      try{ const d= await this._svc.fetchOneCall({lat:this._lat,lon:this._lon}); this._data=d; this._em.emit('telemetry',{type:'fetch',phase:'success',source:d._meta&&d._meta.source,stale:!!(d._meta&&d._meta.stale)}); }
      catch(err){ let used=false; if(this._svc&&typeof this._svc.getCachedOneCall==='function'){ const c=this._svc.getCachedOneCall({lat:this._lat,lon:this._lon}); if(c){ this._data=c; used=true; this._em.emit('telemetry',{type:'fetch',phase:'cached_fallback'}); } } const f=this._formatError(err,used); this._showError(f.text,f.level); this._em.emit('error',{error:err,cached:used}); }
    }

    _scheduleResizeCanvas(){
      if(this._resizeRq) return;
      const cb=()=>{ this._resizeRq=null; this._resizeCanvas(); };
      if (typeof requestAnimationFrame!=='undefined') { this._resizeRq=requestAnimationFrame(cb); } else { this._resizeRq=setTimeout(cb,16); }
    }

    _resizeCanvas(){
      if(!this._canvas) return;
      const newDpr=(typeof devicePixelRatio!=='undefined'? Math.max(1,Math.min(3,devicePixelRatio)) : 1);
      this._dpr=newDpr;
      const cw = this._canvasWrap ? Math.max(1, this._canvasWrap.clientWidth) : Math.max(1, this._root.clientWidth - (this._sidebar?this._sidebar.clientWidth:150));
      const ch = this._canvasWrap ? Math.max(1, this._canvasWrap.clientHeight) : Math.max(1, this._root.clientHeight - (this._header?this._header.clientHeight:48) - (this._footer?this._footer.clientHeight:36));
      const pxW=Math.floor(cw*this._dpr);
      const pxH=Math.floor(ch*this._dpr);
      this._canvas.width=pxW; this._canvas.height=pxH;
      this._canvas.style.width=cw+'px'; this._canvas.style.height=ch+'px';
      if(this._ctx) { this._ctx.setTransform(this._dpr,0,0,this._dpr,0,0); }
      if(typeof document!=='undefined'){
        if(!this._offBaseCanvas){ this._offBaseCanvas=document.createElement('canvas'); this._offBaseCtx=this._offBaseCanvas.getContext('2d'); }
        if(this._offBaseCanvas){ this._offBaseCanvas.width=pxW; this._offBaseCanvas.height=pxH; this._offBaseCanvas.style.width=cw+'px'; this._offBaseCanvas.style.height=ch+'px'; if(this._offBaseCtx){ this._offBaseCtx.setTransform(this._dpr,0,0,this._dpr,0,0); } this._lastBaseSnap=null; }
      }
    }

    _interpHourly(ms){
      if(!this._data || !Array.isArray(this._data.hourly) || this._data.hourly.length===0) return null;
      const arr=this._data.hourly; const tSec=Math.floor(ms/1000);
      let a=arr[0], b=arr[0];
      for(let i=0;i<arr.length-1;i++){ const x=arr[i], y=arr[i+1]; if(tSec>=x.dt && tSec<=y.dt){ a=x; b=y; break; } if(tSec< arr[0].dt){ a=arr[0]; b=arr[1]||arr[0]; break;} if(tSec> arr[arr.length-1].dt){ a=arr[arr.length-2]||arr[arr.length-1]; b=arr[arr.length-1]; break; } }
      const span=Math.max(1,(b.dt - a.dt)); const k=clamp((tSec - a.dt)/span,0,1); const t=easeInOutQuad(k);
      return {
        temp: lerp(a.temp,b.temp,t),
        feels_like: lerp(a.feels_like||a.temp,b.feels_like||b.temp,t),
        wind_speed: lerp(a.wind_speed||0,b.wind_speed||0,t),
        wind_deg: lerp(a.wind_deg||0,b.wind_deg||0,t),
        humidity: lerp(a.humidity||0,b.humidity||0,t),
        clouds: lerp(a.clouds||0,b.clouds||0,t),
        pop: lerp(a.pop||0,b.pop||0,t),
        rain3h: ((a.rain&&a.rain['3h'])||0)* (1-t) + ((b.rain&&b.rain['3h'])||0)*t,
      };
    }

    _updateQuality(wallDt, hidden){ const dt=Math.max(1, wallDt|0); this._dtEma=this._dtEma*0.9 + dt*0.1; const fps=1000/this._dtEma; let q=1; if(hidden) q=0.5; else if(fps<24) q=0.5; else if(fps<40) q=0.75; else q=1; this._quality=q; }

    _renderBase(w,h,s){ if(!this._offBaseCtx || !this._offBaseCanvas) return; const snap={tb:Math.round(s.temp)}; const prev=this._lastBaseSnap; if(prev && prev.tb===snap.tb) return; const c=this._offBaseCtx; c.clearRect(0,0,w,h); }

    _render(ms, hidden){ if(!this._ctx || !this._canvas) return; const ctx=this._ctx; const w=this._canvas.width/this._dpr; const h=this._canvas.height/this._dpr; ctx.clearRect(0,0,w,h); const snap=this._interpHourly(ms) || { temp:20, wind_speed:1, wind_deg:90, clouds:20, pop:0.1, rain3h:0 }; this._renderBase(w,h,snap); if(this._offBaseCanvas){ ctx.drawImage(this._offBaseCanvas,0,0,w,h); } if(this._state.layers.clouds){ this._drawClouds(ctx,w,h,ms,snap); } if(this._state.layers.wind){ this._drawWind(ctx,w,h,ms,snap); } if(this._state.layers.precipitation){ this._drawPrecip(ctx,w,h,ms,snap); } }

    _drawTemperature(ctx,w,h,s){
      const grad=ctx.createLinearGradient(0,0,w,h);
      grad.addColorStop(0,colorForTempC(s.temp+5));
      grad.addColorStop(1,colorForTempC(s.temp-5));
      ctx.fillStyle=grad; ctx.globalAlpha=0.35; ctx.fillRect(0,0,w,h); ctx.globalAlpha=1;
    }

    _drawClouds(ctx,w,h,ms,s){ const t=ms*0.00005; ctx.save(); const qa=this._quality; const alpha=clamp(s.clouds/100,0.3,1.0)*qa; ctx.globalAlpha=alpha; const step=Math.max(6, Math.round(8/qa)); const half=step*0.5; for(let k=0;k<2;k++){ const scale=k===0? 0.015: 0.03; for(let y=0;y<=h;y+=step){ for(let x=0;x<=w;x+=step){ const v=noise2d(x*scale+t*0.5, y*scale + t*0.3); const a=v*0.6+0.2; ctx.fillStyle=`rgba(200,210,240,${a})`; ctx.fillRect(x-half,y-half,step,step);} } } ctx.restore(); }



    _drawWind(ctx,w,h,ms,s){ const sp=clamp(s.wind_speed||0,0,20); const ang=(s.wind_deg||0)*Math.PI/180; const vx=Math.cos(ang), vy=Math.sin(ang); const areaFactor=Math.max(0.6, Math.sqrt((w*h)/(360*260))); const n=Math.max(10, Math.floor(40*this._quality*areaFactor)); if(this._particles.length>n){ this._particles.length=n; } else if(this._particles.length<n){ for(let i=this._particles.length;i<n;i++){ this._particles.push({x:Math.random()*w, y:Math.random()*h, a:Math.random(), l:10+Math.random()*20}); } }
      ctx.save(); ctx.strokeStyle='rgba(80,200,255,1.0)'; ctx.lineWidth=2; ctx.globalCompositeOperation='lighter';
      for(const p of this._particles){ const nx=noise2d(p.x*0.03, p.y*0.03 + ms*0.0002)-0.5; const ny=noise2d(p.y*0.03, p.x*0.03 + ms*0.0002)-0.5; const ax=vx*sp*0.5 + nx*4*this._quality; const ay=vy*sp*0.5 + ny*4*this._quality; const x2=p.x+ax, y2=p.y+ay; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(x2,y2); ctx.stroke(); p.x=x2; p.y=y2; p.l-=1; if(p.x<0||p.x>w||p.y<0||p.y>h||p.l<=0){ p.x=Math.random()*w; p.y=Math.random()*h; p.l=10+Math.random()*20; } }
      ctx.restore();
    }

    _drawPrecip(ctx,w,h,ms,s){ const density=clamp((s.pop||0),0,1) * (s.rain3h>0? 1: 0.5); if(density<=0.01){ this._rain=null; return; } const count=Math.max(5, Math.floor(80*density*this._quality)); if(!this._rain){ this._rain=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h, v:2+Math.random()*4})); } else if(this._rain.length!==count){ if(this._rain.length>count){ this._rain.length=count; } else { for(let i=this._rain.length;i<count;i++){ this._rain.push({x:Math.random()*w,y:Math.random()*h, v:2+Math.random()*4}); } } }
      ctx.save(); ctx.strokeStyle='rgba(50,160,255,1.0)'; ctx.lineWidth=1.5; for(const d of this._rain){ ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x+2,d.y+8); ctx.stroke(); d.x+=1; d.y+=d.v; if(d.x>w||d.y>h){ d.x=Math.random()*w; d.y=-10*Math.random(); } } ctx.restore();
    }

    _loadState(overrides){
      const raw=this._storage.getItem(this._stateKey()); let s=null; try{ s= raw? JSON.parse(raw): null; }catch(_){}
      const base={ left:80, top:80, width:360, height:260, pinned:false, mode:'realtime', rate:1, layers:{ temperature:false, precipitation:false, wind:true, clouds:false } };
      const out=Object.assign({}, base, s||{}, overrides||{});
      if(this._clock && out.mode && this._clock.mode!==out.mode) this._clock.setMode(out.mode);
      if(this._clock && typeof out.rate==='number') this._clock.setRate(out.rate);
      return out;
    }

    _saveState(){ try{ this._storage.setItem(this._stateKey(), JSON.stringify(this._state)); }catch(_){}}
    _stateKey(){ return `WeatherOverlay:state:${this._id}`; }

    _renderLegends(){ if(!this._legendWrap) return; while(this._legendWrap.firstChild){ this._legendWrap.removeChild(this._legendWrap.firstChild);} const layers=this._state.layers||{}; const defs=[{k:'temperature',title:'Temperature (°C)',grad:'linear-gradient(90deg,#1e3a8a,#22d3ee,#f59e0b,#ef4444)',labels:['-10','0','10','20','30+']},{k:'precipitation',title:'Precipitation (mm/3h)',grad:'linear-gradient(90deg,#bfdbfe,#60a5fa,#2563eb,#1e3a8a)',labels:['0','2','5','10','20+']},{k:'wind',title:'Wind (m/s)',grad:'linear-gradient(90deg,#d1fae5,#34d399,#059669,#065f46)',labels:['0','5','10','15','20+']},{k:'clouds',title:'Clouds (%)',grad:'linear-gradient(90deg,rgba(203,213,225,0.2),#cbd5e1,#475569)',labels:['0','25','50','75','100']}]; defs.filter(d=>layers[d.k]).forEach(d=>{ const box=document.createElement('div'); box.style.background='rgba(15,23,42,0.55)'; box.style.border='1px solid rgba(255,255,255,0.08)'; box.style.borderRadius='10px'; box.style.padding='8px'; const h=document.createElement('div'); h.textContent=d.title; h.style.fontWeight='700'; h.style.fontSize='11px'; h.style.marginBottom='6px'; const bar=document.createElement('div'); bar.style.width='100%'; bar.style.height='10px'; bar.style.borderRadius='6px'; bar.style.background=d.grad; bar.style.marginBottom='4px'; const row=document.createElement('div'); row.style.opacity='.8'; row.style.display='flex'; row.style.justifyContent='space-between'; row.style.fontSize='10px'; d.labels.forEach(t=>{ const s=document.createElement('span'); s.textContent=t; row.appendChild(s); }); box.appendChild(h); box.appendChild(bar); box.appendChild(row); this._legendWrap.appendChild(box); }); }

    setHoverContent(text){ if(this._hoverEl){ this._hoverEl.textContent=String(text||''); } }
  }

  return WeatherOverlay;
});
