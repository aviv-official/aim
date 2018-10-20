import {encrypt,decrypt} from "./encryption.js";
import {Wallet} from "./wallet.js";
import {WebRTC} from "./webrtc.js";
import {Ansible} from "./ansible.js";
import {BASE64,BASE75,convert} from "./basecvt.js";
//When messages are received they are added to the msgQ, but they are only processed when the window is idle
window.msgQ = [];

export default class BackGroundApp{
    constructor(){
        this.ports = {};
        chrome.runtime.onConnect.addListener((port)=>{
            console.debug("page opened: ",port);
            port.onDisconnect.addListener((evt) => this.onPortClose(evt));
            this.ports[port.name] = port;
            port.onMessage.addListener((evt)=> this.onAppMsg(evt));
            //port.postMessage({alive:true});
        });
        chrome.idle.onStateChanged.addListener((state) =>this.onStateChanged(state));
        this.alphabet = new Array( 26 ).fill( 1 ).map( ( _, i ) => String.fromCharCode( 65 + i ) );
        this.init();
    }

    async init(){
        this.wallet = await new Wallet();
        this.webRTC = await new WebRTC();
        this.ansible = await new Ansible(this);
    }

    
    onPortClose(evt){
        console.debug("page closed: ",evt);
        delete this.ports[evt.name];
    }

    async onAppMsg(evt){
        console.debug(evt);
        //This is potentially dangerous and should be refactored, perhaps switch on evt.func and also check for priviledges
        if(evt.func){
            let result = {};
            
            result.returnVal = await this[evt.func](evt.params);
            result.func = evt.func;
            if(evt.source){
                this.ports[evt.source].postMessage(result);
            }
        }
    }
    async changeMnemonic(mnemonic){
        await this.wallet.onMnemonicChanged(mnemonic);
        this.ansible = await new Ansible(this);
    }
    onStateChanged(state){
        console.log("StateChanged: ",state);
        if(state == "idle" || state == "locked"){
            window.idle = true;
            console.log("System is idle, starting work tasks now");
            this.start();
        }else{
            console.log("System is active, pausing all work now");
            this.pause();
        }
    }

    async start(){
        while(window.idle && window.msgQ.length){
            this.processMsg(window.msgQ.shift());
        }
        if(window.idle){
            //console.debug("Message Q now empty");
            await this.sleep(1000);
            this.start();
        }
    }

    pause(){
        window.idle = false;
    }

    getKey(){
        let privKeyUTF8 = window.wallet[0].privateKey;
        let bytes = nacl.util.decodeUTF8(privKeyUTF8);
        return nacl.util.encodeBase64(bytes);
    }

    decrypt(cipher){
        //Sometimes what we get back from ansible is base16 encoded, no idea why
        if(cipher.startsWith('0x')){
            cipher = btoa(cipher.match(/\w{2}/g).map(function(a){return String.fromCharCode(parseInt(a, 16));} ).join(""))
        }
        console.debug("decrypting: ",cipher);
        return decrypt(cipher,this.getKey());
    }
    newPasswd(params){
        let hostname = params.hostname;
        let username = params.username;
        let passwords = {};
        let password = "";
        let key = this.getKey();
        if(localStorage[hostname]){
            passwords = this.decrypt(localStorage[hostname]);
        }    
        password = this.wallet.newKey();
        password = password.replace("0x",'');
        password = convert(password,BASE64,BASE75);
        passwords[username] = password;
        localStorage[hostname] = encrypt(passwords,key);
        let ret = {};
        ret[username] = password;
        let anskey = encrypt(hostname,this.getKey());
        
        let ansval = localStorage[hostname];
        this.ansible.set(anskey,ansval);
        return ret;
    }
    
    base64toHex(base64) {
        return window.atob(base64)
                .split('')
                .map(function (aChar) {
                    return ('0' + aChar.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
                .toLowerCase();
    }

    passwdList(hostname){
        let passwords = {};
        if(localStorage[hostname]){
            passwords = this.decrypt(localStorage[hostname]);
        }
        return passwords;
    }

    showNotify(msg){
        let notifyOptions = {
            type: "basic",
            iconUrl : "images/android-chrome-72x72.png",
            title : "AVIV Information",
            message : msg,
        }
        let notice = chrome.notifications.create(null, notifyOptions);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchNodeList(){
        console.debug("Requesting updated list of active nodes...");
        let params = {
            method: 'GET',
            cache: 'default'
        };
        let response = await fetch("https://0hidwxfvzg.execute-api.us-east-1.amazonaws.com/Prod/register",params);
        //console.log(response);
        let nodeList;
        if(response.ok){
            nodeList = await response.json();
        }
        console.debug("Active Nodes: ",nodeList);
        localStorage['nodeList'] = JSON.stringify(nodeList);
        //TODO: Open a listener and attempt to connect to nodes in nodeList
    }
    
    async updateProgress(value){
        window.loadProgress = value;
        notifyOptions.progress = value;
        if(window.currentNotify){
            chrome.notifications.update(window.currentNotify, notifyOptions);
            if(value >= 100){
                await this.sleep(1000);
                chrome.notifications.clear(window.currentNotify);
            }
            console.debug("progress: ",value);
        }
    }
}

window.backgroundApp = new BackGroundApp();
window.backgroundApp.start();
setInterval(async()=>{
    window.backgroundApp.fetchNodeList();
},1000 * 60 * 60);