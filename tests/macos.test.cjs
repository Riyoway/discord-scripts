// Offline logic check: node tests/macos.test.cjs. Does not exercise Apple's JXA bridge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'macos/run.js'), 'utf8');
const runner = vm.createContext({});
vm.runInContext(source, runner);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts.json'), 'utf8'));
for (const script of manifest) {
    const code = fs.readFileSync(path.join(root, 'console', script.name + '.js'), 'utf8');
    new vm.Script(runner.makeExpression(script.name, code, '175928847299117063'));
    assert.equal(runner.commandFor(script.name),
        'curl -fsSL https://script.riyo.me/d/m/' + script.name + ' | sh');
    const wrapper = fs.readFileSync(path.join(root, 'macos', script.name + '.sh'), 'utf8');
    assert.ok(wrapper.includes('/d/m/run') && wrapper.includes('riyo-scripts ' + script.name));
}
assert.throws(() => runner.commandFor('token; echo unsafe'), /Invalid script name/);
let answers = [];
runner.write = () => {};
runner.readLine = () => { assert.ok(answers.length, 'Unexpected selection prompt'); return answers.shift(); };
const login = { type: 'page', url: 'https://discord.com/login' };
const channel = { type: 'page', url: 'https://canary.discord.com/channels/@me' };
const quest = { type: 'page', url: 'https://discord.com/quest-home' };
answers = ['bad', '2'];
assert.equal(runner.selectPage([login, quest, channel]), channel);
answers = [''];
assert.equal(runner.selectPage([quest, channel]), null);
assert.equal(runner.selectPage([login]), undefined);
assert.equal(runner.selectPage([quest]), quest);
const socket = 'ws://127.0.0.1:9222/devtools/page/ABC-123';
assert.equal(runner.socketUrl({ webSocketDebuggerUrl: socket }, 9222), socket);
assert.throws(() => runner.socketUrl({ webSocketDebuggerUrl: 'ws://example.com/devtools/page/ABC' }, 9222), /Unexpected/);
assert.throws(() => runner.socketUrl({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222@evil.test/devtools/page/ABC' }, 9222), /Unexpected/);
const tables = vm.runInNewContext(runner.makeExpression('whoami', 'console.table({id:"123"});'));
assert.equal(tables[0].id, '123');
const input = '123\";throw new Error("injected");//';
assert.equal(vm.runInNewContext(runner.makeExpression('snowflake',
    'const id=prompt("ID"); prompt("Result",id);', input)), input);
assert.equal(vm.runInNewContext(runner.makeExpression('token', '"secret"')), 'secret');
assert.throws(() => vm.runInNewContext(runner.makeExpression('snowflake',
    'alert("Invalid ID");', 'bad')), /Invalid ID/);

assert.equal(runner.parseOptions(['search','--client','canary']).client, 'canary');
assert.equal(runner.parseOptions(['--client','202']).name, 'menu');
assert.throws(() => runner.parseOptions(['search','--client']), /--client/);
assert.throws(() => runner.parseOptions(['search','--other','value']), /--client/);
const stable = {name:'Discord',key:'stable',pid:101,path:'/Applications/Discord.app'};
const canary = {name:'Discord Canary',key:'canary',pid:202,path:'/Applications/Discord Canary.app'};
const another = {name:'Discord',key:'stable',pid:105,path:'/Applications/Discord.app'};
const stopped = {name:'Discord PTB',key:'ptb',pid:0,path:'/Applications/Discord PTB.app'};
assert.equal(runner.chooseClient([stable,canary,stopped],'canary'),canary);
assert.equal(runner.chooseClient([stable,another],'105'),another);
assert.equal(runner.chooseClient([stable,canary,stopped],'ptb'),stopped);
answers=['0','2'];
assert.equal(runner.chooseClient([stable,canary,stopped]),canary);
answers=[''];
assert.equal(runner.chooseClient([stable,canary]),null);
assert.throws(() => runner.chooseClient([stable,canary],'missing'),/not found/);
assert.equal(runner.parseListeners('p101\nn127.0.0.1:9222\np202\nn*:9444\nn[::1]:9555\n').length,2);
let requested=[];
runner.getListeners=()=>[{pid:101,port:9222},{pid:202,port:9444}];
runner.fetchText=url=>{requested.push(url);return JSON.stringify({Browser:'Chrome','Protocol-Version':'1.3'});};
assert.equal(runner.testPort(canary,9222,Date.now()+60000),false);
assert.equal(requested.length,0,'Never query another client port');
assert.equal(runner.testPort(canary,9444,Date.now()+60000),true);
assert.deepEqual(requested,['http://127.0.0.1:9444/json/version']);
assert.equal(runner.socketUrl({webSocketDebuggerUrl:'ws://127.0.0.1:9444/devtools/page/AAA'},9444),'ws://127.0.0.1:9444/devtools/page/AAA');
assert.throws(()=>runner.socketUrl({webSocketDebuggerUrl:socket},9444),/Unexpected/);
for(const script of manifest){
    const wrapper=fs.readFileSync(path.join(root,'macos',script.name+'.sh'),'utf8');
    assert.ok(wrapper.includes('riyo-scripts '+script.name+' "$@"'),'Every named script must forward client arguments');
}

// Simulate two live applications. Only the chosen Canary application may be restarted.
let fakeNow=1800000000000, probes=0, readyAfter=2, launches=0, restored=0, launchFails=false, staysRunning=true;
let quitPids=[],terminated=new Set();
runner.Date={now:()=>fakeNow};
const app=(bundle,pid)=>({
    bundleURL:{isNil:()=>false,path:bundle},processIdentifier:pid,
    get terminate(){quitPids.push(pid);return true;},
    get terminated(){return terminated.has(pid);}
});
const stableApp=app(stable.path,101),canaryApp=app(canary.path,202);
const applications=[stableApp,canaryApp];
const canaryExecutable=canary.path+'/Contents/MacOS/DiscordClient';
runner.ObjC={unwrap:value=>value.value||value};
runner.Ref=()=>[{localizedDescription:'Launch denied'}];
runner.$={
    NSWorkspace:{sharedWorkspace:{
        runningApplications:{count:applications.length,objectAtIndex:index=>applications[index]},
        openURL(url){assert.equal(url,canary.path);restored++;return true;}
    }},
    NSHomeDirectory:()=>'/Users/example',
    NSBundle:{bundleWithPath:bundle=>({
        isNil:()=>![stable.path,canary.path].includes(bundle),
        executablePath:{isNil:()=>false,value:bundle+'/Contents/MacOS/DiscordClient'}
    })},
    NSFileManager:{defaultManager:{isExecutableFileAtPath:()=>true}},
    NSDate:{dateWithTimeIntervalSinceNow:seconds=>seconds},
    NSRunLoop:{currentRunLoop:{runUntilDate(seconds){fakeNow+=seconds*1000;quitPids.forEach(pid=>terminated.add(pid));}}},
    NSURL:{fileURLWithPath:value=>value},
    NSFileHandle:{fileHandleWithNullDevice:{}},
    NSTask:{alloc:{get init(){return{
        processIdentifier:303,
        get running(){return !launchFails&&staysRunning;},terminationStatus:42,
        launchAndReturnError(){
            assert.ok(terminated.has(202),'Wait for the selected app to exit');
            assert.ok(!terminated.has(101),'Keep the other client running');
            assert.equal(this.executableURL,canaryExecutable);
            assert.deepEqual(Array.from(this.arguments),['--remote-debugging-port=9224']);
            for(const key of ['standardInput','standardOutput','standardError'])assert.equal(this[key],runner.$.NSFileHandle.fileHandleWithNullDevice);
            launches++;return !launchFails;
        }
    };}}}
};
runner.getListeners=()=>[{pid:101,port:9222},{pid:303,port:9224}];
runner.execute=(program,argv)=>{assert.equal(program,'/bin/ps');return canaryExecutable;};
runner.fetchText=(url,timeout,allowFailure)=>{
    assert.equal(url,'http://127.0.0.1:9224/json/version');
    assert.ok(timeout<=2);
    assert.equal(allowFailure,true);
    return ++probes>=readyAfter?JSON.stringify({Browser:'Chrome','Protocol-Version':'1.3'}):null;
};
const selected=()=>runner.chooseClient(runner.getClients(),'canary');
runner.startDiscord(selected(),9224,fakeNow+60000);
assert.equal(launches,1);assert.equal(probes,2);assert.equal(restored,0);
assert.deepEqual(quitPids,[202]);
readyAfter=Infinity;probes=0;
assert.throws(()=>runner.startDiscord(selected(),9224,fakeNow+60000),/60-second limit/);
assert.equal(restored,0,'Do not reopen a client that is still running');
staysRunning=false;probes=0;
assert.throws(()=>runner.startDiscord(selected(),9224,fakeNow+60000),/exited during startup \(status 42\)/);
assert.equal(restored,1);
launchFails=true;
assert.throws(()=>runner.startDiscord(selected(),9224,fakeNow+60000),/Could not launch Discord Canary: Launch denied/);
assert.equal(restored,2);
assert.throws(()=>runner.startDiscord({instances:2},9224,fakeNow+60000),/multiple instances/);
launchFails=false;staysRunning=true;
runner.execute=()=>canaryExecutable+' --user-data-dir=/Users/example/other';
assert.throws(()=>runner.startDiscord(selected(),9224,fakeNow+60000),/custom profile/);

// Exercise the real run flow with two ports and two renderer windows, without a network connection.
runner.ObjC.import=()=>{};
runner.getClients=()=>[stable,canary];
runner.getListeners=()=>[{pid:101,port:9222},{pid:202,port:9444}];
runner.confirmScript=()=>true;
let connected,expression,copied;
runner.copy=value=>{copied=value;};
runner.connect=url=>{connected=url;return{evaluate(code){if(code==='typeof webpackChunkdiscord_app')return 'object';expression=code;return 'offline-token';},close(){}};};
requested=[];
runner.fetchText=url=>{
    requested.push(url);
    if(url.endsWith('/d/list'))return JSON.stringify([{name:'token',category:'Discord',source:'/d/c/token',runner:'/d/p/token'}]);
    if(url.endsWith('/d/c/token'))return '"offline-token"';
    assert.ok(url.startsWith('http://127.0.0.1:9444/'),'Only use the selected client endpoint');
    if(url.endsWith('/json/version'))return JSON.stringify({Browser:'Chrome','Protocol-Version':'1.3'});
    return JSON.stringify(['AAA','BBB'].map(id=>({type:'page',title:id,url:'https://discord.com/channels/@me',webSocketDebuggerUrl:'ws://127.0.0.1:9444/devtools/page/'+id})));
};
runner.readLine=()=>{fakeNow+=120000;return '2';};
runner.run(['token','--client','canary']);
assert.equal(connected,'ws://127.0.0.1:9444/devtools/page/BBB');
assert.equal(copied,'offline-token');
assert.ok(expression.includes('riyoScriptApproved="token"'));
assert.ok(!requested.some(url=>url.includes(':9222/')));
console.log('PASS: all script wrappers, client/PID/window choices, port isolation, targeted native restarts, startup timeout and recovery.');
