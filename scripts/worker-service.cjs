// @bun @bun-cjs
(function(exports, require, module, __filename, __dirname) {var C1=Object.create;var{getPrototypeOf:S1,defineProperty:PZ,getOwnPropertyNames:I1}=Object;var y1=Object.prototype.hasOwnProperty;function v1(Z){return this[Z]}var f1,g1,j1=(Z,$,J)=>{var K=Z!=null&&typeof Z==="object";if(K){var W=$?f1??=new WeakMap:g1??=new WeakMap,Q=W.get(Z);if(Q)return Q}J=Z!=null?C1(S1(Z)):{};let H=$||!Z||!Z.__esModule?PZ(J,"default",{value:Z,enumerable:!0}):J;for(let G of I1(Z))if(!y1.call(H,G))PZ(H,G,{get:v1.bind(Z,G),enumerable:!0});if(K)W.set(Z,H);return H};var b1=(Z)=>Z;function P1(Z,$){this[Z]=b1.bind(null,$)}var n=(Z,$)=>{for(var J in $)PZ(Z,J,{get:$[J],enumerable:!0,configurable:!0,set:P1.bind($,J)})};var A=(Z,$)=>()=>(Z&&($=Z(Z=0)),$);function OZ(){return process.env.CLAUDE_PLUGIN_ROOT||I.resolve(__dirname,"..","..")}function S(){return process.env.CLAUDE_PROJECT_PATH||process.cwd()}function m1(){let Z=I.join(cZ.homedir(),h1);if(!UZ.existsSync(Z))UZ.mkdirSync(Z,{recursive:!0});return Z}function sZ(){return I.join(m1(),"architect.sqlite")}function o(){return I.join(OZ(),"rules")}function hZ(){return I.join(OZ(),"templates")}function _(Z){return I.normalize(Z).replace(/\\/g,"/")}function j(Z,$){let J=!1,K=!1,W=!1;for(let Q=0;Q<$&&Q<Z.length;Q++){if(Q>0&&Z[Q-1]==="\\")continue;let H=Z[Q];if(H==='"'&&!J&&!W)K=!K;else if(H==="'"&&!K&&!W)J=!J;else if(H==="`"&&!K&&!J)W=!W}return J||K||W}function T(Z,$){let J=new Bun.Glob(Z);return Array.from(J.scanSync({cwd:$,dot:!1}))}var cZ,I,UZ,__dirname="C:\\Users\\golia\\Desktop\\Projects\\claude-architect\\src\\utils",h1=".claude-architect";var M=A(()=>{cZ=require("os"),I=require("path"),UZ=require("fs")});function zZ(Z,$,J){if(iZ[Z]<iZ[u1])return;let K={timestamp:new Date().toISOString(),level:Z,service:"claude-architect",message:$,...J};process.stderr.write(JSON.stringify(K)+`
`)}var iZ,u1,L;var y=A(()=>{iZ={debug:0,info:1,warn:2,error:3},u1=process.env.ARCHITECT_LOG_LEVEL||"info";L={debug:(Z,$)=>zZ("debug",Z,$),info:(Z,$)=>zZ("info",Z,$),warn:(Z,$)=>zZ("warn",Z,$),error:(Z,$)=>zZ("error",Z,$)}});function nZ(Z){Z.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);let $=Z.query("SELECT version FROM schema_migrations ORDER BY version").all().map((J)=>J.version);for(let J of p1){if($.includes(J.version))continue;Z.run("BEGIN TRANSACTION");try{J.up(Z),Z.query("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)").run(J.version,J.description,Date.now()),Z.run("COMMIT")}catch(K){throw Z.run("ROLLBACK"),Error(`Migration ${J.version} failed: ${K.message}`)}}}var p1;var oZ=A(()=>{p1=[{version:1,description:"Core schema \u2014 projects, decisions, violations, sessions",up:(Z)=>{Z.run(`
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
      `)}},{version:2,description:"Performance indexes",up:(Z)=>{Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_project ON violations(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_rule ON violations(rule_id)"),Z.run("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_changes_project ON structural_changes(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_snapshots_project ON compliance_snapshots(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_rule_metrics_rule ON rule_metrics(rule_id)")}},{version:3,description:"Per-project manual rule configuration",up:(Z)=>{if(!Z.query("PRAGMA table_info(projects)").all().map((J)=>J.name).includes("enabled_manual_rules"))Z.run("ALTER TABLE projects ADD COLUMN enabled_manual_rules TEXT DEFAULT '[]'")}}]});function d1(Z){Z.run("PRAGMA journal_mode = WAL"),Z.run("PRAGMA synchronous = NORMAL"),Z.run("PRAGMA foreign_keys = ON"),Z.run("PRAGMA temp_store = MEMORY"),Z.run("PRAGMA mmap_size = 268435456"),Z.run("PRAGMA cache_size = 10000")}function E(Z){if(v)return v;let $=Z||sZ();return L.info("Opening database",{path:$}),v=new rZ.Database($,{create:!0}),d1(v),nZ(v),L.info("Database ready",{path:$}),v}function r(){if(v)v.close(),v=null,L.info("Database closed")}var rZ,v=null;var b=A(()=>{M();y();oZ();rZ=require("bun:sqlite")});function BZ(Z,$){let J=Date.now(),K=_($.path),W=Z.query("SELECT * FROM projects WHERE path = ?").get(K);if(W)return Z.query("UPDATE projects SET name = ?, tech_stack = ?, architecture_pattern = ?, updated_at = ? WHERE id = ?").run($.name,$.tech_stack??W.tech_stack,$.architecture_pattern??W.architecture_pattern,J,W.id),{...W,name:$.name,enabled_manual_rules:W.enabled_manual_rules??"[]",updated_at:J};return Z.query(`INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run($.id,$.name,K,$.tech_stack??null,$.architecture_pattern??"clean",J,J),{id:$.id,name:$.name,path:K,tech_stack:$.tech_stack??null,architecture_pattern:$.architecture_pattern??"clean",enabled_manual_rules:"[]",created_at:J,updated_at:J}}function w(Z,$){return Z.query("SELECT * FROM projects WHERE path = ?").get(_($))}function mZ(Z,$){return Z.query("SELECT * FROM projects WHERE id = ?").get($)}function VZ(Z){return Z.query("SELECT * FROM projects ORDER BY updated_at DESC").all()}function _Z(Z,$){let J=Z.query("SELECT enabled_manual_rules FROM projects WHERE id = ?").get($);if(!J?.enabled_manual_rules)return[];try{let K=JSON.parse(J.enabled_manual_rules);return Array.isArray(K)?K:[]}catch{return[]}}function aZ(Z,$,J){let K=Date.now();Z.query("UPDATE projects SET enabled_manual_rules = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(J),K,$)}var N=A(()=>{M()});function LZ(Z,$){let K=Z.query(`INSERT INTO compliance_snapshots
       (project_id, session_id, overall_score, scores_by_category,
        total_features, total_files, total_violations,
        violations_by_severity, violations_by_rule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.overallScore,JSON.stringify($.scoresByCategory),$.totalFeatures,$.totalFiles,$.totalViolations,JSON.stringify($.violationsBySeverity),JSON.stringify($.violationsByRule),Date.now());return Number(K.lastInsertRowid)}function AZ(Z,$){return Z.query("SELECT * FROM compliance_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get($)}function MZ(Z,$,J=20){return Z.query(`SELECT * FROM compliance_snapshots WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`).all($,J).reverse()}function a(Z,$){let J=Z.query(`SELECT overall_score FROM compliance_snapshots
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`).all($);if(J.length<2)return"stable";let K=J[0].overall_score,W=J[J.length-1].overall_score,Q=K-W;if(Q>3)return"improving";if(Q<-3)return"declining";return"stable"}function s1(Z){let $=_(Z).split("/");if($.includes("domain"))return"domain";if($.includes("application"))return"application";if($.includes("infrastructure"))return"infrastructure";return"unknown"}function i1(Z){let $=_(Z).match(/src\/features\/([^/]+)\//);return $?$[1]:null}function n1(Z){let $=[];for(let J of c1){let K=new RegExp(J.source,J.flags),W;while((W=K.exec(Z))!==null)$.push(W[1])}return $}function o1(Z){return Z.startsWith(".")}function eZ(Z){let $=[],J=t.join(Z,"src");if(!wZ.existsSync(J))return{violations:[],filesScanned:0};let K=a1(J),W=0;for(let Q of K){W++;let H=_(t.relative(Z,Q)),G=s1(H),X=i1(H);if(G==="unknown")continue;let U;try{U=wZ.readFileSync(Q,"utf-8")}catch{continue}let Y=n1(U);for(let O of Y){if(!o1(O))continue;let z=r1(H,O,G,X);if(z)$.push({...z,filePath:H})}}return{violations:$,filesScanned:W}}function r1(Z,$,J,K){let W=_($);if(J==="domain"){if(W.includes("/application/")||W.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Domain layer imports from ${W.includes("/application/")?"application":"infrastructure"} layer: "${$}"`,suggestion:"Move the dependency to a port interface in domain/ and implement it in infrastructure/"}}if(J==="application"){if(W.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Application layer imports from infrastructure layer: "${$}"`,suggestion:"Define a port interface in domain/ and inject the infrastructure implementation"}}if(K&&W.includes("/features/")){let Q=W.match(/features\/([^/]+)\//);if(Q&&Q[1]!==K)return{ruleId:"01-architecture",ruleName:"Cross-Feature Isolation",severity:"warning",category:"dependency",description:`Direct import from feature "${Q[1]}": "${$}"`,suggestion:"Use shared contracts in src/shared/contracts/ or domain events instead"}}return null}function a1(Z){let $=[],J=T("**/*.{ts,tsx,js,jsx}",Z);for(let K of J)if(!K.includes("node_modules")&&!K.includes(".test.")&&!K.includes(".spec."))$.push(t.join(Z,K));return $}var wZ,t,c1;var Z0=A(()=>{M();wZ=require("fs"),t=require("path"),c1=[/import\s+.*from\s+['"](.+)['"]/g,/import\s*\(\s*['"](.+)['"]\s*\)/g,/require\s*\(\s*['"](.+)['"]\s*\)/g]});function TZ(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}function $0(Z){return Z.replace(/[-_\s]+(.)/g,($,J)=>J.toUpperCase()).replace(/^(.)/,($,J)=>J.toUpperCase())}function K0(Z){let $=[],J=[],K=D.join(Z,"src","features");if(!x.existsSync(K))return{violations:[],filesScanned:0,features:[]};let W=x.readdirSync(K).filter((H)=>{let G=D.join(K,H);return x.statSync(G).isDirectory()&&!H.startsWith(".")}),Q=[];for(let H of W){let G=D.join(K,H),X=t1(G,H,$,Q);J.push(X)}if(Q.length>0)$.push({ruleId:"06-documentation",ruleName:"Feature README",severity:"info",category:"docs",description:`${Q.length} feature(s) missing README.md: ${Q.join(", ")}`,suggestion:"Run /architect-scaffold to generate README.md from template"});if(!x.existsSync(D.join(Z,"tsconfig.json")))$.push({ruleId:"03-quality",ruleName:"TypeScript Config",severity:"warning",category:"quality",filePath:"project root",description:"Missing tsconfig.json",suggestion:"Add TypeScript compiler configuration"});if(!x.existsSync(D.join(Z,"PROJECT_MAP.md")))$.push({ruleId:"06-documentation",ruleName:"PROJECT_MAP Required",severity:"warning",category:"docs",description:"Missing PROJECT_MAP.md at project root",suggestion:"Run /architect-init to generate PROJECT_MAP.md"});return{violations:$,filesScanned:W.length,features:J}}function t1(Z,$,J,K){let W=x.existsSync(D.join(Z,"domain")),Q=x.existsSync(D.join(Z,"application")),H=x.existsSync(D.join(Z,"infrastructure")),G=x.existsSync(D.join(Z,"README.md")),X=x.existsSync(D.join(Z,"__tests__"))||e1(Z),U=J0.filter((O)=>!x.existsSync(D.join(Z,O)));if(U.length===J0.length)J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:_(`src/features/${$}/`),description:"Flat structure \u2014 no clean architecture layers",suggestion:"Scaffold domain/application/infrastructure directories"});else if(U.length>0)J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:_(`src/features/${$}/`),description:`Missing ${U.join(", ")} layer${U.length>1?"s":""}`,suggestion:`Add ${U.map((O)=>O+"/").join(", ")} with repository adapters`});if(!G)K.push($);if($!==$.toLowerCase()||$.includes("_"))J.push({ruleId:"15-code-style",ruleName:"Naming Convention",severity:"info",category:"structure",filePath:_(`src/features/${$}/`),description:`Feature directory "${$}" should use kebab-case`,suggestion:`Rename to "${TZ($)}"`});let Y=0;if(!W)Y++;if(!Q)Y++;if(!H)Y++;if(!G)Y++;return{name:$,path:_(`src/features/${$}/`),hasReadme:G,hasDomain:W,hasApplication:Q,hasInfrastructure:H,hasTests:X,violationCount:Y}}function e1(Z){try{return T("**/*.{test,spec}.{ts,tsx,js,jsx}",Z).length>0}catch{return!1}}var x,D,J0;var W0=A(()=>{M();x=require("fs"),D=require("path"),J0=["domain","application","infrastructure"]});function H0(Z){let $=[],J=e.join(Z,"src"),K=0;try{let W=T("**/*.{ts,tsx,js,jsx,py}",J);for(let Q of W){if($4.some((Y)=>Q.includes(Y)))continue;K++;let H=e.join(J,Q),G=_(e.relative(Z,H)),X;try{X=Q0.readFileSync(H,"utf-8")}catch{continue}let U=X.split(`
`);for(let Y of Z4){let O=new RegExp(Y.pattern.source,Y.pattern.flags),z;while((z=O.exec(X))!==null){let V=X.substring(0,z.index).split(`
`).length,B=U[V-1]?.trim()||"";if(B.startsWith("//")||B.startsWith("*"))continue;let q=z.index-X.lastIndexOf(`
`,z.index-1)-1;if(j(B,q))continue;$.push({ruleId:"02-security",ruleName:Y.name,severity:Y.severity,category:"security",filePath:G,lineNumber:V,description:Y.description,suggestion:Y.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var Q0,e,Z4,$4;var Y0=A(()=>{M();Q0=require("fs"),e=require("path"),Z4=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected",suggestion:"Move to environment variable: process.env.API_KEY or use a secrets manager"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected",suggestion:"Move to environment variable or secrets manager. Never commit secrets to source code"},{name:"SQL String Concatenation",pattern:/(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,severity:"critical",description:"Potential SQL injection via string concatenation/template literals",suggestion:"Use parameterized queries or prepared statements instead of string interpolation"},{name:"SQL Concatenation (plus operator)",pattern:/(?:query|exec|execute)\s*\(\s*['"].*['"]\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"critical",description:"SQL query built with string concatenation using user input",suggestion:"Use parameterized queries: db.query('SELECT * FROM x WHERE id = ?', [id])"},{name:"Dangerous innerHTML",pattern:/dangerouslySetInnerHTML\s*=\s*\{\s*\{.*__html.*\}\s*\}/gi,severity:"warning",description:"Use of dangerouslySetInnerHTML \u2014 potential XSS vulnerability",suggestion:"Sanitize content with DOMPurify before rendering, or use safe alternatives"},{name:"innerHTML Assignment",pattern:/\.innerHTML\s*=\s*(?!['"]<)/gi,severity:"warning",description:"Direct innerHTML assignment with dynamic content \u2014 XSS risk",suggestion:"Use textContent for text, or sanitize HTML before assigning to innerHTML"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability",suggestion:"Never use eval(). Use JSON.parse() for data, or safer alternatives for dynamic code"},{name:"Disabled HTTPS Verification",pattern:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/gi,severity:"critical",description:"TLS/SSL certificate verification is disabled",suggestion:"Never disable certificate verification in production. Fix the certificate issue instead"},{name:"Wildcard CORS",pattern:/(?:cors|Access-Control-Allow-Origin)\s*[:=]\s*['"]?\*['"]?/gi,severity:"warning",description:"CORS allows all origins (*) \u2014 overly permissive",suggestion:"Configure CORS with explicit origin allowlist instead of wildcard"},{name:"Console.log in Production",pattern:/console\.(log|debug|trace)\s*\(/g,severity:"info",description:"console.log found \u2014 use structured logging in production",suggestion:"Replace with structured logger (e.g., winston, pino) for production code"}],$4=["node_modules",".test.",".spec.","__tests__",".d.ts",".min.js","dist/","build/","coverage/"]});function X0(Z){let $=[],J=R.join(Z,"src");if(!ZZ.existsSync(J))return{violations:[],filesScanned:0};let K=0,W=[];try{let Q=T("**/*.{ts,tsx,js,jsx}",J);for(let H of Q){if(H.includes("node_modules")||H.includes(".d.ts")||H.includes("dist/"))continue;K++;let G=R.join(J,H),X=_(R.relative(Z,G)),U;try{U=ZZ.readFileSync(G,"utf-8")}catch{continue}let Y=U.split(`
`);if(Y.length>G0)$.push({ruleId:"15-code-style",ruleName:"File Size Limit",severity:"warning",category:"quality",filePath:X,description:`File has ${Y.length} lines (max ${G0})`,suggestion:"Split into smaller focused modules. Extract helper functions or sub-components."});if(J4(U,X,$),K4(U,X,$),!H.includes(".test.")&&!H.includes(".spec.")&&!H.includes("__tests__")&&Q4(U)){if(!W4(G))W.push(X)}}}catch{}if(W.length>0){let Q=K-W.length;$.push({ruleId:"03-testing",ruleName:"Test Coverage",severity:"info",category:"quality",description:`No test files found (${Q} of ${K} source files have tests)`,suggestion:`Create test files for: ${W.map((H)=>R.basename(H)).join(", ")}`})}return{violations:$,filesScanned:K}}function J4(Z,$,J){let K=/^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gm,W;while((W=K.exec(Z))!==null){let Q=Z.substring(0,W.index).split(`
`).length,H=W[1].split(",").map((X)=>X.trim().split(" as ").pop().trim()).filter(Boolean),G=Z.substring(W.index+W[0].length);for(let X of H)if(!new RegExp(`\\b${X}\\b`).test(G))J.push({ruleId:"03-quality",ruleName:"Unused Import",severity:"warning",category:"quality",filePath:$,lineNumber:Q,description:`Unused import ${X}`,suggestion:"Remove the import"})}}function K4(Z,$,J){let K=Z.split(`
`),W=0,Q=0;for(let H=0;H<K.length;H++){let G=K[H].trim();if(G.startsWith("//")&&!G.startsWith("///")&&!G.startsWith("// @")){if(W===0)Q=H+1;W++}else{if(W>=5)J.push({ruleId:"15-code-style",ruleName:"Commented-Out Code",severity:"info",category:"quality",filePath:$,lineNumber:Q,description:`${W} consecutive commented lines \u2014 likely commented-out code`,suggestion:"Remove commented-out code. Use version control to recover old code."});W=0}}}function W4(Z){let $=R.dirname(Z),J=R.basename(Z),K=[".test.ts",".test.tsx",".spec.ts",".spec.tsx",".test.js",".spec.js"],W=J.replace(/\.(ts|tsx|js|jsx)$/,"");return K.some((Q)=>ZZ.existsSync(R.join($,W+Q)))}function Q4(Z){return/^export\s+/m.test(Z)}var ZZ,R,G0=200;var U0=A(()=>{M();ZZ=require("fs"),R=require("path")});function O0(Z){let $=[],J=C.join(Z,"src"),K=0;try{let W=T("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(Y4.some((Y)=>Q.includes(Y)))continue;K++;let H=C.join(J,Q),G=_(C.relative(Z,H)),X;try{X=g.readFileSync(H,"utf-8")}catch{continue}let U=X.split(`
`);for(let Y of H4){let O=new RegExp(Y.pattern.source,Y.pattern.flags),z;while((z=O.exec(X))!==null){let V=X.substring(0,z.index).split(`
`).length,B=U[V-1]?.trim()||"";if(B.startsWith("//")||B.startsWith("*"))continue;let q=z.index-X.lastIndexOf(`
`,z.index-1)-1;if(j(B,q))continue;$.push({ruleId:Y.ruleId,ruleName:Y.name,severity:Y.severity,category:"security",filePath:G,lineNumber:V,description:Y.description,suggestion:Y.suggestion})}}}}catch{}return G4(Z,$),{violations:$,filesScanned:K}}function G4(Z,$){if(!(g.existsSync(C.join(Z,"package-lock.json"))||g.existsSync(C.join(Z,"bun.lockb"))||g.existsSync(C.join(Z,"yarn.lock"))||g.existsSync(C.join(Z,"pnpm-lock.yaml")))&&g.existsSync(C.join(Z,"package.json")))$.push({ruleId:"30-supply-chain-security",ruleName:"Missing Lock File",severity:"warning",category:"security",description:"No lock file found \u2014 dependency versions are not pinned",suggestion:"Run npm install / bun install to generate a lock file and commit it"});try{let W=g.readFileSync(C.join(Z,"package.json"),"utf-8").match(/"[^"]+"\s*:\s*"(\*|latest)"/g);if(W&&W.length>0)$.push({ruleId:"30-supply-chain-security",ruleName:"Unpinned Dependencies",severity:"warning",category:"security",description:`${W.length} dependency(ies) use wildcard (*) or "latest" version`,suggestion:"Pin all dependencies to specific versions or version ranges"})}catch{}}var g,C,H4,Y4;var z0=A(()=>{M();g=require("fs"),C=require("path"),H4=[{name:"Path Traversal",pattern:/(?:readFile|writeFile|createReadStream|open|access)\w*\s*\([^)]*(?:req\.(?:params|query|body)\.\w+|(?:params|query|body)\.\w+)/gi,severity:"critical",ruleId:"17-owasp-top-ten",description:"User input used directly in file system operation \u2014 path traversal risk (A01)",suggestion:"Validate and sanitize file paths. Use path.resolve() and verify the result is within allowed directory"},{name:"SSRF Risk",pattern:/(?:fetch|axios|http\.get|https\.get|request)\s*\(\s*(?:req\.|params\.|query\.|body\.|`\$\{)/gi,severity:"critical",ruleId:"17-owasp-top-ten",description:"User input used in outbound HTTP request \u2014 SSRF risk (A10)",suggestion:"Validate URLs against an allowlist of trusted domains before making requests"},{name:"Mass Assignment",pattern:/(?:create|update|insert|save|findOneAnd|updateOne)\s*\(\s*(?:\.\.\.\s*req\.body|req\.body\b)/gi,severity:"warning",ruleId:"17-owasp-top-ten",description:"Request body spread directly into database operation \u2014 mass assignment risk (A01)",suggestion:"Explicitly pick allowed fields instead of spreading req.body directly"},{name:"Insecure Deserialization",pattern:/(?:JSON\.parse|deserialize|unserialize|pickle\.loads)\s*\(\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"warning",ruleId:"17-owasp-top-ten",description:"Untrusted input passed to deserialization \u2014 injection risk (A08)",suggestion:"Validate and sanitize input before deserialization. Use schema validation (Zod, Joi)"},{name:"Missing Rate Limiting",pattern:/router\.(post|put|patch|delete)\s*\(\s*['"][^'"]*(?:login|auth|register|password|reset|token|signup)/gi,severity:"info",ruleId:"17-owasp-top-ten",description:"Sensitive endpoint without apparent rate limiting (A07)",suggestion:"Add rate limiting middleware to authentication and sensitive endpoints"}],Y4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function V0(Z){let $=[],J=$Z.join(Z,"src"),K=0;try{let W=T("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(U4.some((Y)=>Q.includes(Y)))continue;K++;let H=$Z.join(J,Q),G=_($Z.relative(Z,H)),X;try{X=B0.readFileSync(H,"utf-8")}catch{continue}let U=X.split(`
`);for(let Y of X4){let O=new RegExp(Y.pattern.source,Y.pattern.flags),z;while((z=O.exec(X))!==null){let V=X.substring(0,z.index).split(`
`).length,B=U[V-1]?.trim()||"";if(B.startsWith("//")||B.startsWith("*"))continue;let q=z.index-X.lastIndexOf(`
`,z.index-1)-1;if(j(B,q))continue;$.push({ruleId:"18-data-privacy",ruleName:Y.name,severity:Y.severity,category:"security",filePath:G,lineNumber:V,description:Y.description,suggestion:Y.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var B0,$Z,X4,U4;var _0=A(()=>{M();B0=require("fs"),$Z=require("path"),X4=[{name:"PII in Logs",pattern:/(?:console\.\w+|logger\.\w+|log\.\w+)\s*\([^)]*(?:email|ssn|social.?security|credit.?card|phone.?number|passport|national.?id)/gi,severity:"critical",description:"Potentially logging PII (email, SSN, credit card, phone) \u2014 GDPR/privacy violation",suggestion:"Mask or redact PII before logging. Use a structured logger with PII sanitization"},{name:"PII in URL Params",pattern:/(?:url|href|redirect|location|navigate)\s*(?:=|\+=|:)\s*[`'"][^`'"]*\$\{[^}]*(?:email|password|ssn|token|secret)/gi,severity:"warning",description:"Sensitive data included in URL parameters \u2014 visible in logs, history, and referrers",suggestion:"Send sensitive data in request body or headers, never in URL query parameters"},{name:"Unencrypted PII Storage",pattern:/(?:localStorage|sessionStorage|cookie|setCookie)\s*(?:\.\w+\s*\(|\[)[^)]*(?:password|ssn|credit.?card|social.?security)/gi,severity:"critical",description:"Sensitive data stored in browser storage without encryption",suggestion:"Never store passwords, SSN, or credit cards in localStorage/cookies. Use encrypted server-side sessions"},{name:"Email Regex in Log",pattern:/(?:console\.\w+|logger\.\w+|log\.\w+)\s*\([^)]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,severity:"warning",description:"Hardcoded email address found in logging statement",suggestion:"Remove email addresses from log statements to protect privacy"}],U4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function A0(Z){let $=[],J=JZ.join(Z,"src"),K=0;try{let W=T("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(B4.some((Y)=>Q.includes(Y)))continue;K++;let H=JZ.join(J,Q),G=_(JZ.relative(Z,H)),X;try{X=L0.readFileSync(H,"utf-8")}catch{continue}let U=z4.test(X);for(let Y of O4){if(Y.name==="Missing Await"&&!U)continue;let O=new RegExp(Y.pattern.source,Y.pattern.flags),z;while((z=O.exec(X))!==null){let V=X.substring(0,z.index).split(`
`).length,B=X.split(`
`)[V-1]?.trim()||"";if(B.startsWith("//")||B.startsWith("*"))continue;$.push({ruleId:"20-concurrency",ruleName:Y.name,severity:Y.severity,category:"quality",filePath:G,lineNumber:V,description:Y.description,suggestion:Y.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var L0,JZ,O4,z4,B4;var M0=A(()=>{M();L0=require("fs"),JZ=require("path"),O4=[{name:"Missing Await",pattern:/(?:^|\n)\s*(?!return\b)(?!await\b)(?!const\b)(?!let\b)(?!var\b)(?!if\b)(?!throw\b)\w+\.\b(?:save|update|delete|create|insert|remove|destroy|findOne|findMany)\s*\(/gm,severity:"info",description:"Async database operation may be missing await",suggestion:"Add await before async operations to ensure proper execution order"},{name:"Promise.all Without Catch",pattern:/Promise\.all\s*\([^)]+\)\s*(?!\.catch|\.then\([^,]+,[^)]+\))(?:\s*;|\s*$)/gm,severity:"warning",description:"Promise.all without error handling \u2014 one rejection crashes all",suggestion:"Use Promise.allSettled() or add .catch() / try-catch around Promise.all"},{name:"Shared Mutable State",pattern:/^(?:export\s+)?let\s+\w+\s*(?::\s*(?:Map|Set|Array|Record|object|\{)|\s*=\s*(?:new\s+(?:Map|Set)|(?:\[|\{)))/gm,severity:"warning",description:"Module-level mutable collection \u2014 potential race condition in concurrent access",suggestion:"Use const with immutable patterns, or isolate state in a class instance"},{name:"Timer Without Cleanup",pattern:/(?:setInterval|setTimeout)\s*\([^)]+\)\s*;?\s*(?:\n|$)(?!.*(?:clearInterval|clearTimeout|\.unref))/gm,severity:"info",description:"Timer created without storing reference for cleanup",suggestion:"Store timer reference and clear it in cleanup/dispose: const timer = setInterval(...); // clearInterval(timer)"},{name:"Async Void Function",pattern:/(?:addEventListener|on\w+)\s*\(\s*['"][^'"]+['"]\s*,\s*async\s/g,severity:"info",description:"Async event handler \u2014 errors may be silently swallowed",suggestion:"Wrap async event handlers in try-catch to prevent unhandled rejections"}],z4=/(?:import|require)\s*(?:\(|.+from\s+)['"](?:@?prisma|sequelize|mongoose|typeorm|drizzle|knex|pg|mysql|better-sqlite3|mikro-orm)/,B4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function T0(Z){let $=[],J=KZ.join(Z,"src"),K=0;try{let W=T("**/*.{tsx,jsx,html,vue}",J);for(let Q of W){if(_4.some((Y)=>Q.includes(Y)))continue;K++;let H=KZ.join(J,Q),G=_(KZ.relative(Z,H)),X;try{X=w0.readFileSync(H,"utf-8")}catch{continue}let U=X.split(`
`);for(let Y of V4){let O=new RegExp(Y.pattern.source,Y.pattern.flags),z;while((z=O.exec(X))!==null){let V=X.substring(0,z.index).split(`
`).length,B=U[V-1]?.trim()||"";if(B.startsWith("//")||B.startsWith("*")||B.startsWith("{/*"))continue;$.push({ruleId:"22-accessibility",ruleName:Y.name,severity:Y.severity,category:"quality",filePath:G,lineNumber:V,description:Y.description,suggestion:Y.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var w0,KZ,V4,_4;var F0=A(()=>{M();w0=require("fs"),KZ=require("path"),V4=[{name:"Image Without Alt",pattern:/<img\s(?![^>]*\balt\s*=)[^>]*>/gi,severity:"warning",description:"Image element without alt attribute \u2014 screen readers cannot describe it",suggestion:'Add alt="descriptive text" or alt="" for decorative images'},{name:"Click Without Keyboard",pattern:/onClick\s*=\s*\{(?![^}]*(?:onKeyDown|onKeyUp|onKeyPress|role))/gi,severity:"warning",description:"Click handler without keyboard event \u2014 not accessible via keyboard navigation",suggestion:"Add onKeyDown handler and role='button' for non-button clickable elements"},{name:"Interactive Without ARIA",pattern:/<(?:div|span)\s+(?=[^>]*onClick)[^>]*(?<!aria-label\s*=\s*"[^"]*")[^>]*>/gi,severity:"info",description:"Interactive div/span without aria-label \u2014 purpose unclear to assistive technology",suggestion:"Add aria-label or use semantic HTML elements (button, a) instead"},{name:"Input Without Label",pattern:/<input\s(?![^>]*(?:aria-label|aria-labelledby|id\s*=\s*"[^"]*"))[^>]*>/gi,severity:"warning",description:"Form input without associated label or aria-label",suggestion:'Add <label htmlFor="id"> or aria-label attribute to the input'},{name:"Missing Lang Attribute",pattern:/<html\s(?![^>]*\blang\s*=)[^>]*>/gi,severity:"warning",description:"HTML element missing lang attribute \u2014 affects screen reader pronunciation",suggestion:'Add lang="en" (or appropriate language code) to the <html> element'},{name:"AutoFocus Usage",pattern:/\bautoFocus\b|\bautofocus\b/gi,severity:"info",description:"autoFocus can disorient screen reader users and break navigation flow",suggestion:"Avoid autoFocus. Manage focus programmatically only when necessary"}],_4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function QZ(Z,$,J,K,W,Q,H){return{ruleId:Z,ruleName:$,severity:J,category:"quality",filePath:K,lineNumber:H,description:W,suggestion:Q}}function q0(Z){let $=[],J=WZ.join(Z,"src"),K=0;try{let W=T("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(A4.some((Y)=>Q.includes(Y)))continue;K++;let H=WZ.join(J,Q),G=_(WZ.relative(Z,H)),X;try{X=k0.readFileSync(H,"utf-8")}catch{continue}let U=X.split(`
`);M4(U,G,$),w4(X,G,$),T4(U,G,$),F4(X,U,G,$),E4(U,G,$)}}catch{}return{violations:$,filesScanned:K}}function M4(Z,$,J){let K=0,W=0,Q=0;for(let H=0;H<Z.length;H++){let G=Z[H].trim();if(G.startsWith("//")||G.startsWith("*"))continue;for(let X of G)if(X==="{"){if(K++,K>W)W=K,Q=H+1}else if(X==="}")K=Math.max(0,K-1)}if(W>E0)J.push(QZ("26-advanced-code-quality","Deep Nesting","warning",$,`Nesting depth of ${W} exceeds maximum of ${E0}`,"Extract nested logic into helper functions or use early returns to reduce nesting",Q))}function w4(Z,$,J){let K=/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+=>)|\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{)/g,W;while((W=K.exec(Z))!==null){let Q=W[0].indexOf("(");if(Q===-1)continue;let H=Z.substring(W.index+Q),G=x4(H);if(G<=1)continue;let U=H.substring(1,G).split(",").filter((Y)=>Y.trim().length>0).length;if(U>x0){let Y=Z.substring(0,W.index).split(`
`).length;J.push(QZ("26-advanced-code-quality","Long Parameter List","info",$,`Function has ${U} parameters (max ${x0})`,"Group related parameters into an options object",Y))}}}function T4(Z,$,J){let K=0;for(let W of Z)if(/\b(?:TODO|FIXME|HACK|XXX)\b/i.test(W))K++;if(K>L4)J.push(QZ("26-advanced-code-quality","TODO Density","info",$,`${K} TODO/FIXME/HACK comments \u2014 indicates accumulated technical debt`,"Address or create tickets for TODO items. Remove resolved TODOs"))}function F4(Z,$,J,K){let W=[{pattern:/(?:https?:\/\/(?!localhost|127\.0\.0\.1|example\.com)[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-z]{2,})/g,name:"Hardcoded URL"},{pattern:/(?:port|PORT)\s*[:=]\s*(\d{4,5})\b/g,name:"Hardcoded Port"},{pattern:/['"](\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!\.0\.1)['"]/g,name:"Hardcoded IP"}];for(let{pattern:Q,name:H}of W){let G=new RegExp(Q.source,Q.flags),X;while((X=G.exec(Z))!==null){let U=Z.substring(0,X.index).split(`
`).length,Y=$[U-1]?.trim()||"";if(Y.startsWith("//")||Y.startsWith("*"))continue;K.push(QZ("29-configuration-hygiene",H,"info",J,`${H} detected \u2014 should be in configuration/environment variable`,"Move to environment variable or configuration file",U))}}}function E4(Z,$,J){let K=new Set(["0","1","-1","2","100","1000","200","201","400","401","403","404","500"]),W=0;for(let Q=0;Q<Z.length;Q++){let H=Z[Q].trim();if(H.startsWith("//")||H.startsWith("*")||H.startsWith("import"))continue;if(/(?:const|let|var)\s+\w+\s*=\s*-?\d+\s*;/.test(H))continue;let G=H.match(/(?<![a-zA-Z_$.])\b(\d{3,})\b(?!["'`])/g);if(G){for(let X of G)if(!K.has(X))W++}}if(W>3)J.push(QZ("26-advanced-code-quality","Magic Numbers","info",$,`${W} magic numbers found \u2014 extract to named constants`,"Define meaningful constants: const MAX_RETRIES = 3; const TIMEOUT_MS = 5000;"))}function x4(Z){let $=0;for(let J=0;J<Z.length;J++)if(Z[J]==="(")$++;else if(Z[J]===")"){if($--,$===0)return J}return-1}var k0,WZ,E0=4,x0=4,L4=5,A4;var N0=A(()=>{M();k0=require("fs"),WZ=require("path"),A4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function R0(Z){let $=[],J=HZ.join(Z,"src"),K=0;try{let W=T("**/*.{ts,js}",J);for(let Q of W){if(k4.some((Y)=>Q.includes(Y)))continue;let H=HZ.join(J,Q),G=_(HZ.relative(Z,H)),X;try{X=D0.readFileSync(H,"utf-8")}catch{continue}if(!q4(X,Q))continue;K++;let U=X.split(`
`);N4(X,U,G,$),D4(X,U,G,$),R4(X,G,$),C4(X,U,G,$)}}catch{}return{violations:$,filesScanned:K}}function q4(Z,$){let J=/(?:route|controller|handler|endpoint|api)/i.test($),K=/router\.\w+\s*\(|app\.\w+\s*\(|@(?:Get|Post|Put|Delete|Patch)\b/i.test(Z);return J||K}function N4(Z,$,J,K){let W=/(?:router|app)\.\w+\s*\(\s*['"]([^'"]+)['"]/g,Q;while((Q=W.exec(Z))!==null){let G=Q[1].split("/").filter((X)=>X&&!X.startsWith(":"));for(let X of G)if(X!==X.toLowerCase()||X.includes("_")){let U=Z.substring(0,Q.index).split(`
`).length;K.push({ruleId:"28-advanced-api-patterns",ruleName:"Route Naming",severity:"info",category:"structure",filePath:J,lineNumber:U,description:`Route path segment "${X}" should use kebab-case`,suggestion:`Rename to "${X.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/_/g,"-").toLowerCase()}"`});break}}}function D4(Z,$,J,K){let W=/(?:router|app)\.(post|put|patch)\s*\(\s*['"]([^'"]+)['"]/g,Q;while((Q=W.exec(Z))!==null){let H=Q[1],G=Q[2],X=Z.substring(0,Q.index).split(`
`).length,U=$.slice(X-1,X+30).join(`
`);if(!/(?:validate|schema|zod|joi|yup|ajv|\.parse\(|\.safeParse\(|typeof\s+\w+\s*!==|if\s*\(\s*!\w+)/i.test(U))K.push({ruleId:"28-advanced-api-patterns",ruleName:"Missing Input Validation",severity:"warning",category:"structure",filePath:J,lineNumber:X,description:`${H.toUpperCase()} ${G} \u2014 no input validation detected`,suggestion:"Add request body validation using Zod, Joi, or manual type checks"})}}function R4(Z,$,J){if(!/(?:router|app)\.\w+\s*\(/g.test(Z))return;let W=/try\s*\{/.test(Z),Q=/err(?:or)?\s*(?:,\s*req|:\s*Error)/i.test(Z),H=/\.status\s*\(\s*(?:4\d{2}|5\d{2})\s*\)/.test(Z);if(!W&&!Q&&!H)J.push({ruleId:"28-advanced-api-patterns",ruleName:"Missing Error Handling",severity:"warning",category:"structure",filePath:$,description:"Route file has no error handling (no try-catch, error middleware, or error responses)",suggestion:"Add try-catch blocks or error middleware to handle failures gracefully"})}function C4(Z,$,J,K){let W=Z.match(/res\.json\s*\(/g),Q=Z.match(/res\.send\s*\(/g);if(W&&Q){let H=W.length,G=Q.length;if(H>0&&G>0&&Math.min(H,G)>1)K.push({ruleId:"28-advanced-api-patterns",ruleName:"Inconsistent Response Format",severity:"info",category:"structure",filePath:J,description:`Mixed response methods: ${H} res.json() and ${G} res.send()`,suggestion:"Use res.json() consistently for API endpoints"})}}var D0,HZ,k4;var C0=A(()=>{M();D0=require("fs"),HZ=require("path"),k4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function I0(Z){if(Z.length===0)return 100;let $=0;for(let J of Z){let K=S4[J.category]??0.15,W=S0[J.severity]??1;$+=W*K}return Math.max(0,Math.round(100-$))}function y0(Z){let $=["dependency","structure","security","quality","docs"],J={};for(let K of $){let W=Z.filter((H)=>H.category===K),Q=0;for(let H of W)Q+=S0[H.severity]??1;J[K]=Math.max(0,Math.round(100-Q))}return J}function FZ(Z){let $={critical:0,warning:0,info:0};for(let J of Z)$[J.severity]=($[J.severity]??0)+1;return $}function EZ(Z){let $={};for(let J of Z)$[J.ruleId]=($[J.ruleId]??0)+1;return $}var S4,S0;var xZ=A(()=>{S4={dependency:0.25,structure:0.2,security:0.25,quality:0.2,docs:0.1},S0={critical:10,warning:3,info:1}});function dZ(Z,$){let J=[],K=kZ.basename($);if(/\.(test|spec)\./i.test(K)||!/\.(ts|tsx|js|jsx)$/i.test(K))return J;let W;try{W=v0.readFileSync($,"utf-8")}catch{return J}let Q=_(kZ.relative(Z,$)),H=W.split(`
`);if(H.length>200)J.push({ruleId:"15-code-style",ruleName:"File Too Long",severity:"warning",category:"quality",filePath:Q,description:`File has ${H.length} lines (limit: 200)`,suggestion:"Split into smaller, focused modules"});for(let U of I4){let Y=new RegExp(U.pattern.source,U.pattern.flags),O;while((O=Y.exec(W))!==null){let z=W.substring(0,O.index).split(`
`).length,V=H[z-1]?.trim()||"";if(V.startsWith("//")||V.startsWith("*"))continue;let B=O.index-W.lastIndexOf(`
`,O.index-1)-1;if(j(V,B))continue;J.push({ruleId:"02-security",ruleName:U.name,severity:U.severity,category:"security",filePath:Q,lineNumber:z,description:U.description})}}let X=_(Q).match(/\/(?:domain|application|infrastructure)\//);if(X){let U=X[0].replace(/\//g,""),Y=y4[U];if(Y)for(let O of H){let z=O.match(/(?:import|from)\s+['"]([^'"]+)['"]/);if(!z)continue;let V=z[1];for(let B of Y)if(V.includes(`/${B}/`)||V.includes(`\\${B}\\`)){J.push({ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",filePath:Q,description:`${U} layer imports from ${B} (forbidden)`,suggestion:`Define a port interface in ${U}/ and implement in ${B}/`});break}}}return J}var v0,kZ,I4,y4;var f0=A(()=>{M();v0=require("fs"),kZ=require("path"),I4=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected"},{name:"SQL String Concatenation",pattern:/(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,severity:"critical",description:"Potential SQL injection via string interpolation"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability"}],y4={domain:["infrastructure","application"],application:["infrastructure"]}});function qZ(Z,$={}){let J=Date.now();L.info("Starting validation",{projectPath:Z});let K=[],W=[],Q=0;if(c("dependency",$.categories)){let U=eZ(Z);K.push(...U.violations),Q+=U.filesScanned}if(c("structure",$.categories)){let U=K0(Z);K.push(...U.violations),W=U.features;let Y=R0(Z);K.push(...Y.violations),Q=Math.max(Q,Y.filesScanned)}if(c("security",$.categories)){let U=H0(Z);K.push(...U.violations),Q=Math.max(Q,U.filesScanned);let Y=O0(Z);K.push(...Y.violations);let O=V0(Z);K.push(...O.violations)}if(c("quality",$.categories)||c("docs",$.categories)){let U=X0(Z);K.push(...U.violations),Q=Math.max(Q,U.filesScanned)}if(c("quality",$.categories)){let U=A0(Z);K.push(...U.violations);let Y=T0(Z);K.push(...Y.violations);let O=q0(Z);K.push(...O.violations)}if($.severity){let U={critical:0,warning:1,info:2},Y=U[$.severity];K=K.filter((O)=>U[O.severity]<=Y)}let H=I0(K),G=y0(K),X=Date.now()-J;return L.info("Validation complete",{projectPath:Z,score:H,violations:K.length,duration:X}),{overallScore:H,scoresByCategory:G,totalFeatures:W.length,totalFiles:Q,violations:K,featureMap:W,trend:"stable",timestamp:Date.now()}}function c(Z,$){if(!$||$.length===0)return!0;return $.includes(Z)}var NZ=A(()=>{Z0();W0();Y0();U0();z0();_0();M0();F0();N0();C0();xZ();y();f0()});function c0(Z,$){let K=Z.query(`INSERT INTO decisions
       (project_id, session_id, title, status, context, decision, alternatives,
        consequences_positive, consequences_negative, tags, created_at)
     VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.title,$.context??null,$.decision,$.alternatives?JSON.stringify($.alternatives):null,$.consequencesPositive?JSON.stringify($.consequencesPositive):null,$.consequencesNegative?JSON.stringify($.consequencesNegative):null,$.tags?JSON.stringify($.tags):null,Date.now());return Number(K.lastInsertRowid)}function RZ(Z,$){return Z.query("SELECT * FROM decisions WHERE id = ?").get($)}function h(Z,$,J={}){let K=["project_id = ?"],W=[$];if(J.query){K.push("(title LIKE ? OR decision LIKE ? OR context LIKE ?)");let X=`%${J.query}%`;W.push(X,X,X)}if(J.status)K.push("status = ?"),W.push(J.status);let Q=Math.min(J.limit??20,100),H=J.offset??0,G=`
    SELECT * FROM decisions
    WHERE ${K.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;return W.push(Q,H),Z.query(G).all(...W)}function GZ(Z,$,J=5){return Z.query("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all($,J)}function s0(Z,$){let K=Z.query(`INSERT INTO violations
       (project_id, session_id, rule_id, rule_name, severity, category,
        file_path, line_number, description, suggestion, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run($.projectId,$.sessionId??null,$.ruleId,$.ruleName,$.severity,$.category,$.filePath??null,$.lineNumber??null,$.description,$.suggestion??null,Date.now());return Number(K.lastInsertRowid)}function CZ(Z,$,J={}){let K=["project_id = ?","resolved = 0"],W=[$];if(J.severity)K.push("severity = ?"),W.push(J.severity);if(J.category)K.push("category = ?"),W.push(J.category);if(J.ruleId)K.push("rule_id = ?"),W.push(J.ruleId);let Q=Math.min(J.limit??50,200);return W.push(Q),Z.query(`SELECT * FROM violations WHERE ${K.join(" AND ")}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`).all(...W)}function i0(Z,$,J="manual"){Z.query("UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?").run(Date.now(),J,$)}function m(Z,$){let J=Z.query(`SELECT severity, COUNT(*) as count FROM violations
       WHERE project_id = ? AND resolved = 0
       GROUP BY severity`).all($),K={critical:0,warning:0,info:0};for(let W of J)if(W.severity in K)K[W.severity]=W.count;return K}function XZ(Z,$,J={}){let K=["project_id = ?"],W=[$];if(J.query){K.push("(description LIKE ? OR file_path LIKE ? OR rule_name LIKE ?)");let H=`%${J.query}%`;W.push(H,H,H)}if(J.resolved!==void 0)K.push("resolved = ?"),W.push(J.resolved?1:0);let Q=Math.min(J.limit??20,100);return W.push(Q,J.offset??0),Z.query(`SELECT * FROM violations WHERE ${K.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...W)}function o0(Z,$,J,K){Z.query(`INSERT OR IGNORE INTO sessions
       (id, project_id, started_at, compliance_score_before, decisions_made, violations_found, violations_resolved)
     VALUES (?, ?, ?, ?, 0, 0, 0)`).run($,J,Date.now(),K??null)}function r0(Z,$,J){Z.query(`UPDATE sessions SET
       completed_at = ?,
       summary = ?,
       features_added = ?,
       files_changed = ?,
       decisions_made = ?,
       violations_found = ?,
       violations_resolved = ?,
       compliance_score_after = ?
     WHERE id = ?`).run(Date.now(),J.summary??null,J.featuresAdded?JSON.stringify(J.featuresAdded):null,J.filesChanged?JSON.stringify(J.filesChanged):null,J.decisionsMade??0,J.violationsFound??0,J.violationsResolved??0,J.complianceScoreAfter??null,$)}function a0(Z,$){return Z.query("SELECT * FROM sessions WHERE id = ?").get($)}function SZ(Z,$,J=10){return Z.query("SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?").all($,J)}function i(Z,$){return Z.query("SELECT COUNT(*) as count FROM sessions WHERE project_id = ?").get($)?.count??0}function t0(Z,$,J=null){let K=Date.now(),W=Z.query("SELECT * FROM rule_metrics WHERE rule_id = ? AND project_id IS ?").get($,J);if(W)Z.query(`UPDATE rule_metrics SET
         total_violations = total_violations + 1,
         last_violation_at = ?,
         updated_at = ?
       WHERE id = ?`).run(K,K,W.id);else Z.query(`INSERT INTO rule_metrics
         (project_id, rule_id, total_violations, resolved_violations,
          ignored_violations, last_violation_at, updated_at)
       VALUES (?, ?, 1, 0, 0, ?, ?)`).run(J,$,K,K)}function e0(Z,$=null){return Z.query(`SELECT * FROM rule_metrics WHERE project_id IS ?
       ORDER BY total_violations DESC`).all($)}function Z1(Z,$){let K=Z.query(`INSERT INTO improvement_suggestions
       (project_id, rule_id, suggestion_type, title, reasoning, evidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run($.projectId??null,$.ruleId??null,$.suggestionType,$.title,$.reasoning,$.evidence?JSON.stringify($.evidence):null,Date.now());return Number(K.lastInsertRowid)}function u(Z,$=null){if($)return Z.query(`SELECT * FROM improvement_suggestions
         WHERE (project_id = ? OR project_id IS NULL) AND status = 'pending'
         ORDER BY created_at DESC`).all($);return Z.query(`SELECT * FROM improvement_suggestions
       WHERE status = 'pending' ORDER BY created_at DESC`).all()}function vZ(){return{workerPort:parseInt(process.env.ARCHITECT_PORT||"37778",10),logLevel:process.env.ARCHITECT_LOG_LEVEL||"info",databasePath:process.env.ARCHITECT_DB_PATH||"",pluginRoot:process.env.CLAUDE_PLUGIN_ROOT||process.cwd(),improvementMinSessions:parseInt(process.env.ARCHITECT_IMPROVEMENT_MIN_SESSIONS||"5",10)}}var X1={};n(X1,{default:()=>G1});async function G1(){let Z=S(),$=E(),J=w($,Z);if(!J){let U=Y1.basename(Z);J=BZ($,{id:crypto.randomUUID(),name:U,path:Z}),L.info("New project registered",{name:U,path:Z})}let K=process.env.CLAUDE_SESSION_ID||crypto.randomUUID(),W=AZ($,J.id);o0($,K,J.id,W?.overall_score);let Q=m($,J.id),H=a($,J.id),G=GZ($,J.id,3),X=[];if(X.push("# [claude-architect] project context"),X.push(`Project: ${J.name} (${J.path})`),W)X.push(`Compliance Score: ${W.overall_score}/100 (${H})`);if(Q.critical>0||Q.warning>0)X.push(`Open Violations: ${Q.critical} critical, ${Q.warning} warning, ${Q.info} info`);if(G.length>0){X.push(`
Recent Decisions:`);for(let U of G)X.push(`- [${U.status}] ${U.title}`)}process.stdout.write(X.join(`
`))}var Y1;var U1=A(()=>{b();N();y();M();Y1=require("path")});var z1={};n(z1,{default:()=>O1});async function O1(){let Z=S(),$=E(),J=w($,Z);if(!J){process.stdout.write("Success");return}let K=CZ($,J.id,{limit:5});if(K.length===0){process.stdout.write("Success");return}let W=[];W.push("# [claude-architect] active warnings");for(let Q of K)W.push(`- [${Q.severity}] ${Q.description}${Q.file_path?` (${Q.file_path})`:""}`);process.stdout.write(W.join(`
`))}var B1=A(()=>{b();N();M()});var _1={};n(_1,{default:()=>V1});async function V1(){let Z=S(),$=E(),J=w($,Z);if(!J){process.stdout.write("Success");return}let K=process.env.TOOL_INPUT_FILE_PATH||"";if(!K){process.stdout.write("Success");return}let W=dZ(Z,K);if(W.length===0){process.stdout.write("Success");return}let Q=process.env.CLAUDE_SESSION_ID;for(let G of W)s0($,{projectId:J.id,sessionId:Q,ruleId:G.ruleId,ruleName:G.ruleName,severity:G.severity,category:G.category,filePath:G.filePath,lineNumber:G.lineNumber,description:G.description,suggestion:G.suggestion}),t0($,G.ruleId,J.id);let H=[];H.push("# [claude-architect] violations detected");for(let G of W)H.push(`- [${G.severity}] ${G.description}${G.suggestion?` \u2192 ${G.suggestion}`:""}`);process.stdout.write(H.join(`
`))}var L1=A(()=>{b();N();NZ();M()});var w1={};n(w1,{default:()=>M1});async function M1(){let Z=S(),$=E(),J=w($,Z);if(!J){process.stdout.write("Success");return}let K=process.env.CLAUDE_SESSION_ID;try{let W=qZ(Z);if(LZ($,{projectId:J.id,sessionId:K??void 0,overallScore:W.overallScore,scoresByCategory:W.scoresByCategory,totalFeatures:W.totalFeatures,totalFiles:W.totalFiles,totalViolations:W.violations.length,violationsBySeverity:FZ(W.violations),violationsByRule:EZ(W.violations)}),K){let Q=a0($,K),H=m($,J.id),G=H.critical+H.warning+H.info,X=f4(Z),U=h($,J.id,{limit:100}),Y=Q?.started_at??0,O=U.filter((V)=>V.created_at>=Y),z=g4({projectName:J.name,scoreBefore:Q?.compliance_score_before??null,scoreAfter:W.overallScore,violations:W.violations,filesChanged:X,decisionsCount:O.length,totalViolations:G});r0($,K,{summary:z,complianceScoreAfter:W.overallScore,filesChanged:X,decisionsMade:O.length,violationsFound:G})}L.info("Session summarized",{project:J.name,score:W.overallScore})}catch(W){L.error("Summarization failed",{error:W.message})}process.stdout.write("Success")}function f4(Z){try{let $=A1.spawnSync("git",["status","--short"],{cwd:Z,encoding:"utf-8",timeout:5000});if(!$.stdout)return[];return $.stdout.split(`
`).filter((J)=>J.trim()).map((J)=>J.substring(3).trim())}catch{return[]}}function g4(Z){let $=[];if(Z.scoreBefore!==null&&Z.scoreBefore!==Z.scoreAfter){let W=Z.scoreAfter-Z.scoreBefore,Q=W>0?"improved":"decreased";$.push(`Architecture compliance ${Q} from ${Z.scoreBefore} to ${Z.scoreAfter} (${W>0?"+":""}${W}).`)}else $.push(`Architecture compliance score: ${Z.scoreAfter}/100.`);if(Z.filesChanged.length>0)if(Z.filesChanged.length<=3)$.push(`Modified: ${Z.filesChanged.join(", ")}.`);else $.push(`${Z.filesChanged.length} files modified, including ${Z.filesChanged.slice(0,2).join(", ")} and ${Z.filesChanged.length-2} more.`);let J=Z.violations.filter((W)=>W.severity==="critical"),K=Z.violations.filter((W)=>W.severity==="warning");if(J.length>0)$.push(`${J.length} critical issue${J.length>1?"s":""} detected: ${J.map((W)=>W.description).slice(0,2).join("; ")}.`);if(K.length>0)$.push(`${K.length} warning${K.length>1?"s":""} remaining.`);if(Z.totalViolations===0)$.push("No open violations \u2014 project is fully compliant.");if(Z.decisionsCount>0)$.push(`${Z.decisionsCount} architectural decision${Z.decisionsCount>1?"s":""} recorded.`);return $.join(" ")}var A1;var T1=A(()=>{b();N();NZ();xZ();y();M();A1=require("child_process")});function F1(Z,$,J=5){let K=$?i(Z,$):0;if($&&K<J)return{suggestions:[],analysisMetadata:{totalRules:0,totalSessions:K,analyzedAt:Date.now()}};let W=e0(Z,$),Q=[];for(let Y of W){if(Y.total_violations>10){let O=Y.ignored_violations/Y.total_violations;if(O>0.5)Q.push({ruleId:Y.rule_id,type:"relax",title:`Rule "${Y.rule_id}" is frequently ignored`,reasoning:`${Math.round(O*100)}% of violations for this rule are ignored (${Y.ignored_violations}/${Y.total_violations}). The rule may be too strict or irrelevant for this project.`,evidence:{totalViolations:Y.total_violations,resolvedViolations:Y.resolved_violations,ignoredViolations:Y.ignored_violations,ignoreRate:Math.round(O*100)}})}if(Y.avg_resolution_time_ms!==null&&Y.avg_resolution_time_ms<300000&&Y.resolved_violations>5)Q.push({ruleId:Y.rule_id,type:"add",title:`Auto-fix candidate: "${Y.rule_id}"`,reasoning:`Violations for this rule are resolved quickly (avg ${Math.round(Y.avg_resolution_time_ms/1000)}s). Consider adding auto-fix support.`,evidence:{avgResolutionTimeSec:Math.round(Y.avg_resolution_time_ms/1000),resolvedCount:Y.resolved_violations}});if($&&K>0){let O=Y.total_violations/K;if(O>3)Q.push({ruleId:Y.rule_id,type:"split",title:`Rule "${Y.rule_id}" triggers too frequently`,reasoning:`This rule triggers ${O.toFixed(1)} times per session on average. Consider splitting into more specific sub-rules or adding examples.`,evidence:{violationsPerSession:O.toFixed(1),totalSessions:K,totalViolations:Y.total_violations}})}}let H=new Set(W.map((Y)=>Y.rule_id)),G=["00-constitution","01-architecture","02-security","03-testing","04-api-design","05-database","06-documentation","07-performance","08-error-handling","09-git-workflow","10-frontend","11-auth-patterns","12-monitoring","13-environment","14-dependency-management","15-code-style","16-ci-cd","17-owasp-top-ten","18-data-privacy","19-resilience-patterns","20-concurrency","22-accessibility","26-advanced-code-quality","28-advanced-api-patterns","29-configuration-hygiene","30-supply-chain-security"];if(K>=J){for(let Y of G)if(!H.has(Y))Q.push({ruleId:Y,type:"remove",title:`Rule "${Y}" never triggered`,reasoning:`This rule has never produced a violation across ${K} sessions. It may be too obvious or not applicable to this project \u2014 consider removing to save tokens.`,evidence:{totalSessions:K,totalViolations:0}})}let X=u(Z,$),U=new Set(X.map((Y)=>Y.title));for(let Y of Q)if(!U.has(Y.title))Z1(Z,{projectId:$??void 0,ruleId:Y.ruleId,suggestionType:Y.type,title:Y.title,reasoning:Y.reasoning,evidence:Y.evidence});return L.info("Self-improvement analysis complete",{projectId:$,suggestionsGenerated:Q.length,sessionCount:K}),{suggestions:Q,analysisMetadata:{totalRules:W.length,totalSessions:K,analyzedAt:Date.now()}}}var E1=A(()=>{y()});var k1={};n(k1,{default:()=>x1});async function x1(){let Z=S(),$=E(),J=w($,Z);if(J){let K=vZ(),W=i($,J.id);if(W>=K.improvementMinSessions)try{F1($,J.id,K.improvementMinSessions),L.info("Self-improvement analysis completed",{project:J.name,sessions:W})}catch(Q){L.error("Self-improvement analysis failed",{error:Q.message})}}r(),process.stdout.write("Success")}var q1=A(()=>{b();N();E1();y();M()});var gZ=j1(require("express")),N1=require("path"),D1=require("fs");b();var Q1=require("express");N();M();var f=require("fs"),l=require("path");var l1=/^---\n([\s\S]*?)\n---\n?/;function uZ(Z){let $=Z.match(l1);if(!$)return{metadata:{mode:"auto",paths:[]},body:Z};let J=$[1],K=Z.slice($[0].length),W={mode:"auto",paths:[]};for(let Q of J.split(`
`)){let H=Q.trim();if(!H||H.startsWith("#"))continue;let G=H.match(/^(\w+):\s*(.*)$/);if(G){let[,X,U]=G;if(X==="mode")W.mode=U.trim()==="manual"?"manual":"auto";else if(X==="paths")continue;else W[X]=U.trim()}else if(H.startsWith("- ")){let X=H.slice(2).replace(/^["']|["']$/g,"").trim();if(X)W.paths.push(X)}}return{metadata:W,body:K}}function pZ(Z){return uZ(Z).metadata.mode}function tZ(Z,$){Z.get("/api/projects",(J,K)=>{K.json(VZ($))}),Z.post("/api/projects",(J,K)=>{let{id:W,name:Q,path:H,tech_stack:G}=J.body;if(!W||!Q||!H){K.status(400).json({error:"id, name, and path are required"});return}if(typeof W!=="string"||typeof Q!=="string"||typeof H!=="string"){K.status(400).json({error:"id, name, and path must be strings"});return}let X=BZ($,{id:W,name:Q,path:H,tech_stack:G});K.status(201).json(X)}),Z.get("/api/projects/:id/rules",(J,K)=>{let W=mZ($,J.params.id);if(!W){K.status(404).json({error:"Project not found"});return}let Q=o();if(!f.existsSync(Q)){K.json({autoRules:[],manualRules:[],enabledManualRules:[]});return}let H=[],G=[];for(let U of f.readdirSync(Q).filter((Y)=>Y.endsWith(".md")).sort()){let Y=l.basename(U,".md"),O=f.readFileSync(l.join(Q,U),"utf-8"),z=pZ(O),V={id:Y,name:Y.replace(/^\d+-/,"").replace(/-/g," ")};if(z==="manual")G.push(V);else H.push(V)}let X=_Z($,W.id);K.json({autoRules:H,manualRules:G,enabledManualRules:X})}),Z.post("/api/projects/:id/rules",(J,K)=>{let W=mZ($,J.params.id);if(!W){K.status(404).json({error:"Project not found"});return}let{enabled:Q}=J.body;if(!Array.isArray(Q)){K.status(400).json({error:"enabled must be an array of rule IDs"});return}let H=o(),G=new Set;if(f.existsSync(H))for(let U of f.readdirSync(H).filter((Y)=>Y.endsWith(".md"))){let Y=l.basename(U,".md"),O=f.readFileSync(l.join(H,U),"utf-8");if(pZ(O)==="manual")G.add(Y)}let X=Q.filter((U)=>typeof U==="string"&&G.has(U));aZ($,W.id,X),K.json({enabledManualRules:X})})}N();NZ();xZ();y();var P=require("fs"),YZ=require("path");function g0(Z,$){return`/**
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
`}function j0(Z){return`/**
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
`}function b0(Z){return`/**
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
`}function P0(Z){return`/**
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
`}function h0(Z){return`/**
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
`}function m0(Z){return`/**
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
}
`}function u0(Z){return`/**
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
  async findById(id: string): Promise<${Z} | null> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  async save(entity: ${Z}): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  async delete(id: string): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }
}
`}function p0(Z,$,J){return`# Feature: ${$}

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
bun test -- --filter=${Z}
\`\`\`
`}function d0(Z){let{projectPath:$,featureName:J,description:K="TODO: Describe this feature",withTests:W=!0}=Z,Q=TZ(J),H=$0(J),G=YZ.join($,"src","features",Q);if(P.existsSync(G))throw Error(`Feature directory already exists: ${G}`);let X=[],U=[],Y=["domain/entities","domain/value-objects","domain/ports","domain/events","domain/services","application/use-cases","application/dtos","application/mappers","infrastructure/controllers","infrastructure/repositories","infrastructure/adapters","infrastructure/config"];if(W)Y.push("__tests__/integration","__tests__/e2e");for(let V of Y)P.mkdirSync(YZ.join(G,V),{recursive:!0}),X.push(`src/features/${Q}/${V}`);let O=[[`domain/entities/${H}.ts`,g0(H,K),"domain/entities"],[`domain/ports/${H}Repository.ts`,j0(H),"domain/ports"],[`application/dtos/${H}Dto.ts`,b0(H),"application/dtos"],[`application/use-cases/Create${H}UseCase.ts`,P0(H),"application/use-cases"],[`application/mappers/${H}Mapper.ts`,h0(H),"application/mappers"],[`infrastructure/controllers/${H}Controller.ts`,m0(H),"infrastructure/controllers"],[`infrastructure/repositories/${H}RepositoryImpl.ts`,u0(H),"infrastructure/repositories"],["README.md",p0(Q,H,K),""]];for(let[V,B]of O)P.writeFileSync(YZ.join(G,V),B,"utf-8"),U.push(`src/features/${Q}/${V}`);let z=["domain/value-objects","domain/events","domain/services","infrastructure/adapters","infrastructure/config"];if(W)z.push("__tests__/integration","__tests__/e2e");for(let V of z){let B=YZ.join(G,V,".gitkeep");if(!P.existsSync(B))P.writeFileSync(B,"","utf-8")}return L.info("Feature scaffold generated",{feature:Q,files:U.length,dirs:X.length}),{createdFiles:U,createdDirs:X,featurePath:G}}M();var s=require("fs"),DZ=require("path");N();function l0(Z,$){Z.get("/api/check",(J,K)=>{let W=J.query.project_path;if(!W||typeof W!=="string"){K.status(400).json({error:"project_path query parameter required"});return}let Q=J.query.categories?J.query.categories.split(","):void 0,H=J.query.severity,G=qZ(W,{categories:Q,severity:H}),X=w($,W);if(X)LZ($,{projectId:X.id,overallScore:G.overallScore,scoresByCategory:G.scoresByCategory,totalFeatures:G.totalFeatures,totalFiles:G.totalFiles,totalViolations:G.violations.length,violationsBySeverity:FZ(G.violations),violationsByRule:EZ(G.violations)});K.json(G)}),Z.post("/api/scaffold",(J,K)=>{let{project_path:W,feature_name:Q,description:H,with_tests:G}=J.body;if(!W||!Q){K.status(400).json({error:"project_path and feature_name are required"});return}if(typeof W!=="string"||typeof Q!=="string"){K.status(400).json({error:"project_path and feature_name must be strings"});return}try{let X=d0({projectPath:W,featureName:Q,description:typeof H==="string"?H:void 0,withTests:G!==!1});K.status(201).json(X)}catch(X){K.status(409).json({error:X.message})}}),Z.get("/api/rules",(J,K)=>{let W=J.query.file_path,Q=J.query.category,H=J.query.project_path,G=o();if(!s.existsSync(G)){K.json({rules:[],message:"Rules directory not found"});return}let X=[];if(H){let O=w($,H);if(O)X=_Z($,O.id)}let U=s.readdirSync(G).filter((O)=>O.endsWith(".md")).sort(),Y=[];for(let O of U){let z=DZ.basename(O,".md");if(Q&&!z.includes(Q))continue;let V=s.readFileSync(DZ.join(G,O),"utf-8"),{metadata:B,body:q}=uZ(V);if(B.mode==="manual"){if(!X.includes(z))continue}if(W&&B.paths.length>0){let jZ=W.replace(/\\/g,"/");if(!B.paths.some((bZ)=>{let R1=bZ.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\\\*\\\*/g,".*").replace(/\\\*/g,"[^/]*");return new RegExp(`^${R1}$`).test(jZ)}))continue}Y.push({id:z,name:z.replace(/^\d+-/,"").replace(/-/g," "),mode:B.mode,content:q})}K.json({rules:Y})})}N();function n0(Z,$){Z.get("/api/search",(J,K)=>{let W=J.query.query,Q=J.query.project_path,H=J.query.type,G=Math.min(parseInt(J.query.limit)||20,100),X=Q?w($,Q):null;if(Q&&!X){K.status(404).json({results:[],message:"Project not found. Run /architect-init first."});return}let U=X?.id,Y=[];if(!H||H==="decisions"){if(U){let O=h($,U,{query:W,limit:G});for(let z of O)Y.push({id:z.id,type:"decision",title:z.title,status:z.status,created_at:z.created_at,extra:z.tags||""})}}if(!H||H==="violations"){if(U){let O=XZ($,U,{query:W,limit:G});for(let z of O)Y.push({id:z.id,type:"violation",title:`[${z.severity}] ${z.description}`,status:z.resolved?"resolved":"open",created_at:z.created_at,extra:z.rule_id})}}Y.sort((O,z)=>z.created_at-O.created_at),K.json(Y.slice(0,G))}),Z.get("/api/timeline",(J,K)=>{let W=parseInt(J.query.anchor),Q=J.query.query,H=J.query.project_path,G=parseInt(J.query.depth_before)||5,X=parseInt(J.query.depth_after)||5,Y=(H?w($,H):null)?.id;if(!Y){K.status(404).json({events:[],message:"Project not found"});return}let O=[],z=h($,Y,{query:Q,limit:100});for(let F of z)O.push({id:F.id,type:"decision",title:F.title,status:F.status,created_at:F.created_at,extra:F.tags||""});let V=XZ($,Y,{limit:100});for(let F of V)O.push({id:F.id,type:"violation",title:`[${F.severity}] ${F.description}`,status:F.resolved?"resolved":"open",created_at:F.created_at,extra:F.rule_id});O.sort((F,bZ)=>F.created_at-bZ.created_at);let B=-1;if(!isNaN(W))B=O.findIndex((F)=>F.id===W);else if(Q)B=O.findIndex((F)=>F.title.toLowerCase().includes(Q.toLowerCase()));if(B===-1)B=O.length-1;let q=Math.max(0,B-G),jZ=Math.min(O.length,B+X+1);K.json({events:O.slice(q,jZ),anchorIndex:B-q,total:O.length})}),Z.post("/api/details/batch",(J,K)=>{let{ids:W,type:Q}=J.body;if(!Array.isArray(W)||!Q){K.status(400).json({error:"ids (array) and type (string) are required"});return}if(typeof Q!=="string"||!["decisions","violations","changes"].includes(Q)){K.status(400).json({error:'type must be "decisions", "violations", or "changes"'});return}if(W.length>50){K.status(400).json({error:"Maximum 50 IDs per request"});return}let H=[];if(Q==="decisions")for(let G of W){let X=RZ($,Number(G));if(X)H.push(X)}else if(Q==="violations")for(let G of W){let X=$.query("SELECT * FROM violations WHERE id = ?").get(Number(G));if(X)H.push(X)}else if(Q==="changes")for(let G of W){let X=$.query("SELECT * FROM structural_changes WHERE id = ?").get(Number(G));if(X)H.push(X)}K.json(H)})}N();function $1(Z,$){Z.get("/api/decisions",(J,K)=>{let W=J.query.project_id,Q=J.query.project_path,H=W;if(!H&&Q)H=w($,Q)?.id??"";if(!H){K.status(400).json({error:"project_id or project_path required"});return}let G=h($,H,{query:J.query.query,status:J.query.status,limit:J.query.limit?parseInt(J.query.limit):void 0});K.json(G)}),Z.get("/api/decisions/:id",(J,K)=>{let W=parseInt(J.params.id);if(isNaN(W)){K.status(400).json({error:"Invalid decision ID"});return}let Q=RZ($,W);if(!Q){K.status(404).json({error:"Decision not found"});return}K.json(Q)}),Z.post("/api/decisions",(J,K)=>{let{projectId:W,project_path:Q,title:H,context:G,decision:X,alternatives:U,tags:Y}=J.body,O=W;if(!O&&Q)O=w($,Q)?.id;if(!O||!H||!X){K.status(400).json({error:"projectId (or project_path), title, and decision required"});return}if(typeof H!=="string"||typeof X!=="string"){K.status(400).json({error:"title and decision must be strings"});return}let z=c0($,{projectId:O,title:H,context:typeof G==="string"?G:void 0,decision:X,alternatives:Array.isArray(U)?U:void 0,tags:Array.isArray(Y)?Y:void 0});K.status(201).json({id:z})}),Z.get("/api/violations",(J,K)=>{let W=J.query.project_id;if(!W){K.status(400).json({error:"project_id required"});return}let Q=XZ($,W,{query:J.query.query,resolved:J.query.resolved==="true"?!0:J.query.resolved==="false"?!1:void 0,limit:J.query.limit?parseInt(J.query.limit):void 0});K.json(Q)}),Z.patch("/api/violations/:id",(J,K)=>{let W=parseInt(J.params.id);if(isNaN(W)){K.status(400).json({error:"Invalid violation ID"});return}let{resolved_by:Q}=J.body;i0($,W,typeof Q==="string"?Q:"manual"),K.json({success:!0})}),Z.get("/api/sessions",(J,K)=>{let W=J.query.project_id;if(!W){K.status(400).json({error:"project_id required"});return}K.json(SZ($,W))}),Z.get("/api/compliance/snapshots",(J,K)=>{let W=J.query.project_id;if(!W){K.status(400).json({error:"project_id required"});return}K.json(MZ($,W))}),Z.get("/api/improvements",(J,K)=>{let W=J.query.project_id||null,Q=J.query.project_path;if(!W&&Q)W=w($,Q)?.id??null;K.json(u($,W))})}N();function J1(Z,$){Z.get("/api/status",(J,K)=>{try{let W=J.query.project_path;if(!W){K.status(400).json({error:"project_path required"});return}let Q=w($,W);if(!Q){K.json({registered:!1,message:"Project not registered. Run /architect-init first."});return}let H=AZ($,Q.id),G=a($,Q.id),X=m($,Q.id),U=GZ($,Q.id,5),Y=i($,Q.id),O=u($,Q.id);K.json({project:Q,complianceScore:H?.overall_score??null,trend:G,violations:X,recentDecisions:U,sessionCount:Y,suggestions:O.length,lastChecked:H?.created_at??null})}catch(W){K.status(500).json({error:`Status error: ${W.message}`})}}),Z.get("/dashboard/data",(J,K)=>{try{let W=J.query.project_path,Q=W?w($,W):null;if(!Q){let V=VZ($);K.json({projects:V,selectedProject:null});return}let H=MZ($,Q.id,20),G=CZ($,Q.id,{limit:50}),X=GZ($,Q.id,10),U=a($,Q.id),Y=m($,Q.id),O=u($,Q.id),z=SZ($,Q.id,20);K.json({project:Q,scoreHistory:H,violations:G,recentDecisions:X,trend:U,violationCounts:Y,suggestions:O,sessions:z})}catch(W){K.status(500).json({error:`Dashboard data error: ${W.message}`})}}),Z.get("/api/health",(J,K)=>{K.json({status:"healthy",service:"claude-architect",timestamp:new Date().toISOString()})})}M();var d=require("fs"),p=require("path");function K1(Z){Z.get("/api/templates",($,J)=>{let K=hZ();if(!d.existsSync(K)){J.json({templates:[]});return}let Q=d.readdirSync(K).filter((H)=>H.endsWith(".md")).sort().map((H)=>({id:p.basename(H,".md"),name:p.basename(H,".md").replace(/-TEMPLATE$/,"").replace(/-/g," "),filename:H}));J.json({templates:Q})}),Z.get("/api/templates/:name",($,J)=>{let K=hZ(),W=$.params.name;if(W.includes("..")||W.includes("/")||W.includes("\\")){J.status(400).json({error:"Invalid template name"});return}let Q=W.endsWith(".md")?W:`${W}.md`,H=p.join(K,Q);if(!d.existsSync(H)){J.status(404).json({error:"Template not found"});return}let G=d.readFileSync(H,"utf-8");J.json({id:p.basename(H,".md"),name:p.basename(H,".md").replace(/-TEMPLATE$/,"").replace(/-/g," "),content:G})})}var IZ=require("fs"),lZ=require("child_process"),yZ=require("path"),v4=new Set(["node_modules",".git",".bun","coverage",".turbo",".cache","__pycache__","dist",".next"]);function W1(Z){Z.get("/api/structure",($,J)=>{let K=$.query.project_path;if(!K||typeof K!=="string"){J.status(400).json({error:"project_path query parameter required"});return}function W(H,G){if(G>6)return null;try{let X=IZ.readdirSync(H,{withFileTypes:!0}),U=[],Y=0,O=0;for(let z of X){if(v4.has(z.name))continue;let V=yZ.join(H,z.name);if(z.isDirectory()){let B=W(V,G+1);if(B)U.push(B),Y+=B.size,O+=B.fileCount}else if(z.isFile())try{let B=IZ.statSync(V),q=z.name.includes(".")?z.name.split(".").pop()||"":"";U.push({name:z.name,type:"file",size:B.size,ext:q}),Y+=B.size,O++}catch{}}return U.sort((z,V)=>{if(z.type==="dir"&&V.type!=="dir")return-1;if(z.type!=="dir"&&V.type==="dir")return 1;return z.name.localeCompare(V.name)}),{name:yZ.basename(H),type:"dir",size:Y,fileCount:O,children:U}}catch{return null}}let Q=W(K,0);if(!Q){J.status(404).json({error:"Project directory not found"});return}J.json(Q)}),Z.get("/api/git-activity",($,J)=>{let K=$.query.project_path;if(!K||typeof K!=="string"){J.status(400).json({error:"project_path required"});return}try{let Q=lZ.spawnSync("git",["log","--format=%H%x09%at%x09%s","--name-status","-n","30"],{cwd:K,encoding:"utf-8",timeout:5000}).stdout||"",H=[],G=null;for(let X of Q.split(`
`)){let U=X.trim();if(!U)continue;let Y=U.match(/^([a-f0-9]{40})\t(\d+)\t(.*)$/);if(Y){if(G)H.push(G);G={hash:Y[1].substring(0,8),timestamp:parseInt(Y[2])*1000,subject:Y[3],files:[]}}else if(G&&/^[AMDRC]\t/.test(X)){let O=X.split("\t");G.files.push({status:O[0],path:O.slice(1).join("\t")})}}if(G)H.push(G);try{let U=(lZ.spawnSync("git",["status","--short"],{cwd:K,encoding:"utf-8",timeout:3000}).stdout||"").split(`
`).filter((Y)=>Y.trim());if(U.length>0){let Y=U.map((O)=>({status:O.substring(0,2).trim()||"M",path:O.substring(3).trim()}));H.unshift({hash:"working",timestamp:Date.now(),subject:`${Y.length} uncommitted change${Y.length!==1?"s":""}`,files:Y})}}catch{}J.json(H)}catch{J.json([])}})}function H1(Z){let $=E(),J=Q1.Router();tZ(J,$),l0(J,$),n0(J,$),$1(J,$),J1(J,$),K1(J),W1(J),Z.use(J)}b();y();M();var j4=vZ(),fZ=j4.workerPort;function b4(){let Z=gZ.default();Z.use(gZ.default.json({limit:"1mb"})),Z.use((K,W,Q)=>{let H=K.headers.origin,G=[`http://localhost:${fZ}`,`http://127.0.0.1:${fZ}`];if(H&&G.includes(H))W.header("Access-Control-Allow-Origin",H);if(W.header("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE"),W.header("Access-Control-Allow-Headers","Content-Type"),K.method==="OPTIONS"){W.sendStatus(204);return}Q()});let $=N1.join(OZ(),"ui");if(D1.existsSync($))Z.use(gZ.default.static($));H1(Z),Z.use((K,W,Q,H)=>{L.error("Unhandled route error",{error:K.message,stack:K.stack}),Q.status(500).json({error:"Internal server error"})}),E();let J=Z.listen(fZ,()=>{L.info(`Worker server started on port ${fZ}`),process.stdout.write("Success")});process.on("SIGTERM",()=>{L.info("Shutting down worker server"),J.close(()=>r())}),process.on("SIGINT",()=>{J.close(()=>r())})}async function P4(Z){let $;switch(Z){case"session-init":$=await Promise.resolve().then(() => (U1(),X1));break;case"context":$=await Promise.resolve().then(() => (B1(),z1));break;case"post-change":$=await Promise.resolve().then(() => (L1(),_1));break;case"summarize":$=await Promise.resolve().then(() => (T1(),w1));break;case"session-complete":$=await Promise.resolve().then(() => (q1(),k1));break;default:L.error(`Unknown hook handler: ${Z}`),process.exit(1);return}await $.default()}(async()=>{let Z=process.argv[2];if(Z==="start")b4();else if(Z==="hook"){let $=process.argv[3];try{await P4($)}catch(J){L.error(`Hook handler "${$}" failed`,{error:J.message}),process.exit(1)}}else L.error(`Unknown command: ${Z}`),process.exit(1)})();})

//# debugId=BF5FCD1BB078BF0364756E2164756E21
