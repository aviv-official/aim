console.log("options loading");
async function onLoad(){
    console.log("options loaded");
    let mnemonicArea = document.getElementById('mnemonic-area');
    this.mnemonicArea = mnemonicArea;
    mnemonicArea.innerText = localStorage.mnemonic;
    mnemonicArea.onchange = mnemonicChanged;

    let wallet = JSON.parse(localStorage.web3js_wallet);
    let address = wallet[0].address;
    let addressArea = document.getElementById('address-area');
    addressArea.innerText = "0x"+address;
    /*
    let genSeedBtn = document.getElementById("gen-seed-btn");
    genSeedBtn.onclick = mnemonicChanged;
    */
}

async function mnemonicChanged(evt){
    console.log("user wishes to change mnemonic: ",evt);
    //Update the mnemonic, delete old wallet, set new wallet
    let port = chrome.runtime.connect({name: "options.js"});
    let p = {
        func: "changeMnemonic",
        params : evt.srcElement.value
    }
    port.postMessage(p);
}
onLoad();