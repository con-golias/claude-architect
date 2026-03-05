// @bun @bun-cjs
(function(exports, require, module, __filename, __dirname) {var f0=Object.create;var{getPrototypeOf:P0,defineProperty:FZ,getOwnPropertyNames:j0}=Object;var g0=Object.prototype.hasOwnProperty;function b0(Z){return this[Z]}var h0,u0,m0=(Z,$,J)=>{var W=Z!=null&&typeof Z==="object";if(W){var X=$?h0??=new WeakMap:u0??=new WeakMap,K=X.get(Z);if(K)return K}J=Z!=null?f0(P0(Z)):{};let H=$||!Z||!Z.__esModule?FZ(J,"default",{value:Z,enumerable:!0}):J;for(let Q of j0(Z))if(!g0.call(H,Q))FZ(H,Q,{get:b0.bind(Z,Q),enumerable:!0});if(W)X.set(Z,H);return H};var p0=(Z)=>Z;function l0(Z,$){this[Z]=p0.bind(null,$)}var d=(Z,$)=>{for(var J in $)FZ(Z,J,{get:$[J],enumerable:!0,configurable:!0,set:l0.bind($,J)})};var T=(Z,$)=>()=>(Z&&($=Z(Z=0)),$);function kZ(){return process.env.CLAUDE_PLUGIN_ROOT||j.resolve(__dirname,"..","..")}function S(){return process.env.CLAUDE_PROJECT_PATH||process.cwd()}function c0(){let Z=j.join(DZ.homedir(),d0);if(!$Z.existsSync(Z))$Z.mkdirSync(Z,{recursive:!0});return Z}function NZ(){return j.join(c0(),"architect.sqlite")}function qZ(){return j.join(kZ(),"rules")}function L(Z){return j.normalize(Z).replace(/\\/g,"/")}function JZ(Z,$){let J=!1,W=!1,X=!1;for(let K=0;K<$&&K<Z.length;K++){if(K>0&&Z[K-1]==="\\")continue;let H=Z[K];if(H==='"'&&!J&&!X)W=!W;else if(H==="'"&&!W&&!X)J=!J;else if(H==="`"&&!W&&!J)X=!X}return J||W||X}function y(Z,$){let J=new Bun.Glob(Z);return Array.from(J.scanSync({cwd:$,dot:!1}))}var DZ,j,$Z,__dirname="C:\\Users\\golia\\Desktop\\Projects\\claude-architect\\src\\utils",d0=".claude-architect";var w=T(()=>{DZ=require("os"),j=require("path"),$Z=require("fs")});function WZ(Z,$,J){if(SZ[Z]<SZ[n0])return;let W={timestamp:new Date().toISOString(),level:Z,service:"claude-architect",message:$,...J};process.stderr.write(JSON.stringify(W)+`
`)}var SZ,n0,B;var I=T(()=>{SZ={debug:0,info:1,warn:2,error:3},n0=process.env.ARCHITECT_LOG_LEVEL||"info";B={debug:(Z,$)=>WZ("debug",Z,$),info:(Z,$)=>WZ("info",Z,$),warn:(Z,$)=>WZ("warn",Z,$),error:(Z,$)=>WZ("error",Z,$)}});function yZ(Z){Z.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);let $=Z.query("SELECT version FROM schema_migrations ORDER BY version").all().map((J)=>J.version);for(let J of i0){if($.includes(J.version))continue;Z.run("BEGIN TRANSACTION");try{J.up(Z),Z.query("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)").run(J.version,J.description,Date.now()),Z.run("COMMIT")}catch(W){throw Z.run("ROLLBACK"),Error(`Migration ${J.version} failed: ${W.message}`)}}}var i0;var IZ=T(()=>{i0=[{version:1,description:"Core schema \u2014 projects, decisions, violations, sessions",up:(Z)=>{Z.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          tech_stack TEXT,
          architecture_pattern TEXT DEFAULT 'clean',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS decisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'accepted',
          context TEXT,
          decision TEXT NOT NULL,
          alternatives TEXT,
          consequences_positive TEXT,
          consequences_negative TEXT,
          superseded_by INTEGER,
          tags TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS violations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          rule_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          severity TEXT NOT NULL,
          category TEXT NOT NULL,
          file_path TEXT,
          line_number INTEGER,
          description TEXT NOT NULL,
          suggestion TEXT,
          resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at INTEGER,
          resolved_by TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          summary TEXT,
          features_added TEXT,
          files_changed TEXT,
          decisions_made INTEGER NOT NULL DEFAULT 0,
          violations_found INTEGER NOT NULL DEFAULT 0,
          violations_resolved INTEGER NOT NULL DEFAULT 0,
          compliance_score_before REAL,
          compliance_score_after REAL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS structural_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          change_type TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          description TEXT NOT NULL,
          details TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS rule_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          rule_id TEXT NOT NULL,
          total_violations INTEGER NOT NULL DEFAULT 0,
          resolved_violations INTEGER NOT NULL DEFAULT 0,
          ignored_violations INTEGER NOT NULL DEFAULT 0,
          avg_resolution_time_ms INTEGER,
          last_violation_at INTEGER,
          updated_at INTEGER NOT NULL
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS improvement_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          rule_id TEXT,
          suggestion_type TEXT NOT NULL,
          title TEXT NOT NULL,
          reasoning TEXT NOT NULL,
          evidence TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          applied_at INTEGER,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS compliance_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          overall_score REAL NOT NULL,
          scores_by_category TEXT NOT NULL,
          total_features INTEGER,
          total_files INTEGER,
          total_violations INTEGER,
          violations_by_severity TEXT,
          violations_by_rule TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `)}},{version:2,description:"Performance indexes",up:(Z)=>{Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_project ON violations(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_rule ON violations(rule_id)"),Z.run("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_changes_project ON structural_changes(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_snapshots_project ON compliance_snapshots(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_rule_metrics_rule ON rule_metrics(rule_id)")}}]});function o0(Z){Z.run("PRAGMA journal_mode = WAL"),Z.run("PRAGMA synchronous = NORMAL"),Z.run("PRAGMA foreign_keys = ON"),Z.run("PRAGMA temp_store = MEMORY"),Z.run("PRAGMA mmap_size = 268435456"),Z.run("PRAGMA cache_size = 10000")}function k(Z){if(v)return v;let $=Z||NZ();return B.info("Opening database",{path:$}),v=new vZ.Database($,{create:!0}),o0(v),yZ(v),B.info("Database ready",{path:$}),v}function c(){if(v)v.close(),v=null,B.info("Database closed")}var vZ,v=null;var g=T(()=>{w();I();IZ();vZ=require("bun:sqlite")});function XZ(Z,$){let J=Date.now(),W=L($.path),X=Z.query("SELECT * FROM projects WHERE path = ?").get(W);if(X)return Z.query("UPDATE projects SET name = ?, tech_stack = ?, architecture_pattern = ?, updated_at = ? WHERE id = ?").run($.name,$.tech_stack??X.tech_stack,$.architecture_pattern??X.architecture_pattern,J,X.id),{...X,name:$.name,updated_at:J};return Z.query(`INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run($.id,$.name,W,$.tech_stack??null,$.architecture_pattern??"clean",J,J),{id:$.id,name:$.name,path:W,tech_stack:$.tech_stack??null,architecture_pattern:$.architecture_pattern??"clean",created_at:J,updated_at:J}}function V(Z,$){return Z.query("SELECT * FROM projects WHERE path = ?").get(L($))}function KZ(Z){return Z.query("SELECT * FROM projects ORDER BY updated_at DESC").all()}var D=T(()=>{w()});function HZ(Z,$){let W=Z.query(`INSERT INTO compliance_snapshots
       (project_id, session_id, overall_score, scores_by_category,
        total_features, total_files, total_violations,
        violations_by_severity, violations_by_rule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.overallScore,JSON.stringify($.scoresByCategory),$.totalFeatures,$.totalFiles,$.totalViolations,JSON.stringify($.violationsBySeverity),JSON.stringify($.violationsByRule),Date.now());return Number(W.lastInsertRowid)}function QZ(Z,$){return Z.query("SELECT * FROM compliance_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get($)}function YZ(Z,$,J=20){return Z.query(`SELECT * FROM compliance_snapshots WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`).all($,J).reverse()}function n(Z,$){let J=Z.query(`SELECT overall_score FROM compliance_snapshots
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`).all($);if(J.length<2)return"stable";let W=J[0].overall_score,X=J[J.length-1].overall_score,K=W-X;if(K>3)return"improving";if(K<-3)return"declining";return"stable"}function r0(Z){let $=L(Z).split("/");if($.includes("domain"))return"domain";if($.includes("application"))return"application";if($.includes("infrastructure"))return"infrastructure";return"unknown"}function a0(Z){let $=L(Z).match(/src\/features\/([^/]+)\//);return $?$[1]:null}function t0(Z){let $=[];for(let J of s0){let W=new RegExp(J.source,J.flags),X;while((X=W.exec(Z))!==null)$.push(X[1])}return $}function e0(Z){return Z.startsWith(".")}function PZ(Z){let $=[],J=i.join(Z,"src");if(!GZ.existsSync(J))return{violations:[],filesScanned:0};let W=$1(J),X=0;for(let K of W){X++;let H=L(i.relative(Z,K)),Q=r0(H),G=a0(H);if(Q==="unknown")continue;let U;try{U=GZ.readFileSync(K,"utf-8")}catch{continue}let Y=t0(U);for(let O of Y){if(!e0(O))continue;let A=Z1(H,O,Q,G);if(A)$.push({...A,filePath:H})}}return{violations:$,filesScanned:X}}function Z1(Z,$,J,W){let X=L($);if(J==="domain"){if(X.includes("/application/")||X.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Domain layer imports from ${X.includes("/application/")?"application":"infrastructure"} layer: "${$}"`,suggestion:"Move the dependency to a port interface in domain/ and implement it in infrastructure/"}}if(J==="application"){if(X.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Application layer imports from infrastructure layer: "${$}"`,suggestion:"Define a port interface in domain/ and inject the infrastructure implementation"}}if(W&&X.includes("/features/")){let K=X.match(/features\/([^/]+)\//);if(K&&K[1]!==W)return{ruleId:"01-architecture",ruleName:"Cross-Feature Isolation",severity:"warning",category:"dependency",description:`Direct import from feature "${K[1]}": "${$}"`,suggestion:"Use shared contracts in src/shared/contracts/ or domain events instead"}}return null}function $1(Z){let $=[],J=y("**/*.{ts,tsx,js,jsx}",Z);for(let W of J)if(!W.includes("node_modules")&&!W.includes(".test.")&&!W.includes(".spec."))$.push(i.join(Z,W));return $}var GZ,i,s0;var jZ=T(()=>{w();GZ=require("fs"),i=require("path"),s0=[/import\s+.*from\s+['"](.+)['"]/g,/import\s*\(\s*['"](.+)['"]\s*\)/g,/require\s*\(\s*['"](.+)['"]\s*\)/g]});function bZ(Z){let $=[],J=[],W=R.join(Z,"src","features");if(!x.existsSync(W))return{violations:[],filesScanned:0,features:[]};let X=x.readdirSync(W).filter((Q)=>{let G=R.join(W,Q);return x.statSync(G).isDirectory()&&!Q.startsWith(".")}),K=[];for(let Q of X){let G=R.join(W,Q),U=J1(G,Q,$,K);J.push(U)}if(K.length>0)$.push({ruleId:"06-documentation",ruleName:"Feature README",severity:"info",category:"docs",description:`${K.length} feature(s) missing README.md: ${K.join(", ")}`,suggestion:"Run /architect-scaffold to generate README.md from template"});if(!x.existsSync(R.join(Z,"tsconfig.json")))$.push({ruleId:"03-quality",ruleName:"TypeScript Config",severity:"warning",category:"quality",filePath:"project root",description:"Missing tsconfig.json",suggestion:"Add TypeScript compiler configuration"});if(!x.existsSync(R.join(Z,"PROJECT_MAP.md")))$.push({ruleId:"06-documentation",ruleName:"PROJECT_MAP Required",severity:"warning",category:"docs",description:"Missing PROJECT_MAP.md at project root",suggestion:"Run /architect-init to generate PROJECT_MAP.md"});let H=R.join(Z,"src","shared");if(x.existsSync(H))X1(H,Z,$);return{violations:$,filesScanned:X.length,features:J}}function J1(Z,$,J,W){let X=x.existsSync(R.join(Z,"domain")),K=x.existsSync(R.join(Z,"application")),H=x.existsSync(R.join(Z,"infrastructure")),Q=x.existsSync(R.join(Z,"README.md")),G=x.existsSync(R.join(Z,"__tests__"))||W1(Z),U=gZ.filter((O)=>!x.existsSync(R.join(Z,O)));if(U.length===gZ.length)J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:L(`src/features/${$}/`),description:"Flat structure \u2014 no clean architecture layers",suggestion:"Scaffold domain/application/infrastructure directories"});else if(U.length>0)J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:L(`src/features/${$}/`),description:`Missing ${U.join(", ")} layer${U.length>1?"s":""}`,suggestion:`Add ${U.map((O)=>O+"/").join(", ")} with repository adapters`});if(!Q)W.push($);if($!==$.toLowerCase()||$.includes("_"))J.push({ruleId:"15-code-style",ruleName:"Naming Convention",severity:"info",category:"structure",filePath:L(`src/features/${$}/`),description:`Feature directory "${$}" should use kebab-case`,suggestion:`Rename to "${K1($)}"`});let Y=0;if(!X)Y++;if(!K)Y++;if(!H)Y++;if(!Q)Y++;return{name:$,path:L(`src/features/${$}/`),hasReadme:Q,hasDomain:X,hasApplication:K,hasInfrastructure:H,hasTests:G,violationCount:Y}}function W1(Z){try{return y("**/*.{test,spec}.{ts,tsx,js,jsx}",Z).length>0}catch{return!1}}function X1(Z,$,J){try{let W=y("**/*.{ts,tsx,js,jsx}",Z);for(let X of W){if(X.includes("node_modules"))continue;let H=(X.split("/").pop()||"").replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/,"");if(/^[A-Z]/.test(H)&&!H.includes("."))continue}}catch{}}function K1(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}var x,R,gZ;var hZ=T(()=>{w();x=require("fs"),R=require("path"),gZ=["domain","application","infrastructure"]});function mZ(Z){let $=[],J=o.join(Z,"src"),W=0;try{let X=y("**/*.{ts,tsx,js,jsx,py}",J);for(let K of X){if(Q1.some((Y)=>K.includes(Y)))continue;W++;let H=o.join(J,K),Q=L(o.relative(Z,H)),G;try{G=uZ.readFileSync(H,"utf-8")}catch{continue}let U=G.split(`
`);for(let Y of H1){let O=new RegExp(Y.pattern.source,Y.pattern.flags),A;while((A=O.exec(G))!==null){let M=G.substring(0,A.index).split(`
`).length,z=U[M-1]?.trim()||"";if(z.startsWith("//")||z.startsWith("*"))continue;let F=A.index-G.lastIndexOf(`
`,A.index-1)-1;if(JZ(z,F))continue;$.push({ruleId:"02-security",ruleName:Y.name,severity:Y.severity,category:"security",filePath:Q,lineNumber:M,description:Y.description,suggestion:Y.suggestion})}}}}catch{}return{violations:$,filesScanned:W}}var uZ,o,H1,Q1;var pZ=T(()=>{w();uZ=require("fs"),o=require("path"),H1=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected",suggestion:"Move to environment variable: process.env.API_KEY or use a secrets manager"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected",suggestion:"Move to environment variable or secrets manager. Never commit secrets to source code"},{name:"SQL String Concatenation",pattern:/(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,severity:"critical",description:"Potential SQL injection via string concatenation/template literals",suggestion:"Use parameterized queries or prepared statements instead of string interpolation"},{name:"SQL Concatenation (plus operator)",pattern:/(?:query|exec|execute)\s*\(\s*['"].*['"]\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"critical",description:"SQL query built with string concatenation using user input",suggestion:"Use parameterized queries: db.query('SELECT * FROM x WHERE id = ?', [id])"},{name:"Dangerous innerHTML",pattern:/dangerouslySetInnerHTML\s*=\s*\{\s*\{.*__html.*\}\s*\}/gi,severity:"warning",description:"Use of dangerouslySetInnerHTML \u2014 potential XSS vulnerability",suggestion:"Sanitize content with DOMPurify before rendering, or use safe alternatives"},{name:"innerHTML Assignment",pattern:/\.innerHTML\s*=\s*(?!['"]<)/gi,severity:"warning",description:"Direct innerHTML assignment with dynamic content \u2014 XSS risk",suggestion:"Use textContent for text, or sanitize HTML before assigning to innerHTML"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability",suggestion:"Never use eval(). Use JSON.parse() for data, or safer alternatives for dynamic code"},{name:"Disabled HTTPS Verification",pattern:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/gi,severity:"critical",description:"TLS/SSL certificate verification is disabled",suggestion:"Never disable certificate verification in production. Fix the certificate issue instead"},{name:"Wildcard CORS",pattern:/(?:cors|Access-Control-Allow-Origin)\s*[:=]\s*['"]?\*['"]?/gi,severity:"warning",description:"CORS allows all origins (*) \u2014 overly permissive",suggestion:"Configure CORS with explicit origin allowlist instead of wildcard"},{name:"Console.log in Production",pattern:/console\.(log|debug|trace)\s*\(/g,severity:"info",description:"console.log found \u2014 use structured logging in production",suggestion:"Replace with structured logger (e.g., winston, pino) for production code"}],Q1=["node_modules",".test.",".spec.","__tests__",".d.ts",".min.js","dist/","build/","coverage/"]});function dZ(Z){let $=[],J=q.join(Z,"src");if(!s.existsSync(J))return{violations:[],filesScanned:0};let W=0,X=[];try{let K=y("**/*.{ts,tsx,js,jsx}",J);for(let H of K){if(H.includes("node_modules")||H.includes(".d.ts")||H.includes("dist/"))continue;W++;let Q=q.join(J,H),G=L(q.relative(Z,Q)),U;try{U=s.readFileSync(Q,"utf-8")}catch{continue}let Y=U.split(`
`);if(Y.length>lZ)$.push({ruleId:"15-code-style",ruleName:"File Size Limit",severity:"warning",category:"quality",filePath:G,description:`File has ${Y.length} lines (max ${lZ})`,suggestion:"Split into smaller focused modules. Extract helper functions or sub-components."});if(Y1(U,G,$),G1(U,G,$),!H.includes(".test.")&&!H.includes(".spec.")&&!H.includes("__tests__")&&O1(U)){if(!U1(Q))X.push(G)}}}catch{}if(X.length>0){let K=W-X.length;$.push({ruleId:"03-testing",ruleName:"Test Coverage",severity:"info",category:"quality",description:`No test files found (${K} of ${W} source files have tests)`,suggestion:`Create test files for: ${X.map((H)=>q.basename(H)).join(", ")}`})}return{violations:$,filesScanned:W}}function Y1(Z,$,J){let W=/^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gm,X;while((X=W.exec(Z))!==null){let K=Z.substring(0,X.index).split(`
`).length,H=X[1].split(",").map((G)=>G.trim().split(" as ").pop().trim()).filter(Boolean),Q=Z.substring(X.index+X[0].length);for(let G of H)if(!new RegExp(`\\b${G}\\b`).test(Q))J.push({ruleId:"03-quality",ruleName:"Unused Import",severity:"warning",category:"quality",filePath:$,lineNumber:K,description:`Unused import ${G}`,suggestion:"Remove the import"})}}function G1(Z,$,J){let W=Z.split(`
`),X=0,K=0;for(let H=0;H<W.length;H++){let Q=W[H].trim();if(Q.startsWith("//")&&!Q.startsWith("///")&&!Q.startsWith("// @")){if(X===0)K=H+1;X++}else{if(X>=5)J.push({ruleId:"15-code-style",ruleName:"Commented-Out Code",severity:"info",category:"quality",filePath:$,lineNumber:K,description:`${X} consecutive commented lines \u2014 likely commented-out code`,suggestion:"Remove commented-out code. Use version control to recover old code."});X=0}}}function U1(Z){let $=q.dirname(Z),J=q.basename(Z),W=[".test.ts",".test.tsx",".spec.ts",".spec.tsx",".test.js",".spec.js"],X=J.replace(/\.(ts|tsx|js|jsx)$/,"");return W.some((K)=>s.existsSync(q.join($,X+K)))}function O1(Z){return/^export\s+/m.test(Z)}var s,q,lZ=200;var cZ=T(()=>{w();s=require("fs"),q=require("path")});function iZ(Z){if(Z.length===0)return 100;let $=0;for(let J of Z){let W=A1[J.category]??0.15,X=nZ[J.severity]??1;$+=X*W}return Math.max(0,Math.round(100-$))}function oZ(Z){let $=["dependency","structure","security","quality","docs"],J={};for(let W of $){let X=Z.filter((H)=>H.category===W),K=0;for(let H of X)K+=nZ[H.severity]??1;J[W]=Math.max(0,Math.round(100-K))}return J}function UZ(Z){let $={critical:0,warning:0,info:0};for(let J of Z)$[J.severity]=($[J.severity]??0)+1;return $}function OZ(Z){let $={};for(let J of Z)$[J.ruleId]=($[J.ruleId]??0)+1;return $}var A1,nZ;var AZ=T(()=>{A1={dependency:0.3,structure:0.3,security:0.25,quality:0.2,docs:0.1},nZ={critical:10,warning:3,info:1}});function MZ(Z,$={}){let J=Date.now();B.info("Starting validation",{projectPath:Z});let W=[],X=[],K=0;if(r("dependency",$.categories)){let U=PZ(Z);W.push(...U.violations),K+=U.filesScanned}if(r("structure",$.categories)){let U=bZ(Z);W.push(...U.violations),X=U.features}if(r("security",$.categories)){let U=mZ(Z);W.push(...U.violations),K=Math.max(K,U.filesScanned)}if(r("quality",$.categories)||r("docs",$.categories)){let U=dZ(Z);W.push(...U.violations),K=Math.max(K,U.filesScanned)}if($.severity){let U={critical:0,warning:1,info:2},Y=U[$.severity];W=W.filter((O)=>U[O.severity]<=Y)}let H=iZ(W),Q=oZ(W),G=Date.now()-J;return B.info("Validation complete",{projectPath:Z,score:H,violations:W.length,duration:G}),{overallScore:H,scoresByCategory:Q,totalFeatures:X.length,totalFiles:K,violations:W,featureMap:X,trend:"stable",timestamp:Date.now()}}function rZ(Z,$){let J=[],W=zZ.basename($);if(/\.(test|spec)\./i.test(W)||!/\.(ts|tsx|js|jsx)$/i.test(W))return J;let X;try{X=sZ.readFileSync($,"utf-8")}catch{return J}let K=L(zZ.relative(Z,$)),H=X.split(`
`);if(H.length>200)J.push({ruleId:"15-code-style",ruleName:"File Too Long",severity:"warning",category:"quality",filePath:K,description:`File has ${H.length} lines (limit: 200)`,suggestion:"Split into smaller, focused modules"});for(let U of z1){let Y=new RegExp(U.pattern.source,U.pattern.flags),O;while((O=Y.exec(X))!==null){let A=X.substring(0,O.index).split(`
`).length,M=H[A-1]?.trim()||"";if(M.startsWith("//")||M.startsWith("*"))continue;let z=O.index-X.lastIndexOf(`
`,O.index-1)-1;if(JZ(M,z))continue;J.push({ruleId:"02-security",ruleName:U.name,severity:U.severity,category:"security",filePath:K,lineNumber:A,description:U.description})}}let G=L(K).match(/\/(?:domain|application|infrastructure)\//);if(G){let U=G[0].replace(/\//g,""),Y=M1[U];if(Y)for(let O of H){let A=O.match(/(?:import|from)\s+['"]([^'"]+)['"]/);if(!A)continue;let M=A[1];for(let z of Y)if(M.includes(`/${z}/`)||M.includes(`\\${z}\\`)){J.push({ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",filePath:K,description:`${U} layer imports from ${z} (forbidden)`,suggestion:`Define a port interface in ${U}/ and implement in ${z}/`});break}}}return J}function r(Z,$){if(!$||$.length===0)return!0;return $.includes(Z)}var sZ,zZ,z1,M1;var BZ=T(()=>{jZ();hZ();pZ();cZ();AZ();w();I();sZ=require("fs"),zZ=require("path");z1=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected"},{name:"SQL String Concatenation",pattern:/(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,severity:"critical",description:"Potential SQL injection via string interpolation"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability"}],M1={domain:["infrastructure","application"],application:["infrastructure"]}});function eZ(Z,$){let W=Z.query(`INSERT INTO decisions
       (project_id, session_id, title, status, context, decision, alternatives,
        consequences_positive, consequences_negative, tags, created_at)
     VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.title,$.context??null,$.decision,$.alternatives?JSON.stringify($.alternatives):null,$.consequencesPositive?JSON.stringify($.consequencesPositive):null,$.consequencesNegative?JSON.stringify($.consequencesNegative):null,$.tags?JSON.stringify($.tags):null,Date.now());return Number(W.lastInsertRowid)}function _Z(Z,$){return Z.query("SELECT * FROM decisions WHERE id = ?").get($)}function h(Z,$,J={}){let W=["project_id = ?"],X=[$];if(J.query){W.push("(title LIKE ? OR decision LIKE ? OR context LIKE ?)");let G=`%${J.query}%`;X.push(G,G,G)}if(J.status)W.push("status = ?"),X.push(J.status);let K=Math.min(J.limit??20,100),H=J.offset??0,Q=`
    SELECT * FROM decisions
    WHERE ${W.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;return X.push(K,H),Z.query(Q).all(...X)}function a(Z,$,J=5){return Z.query("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all($,J)}function Z0(Z,$){let W=Z.query(`INSERT INTO violations
       (project_id, session_id, rule_id, rule_name, severity, category,
        file_path, line_number, description, suggestion, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run($.projectId,$.sessionId??null,$.ruleId,$.ruleName,$.severity,$.category,$.filePath??null,$.lineNumber??null,$.description,$.suggestion??null,Date.now());return Number(W.lastInsertRowid)}function VZ(Z,$,J={}){let W=["project_id = ?","resolved = 0"],X=[$];if(J.severity)W.push("severity = ?"),X.push(J.severity);if(J.category)W.push("category = ?"),X.push(J.category);if(J.ruleId)W.push("rule_id = ?"),X.push(J.ruleId);let K=Math.min(J.limit??50,200);return X.push(K),Z.query(`SELECT * FROM violations WHERE ${W.join(" AND ")}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`).all(...X)}function $0(Z,$,J="manual"){Z.query("UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?").run(Date.now(),J,$)}function u(Z,$){let J=Z.query(`SELECT severity, COUNT(*) as count FROM violations
       WHERE project_id = ? AND resolved = 0
       GROUP BY severity`).all($),W={critical:0,warning:0,info:0};for(let X of J)if(X.severity in W)W[X.severity]=X.count;return W}function t(Z,$,J={}){let W=["project_id = ?"],X=[$];if(J.query){W.push("(description LIKE ? OR file_path LIKE ? OR rule_name LIKE ?)");let H=`%${J.query}%`;X.push(H,H,H)}if(J.resolved!==void 0)W.push("resolved = ?"),X.push(J.resolved?1:0);let K=Math.min(J.limit??20,100);return X.push(K,J.offset??0),Z.query(`SELECT * FROM violations WHERE ${W.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...X)}function W0(Z,$,J,W){Z.query(`INSERT OR IGNORE INTO sessions
       (id, project_id, started_at, compliance_score_before, decisions_made, violations_found, violations_resolved)
     VALUES (?, ?, ?, ?, 0, 0, 0)`).run($,J,Date.now(),W??null)}function X0(Z,$,J){Z.query(`UPDATE sessions SET
       completed_at = ?,
       summary = ?,
       features_added = ?,
       files_changed = ?,
       decisions_made = ?,
       violations_found = ?,
       violations_resolved = ?,
       compliance_score_after = ?
     WHERE id = ?`).run(Date.now(),J.summary??null,J.featuresAdded?JSON.stringify(J.featuresAdded):null,J.filesChanged?JSON.stringify(J.filesChanged):null,J.decisionsMade??0,J.violationsFound??0,J.violationsResolved??0,J.complianceScoreAfter??null,$)}function K0(Z,$){return Z.query("SELECT * FROM sessions WHERE id = ?").get($)}function LZ(Z,$,J=10){return Z.query("SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?").all($,J)}function l(Z,$){return Z.query("SELECT COUNT(*) as count FROM sessions WHERE project_id = ?").get($)?.count??0}function H0(Z,$,J=null){let W=Date.now(),X=Z.query("SELECT * FROM rule_metrics WHERE rule_id = ? AND project_id IS ?").get($,J);if(X)Z.query(`UPDATE rule_metrics SET
         total_violations = total_violations + 1,
         last_violation_at = ?,
         updated_at = ?
       WHERE id = ?`).run(W,W,X.id);else Z.query(`INSERT INTO rule_metrics
         (project_id, rule_id, total_violations, resolved_violations,
          ignored_violations, last_violation_at, updated_at)
       VALUES (?, ?, 1, 0, 0, ?, ?)`).run(J,$,W,W)}function Q0(Z,$=null){return Z.query(`SELECT * FROM rule_metrics WHERE project_id IS ?
       ORDER BY total_violations DESC`).all($)}function Y0(Z,$){let W=Z.query(`INSERT INTO improvement_suggestions
       (project_id, rule_id, suggestion_type, title, reasoning, evidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run($.projectId??null,$.ruleId??null,$.suggestionType,$.title,$.reasoning,$.evidence?JSON.stringify($.evidence):null,Date.now());return Number(W.lastInsertRowid)}function m(Z,$=null){if($)return Z.query(`SELECT * FROM improvement_suggestions
         WHERE (project_id = ? OR project_id IS NULL) AND status = 'pending'
         ORDER BY created_at DESC`).all($);return Z.query(`SELECT * FROM improvement_suggestions
       WHERE status = 'pending' ORDER BY created_at DESC`).all()}function TZ(){return{workerPort:parseInt(process.env.ARCHITECT_PORT||"37778",10),logLevel:process.env.ARCHITECT_LOG_LEVEL||"info",databasePath:process.env.ARCHITECT_DB_PATH||"",pluginRoot:process.env.CLAUDE_PLUGIN_ROOT||process.cwd(),improvementMinSessions:parseInt(process.env.ARCHITECT_IMPROVEMENT_MIN_SESSIONS||"5",10)}}var B0={};d(B0,{default:()=>M0});async function M0(){let Z=S(),$=k(),J=V($,Z);if(!J){let U=z0.basename(Z);J=XZ($,{id:crypto.randomUUID(),name:U,path:Z}),B.info("New project registered",{name:U,path:Z})}let W=process.env.CLAUDE_SESSION_ID||crypto.randomUUID(),X=QZ($,J.id);W0($,W,J.id,X?.overall_score);let K=u($,J.id),H=n($,J.id),Q=a($,J.id,3),G=[];if(G.push("# [claude-architect] project context"),G.push(`Project: ${J.name} (${J.path})`),X)G.push(`Compliance Score: ${X.overall_score}/100 (${H})`);if(K.critical>0||K.warning>0)G.push(`Open Violations: ${K.critical} critical, ${K.warning} warning, ${K.info} info`);if(Q.length>0){G.push(`
Recent Decisions:`);for(let U of Q)G.push(`- [${U.status}] ${U.title}`)}process.stdout.write(G.join(`
`))}var z0;var _0=T(()=>{g();D();I();w();z0=require("path")});var L0={};d(L0,{default:()=>V0});async function V0(){let Z=S(),$=k(),J=V($,Z);if(!J){process.stdout.write("Success");return}let W=VZ($,J.id,{limit:5});if(W.length===0){process.stdout.write("Success");return}let X=[];X.push("# [claude-architect] active warnings");for(let K of W)X.push(`- [${K.severity}] ${K.description}${K.file_path?` (${K.file_path})`:""}`);process.stdout.write(X.join(`
`))}var T0=T(()=>{g();D();w()});var w0={};d(w0,{default:()=>E0});async function E0(){let Z=S(),$=k(),J=V($,Z);if(!J){process.stdout.write("Success");return}let W=process.env.TOOL_INPUT_FILE_PATH||"";if(!W){process.stdout.write("Success");return}let X=rZ(Z,W);if(X.length===0){process.stdout.write("Success");return}let K=process.env.CLAUDE_SESSION_ID;for(let Q of X)Z0($,{projectId:J.id,sessionId:K,ruleId:Q.ruleId,ruleName:Q.ruleName,severity:Q.severity,category:Q.category,filePath:Q.filePath,lineNumber:Q.lineNumber,description:Q.description,suggestion:Q.suggestion}),H0($,Q.ruleId,J.id);let H=[];H.push("# [claude-architect] violations detected");for(let Q of X)H.push(`- [${Q.severity}] ${Q.description}${Q.suggestion?` \u2192 ${Q.suggestion}`:""}`);process.stdout.write(H.join(`
`))}var x0=T(()=>{g();D();BZ();w()});var R0={};d(R0,{default:()=>k0});async function k0(){let Z=S(),$=k(),J=V($,Z);if(!J){process.stdout.write("Success");return}let W=process.env.CLAUDE_SESSION_ID;try{let X=MZ(Z,{severity:"warning"});if(HZ($,{projectId:J.id,sessionId:W??void 0,overallScore:X.overallScore,scoresByCategory:X.scoresByCategory,totalFeatures:X.totalFeatures,totalFiles:X.totalFiles,totalViolations:X.violations.length,violationsBySeverity:UZ(X.violations),violationsByRule:OZ(X.violations)}),W){let K=K0($,W),H=u($,J.id),Q=H.critical+H.warning+H.info,G=R1(Z),U=h($,J.id,{limit:100}),Y=K?.started_at??0,O=U.filter((M)=>M.created_at>=Y),A=C1({projectName:J.name,scoreBefore:K?.compliance_score_before??null,scoreAfter:X.overallScore,violations:X.violations,filesChanged:G,decisionsCount:O.length,totalViolations:Q});X0($,W,{summary:A,complianceScoreAfter:X.overallScore,filesChanged:G,decisionsMade:O.length,violationsFound:Q})}B.info("Session summarized",{project:J.name,score:X.overallScore})}catch(X){B.error("Summarization failed",{error:X.message})}process.stdout.write("Success")}function R1(Z){try{let $=F0.spawnSync("git",["status","--short"],{cwd:Z,encoding:"utf-8",timeout:5000});if(!$.stdout)return[];return $.stdout.split(`
`).filter((J)=>J.trim()).map((J)=>J.substring(3).trim())}catch{return[]}}function C1(Z){let $=[];if(Z.scoreBefore!==null&&Z.scoreBefore!==Z.scoreAfter){let X=Z.scoreAfter-Z.scoreBefore,K=X>0?"improved":"decreased";$.push(`Architecture compliance ${K} from ${Z.scoreBefore} to ${Z.scoreAfter} (${X>0?"+":""}${X}).`)}else $.push(`Architecture compliance score: ${Z.scoreAfter}/100.`);if(Z.filesChanged.length>0)if(Z.filesChanged.length<=3)$.push(`Modified: ${Z.filesChanged.join(", ")}.`);else $.push(`${Z.filesChanged.length} files modified, including ${Z.filesChanged.slice(0,2).join(", ")} and ${Z.filesChanged.length-2} more.`);let J=Z.violations.filter((X)=>X.severity==="critical"),W=Z.violations.filter((X)=>X.severity==="warning");if(J.length>0)$.push(`${J.length} critical issue${J.length>1?"s":""} detected: ${J.map((X)=>X.description).slice(0,2).join("; ")}.`);if(W.length>0)$.push(`${W.length} warning${W.length>1?"s":""} remaining.`);if(Z.totalViolations===0)$.push("No open violations \u2014 project is fully compliant.");if(Z.decisionsCount>0)$.push(`${Z.decisionsCount} architectural decision${Z.decisionsCount>1?"s":""} recorded.`);return $.join(" ")}var F0;var C0=T(()=>{g();D();BZ();AZ();I();w();F0=require("child_process")});function D0(Z,$,J=5){let W=$?l(Z,$):0;if($&&W<J)return{suggestions:[],analysisMetadata:{totalRules:0,totalSessions:W,analyzedAt:Date.now()}};let X=Q0(Z,$),K=[];for(let Y of X){if(Y.total_violations>10){let O=Y.ignored_violations/Y.total_violations;if(O>0.5)K.push({ruleId:Y.rule_id,type:"relax",title:`Rule "${Y.rule_id}" is frequently ignored`,reasoning:`${Math.round(O*100)}% of violations for this rule are ignored (${Y.ignored_violations}/${Y.total_violations}). The rule may be too strict or irrelevant for this project.`,evidence:{totalViolations:Y.total_violations,resolvedViolations:Y.resolved_violations,ignoredViolations:Y.ignored_violations,ignoreRate:Math.round(O*100)}})}if(Y.avg_resolution_time_ms!==null&&Y.avg_resolution_time_ms<300000&&Y.resolved_violations>5)K.push({ruleId:Y.rule_id,type:"add",title:`Auto-fix candidate: "${Y.rule_id}"`,reasoning:`Violations for this rule are resolved quickly (avg ${Math.round(Y.avg_resolution_time_ms/1000)}s). Consider adding auto-fix support.`,evidence:{avgResolutionTimeSec:Math.round(Y.avg_resolution_time_ms/1000),resolvedCount:Y.resolved_violations}});if($&&W>0){let O=Y.total_violations/W;if(O>3)K.push({ruleId:Y.rule_id,type:"split",title:`Rule "${Y.rule_id}" triggers too frequently`,reasoning:`This rule triggers ${O.toFixed(1)} times per session on average. Consider splitting into more specific sub-rules or adding examples.`,evidence:{violationsPerSession:O.toFixed(1),totalSessions:W,totalViolations:Y.total_violations}})}}let H=new Set(X.map((Y)=>Y.rule_id)),Q=["01-architecture","02-security","03-testing","04-api-design","05-database","06-documentation","07-performance","08-error-handling","09-git-workflow","10-frontend","11-auth-patterns","12-monitoring","13-environment","14-dependency-management","15-code-style","16-ci-cd"];if(W>=J){for(let Y of Q)if(!H.has(Y))K.push({ruleId:Y,type:"remove",title:`Rule "${Y}" never triggered`,reasoning:`This rule has never produced a violation across ${W} sessions. It may be too obvious or not applicable to this project \u2014 consider removing to save tokens.`,evidence:{totalSessions:W,totalViolations:0}})}let G=m(Z,$),U=new Set(G.map((Y)=>Y.title));for(let Y of K)if(!U.has(Y.title))Y0(Z,{projectId:$??void 0,ruleId:Y.ruleId,suggestionType:Y.type,title:Y.title,reasoning:Y.reasoning,evidence:Y.evidence});return B.info("Self-improvement analysis complete",{projectId:$,suggestionsGenerated:K.length,sessionCount:W}),{suggestions:K,analysisMetadata:{totalRules:X.length,totalSessions:W,analyzedAt:Date.now()}}}var N0=T(()=>{I()});var S0={};d(S0,{default:()=>q0});async function q0(){let Z=S(),$=k(),J=V($,Z);if(J){let W=TZ(),X=l($,J.id);if(X>=W.improvementMinSessions)try{D0($,J.id,W.improvementMinSessions),B.info("Self-improvement analysis completed",{project:J.name,sessions:X})}catch(K){B.error("Self-improvement analysis failed",{error:K.message})}}c(),process.stdout.write("Success")}var y0=T(()=>{g();D();N0();I();w()});var wZ=m0(require("express")),I0=require("path"),v0=require("fs");g();var O0=require("express");D();function fZ(Z,$){Z.get("/api/projects",(J,W)=>{W.json(KZ($))}),Z.post("/api/projects",(J,W)=>{let{id:X,name:K,path:H,tech_stack:Q}=J.body;if(!X||!K||!H){W.status(400).json({error:"id, name, and path are required"});return}if(typeof X!=="string"||typeof K!=="string"||typeof H!=="string"){W.status(400).json({error:"id, name, and path must be strings"});return}let G=XZ($,{id:X,name:K,path:H,tech_stack:Q});W.status(201).json(G)})}D();BZ();AZ();I();var b=require("fs"),C=require("path");function aZ(Z){let{projectPath:$,featureName:J,description:W="TODO: Describe this feature",withTests:X=!0}=Z,K=F1(J),H=k1(J),Q=C.join($,"src","features",K);if(b.existsSync(Q))throw Error(`Feature directory already exists: ${Q}`);let G=[],U=[],Y=["domain/entities","domain/value-objects","domain/ports","domain/events","domain/services","application/use-cases","application/dtos","application/mappers","infrastructure/controllers","infrastructure/repositories","infrastructure/adapters","infrastructure/config"];if(X)Y.push("__tests__/integration","__tests__/e2e");for(let e of Y){let ZZ=C.join(Q,e);b.mkdirSync(ZZ,{recursive:!0}),G.push(`src/features/${K}/${e}`)}let O=B1(H,W);f(C.join(Q,"domain","entities",`${H}.ts`),O),U.push(`src/features/${K}/domain/entities/${H}.ts`);let A=_1(H);f(C.join(Q,"domain","ports",`${H}Repository.ts`),A),U.push(`src/features/${K}/domain/ports/${H}Repository.ts`);let M=V1(H);f(C.join(Q,"application","dtos",`${H}Dto.ts`),M),U.push(`src/features/${K}/application/dtos/${H}Dto.ts`);let z=L1(H);f(C.join(Q,"application","use-cases",`Create${H}UseCase.ts`),z),U.push(`src/features/${K}/application/use-cases/Create${H}UseCase.ts`);let F=T1(H);f(C.join(Q,"application","mappers",`${H}Mapper.ts`),F),U.push(`src/features/${K}/application/mappers/${H}Mapper.ts`);let E=E1(H);f(C.join(Q,"infrastructure","controllers",`${H}Controller.ts`),E),U.push(`src/features/${K}/infrastructure/controllers/${H}Controller.ts`);let _=w1(H);f(C.join(Q,"infrastructure","repositories",`${H}RepositoryImpl.ts`),_),U.push(`src/features/${K}/infrastructure/repositories/${H}RepositoryImpl.ts`);let xZ=x1(K,H,W);f(C.join(Q,"README.md"),xZ),U.push(`src/features/${K}/README.md`);let CZ=["domain/value-objects","domain/events","domain/services","infrastructure/adapters","infrastructure/config"];if(X)CZ.push("__tests__/integration","__tests__/e2e");for(let e of CZ){let ZZ=C.join(Q,e,".gitkeep");if(!b.existsSync(ZZ))f(ZZ,"")}return B.info("Feature scaffold generated",{feature:K,files:U.length,dirs:G.length}),{createdFiles:U,createdDirs:G,featurePath:Q}}function f(Z,$){b.writeFileSync(Z,$,"utf-8")}function B1(Z,$){return`/**
 * ${Z} entity \u2014 ${$}
 *
 * @module ${Z}
 */

export interface ${Z}Props {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ${Z} domain entity.
 * Contains business logic and invariants.
 */
export class ${Z} {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ${Z}Props) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
`}function _1(Z){return`/**
 * ${Z} repository port (interface).
 * Implemented in infrastructure layer.
 *
 * @module ${Z}Repository
 */

import type { ${Z} } from "../entities/${Z}";

/**
 * Repository interface for ${Z} persistence.
 * Domain defines the contract, infrastructure provides the implementation.
 */
export interface ${Z}Repository {
  /** Find a ${Z} by its unique ID */
  findById(id: string): Promise<${Z} | null>;

  /** Persist a new or updated ${Z} */
  save(entity: ${Z}): Promise<void>;

  /** Remove a ${Z} by ID */
  delete(id: string): Promise<void>;
}
`}function V1(Z){return`/**
 * ${Z} Data Transfer Objects.
 * Used for input/output at application layer boundaries.
 *
 * @module ${Z}Dto
 */

/** Input DTO for creating a ${Z} */
export interface Create${Z}Input {
  // TODO: Define input fields
}

/** Output DTO for ${Z} responses */
export interface ${Z}Output {
  id: string;
  createdAt: string;
  updatedAt: string;
}
`}function L1(Z){return`/**
 * Create${Z} use case.
 * Orchestrates domain objects to create a new ${Z}.
 *
 * @module Create${Z}UseCase
 */

import type { ${Z}Repository } from "../../domain/ports/${Z}Repository";
import type { Create${Z}Input, ${Z}Output } from "../dtos/${Z}Dto";
import { ${Z} } from "../../domain/entities/${Z}";
import { ${Z}Mapper } from "../mappers/${Z}Mapper";

/**
 * Use case: Create a new ${Z}.
 *
 * @param input - Creation input data
 * @param repository - ${Z} repository (injected)
 * @returns Created ${Z} output DTO
 */
export async function create${Z}(
  input: Create${Z}Input,
  repository: ${Z}Repository
): Promise<${Z}Output> {
  const entity = new ${Z}({
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await repository.save(entity);

  return ${Z}Mapper.toOutput(entity);
}
`}function T1(Z){return`/**
 * ${Z} mapper \u2014 converts between domain entities and DTOs.
 *
 * @module ${Z}Mapper
 */

import type { ${Z} } from "../../domain/entities/${Z}";
import type { ${Z}Output } from "../dtos/${Z}Dto";

/**
 * Maps ${Z} entities to/from DTOs.
 */
export class ${Z}Mapper {
  /**
   * Convert domain entity to output DTO.
   *
   * @param entity - Domain entity
   * @returns Output DTO
   */
  static toOutput(entity: ${Z}): ${Z}Output {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
`}function E1(Z){return`/**
 * ${Z} HTTP controller.
 * Thin translation layer \u2014 delegates to use cases.
 *
 * @module ${Z}Controller
 */

// TODO: Import framework-specific types (Express, Fastify, etc.)
// TODO: Import use cases from application layer
// TODO: Import repository implementation for dependency injection

/**
 * ${Z} controller handles HTTP requests.
 * Controllers do ONLY: parse request \u2192 call use case \u2192 format response.
 */
export class ${Z}Controller {
  // TODO: Implement HTTP handlers
  // constructor(private repository: ${Z}Repository) {}
  //
  // async create(req: Request, res: Response): Promise<void> {
  //   const input = req.body;
  //   const result = await create${Z}(input, this.repository);
  //   res.status(201).json({ data: result });
  // }
}
`}function w1(Z){return`/**
 * ${Z} repository implementation.
 * Implements the domain port using actual database operations.
 *
 * @module ${Z}RepositoryImpl
 */

import type { ${Z} } from "../../domain/entities/${Z}";
import type { ${Z}Repository } from "../../domain/ports/${Z}Repository";

/**
 * Database implementation of ${Z}Repository port.
 */
export class ${Z}RepositoryImpl implements ${Z}Repository {
  /**
   * Find ${Z} by ID.
   *
   * @param id - Entity ID
   * @returns Entity or null if not found
   */
  async findById(id: string): Promise<${Z} | null> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /**
   * Save ${Z} to database.
   *
   * @param entity - Entity to persist
   */
  async save(entity: ${Z}): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /**
   * Delete ${Z} by ID.
   *
   * @param id - Entity ID to delete
   */
  async delete(id: string): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }
}
`}function x1(Z,$,J){return`# Feature: ${$}

## Purpose
${J}

## Public API

### Exports
| Export | Type | Description |
|--------|------|-------------|
| \`${$}\` | class | ${$} domain entity |
| \`Create${$}UseCase\` | function | Creates a new ${$} |
| \`${$}Output\` | interface | Output DTO |

### API Endpoints (if applicable)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/${Z} | Create new ${$} |
| GET | /api/v1/${Z}/:id | Get ${$} by ID |

## Dependencies

### Internal
- None (new feature)

### External
- None yet

### Forbidden Dependencies
- NEVER import from other features' internal code directly

## Data Flow
\`\`\`
Controller \u2192 Validate Input \u2192 Use Case \u2192 Domain Entity \u2192 Repository Port \u2192 Database
\`\`\`

## Testing
\`\`\`bash
# Unit tests
bun test -- --filter=${Z}

# Integration tests
bun run test:integration -- --filter=${Z}
\`\`\`
`}function F1(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}function k1(Z){return Z.replace(/[-_\s]+(.)/g,($,J)=>J.toUpperCase()).replace(/^(.)/,($,J)=>J.toUpperCase())}w();var P=require("fs"),RZ=require("child_process"),p=require("path");function tZ(Z,$){Z.get("/api/check",(J,W)=>{let X=J.query.project_path;if(!X||typeof X!=="string"){W.status(400).json({error:"project_path query parameter required"});return}let K=J.query.categories?J.query.categories.split(","):void 0,H=J.query.severity,Q=MZ(X,{categories:K,severity:H}),G=V($,X);if(G)HZ($,{projectId:G.id,overallScore:Q.overallScore,scoresByCategory:Q.scoresByCategory,totalFeatures:Q.totalFeatures,totalFiles:Q.totalFiles,totalViolations:Q.violations.length,violationsBySeverity:UZ(Q.violations),violationsByRule:OZ(Q.violations)});W.json(Q)}),Z.post("/api/scaffold",(J,W)=>{let{project_path:X,feature_name:K,description:H,with_tests:Q}=J.body;if(!X||!K){W.status(400).json({error:"project_path and feature_name are required"});return}if(typeof X!=="string"||typeof K!=="string"){W.status(400).json({error:"project_path and feature_name must be strings"});return}try{let G=aZ({projectPath:X,featureName:K,description:typeof H==="string"?H:void 0,withTests:Q!==!1});W.status(201).json(G)}catch(G){W.status(409).json({error:G.message})}}),Z.get("/api/structure",(J,W)=>{let X=J.query.project_path;if(!X||typeof X!=="string"){W.status(400).json({error:"project_path query parameter required"});return}let K=new Set(["node_modules",".git",".bun","coverage",".turbo",".cache","__pycache__","dist",".next"]);function H(G,U){if(U>6)return null;try{let Y=P.readdirSync(G,{withFileTypes:!0}),O=[],A=0,M=0;for(let z of Y){if(K.has(z.name))continue;let F=p.join(G,z.name);if(z.isDirectory()){let E=H(F,U+1);if(E)O.push(E),A+=E.size,M+=E.fileCount}else if(z.isFile())try{let E=P.statSync(F),_=z.name.includes(".")?z.name.split(".").pop()||"":"";O.push({name:z.name,type:"file",size:E.size,ext:_}),A+=E.size,M++}catch{}}return O.sort((z,F)=>{if(z.type==="dir"&&F.type!=="dir")return-1;if(z.type!=="dir"&&F.type==="dir")return 1;return z.name.localeCompare(F.name)}),{name:p.basename(G),type:"dir",size:A,fileCount:M,children:O}}catch{return null}}let Q=H(X,0);if(!Q){W.status(404).json({error:"Project directory not found"});return}W.json(Q)}),Z.get("/api/git-activity",(J,W)=>{let X=J.query.project_path;if(!X||typeof X!=="string"){W.status(400).json({error:"project_path required"});return}try{let H=RZ.spawnSync("git",["log","--format=%H%x09%at%x09%s","--name-status","-n","30"],{cwd:X,encoding:"utf-8",timeout:5000}).stdout||"",Q=[],G=null;for(let U of H.split(`
`)){let Y=U.trim();if(!Y)continue;let O=Y.match(/^([a-f0-9]{40})\t(\d+)\t(.*)$/);if(O){if(G)Q.push(G);G={hash:O[1].substring(0,8),timestamp:parseInt(O[2])*1000,subject:O[3],files:[]}}else if(G&&/^[AMDRC]\t/.test(U)){let A=U.split("\t");G.files.push({status:A[0],path:A.slice(1).join("\t")})}}if(G)Q.push(G);try{let Y=(RZ.spawnSync("git",["status","--short"],{cwd:X,encoding:"utf-8",timeout:3000}).stdout||"").split(`
`).filter((O)=>O.trim());if(Y.length>0){let O=Y.map((A)=>{let M=A.substring(0,2).trim()||"M",z=A.substring(3).trim();return{status:M,path:z}});Q.unshift({hash:"working",timestamp:Date.now(),subject:`${O.length} uncommitted change${O.length!==1?"s":""}`,files:O})}}catch{}W.json(Q)}catch{W.json([])}}),Z.get("/api/rules",(J,W)=>{let X=J.query.file_path,K=J.query.category,H=qZ();if(!P.existsSync(H)){W.json({rules:[],message:"Rules directory not found"});return}let Q=P.readdirSync(H).filter((U)=>U.endsWith(".md")).sort(),G=[];for(let U of Q){let Y=p.basename(U,".md");if(K&&!Y.includes(K))continue;let O=P.readFileSync(p.join(H,U),"utf-8");if(X){let A=O.match(/^---\s*\npaths:\s*\n([\s\S]*?)---/m);if(A){let M=A[1].split(`
`).map((E)=>E.replace(/^\s*-\s*/,"").trim()).filter(Boolean),z=X.replace(/\\/g,"/");if(!M.some((E)=>{let _=E.replace(/\*\*/g,".*").replace(/\*/g,"[^/]*");return new RegExp(_).test(z)}))continue}}G.push({id:Y,name:Y.replace(/^\d+-/,"").replace(/-/g," "),content:O})}W.json({rules:G})})}D();function J0(Z,$){Z.get("/api/search",(J,W)=>{let X=J.query.query,K=J.query.project_path,H=J.query.type,Q=Math.min(parseInt(J.query.limit)||20,100),U=(K?V($,K):null)?.id,Y=[];if(!H||H==="decisions"){if(U){let O=h($,U,{query:X,limit:Q});for(let A of O)Y.push({id:A.id,type:"decision",title:A.title,status:A.status,created_at:A.created_at,extra:A.tags||""})}}if(!H||H==="violations"){if(U){let O=t($,U,{query:X,limit:Q});for(let A of O)Y.push({id:A.id,type:"violation",title:`[${A.severity}] ${A.description}`,status:A.resolved?"resolved":"open",created_at:A.created_at,extra:A.rule_id})}}Y.sort((O,A)=>A.created_at-O.created_at),W.json(Y.slice(0,Q))}),Z.get("/api/timeline",(J,W)=>{let X=parseInt(J.query.anchor),K=J.query.query,H=J.query.project_path,Q=parseInt(J.query.depth_before)||5,G=parseInt(J.query.depth_after)||5,Y=(H?V($,H):null)?.id;if(!Y){W.status(404).json({events:[],message:"Project not found"});return}let O=[],A=h($,Y,{query:K,limit:100});for(let _ of A)O.push({id:_.id,type:"decision",title:_.title,status:_.status,created_at:_.created_at,extra:_.tags||""});let M=t($,Y,{limit:100});for(let _ of M)O.push({id:_.id,type:"violation",title:`[${_.severity}] ${_.description}`,status:_.resolved?"resolved":"open",created_at:_.created_at,extra:_.rule_id});O.sort((_,xZ)=>_.created_at-xZ.created_at);let z=-1;if(!isNaN(X))z=O.findIndex((_)=>_.id===X);else if(K)z=O.findIndex((_)=>_.title.toLowerCase().includes(K.toLowerCase()));if(z===-1)z=O.length-1;let F=Math.max(0,z-Q),E=Math.min(O.length,z+G+1);W.json({events:O.slice(F,E),anchorIndex:z-F,total:O.length})}),Z.post("/api/details/batch",(J,W)=>{let{ids:X,type:K}=J.body;if(!Array.isArray(X)||!K){W.status(400).json({error:"ids (array) and type (string) are required"});return}if(typeof K!=="string"||!["decisions","violations","changes"].includes(K)){W.status(400).json({error:'type must be "decisions", "violations", or "changes"'});return}if(X.length>50){W.status(400).json({error:"Maximum 50 IDs per request"});return}let H=[];if(K==="decisions")for(let Q of X){let G=_Z($,Number(Q));if(G)H.push(G)}else if(K==="violations")for(let Q of X){let G=$.query("SELECT * FROM violations WHERE id = ?").get(Number(Q));if(G)H.push(G)}else if(K==="changes")for(let Q of X){let G=$.query("SELECT * FROM structural_changes WHERE id = ?").get(Number(Q));if(G)H.push(G)}W.json(H)})}D();function G0(Z,$){Z.get("/api/decisions",(J,W)=>{let X=J.query.project_id,K=J.query.project_path,H=X;if(!H&&K)H=V($,K)?.id??"";if(!H){W.status(400).json({error:"project_id or project_path required"});return}let Q=h($,H,{query:J.query.query,status:J.query.status,limit:J.query.limit?parseInt(J.query.limit):void 0});W.json(Q)}),Z.get("/api/decisions/:id",(J,W)=>{let X=parseInt(J.params.id);if(isNaN(X)){W.status(400).json({error:"Invalid decision ID"});return}let K=_Z($,X);if(!K){W.status(404).json({error:"Decision not found"});return}W.json(K)}),Z.post("/api/decisions",(J,W)=>{let{projectId:X,project_path:K,title:H,context:Q,decision:G,alternatives:U,tags:Y}=J.body,O=X;if(!O&&K)O=V($,K)?.id;if(!O||!H||!G){W.status(400).json({error:"projectId (or project_path), title, and decision required"});return}if(typeof H!=="string"||typeof G!=="string"){W.status(400).json({error:"title and decision must be strings"});return}let A=eZ($,{projectId:O,title:H,context:typeof Q==="string"?Q:void 0,decision:G,alternatives:Array.isArray(U)?U:void 0,tags:Array.isArray(Y)?Y:void 0});W.status(201).json({id:A})}),Z.get("/api/violations",(J,W)=>{let X=J.query.project_id;if(!X){W.status(400).json({error:"project_id required"});return}let K=t($,X,{query:J.query.query,resolved:J.query.resolved==="true"?!0:J.query.resolved==="false"?!1:void 0,limit:J.query.limit?parseInt(J.query.limit):void 0});W.json(K)}),Z.patch("/api/violations/:id",(J,W)=>{let X=parseInt(J.params.id);if(isNaN(X)){W.status(400).json({error:"Invalid violation ID"});return}let{resolved_by:K}=J.body;$0($,X,typeof K==="string"?K:"manual"),W.json({success:!0})}),Z.get("/api/sessions",(J,W)=>{let X=J.query.project_id;if(!X){W.status(400).json({error:"project_id required"});return}W.json(LZ($,X))}),Z.get("/api/compliance/snapshots",(J,W)=>{let X=J.query.project_id;if(!X){W.status(400).json({error:"project_id required"});return}W.json(YZ($,X))}),Z.get("/api/improvements",(J,W)=>{let X=J.query.project_id||null;W.json(m($,X))})}D();function U0(Z,$){Z.get("/api/status",(J,W)=>{let X=J.query.project_path;if(!X){W.status(400).json({error:"project_path required"});return}let K=V($,X);if(!K){W.json({registered:!1,message:"Project not registered. Run /architect-init first."});return}let H=QZ($,K.id),Q=n($,K.id),G=u($,K.id),U=a($,K.id,5),Y=l($,K.id),O=m($,K.id);W.json({project:K,complianceScore:H?.overall_score??null,trend:Q,violations:G,recentDecisions:U,sessionCount:Y,suggestions:O.length,lastChecked:H?.created_at??null})}),Z.get("/dashboard/data",(J,W)=>{let X=J.query.project_path,K=X?V($,X):null;if(!K){let M=KZ($);W.json({projects:M,selectedProject:null});return}let H=YZ($,K.id,20),Q=VZ($,K.id,{limit:50}),G=a($,K.id,10),U=n($,K.id),Y=u($,K.id),O=m($,K.id),A=LZ($,K.id,20);W.json({project:K,scoreHistory:H,violations:Q,recentDecisions:G,trend:U,violationCounts:Y,suggestions:O,sessions:A})}),Z.get("/api/health",(J,W)=>{W.json({status:"healthy",service:"claude-architect",timestamp:new Date().toISOString()})})}function A0(Z){let $=k(),J=O0.Router();fZ(J,$),tZ(J,$),J0(J,$),G0(J,$),U0(J,$),Z.use(J)}g();I();w();var D1=TZ(),EZ=D1.workerPort;function N1(){let Z=wZ.default();Z.use(wZ.default.json({limit:"1mb"})),Z.use((W,X,K)=>{let H=W.headers.origin,Q=[`http://localhost:${EZ}`,`http://127.0.0.1:${EZ}`];if(H&&Q.includes(H))X.header("Access-Control-Allow-Origin",H);if(X.header("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE"),X.header("Access-Control-Allow-Headers","Content-Type"),W.method==="OPTIONS"){X.sendStatus(204);return}K()});let $=I0.join(kZ(),"ui");if(v0.existsSync($))Z.use(wZ.default.static($));A0(Z),Z.use((W,X,K,H)=>{B.error("Unhandled route error",{error:W.message,stack:W.stack}),K.status(500).json({error:"Internal server error"})}),k();let J=Z.listen(EZ,()=>{B.info(`Worker server started on port ${EZ}`),process.stdout.write("Success")});process.on("SIGTERM",()=>{B.info("Shutting down worker server"),J.close(()=>c())}),process.on("SIGINT",()=>{J.close(()=>c())})}async function q1(Z){let $;switch(Z){case"session-init":$=await Promise.resolve().then(() => (_0(),B0));break;case"context":$=await Promise.resolve().then(() => (T0(),L0));break;case"post-change":$=await Promise.resolve().then(() => (x0(),w0));break;case"summarize":$=await Promise.resolve().then(() => (C0(),R0));break;case"session-complete":$=await Promise.resolve().then(() => (y0(),S0));break;default:B.error(`Unknown hook handler: ${Z}`),process.exit(1);return}await $.default()}(async()=>{let Z=process.argv[2];if(Z==="start")N1();else if(Z==="hook"){let $=process.argv[3];try{await q1($)}catch(J){B.error(`Hook handler "${$}" failed`,{error:J.message}),process.exit(1)}}else B.error(`Unknown command: ${Z}`),process.exit(1)})();})

//# debugId=8CC92326238EA5D664756E2164756E21
