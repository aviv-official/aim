const providers = {
    mainnet : "wss://mainnet.infura.io/ws",
    rinkeby : "wss://rinkeby.infura.io/ws"
}

export class Wallet{
    constructor(){
        this.connectToBlockchain(providers.rinkeby);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    newWallet(seedHex){
        let password = window.web3.utils.soliditySha3(seedHex,seedHex,1);
        let key = window.web3.utils.soliditySha3(seedHex);
        let wallet = window.web3.eth.accounts.wallet.create();
        wallet.clear();
        wallet.add(key);
        wallet.save(password);
        window.wallet = wallet;
    }
    
    loadWallet(){
        //TODO:  Require user to set a PIN for this ?
        let seedHex = bip39.mnemonicToSeedHex(localStorage['mnemonic']);
        let password = window.web3.utils.soliditySha3(seedHex,seedHex,1);
        window.wallet = window.web3.eth.accounts.wallet.load(password);
    }

    saveWallet(){
        let seedHex = bip39.mnemonicToSeedHex(localStorage['mnemonic']);
        let password = window.web3.utils.soliditySha3(seedHex,seedHex,1);
        window.wallet.save(password);
    }

    createMnemonic(wordlist){
        //TODO: Allow option for user to choose a wordlist
        return bip39.generateMnemonic();
    }

    newKey(){
        let accounts = window.wallet;
        let lastAcct = accounts[accounts.length -1];
        console.debug("lastAcct: ",lastAcct);
        let newAcctKey = window.web3.utils.soliditySha3(lastAcct.privateKey,accounts.length);
        window.wallet.add(newAcctKey);
        this.saveWallet();
        return(window.wallet[window.wallet.length-1].address);
    }

    onMnemonicChanged(mnemonic){
        if(confirm("Clear All Settings?")){
            localStorage.clear();
        }
        localStorage['mnemonic'] = mnemonic;
        console.log("mnemonic: ",mnemonic);
        let seedHex = bip39.mnemonicToSeedHex(mnemonic);
        this.newWallet(seedHex)
    }

    async connectToBlockchain(provider){
        try{
            window.web3 = new Web3(provider);
            console.debug("window.web3: ",window.web3);
            this.web3 = window.web3;
            if(!localStorage.mnemonic){
                //TODO:  Add an option for user to generate their own entropy by uploading a "keyfile", but this is good enough for now
                let mnemonic = await this.createMnemonic();
                await this.onMnemonicChanged(mnemonic);
            }else{
                await this.loadWallet();
                console.debug("Wallet Loaded!");
                window.setInterval(this.getBalance,30000);
            }
            await this.beg();
        }catch(err){
            //Sometimes the provider is unavailable, sleep it off and try again
            console.debug(err);
            await this.sleep(1000);
            this.connectToBlockchain(provider);
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

    async getBalance(){
        let balance = await window.web3.eth.getBalance(window.wallet[0].address);
        console.debug("Current balance is ",balance);
    }
}
