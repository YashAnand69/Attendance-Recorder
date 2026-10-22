import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2];
const loginFile = process.argv[3];
if (base !== "https://attendly-attendance.vercel.app" || !loginFile) throw new Error("Use the explicit Attendly production URL and private login file.");
const password = readFileSync(loginFile,"utf8").match(/password: `([^`]+)`/)[1];
let cookie="";
async function request(path, method="GET", body, origin) {
  const started=performance.now();
  const response=await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{"content-type":"application/json",...(cookie?{cookie}:{}),...(origin?{origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  console.log(method,path,response.status,Math.round(performance.now()-started)+"ms");
  return {status:response.status,data,cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
assert.equal((await fetch(base)).status,200);
assert.equal((await request("/api/attendance-data")).status,401);
assert.equal((await request("/api/session","POST",{password:"wrong-test-password"})).status,401);
const login=await request("/api/session","POST",{password});
assert.equal(login.status,200);
cookie=login.cookie;
assert.ok(cookie);
const before=await request("/api/attendance-data");
assert.equal(before.status,200);
const id="stu-verification-"+Date.now();
const date=new Date().toISOString().slice(0,10);
const attendanceId="att-"+date+"-"+id;
const mutate=(collection,action,key,data)=>request("/api/attendance-data","POST",{collection,action,id:key,data});
try {
  assert.equal((await mutate("students","upsert",id,{id,name:"Temporary deployment check",rollNumber:id,className:"Verification",parentEmail:"",parentPhone:"",faceImageDataUrl:"",status:"active"})).status,200);
  const record={id:attendanceId,studentId:id,studentName:"Temporary deployment check",date,status:"present",timestamp:"00:00",verificationMethod:"manual",snapshotUrl:"must-be-removed"};
  assert.equal((await mutate("attendance_logs","upsert",attendanceId,record)).status,200);
  assert.equal((await mutate("attendance_logs","upsert",attendanceId,{...record,status:"late"})).status,200);
  const read=await request("/api/attendance-data");
  const found=read.data.attendance.filter(row=>row.id===attendanceId);
  assert.equal(found.length,1);
  assert.equal(found[0].status,"late");
  assert.equal(found[0].snapshotUrl,undefined);
  assert.equal((await request("/api/attendance-data","POST",{collection:"students",action:"delete",id},"https://untrusted.example")).status,403);
} finally {
  assert.equal((await mutate("attendance_logs","delete",attendanceId)).status,200);
  assert.equal((await mutate("students","delete",id)).status,200);
}
const after=await request("/api/attendance-data");
assert.ok(!after.data.students.some(row=>row.id===id));
assert.ok(!after.data.attendance.some(row=>row.id===attendanceId));
assert.equal((await request("/api/session","DELETE")).status,200);
cookie="";
assert.equal((await request("/api/attendance-data")).status,401);
console.log("PASS: protected login, storage CRUD, daily deduplication, snapshot stripping and origin checks. Temporary records removed.");
