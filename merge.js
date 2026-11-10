// Loaded in the main plugin context.
const mergeJobs={};
function mergeCheck(job){if(job.cancelled)throw new Error('已取消合并');}
function mergeTool(name){const configured=String(pref('asr_ffmpeg_path','')).trim();return configured?name==='ffmpeg'?configured:pathJoin(mediaDirectory(configured),'ffprobe'):'/opt/homebrew/bin/'+name;}
async function mergeExec(job,name,args,onData){mergeCheck(job);let tool=mergeTool(name);if(!file.exists(tool))tool='/usr/local/bin/'+name;if(!file.exists(tool))throw new Error('找不到'+name+'，请配置FFmpeg路径。');if(name==='ffmpeg'){const threads=job.performance==='performance'?8:job.performance==='eco'?2:4;args=['-threads',String(threads),'-filter_threads',String(job.performance==='performance'?4:job.performance==='eco'?1:2),'-filter_complex_threads','1'].concat(args);if(job.performance==='eco'&&args.includes('-i')&&!args.includes('concat')&&!args.includes('copy')){const at=args.indexOf('-i');args.splice(at,0,'-readrate','1');}}const r=await subtitleJobExec(job,tool,args,undefined,onData,onData);mergeCheck(job);if(!r||r.status!==0)throw new Error(name+'：'+String(r&&r.stderr||'执行失败').slice(-600));return r;}
// Convert coded pixels to a common square-pixel display coordinate system.
// Keep the longer sampling axis for SAR < 1 rather than reducing resolution.
function mergeRatio(value){
 const match=String(value||'').trim().match(/^(\d+(?:\.\d+)?)[/:](\d+(?:\.\d+)?)$/);
 if(!match)return null;const n=Number(match[1]),d=Number(match[2]);
 return n>0&&d>0&&Number.isFinite(n/d)?n/d:null;
}
function mergeVideoGeometry(video){
 const codedWidth=Number(video.width),codedHeight=Number(video.height);
 if(!(codedWidth>0&&codedHeight>0))throw new Error('视频画面尺寸无效');
 const sideRotation=Number((video.side_data_list||[]).find(x=>x.rotation!==undefined)?.rotation);
 const tagRotation=Number((video.tags||{}).rotate);
 const rotation=((Number.isFinite(sideRotation)?sideRotation:Number.isFinite(tagRotation)?tagRotation:0)%360+360)%360;
 if(rotation%90!==0)throw new Error('暂不支持非90度倍数旋转的视频，请先转换视频方向');
 const swapped=rotation===90||rotation===270;
 const sar=mergeRatio(video.sample_aspect_ratio)||((mergeRatio(video.display_aspect_ratio)||codedWidth/codedHeight)*codedHeight/codedWidth);
 const displayWidth=codedWidth*Math.max(1,sar),displayHeight=codedHeight*Math.max(1,1/sar);
 return {codedWidth,codedHeight,width:swapped?codedHeight:codedWidth,height:swapped?codedWidth:codedHeight,
  displayWidth:swapped?displayHeight:displayWidth,displayHeight:swapped?displayWidth:displayHeight,
  sampleAspectRatio:sar,displayAspectRatio:swapped?codedHeight/(codedWidth*sar):codedWidth*sar/codedHeight,
  squarePixels:Math.abs(sar-1)<1e-9,rotation};
}
function mergeDisplaySize(info){return {width:info.displayWidth||info.width,height:info.displayHeight||info.height};}
function mergeEvenSize(value){return Math.max(2,Math.round(value/2)*2);}
async function mergeProbe(job,path){
 const r=await mergeExec(job,'ffprobe',['-v','error','-show_streams','-show_format','-show_data_hash','sha256','-of','json',path]);
 const p=JSON.parse(r.stdout),v=p.streams.find(s=>s.codec_type==='video'&&!(s.disposition||{}).attached_pic),a=p.streams.find(s=>s.codec_type==='audio'),duration=Number(p.format.duration);
 if((!v&&!a)||!(duration>0))throw new Error('无法读取媒体：'+pathBasename(path));
 const totalRate=Number(p.format.size)*8/duration||Number(p.format.bit_rate)||0;
 const audioRate=a?(Number(a.bit_rate)||(!v?totalRate:Math.min(totalRate*.15,128000))):0;
 const geometry=v?mergeVideoGeometry(v):{width:0,height:0,squarePixels:true,rotation:0};const rotation=geometry.rotation;
 const rate=String(v&&v.avg_frame_rate||'0/1').split('/');
 return {...geometry,duration,size:Number(p.format.size)||0,rate:Number(rate[0])/Number(rate[1])||0,
 bitrate:v?(Number(v.bit_rate)||Math.max(1000,totalRate-audioRate)):0,audioBitrate:audioRate,audio:!!a,hasVideo:!!v,sampleRate:Number(a&&a.sample_rate)||48000,channels:Number(a&&a.channels)||2,
 audioCodec:a&&a.codec_name,videoCodec:v&&v.codec_name,lossless:!!a&&/^(pcm_|flac$|alac$|ape$|wavpack$)/.test(a.codec_name),
 signature:JSON.stringify([v&&[v.codec_name,v.width,v.height,v.pix_fmt,v.profile,v.level,v.avg_frame_rate,v.sample_aspect_ratio,v.display_aspect_ratio,v.extradata_hash,v.time_base,v.color_space,v.color_transfer,v.color_primaries,v.color_range,rotation],a&&[a.codec_name,a.sample_rate,a.channels,a.channel_layout,a.profile,a.extradata_hash]])};
}
// Preserve compatible compressed streams; otherwise budget from duration-weighted source rates.
function mergeBudget(infos,quality){const duration=infos.reduce((n,x)=>n+x.duration,0),factor=quality==='best'?1:quality==='default'?.85:.5;
 const mean=key=>infos.reduce((n,x)=>n+x[key]*x.duration,0)/duration;
 const channels=Math.max(...infos.map(x=>x.channels)),audioOnly=infos.every(x=>!x.hasVideo);
 return {video:Math.max(1000,Math.round(mean('bitrate')*factor)),audio:Math.round(Math.max(16000*channels,Math.min(256000*channels,mean('audioBitrate')*factor))),
 lossless:audioOnly&&quality==='best'&&infos.every(x=>x.lossless)};
}
function mergeCanCopy(infos,quality,volume,smart){return quality==='best'&&volume===100&&!smart&&infos.every(x=>x.signature===infos[0].signature)&&infos.every(x=>(!x.hasVideo||/^(h264|hevc|av1|mpeg4)$/.test(x.videoCodec))&&(!x.audio||/^(aac|alac)$/.test(x.audioCodec)));}
function mergeVolumeDefaults(){const mode=String(pref('merge_volume_mode','unity')),raw=Number(pref('merge_volume_custom',100));return {smartVolume:mode==='smart',volume:mode==='custom'&&Number.isFinite(raw)?Math.round(Math.min(300,Math.max(50,raw))):100};}
async function mergeVolume(job,rows,infos,volume,smart,status){
 if(!smart){const filter=volume===100?'':`volume=${volume/100}`+(volume>100?',alimiter=limit=0.891251:level=false:latency=true':'');return rows.map(()=>filter);}
 const filters=[];
 for(let i=0;i<rows.length;i++){
  if(!infos[i].audio){filters.push('');continue;}status('video','正在测量音量 '+(i+1)+'/'+rows.length);
  const result=await mergeExec(job,'ffmpeg',['-hide_banner','-i',rows[i].path,'-map','0:a:0','-vn','-af','volumedetect','-f','null','-']);
  const match=String(result.stderr).match(/max_volume:\s*(-?[\d.]+) dB/);
  if(!match)throw new Error('无法测量音量：'+pathBasename(rows[i].path));
  const peak=Number(match[1]);
  if(peak<=-90){filters.push('');continue;}
  // Pre-gain brings very quiet sources above the loudness gate. Each part is normalized
  // independently so a loud part or an isolated peak cannot suppress quiet dialogue elsewhere.
  const gain=Math.max(0,Math.min(60,-12-peak));
  filters.push(`volume=${gain}dB,loudnorm=I=-16:TP=-1.5:LRA=11:linear=false`);
 }
 return filters;
}
function mergeSubtitles(path){const directory=mediaDirectory(path),stem=mediaStem(path);return file.list(directory,{includeSubDir:false}).filter(x=>!x.isDir&&/\.(srt|vtt|ass|ssa)$/i.test(x.filename||x.path)).map(x=>resolveListedPath(directory,x)).filter(x=>{const n=mediaStem(x);return n===stem||n.startsWith(stem+'.')||n.startsWith(stem+'-')||n.startsWith(stem+'_');}).sort((a,b)=>{const score=x=>pathBasename(x).startsWith(stem)?1:0;return score(b)-score(a)||a.localeCompare(b,undefined,{numeric:true});});}

// Name suggestions use the destination directory of the first selected item.
function mergeCommonName(rows){
  const names=rows.map(r=>mediaStem(String(r.path||'' )).normalize('NFC'));
  if(!names.length)return '';
  const shortest=Array.from(names.reduce((a,b)=>a.length<=b.length?a:b));
  for(let length=shortest.length;length>0;length--){
    for(let start=0;start+length<=shortest.length;start++){
      const candidate=shortest.slice(start,start+length).join('');
      if(names.every(name=>name.includes(candidate))){
        const cleaned=candidate.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
        if(cleaned)return cleaned;
      }
    }
  }
  return 'Merged';
}
function mergeSuggestedName(rows,subtitles){
  if(!rows.length)return '';
  const common=mergeCommonName(rows),directory=mediaDirectory(rows[0].path);
  const key=value=>String(value).normalize('NFC').toLowerCase();
  const existing=new Set(file.list(directory,{includeSubDir:false}).map(item=>key(pathBasename(resolveListedPath(directory,item)))));
  const selected=new Set(rows.map(row=>key(mediaStem(row.path))));
  function occupied(name){return selected.has(key(name))||['.mp4','.m4a'].concat(subtitles?['.smart-caption-merged.srt']:[]).some(ext=>existing.has(key(name+ext))||file.exists(pathJoin(directory,name+ext)));}
  if(!occupied(common))return common;
  const merged=common==='Merged'?'Merged':common+'_Merged';
  if(merged!==common&&!occupied(merged))return merged;
  let index=1;while(occupied(merged+' '+index))index++;
  return merged+' '+index;
}
standaloneWindow.onMessage('merge-name-request',function(data){
  try{post('merge-name-result',{id:data.id,name:mergeSuggestedName(data.items||[],data.subtitles!==false)});}
  catch(error){post('merge-name-result',{id:data.id,message:'无法读取目标目录，请手动填写名称：'+error.message});}
});

function mergeItem(path){return {path,name:pathBasename(path),subtitles:mergeSubtitles(path)};}

function sendMergeCandidates(){try{const current=localMediaPath(),stem=mediaStem(current);function score(path){const other=mediaStem(path);let i=0;while(i<stem.length&&i<other.length&&stem[i].toLowerCase()===other[i].toLowerCase())i++;return i/Math.max(stem.length,other.length);}
const paths=file.list(mediaDirectory(current),{includeSubDir:false}).filter(x=>!x.isDir&&/\.(mp4|mkv|mov|m4v|avi|webm|ts|mts|m2ts|wmv|asf|mpg|mpeg|mpe|m2v|vob|flv|f4v|3gp|3g2|ogv|divx|rm|rmvb|mxf|mp3|m4a|m4b|aac|wav|flac|ogg|opus|aif|aiff|wma|ape|caf|mka|oga|ac3|eac3|dts|amr|au|snd|wv|tta|alac|aifc|mp2)$/i.test(x.filename||x.path)).map(x=>resolveListedPath(mediaDirectory(current),x)).filter(x=>x===current||(/\.(mp3|m4a|m4b|aac|wav|flac|ogg|opus|aif|aiff|wma|ape|caf|mka|oga|ac3|eac3|dts|amr|au|snd|wv|tta|alac|aifc|mp2)$/i.test(x)===!currentMediaHasVideo()&&score(x)>=.5)).sort((a,b)=>score(b)-score(a)).slice(0,6).sort((a,b)=>pathBasename(a).localeCompare(pathBasename(b),undefined,{numeric:true}));post('merge-list',{items:paths.map(mergeItem),quality:pref('merge_quality','best'),performance:pref('merge_performance','normal'),scaling:pref('merge_scaling','fit'),...mergeVolumeDefaults(),subtitles:pref('merge_subtitles',true)!==false,audioOnly:!currentMediaHasVideo()});}catch(e){post('merge-error',{message:e.message});}}
async function selectMergeFiles(){try{const script='set picked to choose file of type {"public.movie", "public.audio"} with multiple selections allowed\nset output to ""\nrepeat with p in picked\nset output to output & POSIX path of p & linefeed\nend repeat\nreturn output';const r=await utils.exec('/usr/bin/osascript',['-e',script]);if(r.status===0)post('merge-add',{items:String(r.stdout).trim().split('\n').filter(Boolean).map(mergeItem)});}catch(e){post('merge-error',{message:e.message});}}
function mergeSrt(cues){function stamp(t){const ms=Math.max(0,Math.round(t*1000));return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(x=>String(x).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');}return cues.map((c,i)=>(i+1)+'\n'+stamp(c.start)+' --> '+stamp(c.end)+'\n'+c.text+'\n').join('\n');}
async function mergeRecognize(job,path,duration,selection,emit){
  mergeCheck(job);
  const raw=await runMediaASR(path,Object.assign({},selection,{duration:duration}),job,emit);
  mergeCheck(job);const cues=parseSrtOrVtt(raw);if(!cues.length)throw new Error('识别未返回有效字幕');return cues;
}
function mergeTargetVideo(infos){return infos.filter(x=>x.hasVideo).reduce((best,x)=>{
 const current=mergeDisplaySize(x),previous=best&&mergeDisplaySize(best);
 return !best||current.width*current.height>previous.width*previous.height?x:best;
},null);}
function mergeVideoFilters(info,width,height,fps,scaling='fit'){
 const filters=[],size=info.hasVideo?mergeDisplaySize(info):{width,height};
 // Nearness is measured in display coordinates, after rotation and SAR normalization.
 // Direct padding is safe only when both axes fit; never crop an oversized axis.
 const near=size.width<=width&&size.height<=height&&(width-size.width<width*.01||height-size.height<height*.01);
 let scaledWidth=width,scaledHeight=height;
 if(scaling!=='fill'){
  const factor=near?1:Math.min(width/size.width,height/size.height);
  scaledWidth=Math.min(width,mergeEvenSize(size.width*factor));
  scaledHeight=Math.min(height,mergeEvenSize(size.height*factor));
 }
 if(info.hasVideo&&(info.squarePixels===false||info.width!==scaledWidth||info.height!==scaledHeight))filters.push(`scale=${scaledWidth}:${scaledHeight}`);
 // Dimensions already encode the intended display shape; reset SAR only now.
 filters.push('setsar=1');
 if(scaledWidth!==width||scaledHeight!==height)filters.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
 filters.push(`fps=${fps}`,'setpts=PTS-STARTPTS');return filters.join(',');
}
async function cleanupMergeDirectory(directory){
 if(!directory||!file.exists(directory))return;
 if(!/^\.smart-caption-merge-[A-Za-z0-9]+$/.test(pathBasename(directory)))throw new Error('拒绝清理非Merge临时目录');
 for(const item of file.list(directory,{includeSubDir:false})){if(item.isDir)throw new Error('临时目录出现未知子目录：'+directory);await deleteGeneratedFile(resolveListedPath(directory,item));}
 const result=await utils.exec('/bin/rmdir',[directory]);if(!result||result.status!==0||file.exists(directory))throw new Error('临时目录清理失败：'+directory);
}
async function mergeEncoder(job){try{await mergeExec(job,'ffmpeg',['-v','error','-f','lavfi','-i','color=s=320x240:r=25','-frames:v','1','-c:v','h264_videotoolbox','-allow_sw','0','-b:v','1000000','-f','null','-']);return 'h264_videotoolbox';}catch(e){mergeCheck(job);return 'libx264';}}
async function runMerge(data){const id=String(data.clientId),job={clientId:id,cancelled:false,performance:['performance','normal','eco'].includes(data.performance)?data.performance:String(pref('merge_performance','normal'))},rows=data.items||[];if(Object.keys(mergeJobs).length){post('merge-error',{message:'已有合并任务正在运行'});return;}mergeJobs[id]=job;let directory='',published=[],succeeded=false;data.quality=['best','default','compressed'].includes(data.quality)?data.quality:'best';const started=Date.now();function status(channel,text){if(!job.cancelled)post('merge-status',{id,channel,text});}
try{job.mediaContext=localMediaPath();if(data.subtitles&&rows.some(r=>!r.subtitle||r.subtitle==='recognize'))validateASRSelection(data.asr);if(rows.length<2)throw new Error('请至少选择两个媒体文件');if(rows.some(r=>!file.exists(r.path)))throw new Error('部分视频已不存在');const name=String(data.autoName===true?mergeSuggestedName(rows,data.subtitles!==false):data.name||'').trim().replace(/\.(mp4|m4a)$/i,'');if(!name||/[\/\\:\x00-\x1f]/.test(name)||name==='.'||name==='..')throw new Error('请输入有效的目标视频名称');const parent=mediaDirectory(rows[0].path),outputBase=pathJoin(parent,name),subtitle=pathJoin(parent,name+'.smart-caption-merged.srt');if(file.exists(outputBase+'.mp4')||file.exists(outputBase+'.m4a')||data.subtitles&&file.exists(subtitle))throw new Error('目标文件已存在，请修改名称');const tmp=await utils.exec('/usr/bin/mktemp',['-d',pathJoin(parent,'.smart-caption-merge-XXXXXX')]);if(tmp.status!==0)throw new Error('无法创建合并临时目录');directory=String(tmp.stdout).trim();const infos=[];for(const row of rows){status('video','正在读取 '+pathBasename(row.path));infos.push(await mergeProbe(job,row.path));}
const audioOnly=infos.every(x=>!x.hasVideo),extension=audioOnly?'m4a':'mp4',output=outputBase+'.'+extension;const reference=mergeTargetVideo(infos),scaling=(data.scaling||pref('merge_scaling','fit'))==='fill'?'fill':'fit';const width=reference?mergeEvenSize(mergeDisplaySize(reference).width):0,height=reference?mergeEvenSize(mergeDisplaySize(reference).height):0,fps=Math.max(...infos.map(x=>x.rate)),bitrate=mergeBudget(infos,data.quality).video;const volumeDefaults=mergeVolumeDefaults();const budget=mergeBudget(infos,data.quality),volume=Number.isFinite(Number(data.volume))?Math.min(300,Math.max(50,Number(data.volume))):volumeDefaults.volume,smart=typeof data.smartVolume==='boolean'?data.smartVolume:volumeDefaults.smartVolume,copy=mergeCanCopy(infos,data.quality,volume,smart);const volumeFilter=await mergeVolume(job,rows,infos,volume,smart,status);const normalized=[],durations=[];const encoder=audioOnly||copy?'':await mergeEncoder(job);if(!audioOnly&&!copy&&encoder==='libx264')status('video','硬件编码不可用，已切换受限线程的软件编码');
let firstFailure=null;const videoTask=(async()=>{for(let i=0;i<rows.length;i++){if(copy){const target=pathJoin(directory,'part-'+i+'.'+extension);status('video','正在无损拼接 '+(i+1)+'/'+rows.length);const args=['-v','error','-y','-i',rows[i].path];if(!audioOnly)args.push('-map','0:v:0');if(infos[i].audio)args.push('-map','0:a:0');args.push('-c','copy',target);await mergeExec(job,'ffmpeg',args);normalized.push(target);durations.push((await mergeProbe(job,target)).duration);continue;}if(audioOnly){const target=pathJoin(directory,'part-'+i+'.m4a'),rate=Math.max(...infos.map(x=>x.sampleRate)),channels=Math.max(...infos.map(x=>x.channels));status('video','正在合并音频 '+(i+1)+'/'+rows.length);await mergeExec(job,'ffmpeg',['-v','error','-y','-i',rows[i].path,'-map','0:a:0','-vn','-af',[volumeFilter[i],'aresample=async=1:first_pts=0'].filter(Boolean).join(','),'-ar',String(budget.lossless?rate:Math.min(rate,data.quality==='compressed'?48000:96000)),'-ac',String(channels),'-c:a','alac',target]);normalized.push(target);durations.push((await mergeProbe(job,target)).duration);continue;}const target=pathJoin(directory,'part-'+i+'.mp4');const args=['-v','error','-y','-hwaccel','auto','-i',rows[i].path];if(!infos[i].hasVideo)args.push('-f','lavfi','-i',`color=c=black:s=${width}x${height}:r=${fps}`);if(!infos[i].audio)args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');args.push('-map',infos[i].hasVideo?'0:v:0':'1:v:0','-map',infos[i].audio?'0:a:0':'1:a:0','-vf',mergeVideoFilters(infos[i],width,height,fps,scaling),'-af',[volumeFilter[i],'aresample=48000:async=1:first_pts=0,apad'].filter(Boolean).join(','),'-t',String(infos[i].duration));args.push('-c:v',encoder,'-pix_fmt','yuv420p','-threads',String(job.performance==='performance'?8:job.performance==='eco'?2:4));
const targetBitrate=Math.round(bitrate);
if(encoder==='h264_videotoolbox'){args.push('-allow_sw','0','-prio_speed',job.performance==='performance'?'1':'0','-power_efficient',job.performance==='eco'?'1':'-1','-b:v',String(targetBitrate),'-maxrate',String(Math.round(targetBitrate*1.5)),'-bufsize',String(targetBitrate*3));}
else{args.push('-preset',job.performance==='eco'?'ultrafast':job.performance==='performance'?'fast':'veryfast');args.push('-b:v',String(targetBitrate),'-maxrate',String(Math.round(targetBitrate*1.5)),'-bufsize',String(targetBitrate*3));}
args.push('-c:a','aac','-b:a',String(budget.audio),'-ar',String(Math.min(96000,Math.max(...infos.map(x=>x.sampleRate)))),'-ac',String(Math.max(...infos.map(x=>x.channels))),'-video_track_timescale','90000','-progress','pipe:1','-nostats',target);status('video','正在合并视频 '+(i+1)+'/'+rows.length);await mergeExec(job,'ffmpeg',args,chunk=>{const m=String(chunk).match(/out_time=([^\r\n]+)/);if(m)status('video','正在合并视频 '+(i+1)+'/'+rows.length+' · '+m[1]);});normalized.push(target);durations.push((await mergeProbe(job,target)).duration);}const list=pathJoin(directory,'concat.txt');file.write(list,normalized.map((p,i)=>"file 'part-"+i+"."+extension+"'").join('\n'));const concatArgs=['-v','error','-y','-f','concat','-safe','0','-i',list];if(audioOnly&&!copy&&!budget.lossless)concatArgs.push('-c:a','aac','-b:a',String(budget.audio));else concatArgs.push('-c','copy');concatArgs.push('-movflags','+faststart',pathJoin(directory,'merged.'+extension));await mergeExec(job,'ffmpeg',concatArgs);status('video','完成合并。'+((Date.now()-started)/1000).toFixed(1)+'s done');})();
const subtitleTask=(async()=>{if(job.performance==='eco'&&data.subtitles){status('subtitle','等待视频处理完成');await videoTask;}if(!data.subtitles){status('subtitle','不合并字幕');return [];}const result=[];for(let i=0;i<rows.length;i++){mergeCheck(job);if(rows[i].subtitle&&rows[i].subtitle!=='recognize'){let source=rows[i].subtitle;if(/\.(ass|ssa)$/i.test(source)){const converted=pathJoin(directory,'subtitle-'+i+'.srt');await mergeExec(job,'ffmpeg',['-v','error','-y','-i',source,converted]);source=converted;}result.push(parseSrtOrVtt(file.read(source)));if(!result[i].length)throw new Error('字幕无有效内容：'+pathBasename(rows[i].subtitle));}else{status('subtitle','正在补充生成视频'+pathBasename(rows[i].path)+'的字幕');const cues=await mergeRecognize(job,rows[i].path,infos[i].duration,data.asr,(stage,detail)=>status('subtitle',stage+'：'+detail));if(!cues.length)throw new Error('识别未返回字幕');result.push(cues);}}return result;})();
const results=await Promise.allSettled([videoTask.catch(e=>{if(!firstFailure)firstFailure=e;job.cancelled=true;(job.leases||[]).forEach(cleanupRequestFile);throw e;}),subtitleTask.catch(e=>{if(!firstFailure)firstFailure=e;job.cancelled=true;(job.leases||[]).forEach(cleanupRequestFile);throw e;})]);const failed=results.find(x=>x.status==='rejected');if(failed)throw firstFailure||failed.reason;mergeCheck(job);if(data.subtitles){status('subtitle','正在拼接字幕');let offset=0,combined=[];results[1].value.forEach((cues,i)=>{cues.forEach(c=>{const start=Math.max(0,c.start),end=Math.min(c.end,infos[i].duration,durations[i]);if(end>start)combined.push({start:start+offset,end:end+offset,text:c.text});});offset+=durations[i];});combined.sort((a,b)=>a.start-b.start);file.write(pathJoin(directory,'merged.srt'),mergeSrt(combined));}
for(const pair of [[pathJoin(directory,'merged.'+extension),output]].concat(data.subtitles?[[pathJoin(directory,'merged.srt'),subtitle]]:[])){mergeCheck(job);if(file.exists(pair[1]))throw new Error('目标文件已存在');const r=await utils.exec('/bin/mv',['-n',...pair]);if(r.status!==0||file.exists(pair[0]))throw new Error('无法保存合并文件');published.push(pair[1]);}mergeCheck(job);succeeded=true;await cleanupMergeDirectory(directory);directory='';status('subtitle',data.subtitles?'字幕拼接完成':'不合并字幕');post('merge-complete',{id,path:output});if(pref('merge_autoplay',true)){try{const listener=event.on('iina.file-loaded',function(){if(localMediaPath()!==output)return;event.off('iina.file-loaded',listener);if(data.subtitles)core.subtitle.loadTrack(subtitle);core.resume();});core.open(output);}catch(e){post('merge-error',{id,message:'文件已保存，但自动播放失败：'+e.message});}}
}catch(e){if(!succeeded)for(const path of published){try{await deleteGeneratedFile(path);}catch(cleanupError){e.message+='；'+cleanupError.message;}}post(job.userCancelled?'merge-cancelled':'merge-error',{id,message:job.userCancelled?'已取消合并':e.message});}finally{try{await cleanupMergeDirectory(directory);}catch(error){post('merge-error',{id,message:error.message});}finally{delete mergeJobs[id];}}}
standaloneWindow.onMessage('merge-list-request',sendMergeCandidates);
standaloneWindow.onMessage('merge-select',selectMergeFiles);
standaloneWindow.onMessage('merge-start',data=>runMerge(data||{}));
standaloneWindow.onMessage('merge-cancel',data=>{const job=mergeJobs[String(data.clientId)];if(job){job.userCancelled=true;job.cancelled=true;(job.leases||[]).forEach(cleanupRequestFile);}});
