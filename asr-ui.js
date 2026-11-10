/* Caption and Merge share one selection and one control renderer. */
(function(){
  var config={engines:[],providers:[]},views=[];
  var state=window.smartCaptionASR={family:'videocaptioner',engine:'',provider:'',model:'',language:'auto',valid:false};
  function normalize(){
    if(state.family==='apple'){state.engine='apple';state.valid=true;return;}
    if(state.family==='videocaptioner'){
      if(!config.engines.some(function(e){return e.id===state.engine}))state.engine=config.engines.length?config.engines[0].id:'';
      state.valid=!!state.engine;return;
    }
    state.engine='model';var provider=config.providers.filter(function(p){return p.id===state.provider})[0]||config.providers[0];
    state.provider=provider?provider.id:'';
    if(!provider||provider.models.indexOf(state.model)<0)state.model=provider&&provider.models[0]||'';
    state.valid=!!(provider&&state.model);
  }
  function option(select,value,label){var el=document.createElement('option');el.value=value;el.textContent=label;select.appendChild(el);}
  function render(){normalize();views.forEach(function(view){
    var group=view.group,sub=view.sub;sub.textContent='';sub.classList.toggle('apple-help',state.family==='apple');
    group.querySelectorAll('button').forEach(function(b){var active=b.dataset.family===state.family;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    view.languages.querySelectorAll('button').forEach(function(b){var active=b.dataset.language===state.language;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    if(state.family==='apple'){sub.textContent='调用Apple SpeechAnalyzer本地识别，不支持自动识别语言';return;}
    var select=document.createElement('select');select.setAttribute('aria-label',state.family==='model'?'ASR服务商':'VideoCaptioner识别引擎');sub.appendChild(select);
    if(state.family==='videocaptioner'){
      config.engines.forEach(function(e){option(select,e.id,e.name)});if(!select.options.length)option(select,'','请在ASR设置中启用引擎');select.value=state.engine;
      select.onchange=function(){state.engine=select.value;render()};return;
    }
    config.providers.forEach(function(p){option(select,p.id,p.name)});if(!select.options.length)option(select,'','尚未配置ASR服务商');select.value=state.provider;
    var models=document.createElement('select');models.setAttribute('aria-label','ASR模型');sub.appendChild(models);
    var provider=config.providers.filter(function(p){return p.id===state.provider})[0];(provider&&provider.models||[]).forEach(function(m){option(models,m,m)});
    if(!models.options.length)option(models,'','请在ASR设置中添加模型');models.value=state.model;
    select.onchange=function(){state.provider=select.value;render()};models.onchange=function(){state.model=models.value;render()};
  });}
  window.smartCaptionCreateASRControls=function(root,prefix){
    root.classList.add('asr-options');root.innerHTML='<div class="caption-title">ASR接口</div><div class="choice-row asr-engines"><button type="button" class="choice" data-family="videocaptioner">VideoCaptioner</button><button type="button" class="choice" data-family="apple">Apple</button><button type="button" class="choice" data-family="model">ASR Model</button></div><div class="asr-submenu"></div><div class="caption-title">视频语言</div><div class="choice-row asr-languages"></div>';
    var group=root.querySelector('.asr-engines'),sub=root.querySelector('.asr-submenu'),languages=root.querySelector('.asr-languages');group.id=prefix+'-engines';sub.id=prefix==='caption'?'asr-submenu':prefix+'-submenu';languages.id=prefix+'-languages';
    [['auto','自动'],['zh','中文'],['en','英文'],['ja','日语'],['ko','韩语']].forEach(function(item){var b=document.createElement('button');b.type='button';b.className='choice';b.dataset.language=item[0];b.textContent=item[1];b.onclick=function(){state.language=item[0];render()};languages.appendChild(b)});
    group.querySelectorAll('button').forEach(function(b){b.onclick=function(){state.family=b.dataset.family;render()}});
    views.push({group:group,sub:sub,languages:languages});render();
  };
  window.smartCaptionASRSelection=function(){return {engine:state.engine,asrProvider:state.provider,asrModel:state.model,language:state.language}};
  iina.onMessage('asr-config',function(data){config={engines:Array.isArray(data&&data.engines)?data.engines:[],providers:Array.isArray(data&&data.providers)?data.providers:[]};render()});
  window.smartCaptionCreateASRControls(document.getElementById('caption-asr-options'),'caption');
  document.getElementById('caption').addEventListener('click',function(){iina.postMessage('asr-config-request')});
  var back=document.getElementById('caption-back'),forward=document.getElementById('caption-forward');back.onclick=function(){iina.postMessage('caption-navigate',{direction:'back'})};forward.onclick=function(){iina.postMessage('caption-navigate',{direction:'forward'})};
  iina.onMessage('caption-navigation',function(data){back.disabled=!data.back;forward.disabled=!data.forward});
  iina.postMessage('caption-navigation-request');iina.postMessage('asr-config-request');
}());
