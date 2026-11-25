// Only runs on trusted backup runners. Never log object paths or credentials.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
const root = process.argv[2];
const cap = Number(process.env.STORAGE_MAX_BYTES || 100_000_000);
const client = createClient(process.env.BACKUP_SUPABASE_URL, process.env.BACKUP_SUPABASE_SERVICE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
let bytes = 0;
const manifest = [];
async function walk(bucket, prefix = "") {
  for (let offset=0;;offset+=100) {
    const {data,error}=await client.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:"name",order:"asc"}});
    if(error || !data) throw new Error("Storage listing failed");
    for(const row of data) {
      const path=prefix ? prefix+"/"+row.name : row.name;
      if(!row.id){ await walk(bucket,path); continue; }
      const size=Number(row.metadata?.size);
      if(!Number.isSafeInteger(size)||size<0||bytes+size>cap) throw new Error("Storage size limit or unknown size");
      const {data:blob,error:downloadError}=await client.storage.from(bucket).download(path);
      if(downloadError||!blob) throw new Error("Storage download failed");
      const content=Buffer.from(await blob.arrayBuffer());
      if(content.length!==size||bytes+content.length>cap) throw new Error("Storage changed during backup or exceeds cap");
      const sha256=createHash("sha256").update(content).digest("hex");
      const file=String(manifest.length).padStart(8,"0")+".bin";
      await writeFile(join(root,file),content,{flag:"wx",mode:0o600});
      manifest.push({bucket,path,file,size,sha256}); bytes+=size;
    }
    if(data.length<100) break;
  }
}
await mkdir(root,{recursive:true,mode:0o700});
try { for(const bucket of ["worker_documents","profile_pictures"]) await walk(bucket);
await writeFile(join(root,"manifest.json"),JSON.stringify({createdAt:new Date().toISOString(),bytes,objects:manifest}),{mode:0o600});
console.log("Storage exported:",manifest.length,"objects,",bytes,"bytes");
} catch { console.error("Storage backup failed; no partial archive may be uploaded"); process.exit(1); }
