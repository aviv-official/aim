let port = null;
let hostname = null;
let modal = document.getElementById("modal");
let readyBtn = document.getElementById("readyBtn");
let closeBtn = document.getElementById("closeBtn");
let newBtn = document.getElementById("newBtn");
window.onload = ()=>{
    chrome.tabs.query({active : true}, (tabs)=>{
        let tab = tabs[0];
        console.log("active tab is: ",tab);
        const url = new URL(tab.url);
        hostname = url.hostname;
        console.log("hostname: ",hostname);
        port = chrome.runtime.connect({name: hostname});
        port.onMessage.addListener(onPasswdCallback);
        port.postMessage({func: "passwdList", params: hostname, source: hostname});
        
        newBtn.addEventListener('click',(evt)=>{modal.style.display = "block";});
        closeBtn.addEventListener('click',()=>{
            modal.style.display = "none";
        })
        readyBtn.addEventListener('click',(evt)=>onNewID(evt));
    });
}

function doCopy(evt){
    console.log("copy function goes here: ",evt);
    let src = evt.srcElement;
    let x=0;
    while(!src.getAttribute('data-id') && x++ < 10){
        src = src.parentElement;
    }
    let elID = src.getAttribute('data-id');
    console.debug("elID: ",elID);
    let el = document.querySelector(`#${elID}`);
    console.debug("el: ",el);
    if(!el || !el.value){
        return;
    }
    navigator.permissions.query({name: "clipboard-write"}).then(result => {
        if (result.state == "granted" || result.state == "prompt") {
            navigator.clipboard.writeText(el.value)
            .then(()=>{
                console.debug("wrote to clipboard");
                alert("Password for "+hostname+" written to clipboard");
            })
            .catch((err)=>{
                el.select();
                document.execCommand("copy");
                alert("Password for "+hostname+" is now on the clipboard");
            });
        }
    });
}

function newPassword(evt){
    modal.style.display = "block";
    /*
    console.log("newPassword: ",evt);
    let username = prompt(`Please enter a username for ${hostname} or leave empty if you only have one account at this site`,"default");
    if(!username){
        return;
    }
    port.postMessage({func: "newPasswd", params: {hostname: hostname, username:username}, source: hostname});
    */

    
}

function onNewID(evt){
    console.log("evt: ",evt);
    let username = document.getElementById("ident").value;
    port.postMessage({func: "newPasswd", params: {hostname: hostname, username:username}, source: hostname});
    modal.style.display = "none";
}

function appendPassword(msg){
    let el = document.createElement("p");
    el.innerHTML = `<label for "${msg.username}">${msg.username} on ${hostname}</label><br>
    <input type="password" id="${msg.username}-${hostname.replace(/\./g,"-")}" value="${msg.password}">`;
    let btn = document.createElement("button");
    btn.innerHTML = `<i class="far fa-clipboard"></i>`;
    btn.setAttribute('data-id',`${msg.username}-${hostname.replace(/\./g,"-")}`);
    btn.setAttribute('title',`Copy password for ${msg.username} to clipboard`);
    btn.addEventListener('click',doCopy);
    el.appendChild(btn);

    let main = document.querySelector('main');
    main.appendChild(el);
}

function onPasswdCallback(msg){
    console.log("onPasswdCallback: ",msg);
    let pairs = msg.returnVal;
    for(key of Object.getOwnPropertyNames(pairs)){
        let pair = {};
        pair.username = key;
        pair.password = pairs[key];
        appendPassword(pair);
    }
}
modal.style.display = "none";
