import {encrypt,decrypt} from "./encryption.js";
import {Wallet} from "./wallet.js";
import {WebRTC} from "./webrtc-signaling.js";
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
        });
        chrome.idle.onStateChanged.addListener((state) =>this.onStateChanged(state));
        this.init();
    }

    async init(){
        this.wallet = await new Wallet();
        this.webRTC = await new WebRTC(this.getKey(),this);
        this.webRTC.startup("http://18.233.9.2:8080/","lobby");
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
        let promises = [];
        console.debug(`Have ${window.msgQ.length} messages to process`);
        while(window.idle && window.msgQ.length){
            promises.push(this.webRTC.sendDataToPeers(window.msgQ.shift()));
        }
        await Promise.all(promises);
        if(window.idle){
            console.debug("Message Q now empty");
            await this.sleep(10000);
            let ping = await this.timeNow();
            window.msgQ.push(ping);
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

    async timeNow(){
        return await this.prepMsg({ping: Date.now()});
    }

    async prepMsg(msg){
        if(msg.id){
            msg.topic = msg.id;
            delete msg.id;
        }
        if(!msg.version){
            msg.version = "1.0";
        }
        if(!msg.authority){
            msg.authority = [];
        }
        msg.worker = window.wallet[0].address;
        msg.id = await this.obj2ID(msg);
        if(!msg.topic){
            msg.topic = msg.id;
        }
        let poa = {
            id : msg.topic+"."+msg.id+"."+Date.now(),
            signer : window.wallet[0].address
        };
        poa.sig = await this.wallet.web3.eth.sign(poa.id,poa.signer);
        msg.authority.push(poa);
        return msg;
    }

    async verifyMsg(msg){
        switch(msg.version){
            case "1.0" : {
                return await this.verifyV1_0(msg);
            }
        }
        return false;
    }

    async verifyV1_0(msg){
        
        //Step 1: Verify the sig matches the id for most recent poa
        let poa = msg.authority[msg.authority.length-1];
        let sig = poa.sig;
        let id = poa.id;
        let signer = poa.signer;
        let msgId = poa.id.split('.')[1];
        let isValid = (msgId == msg.id);
        if(isValid){
            isValid = await this.sigVerify1_0(id,sig,signer);
            if(isValid){
                //Step 2: Verify the hash matches the content sans meta-data
                id = await this.obj2ID(msg);
                isValid = (msg.id == id);
                if(!isValid){
                    console.debug("id does not match contents");
                }
            }else{
                console.debug("signature verification failed");
            }
        }else{
            console.debug("msg.id mistmatch");
        }
        return isValid;
    }

    async sigVerify1_0(msg,sig,addr){
        try{
            let fromAddr = await window.web3.eth.accounts.recover(msg,sig);
            return fromAddr == addr;
        }catch(err){
            console.debug(err);
            return false;
        }
    }

    async obj2ID(obj){
        let cpy = Object.assign({},obj);
        delete cpy.id;
        delete cpy.topic;
        delete cpy.authority;
        delete cpy.worker;
        delete cpy.version;
        let props = Object.getOwnPropertyNames(cpy);
        props = props.sort();
        let val = "";
        for(let propName of props){            
            val += `${propName}=${JSON.stringify(cpy[propName])}`;
        }
        console.debug("val: ",val);
        let id = await this.wallet.web3.utils.soliditySha3(val);
        console.debug("id: ",id);
        return id;
    }
}

window.backgroundApp = new BackGroundApp();
window.backgroundApp.start();