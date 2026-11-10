(function(){
  const $=id=>document.getElementById(id),bar=$('caption-utility-bar'),workbench=$('caption-workbench');
  $('translate').textContent='翻译字幕';
  const launch=document.createElement('button');launch.id='transcript';launch.type='button';launch.textContent='导出文稿';bar.appendChild(launch);
  ['refresh','caption','translate','optimize','transcript'].forEach(id=>bar.appendChild($(id)));
  const panel=document.createElement('div');panel.id='transcript-panel';panel.className='caption-panel';
  panel.innerHTML='<div id="transcript-actions" class="caption-actions" style="display:flex"><div class="caption-action-title">导出文稿</div><div class="caption-action-buttons"><button id="transcript-confirm" type="button">确认</button><button id="transcript-cancel" type="button" class="secondary">取消</button></div></div><div class="caption-title">LLM</div><div class="composer-controls"><select id="transcript-provider" aria-label="导出文稿服务商"></select><select id="transcript-model" aria-label="导出文稿模型"></select></div><div class="caption-title">导出样式</div><div id="transcript-formats" class="choice-row"><button class="choice active" data-format="clipboard" type="button">复制到剪贴板</button><button class="choice" data-format="txt" type="button">导出纯文本文件</button><button class="choice" data-format="md" type="button">导出Markdown文件</button></div><div id="transcript-progress" class="caption-progress" role="status"></div>';
  workbench.appendChild(panel);
  const provider=$('transcript-provider'),model=$('transcript-model'),progress=$('transcript-progress'),confirm=$('transcript-confirm'),cancel=$('transcript-cancel');
  let providers=[],format='clipboard',clientId='',running=false,serial=0,started=0,timer=null,statusText='';
  const original=document.createElement('button');original.id='transcript-original';original.type='button';original.className='secondary';original.textContent='直接导出原文（不使用LLM）';original.style.display='none';panel.appendChild(original);
  function renderStatus(){progress.textContent=statusText+(running?'  已等待'+Math.floor((Date.now()-started)/1000)+'秒':'');}
  function setStatus(value){statusText=value||'';renderStatus();}
  function stopClock(){if(timer)clearInterval(timer);timer=null;}

  function fillModels(){const item=providers.find(p=>p.id===provider.value),old=model.value;model.innerHTML='';(item&&item.models||[]).forEach(value=>model.add(new Option(value,value)));if(Array.from(model.options).some(o=>o.value===old))model.value=old;model.disabled=running||!item||!item.models.length;if(!model.options.length)model.add(new Option('请先在设置中添加模型',''));}
  function updateProviders(items){providers=Array.isArray(items)?items:[];const old=provider.value;provider.innerHTML='';providers.forEach(p=>provider.add(new Option(p.name,p.id)));if(providers.some(p=>p.id===old))provider.value=old;provider.disabled=running||!providers.length;fillModels();}
  function busy(value){running=value;confirm.disabled=value;provider.disabled=value||!providers.length;fillModels();panel.querySelectorAll('[data-format]').forEach(b=>b.disabled=value);}
  function close(){panel.classList.remove('open');workbench.dataset.action='';setStatus('');}
  launch.onclick=function(){workbench.dataset.action='transcript';panel.classList.add('open');setStatus('');};
  provider.onchange=fillModels;
  panel.querySelectorAll('[data-format]').forEach(b=>b.onclick=function(){format=b.dataset.format;panel.querySelectorAll('[data-format]').forEach(x=>x.classList.toggle('active',x===b));});
  function start(originalOnly){if(running)return;if(!originalOnly&&(!provider.value||!model.value)){setStatus('请先在设置中配置LLM并选择模型。');return;}clientId='transcript-'+Date.now()+'-'+(++serial);original.style.display='none';busy(true);stopClock();started=Date.now();setStatus(originalOnly?'正在导出原文…':'正在准备字幕…');timer=setInterval(renderStatus,1000);iina.postMessage('transcript-generate',{clientId:clientId,provider:provider.value,model:model.value,format:format,originalOnly:!!originalOnly});}
  confirm.onclick=()=>start(false);original.onclick=()=>start(true);
  cancel.onclick=function(){if(running){const old=clientId;clientId='';stopClock();busy(false);iina.postMessage('transcript-cancel',{clientId:old});}close();};
  iina.onMessage('transcript-provider-config',data=>updateProviders(data&&data.providers));
  iina.onMessage('transcript-status',data=>{if(data&&data.id===clientId)setStatus(data.message||'');});
  ['complete','error','cancelled'].forEach(name=>iina.onMessage('transcript-'+name,data=>{if(!data||data.id!==clientId)return;stopClock();busy(false);clientId='';setStatus(data.message||(name==='cancelled'?'已取消导出。':''));original.style.display=name==='error'&&data.canExportOriginal?'':'none';}));
  iina.postMessage('provider-config-request');
}());
