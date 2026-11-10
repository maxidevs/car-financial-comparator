import {root} from '../../lib/db.js';
import {createWriteStream} from 'node:fs';
import {unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import Busboy from 'busboy';
import path from 'node:path';
const run=promisify(execFile);
export const POST=async({request})=>{
  const id=randomUUID(), input=path.join(root,'media',id+'.original'); let output, type, fileTask, rejected=false;
  try {
    const parser=Busboy({headers:{'content-type':request.headers.get('content-type')||''},limits:{files:1}});
    parser.on('file',(name,stream,info)=>{
      if(name!=='file'||!(/^(image|video)\//.test(info.mimeType))){rejected=true;stream.resume();return}
      type=info.mimeType.startsWith('video/')?'video':'image';
      fileTask=pipeline(stream,createWriteStream(input));
    });
    await pipeline(Readable.fromWeb(request.body),parser);
    if(fileTask) await fileTask;
    if(rejected||!type) return new Response('Archivo no admitido',{status:400});
    output=path.join(root,'media',id+(type==='video'?'.mp4':'.webp'));
    await run('ffmpeg',type==='video'?['-y','-i',input,'-map','0:v:0','-map','0:a:0?','-vf','scale=trunc(min(1920,iw)/2)*2:-2','-c:v','libx264','-preset','fast','-crf','28','-c:a','aac','-b:a','96k','-movflags','+faststart',output]:['-y','-i',input,'-vf',"scale='min(1920,iw)':-2",'-frames:v','1','-c:v','libwebp','-quality','78',output]);
    return Response.json({url:'/media/'+path.basename(output),type});
  } catch(e) {if(output)await unlink(output).catch(()=>{});return new Response('No se pudo procesar el archivo',{status:500})}
  finally {await unlink(input).catch(()=>{})}
};
