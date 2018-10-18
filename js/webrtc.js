const dataChannelOptions = {ordered: true};

const configuration = {iceServers: [
{urls:'stun:stun.stunprotocol.org:3478'},
{urls:'stun:108.177.98.127:19302'},
{urls:'stun:[2607:f8b0:400e:c06::7f]:19302'},
{urls:'stun:stun.l.google.com:19302'},
{urls:'stun:stun1.l.google.com:19302'},
{urls:'stun:stun2.l.google.com:19302'},
{urls:'stun:stun3.l.google.com:19302'},
{urls:'stun:stun4.l.google.com:19302'}]};

const reservedIP = /(^127\.)|(^192\.168\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^::1$)|(^[fF][cCdD])/

export class WebRTC{
    constructor(){
        this.setupWebRTC();
    }
    async setupWebRTC(){
        this.localPeerConnection = new RTCPeerConnection(configuration);
        //this.localPeerConnection = new RTCPeerConnection();
        console.log('Created local peer connection object localPeerConnection: ',this.localPeerConnection);
        this.localPeerConnection.onicecandidate = e => this.onIceCandidate(this.localPeerConnection, e);
        this.sendChannel = this.localPeerConnection.createDataChannel('sendDataChannel', dataChannelOptions);
        this.sendChannel.onopen = this.onSendChannelStateChange;
        this.sendChannel.onclose = this.onSendChannelStateChange;
        this.sendChannel.onerror = this.onSendChannelStateChange;
        this.remotePeers = {};
        this.createOffer();
    }

    onSendChannelStateChange(evt){
        console.log("send channel statechange: ",evt);
    }

    onAddIceCandidateError(error) {
        console.debug("Failed to add Ice Candidate: ",error);
    }

    onAddIceCandidateSuccess() {
        console.log('AddIceCandidate success.');
    }

    getName(pc) {
        return (pc === this.localPeerConnection) ? 'localPeerConnection' : 'remotePeerConnection';
    }

    getOtherPc(pc) {
        return (pc === this.localPeerConnection) ? this.remotePeerConnection : this.localPeerConnection;
    }

    async createOffer() {
        try {
          const offer = await this.localPeerConnection.createOffer();
          this.localPeerConnection.setLocalDescription(offer);
          console.log("Our offer is: ",offer);
        }catch(err){
          console.error("Error: ",err);
        }
    }

    onIceCandidate(pc, event) {
        //Got an ice candidate
        if(event.candidate){
            let candidate = event.candidate;
            if(candidate.ip && !reservedIP.test(candidate.ip)){
                console.debug("ICE Candidate: ",candidate.toJSON());
                console.log(candidate.ip+ " is public!");
                //TODO:  Broadcast this!
            }
        }
    }

    //used during peerDiscovery by background process
    async onPeerFound(name,candidate){
        let peer = new RTCPeerConnection();
        try{
            await peer.addIceCandidate(candidate);
            await peer.addIceCandidate({candidate:''});
            this.remotePeers[name] = peer;
        }catch(err){
            console.warn(err);
        }
    }
    broadcast(msg){
        let workers = Object.getOwnPropertyNames(this.remotePeers);
        for(let worker of workers){
            //this.remotePeers[worker].sendChannel.
        }
    }
}