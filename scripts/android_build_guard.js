const fs=require('fs');
const path=require('path');
const p=path.join('android-demo','app','build.gradle');
if(!fs.existsSync(p)) throw new Error(`Missing ${p}`);
const s=fs.readFileSync(p,'utf8');
if(!/plugins\s*\{[\s\S]*?com\.android\.application/.test(s)) throw new Error('Android application plugin missing');
if(!/assembleDebug/.test(process.env.GITHUB_WORKFLOW||'') && !fs.existsSync('android-demo/gradlew')) throw new Error('Gradle wrapper missing');
console.log('Android project structure OK');
