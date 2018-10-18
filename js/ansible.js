const ansibleAddr = "0x95c12906e7df9931431aa849d1f518d0a8f2ac0a";
const providers = {
    rinkeby : "wss://rinkeby.infura.io/ws"
}
export class Ansible{
    constructor(app){
        this.app = app;
        this.init(providers.rinkeby);
    }
    async init(provider){
        try{
            this.web3 = this.app.wallet.web3;
            let ansibleABI = await(await fetch('./js/ansible.abi.json')).json();
            this.ansible = await new this.web3.eth.Contract(ansibleABI,ansibleAddr);
            //Read from contract...
            console.debug("ANSIBLE: ",this.ansible);
            let fromBlock = 3170085;
            let params = {fromBlock : fromBlock};
            let events = await this.ansible.getPastEvents("ValueSet",params);
            this.onEvent(events);
        }catch(err){
            console.debug(err);
            setTimeout(()=>{
                console.debug("Lost connection to provider, re-initializing app");
                this.init(provider);
            },60000);
        }
        //this.ansible.events.allEvents(null,(evt)=> this.onEvent(evt));
    }

    async set(key,value){
        let addr = window.wallet[0].address;
        try{
            let gas = await this.ansible.methods.set(addr,key,value).estimateGas({from: addr});
            console.debug("gas to store "+key+" = "+value+" is "+gas);
            let result = await this.ansible.methods.set(addr,key,value).send({from: addr, gas: gas});
            console.debug("result of send: ",result);
        }catch(err){
            console.debug(err);
            //Most likely we ran out of money, try to beg, wait a minute and try again.
            await this.beg();
            setTimeout(()=>{
                this.set(key,value);
            },60000);
            alert(err);
        }
    }

    async get(key,addr){
        if(!addr){
            addr = window.wallet[0].address;
        }
        console.debug("fetching "+key+" for "+addr);
        let val = await this.ansible.methods.get(addr,key).call();
        console.debug("val: ",val);
        return val; 
    }

    async onEvent(evts){
        console.debug("evt: ",evts);
        if(evts.length){
            for(let event of evts){
                this.processEvent(event);
            }
        }else{
            this.processEvent(evts);
        }
    }

    async processEvent(event){
        
        try{
            switch(event.event){
                case "ValueSet" : {
                    let values = event.returnValues;
                    if(values.account == window.wallet[0].address){ 
                        //First check key, for some reason it can be base16 encoded, I have no idea why
                        let key = values.key;
                        //Request the most recent version of this from ansible instead of inserting what may be an outdated value
                        let value = await this.get(key);
                        if(!value){
                            console.debug("no value for ",key," relying on event value");
                            value= values.value;
                        }
                        console.debug("value is ",value);
                        try{
                            key = this.app.decrypt(key);
                        }catch(err){
                            console.debug("key: ",key," could not be decrypted possible plaintext or a hash, verify integrity of ",value);
                            try{
                                console.debug("Attempting to decrypt: ",value);
                                let val = this.app.decrypt(value);
                                console.debug("The encrypted value, decrypted successfully!");
                                console.debug("value: ",val);
                            }catch(err){
                                console.debug("both key and value failed decryption, discarding!");
                                return;
                            }
                        }
                        console.log("Setting "+key+" to "+value);
                        localStorage[key] = value;
                    }
                }
            }
            if(event.blockNumber > localStorage['lastEvtBlk']){
                localStorage['lastEvtBlk'] = event.blockNumber;
            }
        }catch(err){
            console.debug(err);
        }
        
    }
    async beg(){
        let addr = window.wallet[0].address;
        try{
            let response = await fetch("http://rinkeby-faucet.com/send?address="+addr);
            if(response.ok){
                let body = await response.text();
                console.debug("beg: ",body);
            }
        }catch(err){
            console.debug("The error below is for reference only and has no significance unless it reads 404");
            console.debug(err);
        }
    }
    
}