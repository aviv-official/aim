const mints = ["http://localhost:8080"];

const ice = [
    {urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
    {urls:'stun:stun.stunprotocol.org:3478'},
    {urls:'stun:108.177.98.127:19302'},
    {urls:'stun:[2607:f8b0:400e:c06::7f]:19302'},
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'stun:stun2.l.google.com:19302'},
    {urls:'stun:stun3.l.google.com:19302'},
    {urls:'stun:stun4.l.google.com:19302'}
];

const config = { iceServers: ice };

export class WebRTC{
    constructor(uuid,app){
        this.uuid = uuid;
        this.peers = {};
        this.messages = [];
        localStorage['p2pCount'] = 0;
        this.app = app;
    }

    startup(mint,channel){
        this.socket = io.connect(mint, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 10000,
            reconnectionDelayMax : 50000,
            reconnectionAttempts: 99999
        });

        this.socket.on( 'connected', (data)=>{
            console.debug( 'got "connected" message from signaling server: ',data );
            for(let clientId of data.allClientIds){ 
                let p = this.peers[clientId] = new SimplePeer({
                    config: config,
                    initiator: true,
                    objectMode : true,
                    channelName: channel
                });
                p.rtt = 0;
                this.addPeerListeners( p, clientId );
            }
        });

        this.socket.on( 'new_peer', (data)=>{
            let p = this.peers[data.newPeerId] = new SimplePeer({
                initiator: false,
                channelName: channel
            });
            this.addPeerListeners( p, data.newPeerId );
        });

        this.socket.on( 'signal', (data)=>{
            console.log( 'got signal: ',data);
            if( this.peers[data.senderId] && this.self !== data.senderId) {
                this.peers[data.senderId].signal( JSON.stringify(data) );
            }
        });

        this.socket.on('self',(data)=>{
            console.debug("got self: ",data);
            this.self = data;
        });
    }
 
    addPeerListeners( p, peerId ){
        p.on('error', (err)=>{ 
            console.debug(err);
            if(JSON.stringify(err).includes("connection failed")){
                this.socket.emit('list',{});
            }
        });
    
        p.on('signal', (data)=>{
          data.receiverId = peerId;
          //console.log('SIGNAL', JSON.stringify(data));
          this.socket.emit( 'signal', data );
        });
    
        p.on('connect',async (evt)=>{
          console.log(`WebRTC connection established with ${peerId}`);
          localStorage['p2pCount'] = parseInt(localStorage['p2pCount']) + 1;
        });
    
        p.on('data',async (data)=>{
            
            if(typeof data !== "string"){
                data = new TextDecoder("utf-8").decode(data);
            }
            
            data = JSON.parse( data );

            //TODO:  Data should be validated here, data.id == validate(data)
            if(!data || ! await this.app.verifyMsg(data)){
                console.debug("validation failed for: ",data);
                return;
            }else{
                console.debug("validation passed for: ",data);
            }

            //Where data.id = sha256 hash of all fields of the message except id, in an alpha sort
            //Should also validate the sig matches the data.requestor field 
            //this.messages.push(data);
            if(data.ping){
                if(!data.pong){
                    data.pong = Date.now();
                    //Need to prepareMsg before sending
                    data = await this.app.prepMsg(data);
                    p.send(JSON.stringify(data));
                    return;
                }else{
                    let rtt = Math.abs(Date.now() - data.ping);
                    if(!p.rtt){
                        p.rtt = 500;
                    }
                    p.rtt += rtt;
                    p.rtt = Math.floor(p.rtt / 2);
                    console.debug(`${p.remoteAddress}:${p.remotePort} rtt: ${p.rtt}`);
                }
            }else{
                console.debug( ' received data: ',data );
            }
        });
    
        p.on( 'close', ()=>{
            console.debug(`Connection to ${peerId} is closed`);
            localStorage['p2pCount'] = 0 > parseInt(localStorage['p2pCount']) - 1 ? 0 : parseInt(localStorage['p2pCount']) - 1;
            delete this.peers[peerId];
        });
    }

    async sendDataToPeers(data) {
        // will send the data to every single peer in the network
        //This is a blind send, need to filter perhaps for data seen

        console.log("broadcasting: ",data);
        console.log("peers: ",this.peers);
        let dataStr = JSON.stringify(data);
        for(let peer of Object.getOwnPropertyNames(this.peers) ) {
            try {
                console.debug(`Sending ${dataStr} to ${peer}`);
                this.peers[peer].send(dataStr);
            } catch( error ) {
                console.debug(error);
                delete this.peers[peer];
            }
        }
    }
}