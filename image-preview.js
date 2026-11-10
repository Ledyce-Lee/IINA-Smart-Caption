(function () {
  'use strict';
  // Native JavaScript dialogs cannot share the WebView glass appearance.
  function dialog(message, value) {
    return new Promise(function(resolve) {
      var previous=document.activeElement, overlay=document.createElement('div');
      overlay.className='sc-dialog-overlay';
      overlay.innerHTML='<div class="modal-card" role="dialog" aria-modal="true"><h2></h2><div class="modal-actions"><button class="secondary" type="button">取消</button><button type="button">确定</button></div></div>';
      overlay.querySelector('h2').textContent=message;
      var input=null, buttons=overlay.querySelectorAll('button');
      if(value!==undefined){input=document.createElement('input');input.value=value;input.setAttribute('aria-label',message);overlay.querySelector('.modal-card').insertBefore(input,overlay.querySelector('.modal-actions'))}
      function finish(ok){overlay.remove();if(previous&&previous.isConnected)previous.focus({preventScroll:true});resolve(input?(ok?input.value:null):ok)}
      buttons[0].onclick=function(){finish(false)};buttons[1].onclick=function(){finish(true)};
      overlay.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish(false)}else if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Tab'){var nodes=input?[input,buttons[0],buttons[1]]:[buttons[0],buttons[1]],index=nodes.indexOf(document.activeElement);e.preventDefault();nodes[(index+(e.shiftKey?nodes.length-1:1))%nodes.length].focus()}});
      document.body.appendChild(overlay);(input||buttons[0]).focus();if(input)input.select();
    });
  }
  window.smartCaptionConfirm=function(message){return dialog(message)};
  window.smartCaptionPrompt=function(message,value){return dialog(message,value)};

  var overlay=document.createElement('div');overlay.id='sc-preview';overlay.hidden=true;
  overlay.innerHTML='<section class="sc-preview-card" role="dialog" aria-modal="true" aria-labelledby="sc-preview-title"><div class="sc-preview-bar"><button id="sc-preview-close" type="button" aria-label="关闭预览"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4L12 12M12 4L4 12"></path></svg></button><span id="sc-preview-title"></span><span id="sc-preview-count"></span><button id="sc-preview-prev" type="button" aria-label="上一张"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8L10 13"></path></svg></button><button id="sc-preview-next" type="button" aria-label="下一张"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3L11 8L6 13"></path></svg></button></div><div id="sc-preview-stage"><img id="sc-preview-image" alt="" draggable="false"><span id="sc-preview-status" role="status"></span></div></section>';
  document.body.appendChild(overlay);
  var $=function(id){return document.getElementById(id)},stage=$('sc-preview-stage'),image=$('sc-preview-image'),status=$('sc-preview-status');
  var items=[],index=0,group='',previous=null,request=0,scale=1,x=0,y=0,gestureScale=1,drag=null;
  // The stage follows the original aspect ratio; only toolbar and frame add height.
  function fitCard(){
    if(overlay.hidden||!image.naturalWidth||!image.naturalHeight)return;
    var card=overlay.querySelector('.sc-preview-card');
    var frameWidth=14,frameHeight=48;
    var availableWidth=Math.max(1,Math.min(1400,window.innerWidth-40)-frameWidth);
    var availableHeight=Math.max(1,Math.min(1100,window.innerHeight-48)-frameHeight);
    var ratio=Math.min(1,availableWidth/image.naturalWidth,availableHeight/image.naturalHeight);
    card.style.width=(image.naturalWidth*ratio+frameWidth)+'px';
    card.style.height=(image.naturalHeight*ratio+frameHeight)+'px';
  }
  function transform(){var maxX=Math.max(0,(image.clientWidth*scale-stage.clientWidth)/2),maxY=Math.max(0,(image.clientHeight*scale-stage.clientHeight)/2);x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));image.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';stage.style.cursor=scale>1?'grab':'default'}
  function reset(){scale=1;x=y=0;drag=null;transform()}
  function close(){if(overlay.hidden)return;overlay.hidden=true;request++;image.removeAttribute('src');items=[];reset();if(previous&&previous.isConnected)previous.focus({preventScroll:true})}
  function display(){var item=items[index];if(!item){close();return}request++;reset();image.removeAttribute('src');$('sc-preview-title').textContent=item.name||'图片';image.alt=item.name||'图片';$('sc-preview-count').textContent=(index+1)+' / '+items.length;$('sc-preview-prev').disabled=index===0;$('sc-preview-next').disabled=index===items.length-1;status.textContent='';if(item.path){status.textContent='正在读取原图…';iina.postMessage('gallery-preview',{id:request,path:item.path})}else image.src=item.source}
  function open(list,selected,kind){items=list;index=selected;group=kind;previous=document.activeElement;overlay.hidden=false;display();$('sc-preview-close').focus({preventScroll:true})}
  function step(delta){var next=index+delta;if(next>=0&&next<items.length){index=next;display()}}
  $('sc-preview-close').onclick=close;$('sc-preview-prev').onclick=function(){step(-1)};$('sc-preview-next').onclick=function(){step(1)};
  overlay.addEventListener('click',function(e){if(e.target===overlay)close()});
  document.addEventListener('keydown',function(e){if(overlay.hidden)return;e.stopImmediatePropagation();if(e.key==='Escape'||e.key===' '){e.preventDefault();close()}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1)}else if(e.key==='Tab'){e.preventDefault();var nodes=Array.from(overlay.querySelectorAll('button:not(:disabled)')),i=nodes.indexOf(document.activeElement);nodes[(i+(e.shiftKey?nodes.length-1:1))%nodes.length].focus()}},true);
  document.addEventListener('click',function(e){if(!overlay.hidden||e.metaKey||e.ctrlKey||e.shiftKey)return;var target=e.target;if(!target.closest)return;var selector,kind;if(target.matches('#image-preview-bar img')){selector='#image-preview-bar img';kind='composer'}else if(target.matches('#chat .user-attachment img')){selector='#chat .user-attachment img';kind='chat'}else if(target.closest('.gallery-thumb')){selector='.gallery-item';kind='gallery';target=target.closest('.gallery-item')}else return;var nodes=Array.from(document.querySelectorAll(selector)),selected=nodes.indexOf(target);if(selected<0)return;open(nodes.map(function(node){return kind==='gallery'?{path:node.dataset.path,name:node.title}:{source:node.src,name:node.alt}}),selected,kind)},true);
  iina.onMessage('gallery-preview',function(data){if(overlay.hidden||!data||data.id!==request||group!=='gallery')return;if(data.error){status.textContent=data.error;return}if(data.path!==items[index].path)return;image.src=data.source;status.textContent=''});
  image.onload=function(){status.textContent='';fitCard();transform()};image.onerror=function(){status.textContent='无法显示图片，文件可能已被移动或删除。'};
  function zoom(next,cx,cy){var rect=stage.getBoundingClientRect(),px=(Number.isFinite(cx)?cx:rect.left+rect.width/2)-rect.left-rect.width/2,py=(Number.isFinite(cy)?cy:rect.top+rect.height/2)-rect.top-rect.height/2;next=Math.max(1,Math.min(12,next));var ratio=next/scale;x=px-(px-x)*ratio;y=py-(py-y)*ratio;scale=next;transform()}
  stage.addEventListener('wheel',function(e){e.preventDefault();if(e.ctrlKey||e.metaKey)zoom(scale*Math.exp(-e.deltaY*.01),e.clientX,e.clientY);else if(scale>1){x-=e.deltaX;y-=e.deltaY;transform()}},{passive:false});
  stage.addEventListener('gesturestart',function(e){e.preventDefault();gestureScale=scale},{passive:false});
  stage.addEventListener('gesturechange',function(e){e.preventDefault();zoom(gestureScale*e.scale,e.clientX,e.clientY)},{passive:false});
  stage.addEventListener('gestureend',function(e){e.preventDefault()},{passive:false});
  stage.addEventListener('pointerdown',function(e){if(scale<=1||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);e.preventDefault()});
  stage.addEventListener('pointermove',function(e){if(!drag||drag.id!==e.pointerId)return;x+=e.clientX-drag.x;y+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;transform()});
  stage.addEventListener('pointerup',function(){drag=null});stage.addEventListener('pointercancel',function(){drag=null});stage.addEventListener('dblclick',function(e){if(scale>1)reset();else zoom(2,e.clientX,e.clientY)});window.addEventListener('resize',function(){fitCard();transform()});
  // Do not retain images removed by a refresh, a media change or composer edits.
  function releaseSession(){close();if(window.smartCaptionReleaseChatImages)window.smartCaptionReleaseChatImages();window.__smartCaptionComposerImages=[];window.smartCaptionRenderImagePreviews();window.__smartCaptionPendingImageSave=null;window.__saveElsewhere=null;iina.postMessage('chat-session-reset')}
  // Session images stay only in memory; screenshot staging files are removed immediately.
  releaseSession();
  $('refresh-chat-confirm').addEventListener('click',releaseSession);
  window.addEventListener('pagehide',releaseSession);
  var observer=new MutationObserver(function(){if(overlay.hidden)return;var selector=group==='chat'?'#chat .user-attachment img':group==='composer'?'#image-preview-bar img':'.gallery-item';var nodes=Array.from(document.querySelectorAll(selector));if(nodes.length!==items.length||nodes.some(function(node,i){return group==='gallery'?node.dataset.path!==items[i].path:node.src!==items[i].source}))close()});
  ['chat','image-preview-bar','gallery-content'].forEach(function(id){var node=$(id);if(node)observer.observe(node,{childList:true,subtree:true})});
}());
