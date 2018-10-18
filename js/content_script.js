let hostname = document.location.hostname;
console.log("aviv: ",hostname);
let port = chrome.runtime.connect({name: hostname});


function addToClipboard(value){
    navigator.permissions.query({name: "clipboard-write"}).then(result => {
        if (result.state == "granted" || result.state == "prompt") {
            navigator.clipboard.writeText(value)
            .then(()=>{
                console.debug("wrote to clipboard")
            })
            .catch((err)=>{
                //Fallback
                console.debug("There was a failure writing to clipboard, trying fallback");
                let el = document.createElement("input");
                document.body.appendChild(el);
                el.value = value;
                setTimeout(()=>{
                    el.select();
                    document.execCommand("copy");
                    console.debug("el: ",el);
                    alert(el.value+" is now on the clipboard");
                },1000);
            });
        }
    });  
}
port.onMessage.addListener(async function(msg) {
    console.debug("msg: ",msg);
    if(msg.action == "password"){
        addToClipboard(msg.value);
    }
});

port.postMessage({type: "alive",hostname : hostname});
function getPassword(){
    port.postMessage({func: "getPassword", params: [hostname]});
}


//TODO:  Scan DOM looking for a creator ID, inject vote button if found

//TODO:  If found and clicked, check social media contract for this creation and this person, if not found, add to user's ap feed.

//TODO:  Look for aviv:// urls, examine cache, download manifest, download chunks