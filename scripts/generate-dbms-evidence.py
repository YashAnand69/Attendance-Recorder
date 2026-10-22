from pathlib import Path
import re,textwrap,json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'/'dbms-report'; OUT.mkdir(parents=True,exist_ok=True)
W,H=1120,840
c=canvas.Canvas(str(OUT/'Attendly-DBMS-Evidence.pdf'),pagesize=(W,H))
c.setTitle('Attendly | DBMS source evidence and ER/EER diagrams')
navy='#132B40'; teal='#087F7C'; muted='#586B7D'
index=[]
def text(x,y,s,size=13,color=navy,font='Helvetica'):
 c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,s)
def base(title,subtitle):
 c.setFillColor(HexColor('#F3F6F9'));c.rect(0,0,W,H,fill=1,stroke=0)
 text(42,H-38,'ATTENDLY / DATABASE SYSTEMS',12,teal,'Helvetica-Bold')
 text(42,H-78,title,26,navy,'Helvetica-Bold');text(42,H-103,subtitle,12,muted)
 c.setStrokeColor(HexColor('#CDD9E2'));c.line(42,42,W-42,42)
 text(42,23,'22 October 2026 | Oracle SQL / PL/SQL academic module | source evidence, not execution output',10,muted)
 text(W-86,23,f'{c.getPageNumber():02}',11,teal,'Helvetica-Bold')
def finish(slug,title):
 index.append({'page':c.getPageNumber(),'image':slug+'.png','title':title});c.showPage()
def note(y,heading,body):
 text(56,y,heading,17,teal,'Helvetica-Bold')
 for i,line in enumerate(textwrap.wrap(body,117)):text(56,y-27-i*21,line,14)
base('Your DBMS report evidence pack','Schema, relationships, executable source and a presentation checklist')
note(670,'What is included','Six-table ER model, an EER view of attendance verification types, and complete source screenshots for setup, DDL, sample data, PL/SQL, queries and the demonstration.')
note(555,'How to use the images','Insert the numbered PNGs into your report, keeping the figure caption and source path. The companion PDF keeps the source selectable and the diagrams sharp.')
note(440,'Implementation boundary','The website stores private JSON documents in Vercel Blob. The Oracle module is separate and is not connected to the deployed website. These are source-code screenshots; no Oracle execution results are claimed.')
note(325,'Evidence still needed from Oracle','Run the scripts in a disposable Oracle schema. Capture USER_TABLES, USER_CONSTRAINTS, USER_ERRORS, query results, package calls, rejection cases, audit records and transaction behavior using the supplied capture script.')
note(190,'Before running setup','01_schema.sql drops and recreates the academic tables. Use a dedicated demonstration schema. Never run it against an existing database that contains records you need.')
finish('01-report-guide','Report guide and evidence boundary')
# ER diagram, positions chosen for non-overlapping routes.
def box(x,y,w,title,rows):
 h=42+len(rows)*22
 c.setFillColor(HexColor('#FFFFFF'));c.setStrokeColor(HexColor('#B7CBD7'));c.roundRect(x,y-h,w,h,9,fill=1,stroke=1)
 c.setFillColor(HexColor(navy));c.roundRect(x,y-37,w,37,8,fill=1,stroke=0)
 text(x+13,y-25,title,14,'#FFFFFF','Helvetica-Bold')
 for i,r in enumerate(rows):text(x+13,y-59-i*22,r,12)
 return (x,y,w,h)
def edge(points,label,lx,ly,dashed=False):
 c.setStrokeColor(HexColor(teal if not dashed else muted));c.setLineWidth(1.7);c.setDash(5,4) if dashed else c.setDash()
 p=c.beginPath();p.moveTo(*points[0])
 for pt in points[1:]:p.lineTo(*pt)
 c.drawPath(p);c.setDash();text(lx,ly,label,11,teal if not dashed else muted,'Helvetica-Bold')
base('ER diagram | implemented Oracle schema','PK = primary key   FK = foreign key   UQ = unique   0..* = zero or many')
box(420,680,280,'CLASSROOMS',['PK classroom_id','classroom_name, teacher_name','latitude, longitude, radius_meters'])
box(50,490,300,'STUDENTS',['PK student_id','UQ roll_number','FK classroom_id (required)','student_name, parent contacts','face_image_url, status, created_at'])
box(770,490,300,'CLASS_SESSIONS',['PK session_id (identity)','FK classroom_id (required)','UQ (classroom_id, session_date)','session_date, start_time, end_time','topic, session_status, created_at'])
box(410,390,300,'ATTENDANCE',['PK attendance_id (identity)','FK session_id, student_id (required)','UQ (session_id, student_id)','status, recorded_at, confidence','latitude, longitude, method','offline flag, snapshot_url, notes'])
box(50,220,300,'PARENT_ALERTS',['PK alert_id (identity)','FK student_id (required)','FK attendance_id (nullable)','UQ (student_id, alert_date)','recipient, status, sent_at, message'])
box(770,220,300,'ATTENDANCE_AUDIT',['PK audit_id (identity)','attendance_id (logical reference)','action_type, old_status, new_status','changed_at, changed_by, details'])
edge([(420,630),(200,630),(200,490)],'1 classroom : 0..* students',55,575)
edge([(700,630),(920,630),(920,490)],'1 classroom : 0..* sessions',780,575)
edge([(350,430),(375,430),(375,360),(410,360)],'1 : 0..*',355,444)
edge([(770,430),(745,430),(745,360),(710,360)],'1 : 0..*',712,444)
edge([(100,338),(100,220)],'1 : 0..*',112,265)
edge([(410,275),(375,275),(375,190),(350,190)],'0..1 : 0..*',282,257)
edge([(710,275),(745,275),(745,180),(770,180)],'logical only',734,257,True)
text(420,127,'Session deletion cascades attendance.',12)
text(420,106,'Attendance deletion sets alert FK to NULL.',12)
text(420,85,'Audit has no FK, so history survives deletion.',12)
finish('02-ER-diagram','Implemented ER diagram')
base('EER diagram | attendance specialization','Conceptual interpretation of verification_method; stored together in the ATTENDANCE table')
box(350,680,420,'ATTENDANCE (supertype)',['PK attendance_id; FK student_id, session_id','Common: status, time, score, location, notes','Discriminator: verification_method NOT NULL'])
edge([(560,572),(560,518)],'total specialization',580,533)
c.setFillColor(HexColor('#FFFFFF'));c.setStrokeColor(HexColor(teal));c.circle(560,492,24,fill=1,stroke=1);text(553,484,'d',22,teal,'Helvetica-Bold')
# double line means total, d means disjoint
edge([(555,572),(555,518)],'',0,0)
for x,cx in [(50,200),(410,560),(770,920)]:edge([(560,468),(560,433),(cx,433),(cx,392)],'',0,0)
box(50,392,300,'FACE_VERIFIED',['method = FACE_RECOGNITION','Package requires coordinates','Package checks classroom radius'])
box(410,392,300,'MANUALLY_VERIFIED',['method = MANUAL','Administrator/manual entry','Shares common attendance fields'])
box(770,392,300,'OFFLINE_SYNCHRONIZED',['method = OFFLINE_SYNC','Conceptual method-based subtype','synced_offline is a separate flag'])
note(235,'Disjoint and total','The NOT NULL discriminator plus CHECK constraint permits exactly one of FACE_RECOGNITION, MANUAL or OFFLINE_SYNC. Thus each stored attendance row has one method category.')
note(134,'Mapping to the relational schema','These three subtype boxes are conceptual categories, not three additional tables. The offline Y/N flag is independent of the verification method. No PERSON/STUDENT/TEACHER hierarchy exists in the current schema.')
finish('03-EER-diagram','EER conceptual specialization and relational mapping')
# Complete SQL source, line numbered, wrapped without truncation.
files=['00_setup.sql','01_schema.sql','02_sample_data.sql','03_plsql_program_units.sql','04_queries.sql','05_demo.sql','06_report_capture.sql']
for file in files:
 lines=(ROOT/'database'/file).read_text().splitlines()
 wrapped=[]
 for no,line in enumerate(lines,1):
  chunks=textwrap.wrap(line,112,replace_whitespace=False,drop_whitespace=False,break_long_words=True,break_on_hyphens=False) or ['']
  wrapped.extend([(str(no) if i==0 else '',chunk) for i,chunk in enumerate(chunks)])
 for start in range(0,len(wrapped),39):
  page=wrapped[start:start+39];first=next((n for n,_ in page if n),'continuation')
  base(file.replace('_',' '),f'database/{file} | source lines from {first} | Oracle source - not executed output')
  c.setFillColor(HexColor('#FFFFFF'));c.roundRect(42,69,W-84,646,8,fill=1,stroke=0)
  for i,(no,line) in enumerate(page):
   y=695-i*16
   text(53,y,no,10,'#8293A2','Courier')
   color='#6E8291' if line.lstrip().startswith('--') else '#16415C'
   if re.match(r'\s*(CREATE|CONSTRAINT|SELECT|FROM|WHERE|JOIN|MERGE|INSERT|UPDATE|DELETE|BEGIN|END|IF|EXCEPTION|PROCEDURE|FUNCTION|PROMPT)\b',line,re.I):color=teal
   text(93,y,line,12,color,'Courier')
  finish(f'{len(index)+1:02}-{file[:-4]}-{start//39+1:02}',file)
c.save()
(OUT/'image-index.json').write_text(json.dumps(index,indent=2))
print(f'Created {len(index)} pages')
